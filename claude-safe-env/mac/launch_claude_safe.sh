#!/usr/bin/env bash
# macOS 安全启动 Claude 脚本：先验 Clash Verge / 出口 IP，通过后再拉起隔离版 Chrome 与 Claude Desktop。
# 用法:
#   bash launch_claude_safe.sh            # 安检通过后启动隔离 Chrome + Claude Desktop
#   bash launch_claude_safe.sh --check    # 仅做环境安检

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/local.env"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

CHECK_ONLY=0
if [[ "${1:-}" == "--check" ]]; then
  CHECK_ONLY=1
fi

EXPECTED_IP="${CLAUDE_EXPECTED_IP:-}"
if [[ -z "$EXPECTED_IP" || "$EXPECTED_IP" == "REPLACE_WITH_US_IP" ]]; then
  echo "[WARN] 未设置 CLAUDE_EXPECTED_IP（可在 $ENV_FILE 中填写，当前仅校验 loc=US）"
  EXPECTED_IP=""
fi

alert_and_exit() {
  local msg="$1"
  echo "[BLOCKED] $msg" >&2
  if command -v osascript >/dev/null 2>&1; then
    osascript -e "display alert \"Claude 网络安检未通过\" message \"$msg\" as critical" >/dev/null 2>&1 || true
  fi
  exit 2
}

# 1. 检查 Clash Verge / Mihomo 是否在运行
if ! pgrep -if "verge-mihomo|Clash Verge" >/dev/null 2>&1; then
  alert_and_exit "未检测到 Clash Verge 或 Mihomo 内核运行，已禁止启动 Claude。"
fi

# 2. 若设置了 Clash external-controller (HTTP)，校验 mode=rule 与 AI 策略组
# 默认探测 Clash Verge 常见本地控制端口或通过 env CLAUDE_MIHOMO_API 指定
MIHOMO_API="${CLAUDE_MIHOMO_API:-}"
if [[ -n "$MIHOMO_API" ]]; then
  AUTH_HEADER=()
  if [[ -n "${CLAUDE_MIHOMO_SECRET:-}" ]]; then
    AUTH_HEADER=(-H "Authorization: Bearer ${CLAUDE_MIHOMO_SECRET}")
  fi
  CFG_JSON="$(curl -fsS --max-time 3 "${AUTH_HEADER[@]}" "${MIHOMO_API}/configs" 2>/dev/null || true)"
  if [[ -n "$CFG_JSON" ]]; then
    MODE="$(python3 -c 'import sys,json; print(json.loads(sys.stdin.read()).get("mode","").lower())' <<<"$CFG_JSON" 2>/dev/null || echo "")"
    if [[ -n "$MODE" && "$MODE" != "rule" ]]; then
      alert_and_exit "Clash Verge 当前运行模式为 '$MODE'，请先切换为 'rule' 模式。"
    fi
  fi
fi

# 3. 实测 claude.ai/cdn-cgi/trace（优先走系统 TUN，若设置了 CLAUDE_PROXY_URL 则走代理）
CURL_ARGS=(-fsS --max-time 10 -A "Mozilla/5.0")
if [[ -n "${CLAUDE_PROXY_URL:-}" ]]; then
  CURL_ARGS+=(-x "$CLAUDE_PROXY_URL")
fi

TRACE_OUT="$(curl "${CURL_ARGS[@]}" "https://claude.ai/cdn-cgi/trace" 2>/dev/null || true)"
if [[ -z "$TRACE_OUT" ]]; then
  alert_and_exit "无法访问 https://claude.ai/cdn-cgi/trace（若未开 TUN，请在 local.env 设置 CLAUDE_PROXY_URL=http://127.0.0.1:端口）。"
fi

TRACE_IP="$(awk -F= '/^ip=/{print $2}' <<<"$TRACE_OUT" | tr -d '\r')"
TRACE_LOC="$(awk -F= '/^loc=/{print $2}' <<<"$TRACE_OUT" | tr -d '\r')"

echo "=== Claude (macOS) 启动前环境安检 ==="
echo "  claude.ai 实测: ip=${TRACE_IP:-未知}, loc=${TRACE_LOC:-未知}"

if [[ "$TRACE_LOC" != "US" ]]; then
  alert_and_exit "claude.ai 实测地区为 '${TRACE_LOC}'（非 US），已禁止启动 Claude。"
fi

if [[ -n "$EXPECTED_IP" && "$TRACE_IP" != "$EXPECTED_IP" ]]; then
  alert_and_exit "claude.ai 实测出口 IP 为 '${TRACE_IP}'（非预期 '${EXPECTED_IP}'），已禁止启动 Claude。"
fi

echo "[PASS] 网络与分流环境全部正常。"
if [[ "$CHECK_ONLY" -eq 1 ]]; then
  exit 0
fi

# 4. 启动独立隔离 Chrome Profile（WebRTC 仅代理、en-US）
CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
CLAUDE_CHROME_DIR="$HOME/Library/Application Support/Google/Chrome-Claude-US"
mkdir -p "$CLAUDE_CHROME_DIR/Default"
if [[ ! -f "$CLAUDE_CHROME_DIR/Default/Preferences" ]]; then
  cat >"$CLAUDE_CHROME_DIR/Default/Preferences" <<'EOF'
{
  "intl": { "accept_languages": "en-US,en" },
  "webrtc": { "ip_handling_policy": "disable_non_proxied_udp" },
  "browser": { "has_seen_welcome_page": true }
}
EOF
fi

if [[ -x "$CHROME_BIN" ]]; then
  "$CHROME_BIN" \
    --user-data-dir="$CLAUDE_CHROME_DIR" \
    --webrtc-ip-handling-policy=disable_non_proxied_udp \
    --enforce-webrtc-ip-permission-check \
    --lang=en-US \
    --no-first-run \
    --no-default-browser-check \
    "https://claude.ai" >/dev/null 2>&1 &
  sleep 1
fi

if [[ -d "/Applications/Claude.app" ]]; then
  open -a "Claude"
else
  echo "[INFO] 未检测到 /Applications/Claude.app，已打开隔离版 Chrome 网页版。"
fi

#!/usr/bin/env bash
# macOS 安全启动 ChatGPT 脚本：
#   先调用 preflight_check.py 核验 Clash Verge (TUN / rule / IPv6 / 💬 ChatGPT 链路 / chatgpt.com & auth.openai.com 同出口)，
#   全部通过后再拉起隔离版 Chrome (Chrome-ChatGPT-US) 与 ChatGPT 桌面端。
#
# 用法:
#   bash mac/launch_chatgpt_safe.sh              # 安检通过后启动隔离 Chrome + ChatGPT.app
#   bash mac/launch_chatgpt_safe.sh --check      # 仅做环境安检
#   bash mac/launch_chatgpt_safe.sh --no-browser # 安检通过后仅启动 ChatGPT.app（不打开 Chrome）

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/local.env"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

CHECK_ONLY=0
NO_BROWSER="${CHATGPT_SKIP_BROWSER:-0}"

for arg in "$@"; do
  case "$arg" in
    --check)
      CHECK_ONLY=1
      ;;
    --no-browser)
      NO_BROWSER=1
      ;;
    -h|--help)
      echo "用法: $0 [--check] [--no-browser]"
      exit 0
      ;;
    *)
      echo "[ERROR] 未知参数: $arg" >&2
      exit 1
      ;;
  esac
done

set +e
CHECK_OUT="$(python3 "$SCRIPT_DIR/preflight_check.py" 2>&1)"
CHECK_RC=$?
set -e

echo "$CHECK_OUT"

if [[ $CHECK_RC -ne 0 ]]; then
  if command -v osascript >/dev/null 2>&1; then
    ALERT_MSG="$(printf '%s' "$CHECK_OUT" | tail -n 12 | tr '"' "'")"
    osascript -e "display alert \"ChatGPT 网络安检未通过\" message \"${ALERT_MSG}\" as critical" >/dev/null 2>&1 || true
  fi
  exit "$CHECK_RC"
fi

if [[ "$CHECK_ONLY" -eq 1 ]]; then
  exit 0
fi

CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROFILE_NAME="${CHATGPT_CHROME_PROFILE_NAME:-Chrome-ChatGPT-US}"
CHATGPT_CHROME_DIR="$HOME/Library/Application Support/Google/$PROFILE_NAME"

if [[ "$NO_BROWSER" != "1" ]]; then
  mkdir -p "$CHATGPT_CHROME_DIR/Default"
  if [[ ! -f "$CHATGPT_CHROME_DIR/Default/Preferences" ]]; then
    cat >"$CHATGPT_CHROME_DIR/Default/Preferences" <<'EOF'
{
  "intl": { "accept_languages": "en-US,en" },
  "webrtc": { "ip_handling_policy": "disable_non_proxied_udp" },
  "browser": { "has_seen_welcome_page": true }
}
EOF
  fi

  if [[ -x "$CHROME_BIN" ]]; then
    CHROME_ARGS=(
      "--user-data-dir=$CHATGPT_CHROME_DIR"
      "--webrtc-ip-handling-policy=disable_non_proxied_udp"
      "--enforce-webrtc-ip-permission-check"
      "--lang=en-US"
      "--no-first-run"
      "--no-default-browser-check"
    )
    if [[ -n "${CHATGPT_PROXY_URL:-}" ]]; then
      CHROME_ARGS+=("--proxy-server=$CHATGPT_PROXY_URL")
    fi
    CHROME_ARGS+=("https://chatgpt.com")

    "$CHROME_BIN" "${CHROME_ARGS[@]}" >/dev/null 2>&1 &
    sleep 1
  else
    echo "[WARN] 未找到 Google Chrome ($CHROME_BIN)，跳过启动隔离浏览器。"
  fi
fi

if [[ -d "/Applications/ChatGPT.app" ]]; then
  open -a "ChatGPT"
  echo "[OK] 已启动 ChatGPT 桌面端。"
else
  echo "[INFO] 未检测到 /Applications/ChatGPT.app，已打开隔离版 Chrome 网页版。"
fi

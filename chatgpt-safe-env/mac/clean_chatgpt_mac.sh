#!/usr/bin/env bash
# macOS 精准清理旧 ChatGPT 桌面端、Chrome Default 与可选 Keychain / Codex 账号缓存
# 目的：换号、重新登录或被 Cloudflare/风控拦截后消除旧设备/旧会话指纹残留，避免与新账号串线。
#
# 用法:
#   bash mac/clean_chatgpt_mac.sh                       # 清理 ChatGPT.app + Keychain + Chrome Default 中 OpenAI 痕迹
#   bash mac/clean_chatgpt_mac.sh --keep-keychain       # 保留 macOS Keychain 项
#   bash mac/clean_chatgpt_mac.sh --clean-isolated      # 同时清空 Chrome-ChatGPT-US 隔离配置目录
#   bash mac/clean_chatgpt_mac.sh --clean-codex         # 同时备份并清理 ~/.codex/auth.json

set -euo pipefail

KEEP_KEYCHAIN=0
CLEAN_ISOLATED=0
CLEAN_CODEX=0

for arg in "$@"; do
  case "$arg" in
    --keep-keychain)
      KEEP_KEYCHAIN=1
      ;;
    --clean-isolated)
      CLEAN_ISOLATED=1
      ;;
    --clean-codex)
      CLEAN_CODEX=1
      ;;
    -h|--help)
      echo "用法: $0 [--keep-keychain] [--clean-isolated] [--clean-codex]"
      exit 0
      ;;
    *)
      echo "[ERROR] 未知参数: $arg" >&2
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/local.env"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

if pgrep -x "Google Chrome" >/dev/null 2>&1; then
  echo "[ERROR] 请先完全退出 Google Chrome (Cmd+Q) 后再运行本脚本，否则 Cookies 数据库被锁定。"
  exit 1
fi
if pgrep -if "^/Applications/ChatGPT\.app|/ChatGPT$" >/dev/null 2>&1; then
  echo "[ERROR] 请先完全退出 ChatGPT 桌面客户端 (Cmd+Q) 后再运行本脚本。"
  exit 1
fi

BACKUP_DIR="$HOME/Desktop/chatgpt_mac_cleanup_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# 1. 清理 ChatGPT Desktop (com.openai.chat) 本地状态与会话缓存
echo "[1/4] 清理 ChatGPT 桌面端本地缓存与会话状态 (com.openai.chat)"

APP_SUPPORT="$HOME/Library/Application Support/com.openai.chat"
if [[ -d "$APP_SUPPORT" ]]; then
  cp -R "$APP_SUPPORT" "$BACKUP_DIR/ApplicationSupport_com.openai.chat"
  rm -rf "$APP_SUPPORT"
  echo "  已清理: $APP_SUPPORT"
fi

for target in \
  "$HOME/Library/Caches/com.openai.chat" \
  "$HOME/Library/HTTPStorages/com.openai.chat" \
  "$HOME/Library/HTTPStorages/com.openai.chat.binarycookies" \
  "$HOME/Library/WebKit/com.openai.chat" \
  "$HOME/Library/Saved Application State/com.openai.chat.savedState" \
  "$HOME/Library/Preferences/com.openai.chat.plist"; do
  if [[ -e "$target" ]]; then
    cp -R "$target" "$BACKUP_DIR/" 2>/dev/null || true
    rm -rf "$target"
    echo "  已清理: $target"
  fi
done

if [[ -d "$HOME/Library/Group Containers" ]]; then
  while IFS= read -r -d '' gc; do
    cp -R "$gc" "$BACKUP_DIR/" 2>/dev/null || true
    rm -rf "$gc"
    echo "  已清理 Group Container: $gc"
  done < <(find "$HOME/Library/Group Containers" -maxdepth 1 \( -iname "*com.openai.chat*" -o -iname "*openai*" \) -print0 2>/dev/null || true)
fi

# 2. 清理 macOS Keychain 中的 ChatGPT 登录凭据与加密缓存键
if [[ "$KEEP_KEYCHAIN" -eq 0 ]]; then
  echo "[2/4] 清理 macOS Keychain 中 com.openai.chat 相关凭据"
  REMOVED_KC=0
  for svc in "com.openai.chat" "com.openai.chat.conversations_v2_cache" "OpenAI" "ChatGPT"; do
    while security delete-generic-password -s "$svc" >/dev/null 2>&1; do
      REMOVED_KC=$((REMOVED_KC + 1))
    done
  done
  echo "  已移除 Keychain 通用密码条目数: $REMOVED_KC"
else
  echo "[2/4] 已跳过 Keychain 清理（--keep-keychain）"
fi

# 3. 清理 Chrome Default Profile 中的 ChatGPT / OpenAI 痕迹（保留其他网站）
CHROME_DEF="$HOME/Library/Application Support/Google/Chrome/Default"
if [[ -d "$CHROME_DEF" ]]; then
  echo "[3/4] 清理 Chrome Default 中的 ChatGPT/OpenAI Cookie 与本地记录"
  [[ -f "$CHROME_DEF/Cookies" ]] && cp "$CHROME_DEF/Cookies" "$BACKUP_DIR/Chrome_Default_Cookies.bak"
  python3 - "$CHROME_DEF" <<'PY'
import json, os, shutil, sqlite3, sys

ud = sys.argv[1]
PATTERNS = ("chatgpt", "openai", "oaistatic", "oaiusercontent", "oaistatsig", "auth0.openai")

def matches(text: str) -> bool:
    t = (text or "").lower()
    return any(p in t for p in PATTERNS)

cookies = os.path.join(ud, "Cookies")
if os.path.exists(cookies):
    con = sqlite3.connect(cookies)
    cur = con.execute(
        "DELETE FROM cookies WHERE host_key LIKE '%chatgpt%' OR host_key LIKE '%openai%' "
        "OR host_key LIKE '%oaistatic%' OR host_key LIKE '%oaiusercontent%' OR host_key LIKE '%oaistatsig%'"
    )
    con.commit()
    print("  删除 Chrome Cookies 条数:", cur.rowcount)
    con.close()

dips = os.path.join(ud, "DIPS")
if os.path.exists(dips):
    con = sqlite3.connect(dips)
    for (t,) in con.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall():
        cols = [c[1] for c in con.execute(f"PRAGMA table_info({t})").fetchall()]
        if "site" in cols:
            con.execute(
                f"DELETE FROM {t} WHERE site LIKE '%chatgpt%' OR site LIKE '%openai%' "
                f"OR site LIKE '%oaistatic%' OR site LIKE '%oaiusercontent%'"
            )
    con.commit()
    con.close()

idb = os.path.join(ud, "IndexedDB")
if os.path.exists(idb):
    for name in os.listdir(idb):
        if matches(name):
            shutil.rmtree(os.path.join(idb, name), ignore_errors=True)
            print("  移除 IndexedDB:", name)

nps = os.path.join(ud, "Network Persistent State")
if os.path.exists(nps):
    with open(nps, "r", encoding="utf-8") as f:
        d = json.load(f)
    props = d.get("net", {}).get("http_server_properties", {})
    for key in ("servers", "broken_alternative_services"):
        if isinstance(props.get(key), list):
            props[key] = [s for s in props[key] if not matches(json.dumps(s))]
    with open(nps, "w", encoding="utf-8") as f:
        json.dump(d, f)
PY
else
  echo "[3/4] 未找到 Chrome Default Profile，跳过。"
fi

# 4. 可选：清理隔离 Chrome Profile 与 Codex auth.json
PROFILE_NAME="${CHATGPT_CHROME_PROFILE_NAME:-Chrome-ChatGPT-US}"
ISOLATED_DIR="$HOME/Library/Application Support/Google/$PROFILE_NAME"
if [[ "$CLEAN_ISOLATED" -eq 1 && -d "$ISOLATED_DIR" ]]; then
  echo "[4/4] 备份并清理隔离浏览器目录: $ISOLATED_DIR"
  cp -R "$ISOLATED_DIR" "$BACKUP_DIR/$PROFILE_NAME"
  rm -rf "$ISOLATED_DIR"
else
  echo "[4/4] 保留隔离浏览器目录（如需重置请加 --clean-isolated）"
fi

if [[ "$CLEAN_CODEX" -eq 1 && -f "$HOME/.codex/auth.json" ]]; then
  cp "$HOME/.codex/auth.json" "$BACKUP_DIR/codex_auth.json.bak"
  rm -f "$HOME/.codex/auth.json"
  echo "  已备份并清理 ~/.codex/auth.json"
fi

echo "清理完成。备份位于: $BACKUP_DIR"

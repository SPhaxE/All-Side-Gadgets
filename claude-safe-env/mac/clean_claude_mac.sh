#!/usr/bin/env bash
# macOS 精准清理旧 Claude Desktop / Chrome / Claude Code CLI 账号与 Cookie 残留
# 保留 MCP 配置 (claude_desktop_config.json) 与本地工程会话 (~/.claude/projects)

set -euo pipefail

if pgrep -x "Google Chrome" >/dev/null 2>&1; then
  echo "[ERROR] 请先完全退出 Google Chrome (Cmd+Q) 后再运行本脚本，否则 Cookies 数据库被锁定。"
  exit 1
fi
if pgrep -x "Claude" >/dev/null 2>&1; then
  echo "[ERROR] 请先完全退出 Claude 桌面客户端 (Cmd+Q) 后再运行本脚本。"
  exit 1
fi

BACKUP_DIR="$HOME/Desktop/claude_mac_cleanup_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# 1. 清理 Claude Desktop (~/Library/Application Support/Claude)
CLAUDE_DIR="$HOME/Library/Application Support/Claude"
if [[ -d "$CLAUDE_DIR" ]]; then
  echo "[1/3] 清理 Claude Desktop: $CLAUDE_DIR"
  for f in config.json ant-did ant-device-registry.json ccd-ids.json; do
    [[ -f "$CLAUDE_DIR/$f" ]] && cp "$CLAUDE_DIR/$f" "$BACKUP_DIR/claude_$f"
  done

  for sub in "Network" "Cookies" "Cookies-journal" "Local Storage" "Session Storage" \
             "IndexedDB" "WebStorage" "Cache" "Code Cache" "GPUCache" \
             "Shared Dictionary" "blob_storage" "DIPS" "DIPS-wal" "DIPS-shm" \
             "fcache" "sentry" "Partitions" "ant-did" "ant-device-registry.json" \
             "ccd-ids.json" "buddy-tokens.json" "plan-usage-history.json"; do
    rm -rf "${CLAUDE_DIR:?}/$sub"
  done

  if [[ -f "$CLAUDE_DIR/config.json" ]]; then
    python3 - "$CLAUDE_DIR/config.json" <<'PY'
import json, sys
p = sys.argv[1]
d = json.load(open(p, encoding="utf-8"))
for k in ["lastKnownAccountUuid", "oauth:tokenCache", "oauth:tokenCacheV2", "windowSizeWasSignedIn", "bootSideSessions"]:
    d.pop(k, None)
open(p, "w", encoding="utf-8").write(json.dumps(d, ensure_ascii=False, indent=2))
PY
  fi
fi

# 2. 清理 Chrome Default Profile 中的 Claude/Anthropic 痕迹
CHROME_DEF="$HOME/Library/Application Support/Google/Chrome/Default"
if [[ -d "$CHROME_DEF" ]]; then
  echo "[2/3] 清理 Chrome Default 中的 Claude/Anthropic Cookie 与记录"
  [[ -f "$CHROME_DEF/Cookies" ]] && cp "$CHROME_DEF/Cookies" "$BACKUP_DIR/Chrome_Cookies.bak"
  python3 - "$CHROME_DEF" <<'PY'
import json, os, shutil, sqlite3, sys
ud = sys.argv[1]

cookies = os.path.join(ud, "Cookies")
if os.path.exists(cookies):
    con = sqlite3.connect(cookies)
    con.execute("DELETE FROM cookies WHERE host_key LIKE '%claude%' OR host_key LIKE '%anthropic%'")
    con.commit()
    print("  删除 Chrome Cookies 条数:", con.total_changes)
    con.close()

dips = os.path.join(ud, "DIPS")
if os.path.exists(dips):
    con = sqlite3.connect(dips)
    for (t,) in con.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall():
        cols = [c[1] for c in con.execute(f"PRAGMA table_info({t})").fetchall()]
        if "site" in cols:
            con.execute(f"DELETE FROM {t} WHERE site LIKE '%claude%' OR site LIKE '%anthropic%'")
    con.commit()
    con.close()

idb = os.path.join(ud, "IndexedDB")
if os.path.exists(idb):
    for name in os.listdir(idb):
        if "claude" in name.lower() or "anthropic" in name.lower():
            shutil.rmtree(os.path.join(idb, name), ignore_errors=True)
            print("  移除 IndexedDB:", name)

nps = os.path.join(ud, "Network Persistent State")
if os.path.exists(nps):
    d = json.load(open(nps, encoding="utf-8"))
    props = d.get("net", {}).get("http_server_properties", {})
    for key in ("servers", "broken_alternative_services"):
        if isinstance(props.get(key), list):
            props[key] = [
                s for s in props[key]
                if "claude" not in json.dumps(s).lower() and "anthropic" not in json.dumps(s).lower()
            ]
    open(nps, "w", encoding="utf-8").write(json.dumps(d))
PY
fi

# 3. 清理 ~/.claude.json 中的账号缓存字段
if [[ -f "$HOME/.claude.json" ]]; then
  echo "[3/3] 清理 ~/.claude.json 中的 userID / oauthAccount"
  cp "$HOME/.claude.json" "$BACKUP_DIR/.claude.json.bak"
  python3 - "$HOME/.claude.json" <<'PY'
import json, sys
p = sys.argv[1]
d = json.load(open(p, encoding="utf-8"))
for k in ("userID", "oauthAccount"):
    d.pop(k, None)
open(p, "w", encoding="utf-8").write(json.dumps(d, ensure_ascii=False, indent=2))
PY
fi

echo "清理完成。备份位于: $BACKUP_DIR"

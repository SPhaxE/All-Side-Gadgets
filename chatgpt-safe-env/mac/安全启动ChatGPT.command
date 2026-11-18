#!/usr/bin/env bash
# macOS Finder 双击一键启动入口（若安检拦截则暂停保留终端输出）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/launch_chatgpt_safe.sh"
RC=$?
if [[ $RC -ne 0 ]]; then
  echo ""
  read -r -p "安检未通过，按回车键关闭窗口..."
fi
exit $RC

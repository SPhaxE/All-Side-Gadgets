# claude-safe-env — Claude 跨平台安全隔离与三路分流工具集（Windows & macOS）

> **安全提示**：本仓库为公开仓库，所有脚本与模板已做完全脱敏处理，不含任何真实代理 IP、账号密码或订阅链接。本地填写真实参数请放在 `local.env` 或 Clash Verge 本地配置中（已被 `.gitignore` 忽略）。

---

## 目录结构

| 路径 | 用途 |
|---|---|
| `clash-verge-script.template.js` | Clash Verge Rev 三路精准分流扩展脚本模板（Claude 走静态 ISP 链式落地，Gemini 走英国，其余外网走默认美国节点，含 DoH DNS 三路绑定） |
| `local.env.example` | 本地预期出口 IP 模板，复制为 `local.env` 后填写 |
| `mac/clean_claude_mac.sh` | macOS 一键清理 Claude Desktop、Chrome Default 及 `~/.claude.json` 中的旧账号/Cookie 残留 |
| `mac/launch_claude_safe.sh` | macOS 启动前网络安检 + 拉起独立隔离 Chrome (`Chrome-Claude-US`) 与 Claude 桌面端 |
| `windows/preflight_check.py` | Windows 启动前 Clash Verge 管道与 `claude.ai` 出口 IP 核验 |
| `windows/launch_claude_safe.ps1` | Windows 安全启动脚本（带失败弹窗拦截） |
| `windows/安全启动Claude.bat` | Windows 双击启动入口 |
| `tools/check_ip.py` | 跨平台美区 IP 纯净度体检工具（rDNS / `ip-api` / `ipinfo` / RDAP 归属查询） |
| `tools/vps_setup.sh` | 全新 Ubuntu/Debian 美区 VPS 一键部署 VLESS + Vision + Reality 脚本 |

---

## MacBook 快速上手（5 步）

### 1. 拉取仓库（建议稀疏检出本目录）
```bash
git clone --filter=blob:none --sparse https://github.com/SPhaxE/All-Side-Gadgets.git
cd All-Side-Gadgets
git sparse-checkout set claude-safe-env
cd claude-safe-env
```

### 2. 配置本地预期 IP（不会提交到 Git）
```bash
cp local.env.example local.env
# 编辑 local.env，把 CLAUDE_EXPECTED_IP=REPLACE_WITH_US_IP 改为你的静态 ISP IP
```

### 3. 配置 MacBook 上的 Clash Verge Rev
1. 导入你的机场订阅；
2. 右键订阅 $\rightarrow$ **编辑扩展脚本**，粘贴 `clash-verge-script.template.js` 全文；
3. 修改脚本顶部 `LANDING`：
   - `enabled: true`
   - `server`、`port`、`username`、`password` 填入你的美区静态 ISP 账密（或 VPS VLESS 参数）；
4. 保存后更新/重新加载订阅，在 Clash Verge Rev 界面：
   - 顶部切为 **规则（Rule）** 模式，开启 **TUN 模式**（建议在全局合并/设置里关闭 IPv6）；
   - **`AI`** 策略组选 **`🎯 独享美区落地`**；
   - **`⚡ 中转前置`** 策略组选延迟最低的新加坡节点（如 `🇸🇬 V新加坡 04`）；
   - **`🤖 国际AI`** 策略组选 **`🇬🇧 V英国`**；
   - **`默认节点`** 选你的常规美区节点（如 `🇺🇸 V美国 05`）。

### 4. 若 MacBook 之前登过旧号，先做一次精准清理
先按 `Cmd+Q` 完全退出 **Google Chrome** 与 **Claude** 桌面客户端，然后运行：
```bash
chmod +x mac/clean_claude_mac.sh mac/launch_claude_safe.sh
./mac/clean_claude_mac.sh
```
（自动备份到桌面后，仅清理 Claude/Anthropic 相关的 Cookie、IndexedDB、DIPS、Device ID 与 `~/.claude.json` 账号缓存，保留 `claude_desktop_config.json` 与 `~/.claude/projects`）。

### 5. 每次安全启动 Claude
```bash
./mac/launch_claude_safe.sh --check   # 先只跑安检确认无误
./mac/launch_claude_safe.sh           # 安检通过后启动 Chrome-Claude-US 与 Claude Desktop
```
- **桌面端跳转 Chrome 登录防串线**：若登录跳转到了普通 Chrome 窗口，把地址栏登录链接复制进新弹出的 **`Chrome-Claude-US` 隔离窗口**完成授权，会自动回调拉回桌面端。

---

## 三路分流架构说明

1. **Claude 生态（19 个核心/验证/支付域）** $\rightarrow$ `AI` $\rightarrow$ `🎯 独享美区落地`（通过 `⚡ 中转前置` 新加坡节点链式转发，节省静态 ISP 流量且彻底隔离）；
2. **Gemini / Google AI / Antigravity 生态** $\rightarrow$ `🤖 国际AI` $\rightarrow$ `🇬🇧 V英国`；
3. **其余外网（ChatGPT / GitHub / YouTube / 日常网页）** $\rightarrow$ `默认节点`。

DoH DNS 策略（`dns.nameserver-policy`）同步按以上三路绑定对应出口，避免 DNS 地区与实际 TCP 出口分裂。

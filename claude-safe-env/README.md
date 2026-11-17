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

1. **Claude 生态（25 个核心/验证/遥测/支付域）** $\rightarrow$ `AI` $\rightarrow$ `🎯 独享美区落地`（通过 `⚡ 中转前置` 新加坡节点链式转发，节省静态 ISP 流量且彻底隔离）；
   - 包含 `claude.ai`、`anthropic.com`、`claudeusercontent.com`、`challenges.cloudflare.com`、`hcaptcha.com`、`hcaptcha.net`、`withpersona.com`、`persona-id.com`、`browser-intake-us5-datadoghq.com`、`datadoghq.com`、`stripe.com`、`workos.com`、`statsig.com`、`intercom.io` 等；
2. **Gemini / Google AI / Antigravity 生态** $\rightarrow$ `🤖 国际AI` $\rightarrow$ `🇬🇧 V英国`；
3. **其余外网（ChatGPT / GitHub / YouTube / 日常网页）** $\rightarrow$ `默认节点`。

DoH DNS 策略（`dns.nameserver-policy`）同步按以上三路绑定对应出口，避免 DNS 地区与实际 TCP 出口分裂。

---

## 使用注意事项与防踩坑清单

1. **桌面客户端登录跳到普通 Chrome 怎么处理（Windows & macOS 通用）**
   - 桌面端首次登录会调用系统默认浏览器完成 OAuth 回调，往往会弹进平时的普通 Chrome（`Default` Profile）。
   - **切勿在普通 Chrome 窗口点击登录**：直接复制普通 Chrome 地址栏里的登录网址，关掉该标签页，粘贴到脚本启动的 **`Claude-US` / `Chrome-Claude-US` 隔离窗口**中完成登录与验证，授权后会弹出提示自动回调桌面客户端。
2. **运行期间不要关闭 Clash Verge 或切换成 `Global` 模式**
   - `launch_claude_safe` 仅在启动前做安检拦截；若在 Claude 桌面端**已经运行期间**关闭 Clash Verge、关闭 TUN 模式或切换 `Global` 到其他国家，运行中的后台连接会立即更换出口 IP。
   - 若需要“即使宿主机断网或误关代理也绝对无法直连公网”的物理级断网保护，请使用独立虚拟机（开机默认取消连接虚拟网卡 + 虚拟机防火墙仅放行宿主机代理端口）。
3. **谨防全局脚本优先级冲突**
   - Clash Verge Rev 中全局扩展脚本与单订阅扩展脚本共存时，需保证 Claude 相关规则置顶（`clash-verge-script.template.js` 已内置置顶清除与覆写逻辑，可压过全局脚本里的旧分流规则）。
4. **静态 ISP 到期 / 更换 IP 时的操作顺序**
   - 先停掉 Claude 桌面端与隔离 Chrome，再更新 Clash Verge 扩展脚本里的 `LANDING` 参数与 `local.env` 中的 `CLAUDE_EXPECTED_IP`，先跑一次 `--check`（或 `windows/launch_claude_safe.ps1 -CheckOnly`）确认 `[PASS]` 后再启动使用。
5. **新号注册与环境卫生**
   - 购买新 IP/代理后，先用 `python3 tools/check_ip.py --ip <IP>` 核查 RDAP 归属（避开跨洲广播段）与 `proxy`/`hosting` 标记；
   - 不要复用此前已被封号账号用过的手机号、支付卡、浏览器 Profile 或旧 `ant-did` / `Cookies`（重装或换号前先跑一次清理脚本）；
   - macOS 若未开启 TUN 模式，可在 `local.env` 中取消注释 `CLAUDE_PROXY_URL=http://127.0.0.1:7897`（按本机 Clash 端口填写）。

---

## 手机端同步方案（含 Persona KYC 验证场景）

当网页/桌面端弹出 **Persona Verification Portal** 并要求手机扫码拍证件与人脸活体时，务必确保**手机与电脑走完全相同的美区静态 ISP 出口**（切勿让手机用国内蜂窝/Wi-Fi直连或另一条机场节点）：

- **方法 A（临时最省事：走电脑 Clash Verge 局域网代理）**
  1. 确保电脑 Clash Verge 已开启 `Allow LAN`（允许局域网连接），手机连入同一路由器 Wi-Fi 并**关闭手机自带 VPN 与蜂窝数据**；
  2. 在手机 Wi-Fi 设置中将 HTTP 代理设为手动：主机填电脑局域网 IP，端口填 Clash 混杂端口（如 `23466`）；
  3. 手机系统浏览器先访问 `https://claude.ai/cdn-cgi/trace`，确认 `ip=` 与电脑端静态 ISP 完全一致、`loc=US`，再用系统相机扫码并在该浏览器打开 Persona 页面（不要用微信扫一扫内置浏览器）。
- **方法 B（长期移动端同款链式分流）**
  - **Android（Clash Meta / FlClash）**：直接复用本仓库 `clash-verge-script.template.js` 同款分流与 `dialer-proxy` 逻辑；
  - **iOS（Shadowrocket / Stash / Surge）**：导入订阅并新增你的美区静态 ISP `SOCKS5` 节点，将前置/代理通过（`dialer-proxy` / `underlying-proxy`）指向新加坡节点，把 `claude.ai`、`anthropic.com`、`withpersona.com`、`persona-id.com`、`hcaptcha.com` 指向该落地节点。

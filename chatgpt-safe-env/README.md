# chatgpt-safe-env — macOS ChatGPT 桌面端安全隔离与四路分流工具集

> **安全提示**：本仓库为公开仓库，所有脚本与模板已做完全脱敏处理，不含任何真实代理 IP、账号密码或订阅链接。本地参数请放在 `local.env` 或 Clash Verge 本地配置中（已被 `.gitignore` 忽略）。

---

## 目录结构

| 路径 | 用途 |
|---|---|
| `clash-verge-script.template.js` | Clash Verge Rev **四路精准分流**扩展脚本模板（ChatGPT / Claude / Gemini / 默认节点，含进程级隔离防串线与 DoH DNS 绑定） |
| `local.env.example` | 本地预期出口地区/IP 与 Mihomo 策略配置模板，复制为 `local.env` 后填写 |
| `mac/preflight_check.py` | macOS 启动前硬安检：通过 `/tmp/verge/verge-mihomo.sock` 核验 `rule` / `TUN` / `IPv6` / `💬 ChatGPT` 链路，并双端实测 `chatgpt.com` 与 `auth.openai.com` 出口一致性 |
| `mac/launch_chatgpt_safe.sh` | macOS 安全启动脚本（失败时弹出 macOS 原生 `osascript` 警告阻断；通过后拉起隔离 Chrome `Chrome-ChatGPT-US` 与 `ChatGPT.app`） |
| `mac/安全启动ChatGPT.command` | macOS Finder 双击一键启动入口 |
| `mac/clean_chatgpt_mac.sh` | macOS 一键精准清理 `ChatGPT.app` (`com.openai.chat`) 本地缓存、Keychain 凭据与 Chrome `Default` 中的 OpenAI Cookie 残留 |
| `tools/check_ip.py` | 落地 IP 纯净度与 OpenAI 支持地区合规体检工具（rDNS / `ip-api` / `ipinfo` / RDAP 归属查询） |

---

## MacBook 快速上手（5 步）

### 1. 拉取仓库（建议稀疏检出本目录）
```bash
git clone --filter=blob:none --sparse https://github.com/SPhaxE/All-Side-Gadgets.git
cd All-Side-Gadgets
git sparse-checkout set chatgpt-safe-env
cd chatgpt-safe-env
```
（若本机已克隆完整仓库，直接 `git pull` 后进入 `chatgpt-safe-env` 即可。）

### 2. 配置本地安检策略（不会提交到 Git）
```bash
cp local.env.example local.env
# 按需编辑 local.env：
# - CHATGPT_ALLOWED_LOCS=US（若账号允许日本/新加坡等，可写 US,SG,JP）
# - 若给 ChatGPT 配了固定静态落地 IP，填 CHATGPT_EXPECTED_IP=<你的IP>；否则保留占位符仅校验地区与同出口
```

### 3. 配置 MacBook 上的 Clash Verge Rev（四路分流兼容 `claude-safe-env`）
1. 导入你的机场订阅；
2. 右键订阅 $\rightarrow$ **编辑扩展脚本**，粘贴 `clash-verge-script.template.js` 全文；
3. 按需修改顶部配置：
   - **仅用干净订阅节点跑 ChatGPT**：`CHATGPT_CONFIG.landing.enabled` 保持 `false`，保存即可自动筛选美/新/日/台节点并过滤 CN/HK/MO/RU 等高危地区；
   - **给 ChatGPT 配独享落地 IP**：将 `CHATGPT_CONFIG.landing.enabled` 改为 `true` 并填写 `server`、`port`、账密或 VLESS 参数；
   - **同时使用 `claude-safe-env`**：把你在 `claude-safe-env` 里填好的参数复制到 `CLAUDE_LANDING` 并设为 `enabled: true`，即可一套脚本同时托管 Claude 与 ChatGPT，互不串线；
4. 保存后重新加载订阅，在 Clash Verge Rev 界面确认：
   - 顶部切为 **规则（Rule）** 模式，开启 **TUN 模式**（建议在全局设置里关闭 IPv6）；
   - **`💬 ChatGPT`** 策略组选择你指定的干净美区节点（或 `🎯 ChatGPT 独享落地`）；
   - **`AI`** 策略组（如启用 Claude）选择 **`🎯 独享美区落地`**；
   - **`🤖 国际AI`** 策略组选 **`🇬🇧 V英国`**；
   - **`默认节点`** 选常规节点。

### 4. 若 MacBook 之前登过旧号 / 被 Cloudflare 反复拦截，先做一次清理
先按 `Cmd+Q` 完全退出 **Google Chrome** 与 **ChatGPT** 桌面客户端，然后运行：
```bash
chmod +x mac/clean_chatgpt_mac.sh mac/launch_chatgpt_safe.sh mac/安全启动ChatGPT.command
./mac/clean_chatgpt_mac.sh
```
（自动备份到桌面后，清理 `~/Library/*/com.openai.chat*`、Keychain `com.openai.chat` 凭据及 Chrome `Default` 中的 `chatgpt`/`openai` Cookie、IndexedDB、DIPS，**不会影响其他网站与 Claude 环境**；如需重置隔离浏览器或 Codex CLI 凭据可追加 `--clean-isolated` 或 `--clean-codex`。）

### 5. 每次安全启动 ChatGPT
```bash
./mac/launch_chatgpt_safe.sh --check   # 先只跑安检确认 [PASS]
./mac/launch_chatgpt_safe.sh           # 安检通过后启动 Chrome-ChatGPT-US 与 ChatGPT.app
```
之后在 Finder 中直接双击 `mac/安全启动ChatGPT.command` 即可一键核验并启动。

---

## 四路分流与防串线设计说明

1. **进程级优先隔离（TUN 模式下生效）**：
   - `PROCESS-NAME-REGEX,(?i)(chatgpt|com\.openai\.chat|codex|com\.openai\.codex)` $\rightarrow$ `💬 ChatGPT`
   - `PROCESS-NAME-REGEX,(?i)(claude|anthropic)` $\rightarrow$ `AI`
   - **关键意义**：Claude 与 ChatGPT 都会请求 `challenges.cloudflare.com`、`stripe.com`、`workos.com`、`intercom.io`、`statsigapi.net` 等第三方域名；通过进程规则置顶，原生桌面端绝不会因为共用域名而把流量导错出口。
2. **域名与 DoH DNS 四路绑定**：
   - `CHATGPT_DOMAINS`（含 `chatgpt.com`、`ws.chatgpt.com`、`auth.openai.com`、`oaistatic.com`、`oaiusercontent.com`、`api.openai.com` 等）$\rightarrow$ `💬 ChatGPT`；
   - `CLAUDE_DOMAINS` $\rightarrow$ `AI`；
   - `GEMINI_DOMAINS` $\rightarrow$ `🤖 国际AI`；
   - 其余外网 $\rightarrow$ `默认节点`。
   - `dns.nameserver-policy` 同步将四组域名的 DoH 解析分别绑定对应策略组，防止 DNS 解析地区与 TCP/WebSocket 出口分裂。

---

## 使用注意事项与防踩坑清单

1. **桌面客户端 OAuth 登录防串线（`auth.openai.com`）**
   - `ChatGPT.app` 登录时会调用系统默认浏览器打开 `auth.openai.com` 完成授权。
   - **切勿在普通 Chrome（`Default` Profile）中登录**：若弹到普通 Chrome，直接复制地址栏登录链接，关闭该标签页，粘贴到脚本启动的 **`Chrome-ChatGPT-US` 隔离窗口**中完成登录与 Turnstile 验证，授权完成后会自动回调拉回 `ChatGPT.app`。
2. **为什么 macOS 必须开启 TUN 模式（且安检脚本要直连 Unix Socket 核验）**
   - macOS 原生 Swift 版 `ChatGPT.app`（以及内置语音 UDP 3478、`wss://ws.chatgpt.com`、Codex 后台任务）部分请求不会严格遵循系统 HTTP 代理；
   - 此外部分 Clash Verge Rev macOS 版本存在“GUI 显示 TUN 已开启，但内核 `tun.enable` 实际为 `false`”的已知状态不同步问题。`mac/preflight_check.py` 会直接读取 `/tmp/verge/verge-mihomo.sock` 的 `/configs` 进行真实核验，杜绝假开启裸连。
3. **警惕 `~/.codex/.env` 或 `launchctl` 残留代理变量**
   - 若本机曾经配置过 `~/.codex/.env` 或 `launchctl setenv HTTPS_PROXY` 指向旧端口（如 `7890`），会导致 `ChatGPT.app` / Codex 出现连接失败或假证书告警；`preflight_check.py` 启动前会自动扫描并在终端提示 `[WARN]`。
4. **必须保证 `chatgpt.com` 与 `auth.openai.com` 同出口**
   - 若两个域名分流到了不同 IP，Cloudflare Turnstile 会判定令牌来源 IP 漂移，出现无限 `Verify you are human` 死循环；安检脚本会同时探测两者的 `/cdn-cgi/trace`，出口 IP 不一致直接拦截启动。
5. **运行期间不要关闭 Clash Verge 或切到 `Global` / 香港节点**
   - `launch_chatgpt_safe.sh` 仅在启动前做核验；运行中切出支持的地区（OpenAI 不支持 `CN`/`HK`/`MO`/`RU`/`BY`/`IR`/`KP`/`SY`/`CU`/`VE`）会立即暴露新出口。
6. **新节点/落地 IP 纯净度体检**
   - 切换节点或购买静态 IP 前，建议先跑一次：
     ```bash
     python3 tools/check_ip.py --ip <目标出口IP>
     ```
     确认无 `proxy=True`、RDAP 无跨洲广播且属于 OpenAI 支持国家。

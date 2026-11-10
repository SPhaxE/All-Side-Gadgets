# All-Side-Gadgets

各种小项目的合集。每个项目一个根目录，互不依赖；仓库根目录只放共用的 Claude Code 配置。

| 目录 | 项目 | 入口 |
|---|---|---|
| [`ip-pet/`](ip-pet/) | 暖橙水滴 IP：8 步绘制教程的 SVG 复刻，以及两只可交互桌宠（参数化 G2 曲线、锚点表情、物理、模拟 Agent 事件） | `index.html` 验收页、`share.html` 分享页；复盘见 `RETRO.md` |
| [`showcase/`](showcase/) | Visual FX Reel：20 种视效无缝循环短片（1920×1080、60 fps、120 秒）的本地渲染包 | 从仓库渲染看 `RENDER-LOCAL.md`（完整说明）；`先看我-README.md` 针对已含素材帧的本地渲染包（zip），素材帧不在仓库里（`showcase/assets/footage/`、`assets/build/` 被忽略） |
| [`sound-lab/`](sound-lab/) | Sound Lab：Web Audio 音效库与背景循环，基于真实乐器采样 | `index.html` 试听页；`scripts/build-page.py` 打包 |
| [`audio-lab/`](audio-lab/) | 音效复刻台：把两段参考视频里的音效和循环用纯 JS 合成复刻 | `dist/index.html`；命令见 `README.md` |
| [`money-maxxing/`](money-maxxing/) | 支付宝基金持仓量化跟踪与双模型对冲投研：多源行情/公告自动同步、60 日动态 OLS 估值、条件胜率信号、Brier 记分卡与 850+ 基金咽喉备选库 | 状态看板 `STATUS.md`、记分卡 `prediction_scorecard.md`、线报档案 `intelligence_archive.md`；命令见 `README.md` |

## 共用配置

- `CLAUDE.md` + `.claude/rules/`：模型分工、后台运行等通用规则
- `.claude/agents/`：子代理定义（architect、Explore、doc-reader、ast-analyst）
- `.claude/skills/ip-to-desktop-pet/`：从 IP 绘制教程到动态桌宠的技能（流程、规则、实测数据、脚本、参考实现）。在本仓库里用 Claude Code 时自动可用，也可以输入 `/ip-to-desktop-pet` 直接调用
- `.gitignore`：各项目的构建产物、渲染输出

## 来源

这些项目原本分别在各自的分支上开发，现已合并到 `main`，每个项目的提交历史都保留在合并记录里：

| 项目 | 原分支 |
|---|---|
| `ip-pet/` 和桌宠技能 | `claude/sharp-goldberg-dors1h` |
| `showcase/` | `claude/clever-allen-27vz0a` |
| `sound-lab/` | `claude/sweet-curie-8qj8rf`（原来放在仓库根目录） |
| `audio-lab/` | `ccr-477d8580-nv3s14`（原来的 `references/`、`tools/` 已移入 `audio-lab/`） |
| 共用规则 | `claude/cool-hypatia-yjrw5b`（与合并前的 `main` 相同） |

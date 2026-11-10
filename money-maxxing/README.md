# money-maxxing（支付宝基金持仓量化跟踪与双模型对冲投研系统）

面向个人真实支付宝基金账户（本金 `25,753.42 元`，6 只持仓基金）的**本地量化数据库 + 现实新闻双引擎投研与可验证预测记分系统**。采用 **Gemini（主线量化同步、新闻检索、双层线报与高胜率预测登记）+ Claude（独立侧评审、算术/费率核验与措辞审查）** 的双模型制衡架构。

## 核心特性

1. **全自动多源行情与基本面同步（[`fund_tracker.py`](fund_tracker.py)）**：
   - 自动拉取天天基金官方历史/最新净值、A 股 6 大核心指数（含两市总成交额计算）、4 只底层 ETF（含十年国债 ETF）及 12 只 AI/医药核心重仓股实时行情；
   - 自动拉取隔夜美股三大指数、`SOXX` 半导体 ETF 及海外算力/医药龙头（英伟达、AMD、Marvell、Lumentum、超微电脑、礼来）行情；
   - 自动回补 250 天日 K 线（`asset_kline_history`），运行 **60 日动态多元 OLS 回归**校准盘中估值，并持续追踪盘中估值与晚间官方净值的残差（`fund_est_tracking`）；
   - 自动抓取东方财富重仓股官方公告（`stock_announcements`）并计算事件冲击分，自动抓取新浪财经 7×24 全球宏观快讯（`macro_news_archive`）。
2. **三维状态机与历史条件胜率引擎（`forecast_signals`）**：
   - 基于 250 日滚动窗口计算各基金 `p10 / p50 / p90` 波动基准、MA20 乖离率、两市量能比与重仓股内部撕裂度，输出非对称高条件胜率信号。
3. **可验证预测登记与 Brier Score 自动记分卡（[`predictions.json`](predictions.json) / [`prediction_scorecard.md`](prediction_scorecard.md)）**：
   - 所有预测均以 `标的代码 + 指标 + 比较符 + 精确阈值 + 截止日 + 模式(at/any) + 概率(0~1) + 基准率 + 证伪条件` 结构化登记，附带 SHA-1 指纹防篡改校验；
   - 严禁使用盘中估值判定命中，仅以官方结算净值或收盘价自动判分并计算 Brier 得分（截至第 19 期官方结算：已登记 `20` 条，已判定 `10` 条命中 `8` 条，总命中率 `80.0%`；带概率已判定 `7` 条 **7 战全中**，平均 Brier 得分 `0.1646`）。
4. **赎回费分批精算与波动对比日历（`fee_calendar`）**：
   - 按 `FIFO` 与官方招募说明书逐笔计算赎回费、下一档免/降费日期、省费金额及同期组合 `p10 ~ p90` 正常波动区间。
5. **Serenity（`@aleabitoreddit`）生产资料咽喉框架与 850+ 基金穿透备选库**：
   - 穿透筛选天天基金 850+ 只独立基金（[`fund_universe_500plus.json`](fund_universe_500plus.json)），围绕“做多生产资料咽喉、拔除二级债基股票暗刺、剔除高费率高散户占比拥挤度”提炼出 20 只咽喉备选基金手册（[`fund_chokepoint_playbook.md`](fund_chokepoint_playbook.md)）。

## 目录与文件说明

| 文件 / 目录 | 说明 | 维护方 |
| :--- | :--- | :--- |
| [`STATUS.md`](STATUS.md) | 项目实时状态看板：最新官方已结账面、6 只基金逐笔明细、费率倒计时、记分卡战绩与本周日程 | Gemini |
| [`HANDOFF.md`](HANDOFF.md) | 跨窗口无缝交接指南：用户画像、人话版/量化版双层报告铁律与 7 步标准工作流 | Gemini |
| [`GEMINI.md`](GEMINI.md) | 主线 Agent（Gemini）工作空间说明与分工规范 | 共用 |
| [`CLAUDE.md`](CLAUDE.md) | 侧评审 Agent（Claude）核验清单与评审纪律 | Claude |
| [`.agents/rules/forecast_discipline.md`](.agents/rules/forecast_discipline.md) | 预测、线报与方案写作唯一权威规则（基准率锚定、禁用武断词、必列反例） | 共用 |
| [`fund_tracker.py`](fund_tracker.py) | 核心爬虫、60 日动态 OLS 估值、条件胜率信号、赎回费精算、Brier 自动打分与措辞 `lint` 脚本 | 共用 |
| [`portfolio_db.sqlite`](portfolio_db.sqlite) | SQLite 全量本地数据库（基金净值、250 天 K 线、重仓股公告、7×24 宏观电报、持仓与预测记录） | 脚本生成 |
| [`portfolio_latest.json`](portfolio_latest.json) | 最新全量量化快照（持仓、盘中/收盘估值、重仓股与美股行情、`forecast_signals`、费率日历、预测战绩） | 脚本生成 |
| [`predictions.json`](predictions.json) | 结构化预测登记簿（只增不改，SHA-1 防篡改） | Gemini / Claude(`legacy`) |
| [`prediction_scorecard.md`](prediction_scorecard.md) | 预测自动记分卡（由 `fund_tracker.py grade` 自动生成，禁止手改） | 脚本生成 |
| [`intelligence_archive.md`](intelligence_archive.md) | 第 1～19 期量化线报完整档案（含 Claude 侧评审行内批注） | Gemini / Claude |
| [`reports.json`](reports.json) | 历期线报结构化摘要与侧评审结论（`review_notes`） | Gemini / Claude |
| [`claude_review.md`](claude_review.md) | Claude 独立侧评审记录（事实、算术、费率与措辞核查） | Claude |
| [`fund_chokepoint_playbook.md`](fund_chokepoint_playbook.md) | Serenity 生产资料咽喉投研框架与 1,000+ 基金穿透精选 20 只王牌备选库 | Gemini |
| [`fund_universe_500plus.json`](fund_universe_500plus.json) | 天天基金官方接口抓取的 850 只全品类独立基金净值与费率底座 | 脚本生成 |
| [`portfolio_dossier_advisory_review.md`](portfolio_dossier_advisory_review.md) | 面向真人持牌投顾的账户诊断档案（10/19 版） | Gemini |
| [`ep16_news_brief.md`](ep16_news_brief.md) | 第 16 期国内外宏观与产业新闻深度检索简报归档 | Gemini |
| [`serenity_research/`](serenity_research/) | `@aleabitoreddit`（Serenity）原始推文语料与抓取解析脚本归档 | 脚本 / 归档 |

## 常用命令

在 `money-maxxing/` 目录下运行（仅依赖 Python 3 标准库，无需安装第三方包）：

```bash
# 1. 一键同步全市场净值、A股/美股行情、公告快讯、OLS估值校准并自动更新记分卡
python fund_tracker.py sync

# 2. 离线重新判分并生成 prediction_scorecard.md（校验 SHA-1 指纹与合规问题）
python fund_tracker.py grade

# 3. 逐笔计算指定日期的基金赎回费与下一档降费日历
python fund_tracker.py fees --date 2026-11-12

# 4. 对指定期数的线报执行措辞合规检查（确保硬性问题为 0）
python fund_tracker.py lint intelligence_archive.md --section "第 19 期"

# 5. 每期收尾：同步到 GitHub（SPhaxE/All-Side-Gadgets 的 main 分支 money-maxxing/ 子目录，不含 _backup/）
python github_sync.py -m "第 N 期"
```

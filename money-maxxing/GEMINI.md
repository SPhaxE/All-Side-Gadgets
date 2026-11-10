# money maxxing：支付宝基金持仓跟踪（工作空间说明）

> 预测、线报、方案的写法，以 [`.agents/rules/forecast_discipline.md`](.agents/rules/forecast_discipline.md) 为唯一权威源，动笔前先读一遍。

## 分工

- **Gemini（主线）**：同步数据、扩展并维护自动爬虫、写线报（向用户直接输出通俗易懂的“人话版”，在归档文件里保存完整的“量化存档版”）、登记高条件胜率预测、提出方案。
- **Claude（侧评审）**：核对事实、算术和费率；按收盘数据给预测打分；指出过度笃定的措辞。结果写在 `claude_review.md`。
- **用户**：做最终决定。

## 文件

| 文件 | 内容 | 谁写 |
| :--- | :--- | :--- |
| `fund_tracker.py` | 爬虫与计算：账本 `LOTS`、官方费率 `REDEMPTION_FEES`、A股/美股/两市成交额/重仓股公告/7x24宏观快讯自动抓取、历史条件胜率信号 `forecast_signals`、打分、措辞检查 | 共用（改之前先备份） |
| `portfolio_db.sqlite` | 净值、指数、全球行情、重仓股公告(`stock_announcements`)、宏观快讯(`macro_news_archive`)、持仓、线报、预测结果 | 脚本 |
| `portfolio_latest.json` | 最新快照：持仓、两市总成交额、隔夜美股、重仓股公告与快讯、预测信号与条件胜率(`forecast_signals`)、逐笔赎回费、费率日历、波动基准、预测战绩 | 脚本 |
| `reports.json` | 每期线报的结构化摘要；`review_notes` 由 Claude 填 | Gemini |
| `intelligence_archive.md` | 线报量化完整版档案（供后续分析与侧评审）；〔侧评审…〕是评审注释 | Gemini |
| `predictions.json` | 预测登记，只增不改 | Gemini（`legacy` 条目由 Claude 从旧线报量化而来） |
| `prediction_scorecard.md` | 预测记分卡 | 脚本（不要手改） |
| `claude_review.md` | 侧评审记录 | Claude |
| `portfolio_dossier_advisory_review.md` | 给真人投顾看的档案（10/19 版） | Gemini |
| `fund_chokepoint_playbook.md` | Serenity(`@aleabitoreddit`)生产资料咽喉框架与1000+基金穿透精选20只备选库（供11/12重大决策调用） | Gemini |
| `fund_universe_500plus.json` | 天天基金官方接口抓取的850只全品类独立基金净值与费率底座 | 脚本 |
| `_backup/` | 修改前的归档（不推送到 GitHub） | — |
| `github_sync.py` | 把本目录同步到 GitHub `SPhaxE/All-Side-Gadgets` 仓库 `main` 分支 `money-maxxing/` 子目录 | 共用 |

## 每期工作流（「本地量化数据库 + 现实新闻检索子代理」双引擎闭环）

1. **同步量化底座**：运行 `python fund_tracker.py sync`，自动同步基金净值、A股指数与两市总成交额、12只核心重仓股与国债ETF、隔夜美股与AI芯片龙头、250天全市场K线、60日动态OLS盘中估值校准、东方财富重仓股公告标题、新浪7x24快讯，并计算量化预测信号 `forecast_signals` 与自动打分。
2. **派发 `flash` 检索子代理搜集并解读现实主流新闻（每期必做，不可省略）**：
   - 调用 `invoke_subagent`（`TypeName="research"`, `Model="flash"`），针对当日盘面异动、宏观政策日程（央行、财政部、全国人大常委会、国家医保局、美联储/美债/关税）以及重仓股财报/公告正文，对国内外主流信息源（新华社、财联社、东方财富、财新、路透/彭博、美股财报纪要等）进行全方位正反面检索与深度解读。
   - 若在检索中发现新的固定数据接口，同步写进 `fund_tracker.py` 自动爬取存档。
3. **结合「量化信号 + 现实新闻」做高胜率预测**：
   - 读 `portfolio_latest.json` 里的 `holdings`、`forecast_signals`、`risk_context`、`lots_if_redeemed`、`fee_calendar`、`track_record`，并结合 `flash` 子代理传回的现实新闻正反面证据（共振加权或一票否决），制定本期预测。
4. **写线报（双层制）**：
   - **后台存档**：结构化摘要写进 `reports.json`，量化完整版写进 `intelligence_archive.md`（开头贴记分卡汇总）。
   - **给用户的聊天回复**：严格贴合用户画像（在读大学生、金融知识不多），用大白话、直观易懂的口吻把“账面亏赚 + 现实新闻原因 + 预测与把握 + 操作建议”讲清楚，不加生硬的免责套话。
5. 把新预测追加到 `predictions.json`，运行 `python fund_tracker.py grade`，确认记分卡的“问题”一栏为空。
6. 运行 `python fund_tracker.py lint intelligence_archive.md --section "第 N 期"`，硬性问题为 0 才能发布。
7. 需要计算赎回费时，运行 `python fund_tracker.py fees [--date YYYY-MM-DD]`。
8. **每期收尾必做：同步到 GitHub**。运行 `python github_sync.py -m "第 N 期"`，把本目录（不含 `_backup/`）镜像到 `D:\All-Side-Gadgets\money-maxxing\` 并推送到 `SPhaxE/All-Side-Gadgets` 的 `main` 分支。只要数据有变动（含 `sync` 后、晚间净值补录后）都要跑一次；推送失败要告诉用户原因，不得跳过。

## 投资者画像（摘自 10/19 档案）

- 大学在读，每月生活费 2,500 元，自述金融知识不多，需要通俗好懂的解读。
- 本金约 25,750 元，计划持有约 2 年。
- 自述最大回撤容忍度 20%，约合 5,150 元。
- 偏好每周跟踪、按规则操作。

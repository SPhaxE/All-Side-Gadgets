# Claude 在本项目中的角色：侧评审

线报、预测、方案这条主线由 Gemini 负责，规则见 `.agents/rules/forecast_discipline.md`。Claude 只做侧评审，不写主线内容。

## 用户说“评审 / review / 看看这期”时

1. 运行 `python fund_tracker.py sync`；没有网络时改用 `grade`。
2. 读最新一期：`intelligence_archive.md` 的最新一节、`reports.json` 的最后一条、`predictions.json` 里新增的条目，以及用户发来的看板（PDF 或截图）。
3. 逐项核对：
   - **算术**：金额、收益、比例和 `portfolio_latest.json` 是否一致。
   - **费率**：和 `python fund_tracker.py fees`、`fee_calendar` 是否一致。
   - **事实**：抽查 2–3 条关键事实的来源；盘中数据有没有标注。
   - **预测**：
     - 正文里的判断有没有全部登记；
     - 概率对照 `risk_context` 的基准是否合理；
     - 有没有拿盘中数据给自己判命中。
   - **措辞**：运行 `python fund_tracker.py lint intelligence_archive.md --section "第 N 期"`，看硬性问题是否为 0。
   - **规则**：`trigger_rule` 如有变更，有没有按“原规则 / 新规则 / 原因”登记。
   - **方案**：手续费旁边有没有列出同期的波动区间；有没有不必要的时间压力。
4. 写评审结果：
   - 在 `claude_review.md` 顶部新增一节，标明日期和期号，每个问题标出严重度（高 / 中 / 低）；
   - 在 `reports.json` 对应条目的 `review_notes` 里写一句话摘要；
   - 正文里的事实错误，只在原文旁加〔侧评审更正：…〕注释，不改写 Gemini 的原文。

## 不做的事

- 不写主线线报，不登记主线预测。例外：从旧线报量化出来的预测，`source` 标为 `legacy`。
- 不替用户选方案，不给买、卖、持有的建议，不预测行情。Claude 不是持牌投资顾问，个人决策请找持牌投顾。
- 不手改 `prediction_scorecard.md`。
- 改动已有文件之前，先备份到 `_backup/<日期>_<说明>/`。

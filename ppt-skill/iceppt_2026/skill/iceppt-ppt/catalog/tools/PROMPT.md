# 任务：给幻灯片裁图打标签（只看图，不要推测）

目录 /tmp/claude-0/-home-user-All-Side-Gadgets/8f29605b-6939-5423-9eb8-b297312834c5/scratchpad/cat/crops/ 里每张 `<tid>.jpg` 是从小红书拼图里裁出的一页 PPT。
你的批次清单在 `batches/<批次号>.txt`（每行一个 tid）。逐张用 Read 工具真正打开图片看，然后给出标签。不许跳过，不许凭文件名猜。

把结果写成一个 JSON 数组放在你最终回复里（你是只读的，不要尝试写文件；主会话会从回复里提取 JSON）。JSON 必须是合法的、一行一个对象的数组。

每张一个对象，字段固定：
- `tid`: 文件名去掉 .jpg
- `crop_ok`: true/false。裁图是否正好是一整页（false = 切到半页、含两页、或不是幻灯片）
- `kind`: `slide` | `done_before`（"Done" 对照里那张故意做差的灰表格/默认图）| `cover_toc`（封面/目录/宣传）| `other`
- `system`: `green`（深绿+灰）| `wine`（酒红+灰绿）| `blue` | `mono`（纯黑白灰）| `other`
- `page_no`: 页面右上角的三位编号字符串如 "086"；没有就 null
- `title`: 页面左上角标题原文（含 CASE STUDY 后缀，照抄，看不清就尽量）
- `role`: `concept`（框架定义页）| `case`（CASE STUDY 案例页）| `report`（述职/汇报数据页）| `template`（占位文字模板页）
- `main`: 页面里面积最大/最核心的一种图形，从下面词表选一个
- `charts`: 页面里出现的所有图形，词表值数组（含 main）
- `layout`: 版式骨架，从版式词表选一个
- `accent`: 强调色落在哪（≤12 字，如 "末根柱+描边框"）
- `score`: 1–5，作为"可复刻的视觉范例"的价值（5 = 图形清晰、有巧思、一眼好看；1 = 纯文字或很乱）
- `gist`: ≤18 字，这页画了什么（如 "阶梯成本曲线+三张浮层卡"）

图形词表（只能用这些值）：
bar, stacked_bar, grouped_bar, hbar, combo_bar_line, line, area, waterfall, step, dumbbell, slope, small_multiples, heatmap, cohort, pareto, boxplot, butterfly, bubble, scatter, radar, pie_donut, funnel, pyramid, matrix_2x2, matrix_grid, table, gantt, timeline, chevron_flow, box_flow, cycle, tree, venn, sankey, map, concept_curve（S 曲线/扩散曲线/价值曲线/情绪曲线等概念曲线）, kpi_cards, progress_bar, gauge, icon_array, journey_map, layers（分层/房子/冰山/洋葱）, swimlane, formula, cards_only（只有文字卡片）, text_only

版式词表：
left_chart_right_text, left_text_right_chart, kpi_top_charts_below, two_charts_side, three_columns, four_columns, five_columns, grid_2x2, full_chart, flow_top_columns_below, center_diagram, table_full, top_bottom, other

最后只回复一行：批次号、写了多少条、crop_ok=false 的 tid 列表。

# 图表图库（catalog）

把 61 篇笔记里的拼图切成单页，去重后得到 312 页（其中 40 页是作者自己做的 "Done" 反例）。每页有固定词表的标签和像素实测的颜色。

**用途：复刻时先在这里找到原图，对着图做，不要只按文字规则做。**

## 怎么查

- 人看：用浏览器打开 [`index.html`](index.html)，按图形、体系、页型、版式筛选，点图放大，放大后显示文件路径。
- 代理看：
  1. 在下表找到图形类型，用 Read 打开 `sheets/<类型>.jpg`，一张图看完这类图形最好的 12 个范例。
  2. 打开 `charts/<类型>.md`，按顺序号找到对应的 `slides/<tid>.jpg`，用 Read 看单页原图。
  3. 要按条件筛选时读 `index.json`（字段见下）。

## 怎么复刻（对照法）

1. 选定 1 张范例页，Read 原图，先数清楚：几个版块、各占多宽、图在哪一侧、强调色落在哪一个对象上。
2. 按范例的版块比例搭骨架，再画图形，最后填字。版块数量和文字分工都向范例看齐（见 `SKILL.md`「版式先说话」），不要只留一个图和一句标题。
3. 截图，把范例图和自己的截图上下拼成一张对比图再看一遍，逐项核对版块数、图形类型、强调落点、留白。不一致就改，直到对上。
4. 颜色用 `index.json` 里该页的实测值，不用文字参考里的"目测"值。

## 图形类型索引

"主图页"指这页以该图形为主角；"出现页"含作为配角出现的页。

| 图形 | 代码 | 主图页 | 出现页 | 入口 |
|---|---|---|---|---|
| 纯卡片版式 | `cards_only` | 28 | 137 | [总览图](sheets/cards_only.jpg) · [清单](charts/cards_only.md) |
| 2×2 矩阵 | `matrix_2x2` | 24 | 30 | [总览图](sheets/matrix_2x2.jpg) · [清单](charts/matrix_2x2.md) |
| 表格 / 对照表 | `table` | 19 | 46 | [总览图](sheets/table.jpg) · [清单](charts/table.md) |
| 多格矩阵 / 风险矩阵 | `matrix_grid` | 16 | 16 | [总览图](sheets/matrix_grid.jpg) · [清单](charts/matrix_grid.md) |
| 瀑布 / 桥图 | `waterfall` | 14 | 17 | [总览图](sheets/waterfall.jpg) · [清单](charts/waterfall.md) |
| 柱状图 | `bar` | 13 | 28 | [总览图](sheets/bar.jpg) · [清单](charts/bar.md) |
| 堆叠柱 / Marimekko | `stacked_bar` | 12 | 20 | [总览图](sheets/stacked_bar.jpg) · [清单](charts/stacked_bar.md) |
| 树状拆解 | `tree` | 11 | 13 | [总览图](sheets/tree.jpg) · [清单](charts/tree.md) |
| 概念曲线（S 曲线 / Kano / 情绪） | `concept_curve` | 11 | 13 | [总览图](sheets/concept_curve.jpg) · [清单](charts/concept_curve.md) |
| 折线图 | `line` | 10 | 29 | [总览图](sheets/line.jpg) · [清单](charts/line.md) |
| 方框流程 | `box_flow` | 9 | 21 | [总览图](sheets/box_flow.jpg) · [清单](charts/box_flow.md) |
| 分层 / 冰山 / 同心圆 | `layers` | 9 | 10 | [总览图](sheets/layers.jpg) · [清单](charts/layers.md) |
| 大数字 KPI 卡 | `kpi_cards` | 8 | 71 | [总览图](sheets/kpi_cards.jpg) · [清单](charts/kpi_cards.md) |
| 时间轴 | `timeline` | 7 | 19 | [总览图](sheets/timeline.jpg) · [清单](charts/timeline.md) |
| 蝴蝶图 / 力场 | `butterfly` | 7 | 9 | [总览图](sheets/butterfly.jpg) · [清单](charts/butterfly.md) |
| 循环 / 飞轮 / 辐射 | `cycle` | 6 | 12 | [总览图](sheets/cycle.jpg) · [清单](charts/cycle.md) |
| 柱线组合（双轴） | `combo_bar_line` | 6 | 8 | [总览图](sheets/combo_bar_line.jpg) · [清单](charts/combo_bar_line.md) |
| 气泡图 | `bubble` | 6 | 7 | [总览图](sheets/bubble.jpg) · [清单](charts/bubble.md) |
| 面积图 | `area` | 5 | 8 | [总览图](sheets/area.jpg) · [清单](charts/area.md) |
| 金字塔 | `pyramid` | 5 | 6 | [总览图](sheets/pyramid.jpg) · [清单](charts/pyramid.md) |
| 箭头流程（chevron） | `chevron_flow` | 4 | 10 | [总览图](sheets/chevron_flow.jpg) · [清单](charts/chevron_flow.md) |
| 进度条 | `progress_bar` | 3 | 10 | [总览图](sheets/progress_bar.jpg) · [清单](charts/progress_bar.md) |
| 帕累托 | `pareto` | 3 | 5 | [总览图](sheets/pareto.jpg) · [清单](charts/pareto.md) |
| 小多图 | `small_multiples` | 3 | 4 | [总览图](sheets/small_multiples.jpg) · [清单](charts/small_multiples.md) |
| 同期群热力 | `cohort` | 3 | 3 | [总览图](sheets/cohort.jpg) · [清单](charts/cohort.md) |
| 漏斗 | `funnel` | 3 | 3 | [总览图](sheets/funnel.jpg) · [清单](charts/funnel.md) |
| 公式拆解 | `formula` | 2 | 14 | [总览图](sheets/formula.jpg) · [清单](charts/formula.md) |
| 环形 / 饼 | `pie_donut` | 2 | 12 | [总览图](sheets/pie_donut.jpg) · [清单](charts/pie_donut.md) |
| 地图 | `map` | 2 | 8 | [总览图](sheets/map.jpg) · [清单](charts/map.md) |
| 雷达图 | `radar` | 2 | 5 | [总览图](sheets/radar.jpg) · [清单](charts/radar.md) |
| 阶梯图 / 成本曲线 | `step` | 2 | 5 | [总览图](sheets/step.jpg) · [清单](charts/step.md) |
| 斜率图 | `slope` | 2 | 3 | [总览图](sheets/slope.jpg) · [清单](charts/slope.md) |
| 箱线图 | `boxplot` | 2 | 3 | [总览图](sheets/boxplot.jpg) · [清单](charts/boxplot.md) |
| 甘特图 | `gantt` | 2 | 3 | [总览图](sheets/gantt.jpg) · [清单](charts/gantt.md) |
| 散点图 | `scatter` | 2 | 2 | [总览图](sheets/scatter.jpg) · [清单](charts/scatter.md) |
| 韦恩图 | `venn` | 2 | 2 | [总览图](sheets/venn.jpg) · [清单](charts/venn.md) |
| 哑铃图 | `dumbbell` | 2 | 2 | [总览图](sheets/dumbbell.jpg) · [清单](charts/dumbbell.md) |
| 仪表 / 环形进度 | `gauge` | 1 | 6 | [总览图](sheets/gauge.jpg) · [清单](charts/gauge.md) |
| 纯文字 | `text_only` | 1 | 6 | [总览图](sheets/text_only.jpg) · [清单](charts/text_only.md) |
| 图标阵列 | `icon_array` | 1 | 4 | [总览图](sheets/icon_array.jpg) · [清单](charts/icon_array.md) |
| 旅程地图 | `journey_map` | 1 | 2 | [总览图](sheets/journey_map.jpg) · [清单](charts/journey_map.md) |
| 桑基图 | `sankey` | 1 | 1 | [总览图](sheets/sankey.jpg) · [清单](charts/sankey.md) |
| 横向条形 | `hbar` | 0 | 9 | [总览图](sheets/hbar.jpg) · [清单](charts/hbar.md) |
| 分组柱 | `grouped_bar` | 0 | 4 | [总览图](sheets/grouped_bar.jpg) · [清单](charts/grouped_bar.md) |
| 热力表 | `heatmap` | 0 | 1 | [总览图](sheets/heatmap.jpg) · [清单](charts/heatmap.md) |

## 实测颜色（按体系取中位数）

| 体系 | 页数 | 深色强调（中位） | 深色面积中位 / 90 分位 | 浅底色（中位） | 浅底面积中位 | 纯白面积中位 |
|---|---|---|---|---|---|---|
| 绿 | 173 | `#34816E` | 0.2% / 1.3% | `#D1E1DD` | 1.4% | 67.5% |
| 酒红 | 78 | `#501313` | 0.3% / 2.2% | `#DFD9D6` | 1.9% | 61.6% |
| 蓝 | 10 | 样本太少 | — | `#E9F1F9` | 7.4% | 60.3% |

- 测法：裁图缩到 400px 宽后逐像素统计；饱和度 ≥0.30 算深色强调，0.045–0.30 且明度 ≥0.78 算浅底。
- 这些是 JPEG 压缩图上的值。细线和小字会被抗锯齿冲淡，所以深色的实测值比源文件偏浅、面积偏小，只能当下限看。
- 可以确定的结论：深色强调的面积远小于文字参考里写的"≤10%"，绝大多数页不到 2%。页面主体是白底加少量浅色底。

## index.json 字段

| 字段 | 含义 |
|---|---|
| `tid` / `file` | 单页编号和图片路径 |
| `src` / `bbox` | 原拼图路径和裁切框（像素） |
| `kind` | `slide` 正常页；`done_before` 作者做的 Done 反例 |
| `system` | `green` / `wine` / `blue` / `mono` / `other` |
| `role` | `concept` 概念页 / `case` 案例页 / `report` 汇报数据页 / `template` 占位模板页 |
| `main` / `charts` | 主图形 / 页内全部图形（词表见上表"代码"列） |
| `layout` | 版式骨架 |
| `accent` | 强调色落在哪 |
| `score` | 1–5，作为复刻范例的价值 |
| `gist` / `title` / `page_no` | 画了什么 / 页面标题 / 右上角页码 |
| `palette` | 实测深色强调、浅底色及面积占比 |

## 局限

- 标签由子代理逐张看图给出，没有人工复核。图形类型和版式有主观取舍，评分只能粗排。
- 有 63 张拼图经过二次裁切（重切出 136 张）；仍有约 30 张因边界切不准被剔除，所以个别页面不在库里，需要时回原拼图找。
- 同一页的换色版本（绿 / 酒红 / 蓝）没有合并，会各占一条。
- 单页分辨率约 1000×560，小字看不清，复刻时以版式和图形为准。
- `tools/` 里是生成这套图库的脚本，路径写死在脚本里，重跑前要改。

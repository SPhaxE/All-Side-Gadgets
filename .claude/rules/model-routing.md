# 模型分工（主会话 = Sonnet 5.5）

版本固定：主会话 `claude-sonnet-5-5`，advisor 与 `architect` 用 `claude-opus-5-5`，其余子代理用 `claude-haiku-5-5`。设置在 `.claude/settings.json`，子代理定义在 `.claude/agents/`（`Explore` 对应 `explore.md`）。

## 交给 Haiku 子代理（只要结论，不要原文）
- 在仓库里找文件、找组件/路由/符号、了解目录结构 → `Explore`
- 查文档、库用法、API、版本差异 → `doc-reader`
- 查引用和调用方、依赖关系、改名或重构的影响范围 → `ast-analyst`
- 规划阶段需要搜代码时，同样交给上面三个，不要自己大范围读文件
- 门槛：已知路径、或只需读 1–2 个文件，就自己读；要搜 3 个以上文件、或不知道东西在哪，才派子代理

## 主会话自己做
- 写代码、改代码、跑测试和构建、修普通 bug
- 作品集的 SVG 生成脚本、文案和版式改动（规范见 `CLAUDE.md` 的 Figma 一节）

## 交给 Opus（`architect` 子代理或 advisor）
- 新功能或大改动开工前：先让 `architect` 出方案，按它的分步计划执行
- 同一个问题修了 2 次仍失败（同一报错或同一现象，两次改动后仍在）：停下来，先咨询 advisor 或 `architect`，不要第 3 次盲改
- 合并到主分支或上线前：让 `architect` 做最终评审，阻断项修完再提交；涉及 SVG 时重点查 `tspan`、`filter`、`mask`、`foreignObject`、`<image opacity>`、画布尺寸
- 委派给 `architect` 时，它看不到我们的对话，按固定格式写任务描述：
  目标 / 已尝试的方法 / 报错信息 / 相关文件路径 / 想要的输出

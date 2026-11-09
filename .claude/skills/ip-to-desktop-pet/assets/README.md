# 资产

| 路径 | 内容 | 什么时候用 |
|---|---|---|
| `examples/tutorial-steps.jpg` | 本项目的原始输入：8 步绘制教程长图（9940×1522） | 试跑 `split_panels.py`、`trace_outline.py`；对照 `references/data.md` 里的实测值 |
| `reference-implementation/index.html` | 引擎与验收页的完整参考实现（快照） | 新项目复制它作为起点：改 `CHARS`、生成器、`behave` 和文案 |
| `reference-implementation/share.html` | 由 `build_share.py` 生成的分享页（快照） | 看分享页版式与模拟 Agent 面板 |
| `reference-implementation/ref/` | 原图逐步裁切（index.html 的「原图」对照用） | 与 index.html 放在同一目录 |
| `reference-implementation/README.md`、`RETRO.md` | 参数说明、迭代记录与 20 条踩坑 | 开工前读 RETRO.md |

快照取自 `ip-pet/`（仓库内以 `ip-pet/` 为准；技能被复制到别处使用时，用这里的快照）。更新 `ip-pet/` 后可以重新复制：

```bash
cp ip-pet/index.html ip-pet/share.html ip-pet/README.md ip-pet/RETRO.md .claude/skills/ip-to-desktop-pet/assets/reference-implementation/
```

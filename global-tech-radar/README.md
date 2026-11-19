# 全球技术视野

用中文追踪中国与海外的 AI 模型、评测、新产品和技术架构。每条动态附原文、日期、影响和验证条件。

[在线归档](https://mondaylab.github.io/ai-industry-brief/global-tech-radar/) · [Agent 定义](../skills/global-tech-radar/SKILL.md) · [发布流程](../skills/global-tech-radar/references/publish.md)

在 Codex 加载 Agent 后，可用 `$global-tech-radar` 生成一期。例如「出一期今天的全球技术简报」或「追踪这周长上下文推理的进展，重点看国内模型和独立实测」。Agent 校验本期稿件后默认提交到本仓库，GitHub Pages 从 `main` 发布。

`brief-data/` 保存按日编号的原稿。从仓库根目录运行下面的命令，使用 Python 3.9 或更新版本重建静态归档。

```sh
python3 skills/global-tech-radar/scripts/render.py --root global-tech-radar
```

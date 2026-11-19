# 数据与构建

将当天稿件写入归档目录下的 `brief-data/YYYY-MM-DD.json`。已有一期时，沿用最接近的一期作为结构参考。

- 顶层包含 `date`、`windowStart`（ISO 日期）、`headline`、`opening`、`insight`、`coverage`（文字）、`watch`（待关注事项数组）和 `sections`。
- `sections` 是对象，包含 `models`、`evaluations`、`products`、`architecture` 四个条目数组。允许空数组。
- 每个条目包含 `id`（跨期稳定的事件标识，例如 `qwen4-max-ga`）、`title`、`region`、`status`、`fact`、`impact`、`check`（验证条件、方法或限制）和 `sources`。
- 每个来源包含 `name`、`url`（HTTP 或 HTTPS）、`date`（ISO 日期）、`kind`（如「官方公告」「评测榜单条目」「文档更新」「评测快照」）。第一个为去重主来源。只有持续更新的 changelog、榜单等页面需要加具体锚点或版本参数来定位事件。正文须与日期口径一致。
- 归档按稳定事件 ID、规范化标题和主来源去重。当天修订覆盖同名文件，补旧期保留更新一期在首页。相同报告的重复报道应从候选中移除。独立评测、阶段变化等有新证据的里程碑使用各自的事件 ID 和直接证据。
- 保留日期窗以外的必要参考资料时，页面会为该来源标「窗口外参考」。正文同步说明它的参考用途。

运行 `python3 <本 Skill 目录>/scripts/render.py --root <归档目录>`。该命令校验全部日期 JSON、跨期查重、重建 `index.html` 和每期 HTML。加 `--check` 只检查数据。HTML 可直接打开，无运行时依赖。

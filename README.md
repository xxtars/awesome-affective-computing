# Awesome Affective Computing

现在仓库只保留一个功能：

- 读取 `data/researcher.json`
- 自动生成 `teams` 信息到：
  - `data/teams.json`
  - `src/data/teams.json`

## 用法

```bash
python scripts/generate_teams.py
```

生成逻辑会优先使用 `openalex_author_id` 查询 OpenAlex；如果没有 ID，则按 `name` 搜索并选择最佳候选。

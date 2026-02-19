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


## GitHub Actions

- `update_teams.yml`: 每周自动执行 `python scripts/generate_teams.py`，并在有变更时提交 `data/teams.json` 与 `src/data/teams.json`。
- `deploy.yml`: 构建站点并在仓库已启用 GitHub Pages 时自动部署；若未启用会在 workflow 中给出 warning 并跳过部署（不再报错失败）。

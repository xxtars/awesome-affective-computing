# Affective Computing Research

This repository is an AI-assisted personal tracking workspace for affective computing research.
It focuses on identity-based researcher tracking, OpenAlex paper retrieval, and paper-level analysis outputs.

⚠️ **Disclaimer**

- This list is not comprehensive and may not cover all relevant works.
- The organization reflects personal interpretation and research interests.
- No ranking or endorsement is implied.

## Researcher Pipeline (OpenAlex + ORCID + Qwen)

Current website structure:

- `/researchers`: researcher overview (search/filter by country, university, keyword)
- `/researchers/detail?id=<openalex_author_id>`: per-researcher detail page
- `/papers`: aggregated affective-related papers from tracked researchers
- `/landscape`: L1/L2 taxonomy analysis and stage-wise mapping view

### Seed file

Identity-only researcher info is stored in:

- `data/researchers/researcher.seed.json`

The seed stores identity keys only (no manual affiliation).
It is not treated as a complete profile source.

Seed format:

```json
{
  "researchers": [
    {
      "name": "Example Name",
      "openalex_author_id": "A1234567890",
      "orcid": "https://orcid.org/0000-0000-0000-0000",
      "google_scholar": "https://scholar.google.com/citations?user=xxxx"
    }
  ]
}
```

Seed can include multiple researchers and is designed for incremental expansion.

### Data sources and priority

- Seed fields:
  - `name`: manual seed input
  - `openalex_author_id`: manual seed input, primary ID for pipeline collection
  - `orcid`: manual seed input (optional); if missing, may be inferred from OpenAlex author record at runtime
  - `google_scholar`: manual seed input (optional)
- Institution:
  - Priority: Google Scholar profile affiliation -> ORCID affiliation -> OpenAlex first institution
- Institution country/region:
  - Priority: geocoding result from chosen institution name -> OpenAlex institution country code fallback
- Directions / TLDR:
  - Source: AI-generated from title/abstract/concepts and affective-topic prompt
  - Note: may contain errors, omissions, or interpretation bias
- Venue:
  - Priority: OpenAlex primary source -> DOI/Crossref resolution -> DOI prefix heuristic fallback
- Author order on Papers page:
  - Source: OpenAlex authorship order (`work.authorships`)

### Environment variables

- `QWEN_API_KEY`: required unless using `--skip-ai`
- `QWEN_BASE_URL`: optional, defaults to `https://dashscope.aliyuncs.com/compatible-mode/v1`
- `QWEN_MODEL`: optional, defaults to `qwen-plus`

### Run

```bash
npm run researcher:build
```

Default behavior is incremental:

- Only new papers are fetched/analyzed.
- Existing papers from per-researcher profile files are reused.
- Cached AI results are reused from per-researcher `paper-analysis-cache.json` files.
- Checkpoint is saved after each processed researcher (index + per-researcher profile + cache).
- Cache can be flushed during processing with `--save-every` (default `1`, i.e., save after each paper).
- AI analysis is optimized for speed:
  - Non-related papers return minimal output only.
  - Keywords/directions are generated only for affective-related papers.
- Summary is incremental-aware:
  - If no new papers are found for a researcher, previous summary is reused.
  - Summary AI call is triggered only when new papers are added (or full refresh).
- Works are deduplicated by title before final output.
  - If both published and preprint versions exist, published version is preferred.
  - If only preprints exist, `ArXiv.org` is preferred.

Optional flags:

```bash
node scripts/researcher-pipeline/run.mjs --max-papers 20 --delay-ms 300
node scripts/researcher-pipeline/run.mjs --max-papers 20 --concurrency 4
node scripts/researcher-pipeline/run.mjs --max-papers 50 --concurrency 4 --save-every 1
node scripts/researcher-pipeline/run.mjs --researcher-name "Jufeng Yang"
node scripts/researcher-pipeline/run.mjs --researcher-name "Jufeng Yang,Sicheng Zhao"
node scripts/researcher-pipeline/run.mjs --skip-ai --max-papers 5
node scripts/researcher-pipeline/run.mjs --full-refresh
```

### Output

- `data/researchers/researchers.index.json`: lightweight index for list pages
- `data/researchers/profiles/<openalexAuthorId>.json`: full per-researcher profile
- `data/researchers/cache/<name>__<scholarUserId>__<openalexAuthorId>/paper-analysis-cache.json`: per-researcher AI cache
  - cache entries include `paper_id`, `title`, `researcher_name`, and `researcher_openalex_author_id` for manual checks

### Taxonomy pipeline (problem/method -> L2/L1)

This repo also supports offline taxonomy analysis using paper-level
`problem_directions` and `method_directions`:

1. direction-only text -> Qwen embedding (`text-embedding-v4` by default)
2. BERTopic clustering on embeddings
3. Qwen labels each cluster as L2
4. Qwen directly outputs L1 categories from all L2 items
5. Local embedding-based mapping assigns each L2 to one L1

Install Python deps:

```bash
python3 -m pip install -r scripts/taxonomy/requirements.txt
```

Run:

```bash
npm run taxonomy:build
# or:
python3 scripts/taxonomy/build_taxonomy.py --axis both
```

Defaults:

- input: `data-repo/data/researchers`
- output: `data-repo/data/taxonomy`
- axes: `problem` + `method` (when `--axis both`)
- chat model: `qwen3.5-plus`
- embedding batch size: `10`
- embedding concurrency: `4` (`--embedding-concurrency`)
- chat concurrency: `4` (`--chat-concurrency`, for L2 labeling)
- random seed: `42` (`--random-seed`, for deterministic first-stage clustering)

Thinking mode for taxonomy labeling:

- Disabled by default.
- Enable only when needed: `QWEN_ENABLE_THINKING=true`.
- Force off: `QWEN_ENABLE_THINKING=false`.

Raw API responses are persisted for later reuse/audit:

- `data-repo/data/taxonomy/api_logs/problem/*.json`
- `data-repo/data/taxonomy/api_logs/method/*.json`

Main outputs:

- `data-repo/data/taxonomy/problem/taxonomy.json`
- `data-repo/data/taxonomy/method/taxonomy.json`
- `data-repo/data/taxonomy/taxonomy.summary.json`
- `data-repo/data/taxonomy/<axis>/l1.input.items.json` (unique L2 items for direct L1 grouping)
- `data-repo/data/taxonomy/<axis>/l1.direct.grouping.json` (LLM raw and normalized L1 output)
- `data-repo/data/taxonomy/<axis>/l1.direct.assignments.json` (local embedding-based L2 -> L1 mapping)

Resume/incremental cache files (per axis):

- `cache.embedding.json`: record-level embedding cache (resume from interruption; only embed misses)
- `cache.bertopic.json`: first-stage BERTopic assignments/candidates cache (reused when fingerprint matches)
- `cache.l2.json`: topic-label cache (reuse prior L2 labels by topic fingerprint)
- `cache.l1.json`: L1 direct-grouping cache (reuse prior L1 raw output by fingerprint)

Production recommendation:

- Keep full generated data in a separate private data repository.
- GitHub Actions `Researcher Build` writes full data to the external data repo using `DATA_REPO_PAT`.
- `Deploy to GitHub Pages` checks out the private data repo and exports minimized public snapshots to:
  - `static/data/researchers`
  - `static/data/taxonomy`
- The public snapshot is not committed back to this code repository.
  - Add `DATA_REPO_PAT` in repository secrets with access to `xxtars/affective-computing-research-data`.

### Pipeline flow

1. Read researchers from `data/researchers/researcher.seed.json`
2. Fetch author profile + works from OpenAlex
3. Optionally run per-name mode (`--researcher-name`) to process only selected researchers
4. Deduplicate works by title with source preference rules
5. Run AI analysis per paper (affective-related judgment + conditional extraction)
6. Save cache checkpoints during processing (`--save-every`, default each paper)
7. Build or reuse researcher-level summaries (incremental-aware)
8. Export index JSON + per-researcher profile JSON for website pages

### Affiliation rule

- If Google Scholar profile affiliation is available, use it first.
- If Google Scholar affiliation is missing, pipeline tries ORCID affiliation.
- If ORCID is missing/unavailable, pipeline falls back to OpenAlex first institution.
- Researcher country is resolved from institution name via geocoding and normalized to English country names.
- This rule is practical but heuristic, and may not always be real-time or correct.

## Disclaimer

- Researchers are continuously being added.
- The current list is not a filtered shortlist, ranking, or complete coverage of the field.
- Parts of this project are AI-assisted. Metadata extraction, topic labeling, and summaries may contain errors or omissions.
- Affiliation and metadata sources may be stale; real-time correctness is not guaranteed.
- Please verify important details with official paper pages, publishers, and OpenAlex records.

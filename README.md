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
  - Priority: ORCID affiliation -> Google Scholar profile affiliation -> OpenAlex first institution
- Institution country:
  - Priority: geocoding result from chosen institution name -> OpenAlex institution country code fallback
- Directions / keywords:
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

- If `orcid` exists in seed and ORCID record is available, use ORCID affiliation first.
- If ORCID affiliation is missing, pipeline tries Google Scholar profile affiliation.
- If Google Scholar is missing/unavailable, pipeline falls back to OpenAlex first institution.
- Researcher country is resolved from institution name via geocoding and normalized to English country names.
- This rule is practical but heuristic, and may not always be real-time or correct.

## Disclaimer

- Researchers are continuously being added.
- The current list is not a filtered shortlist, ranking, or complete coverage of the field.
- Parts of this project are AI-assisted. Metadata extraction, topic labeling, and summaries may contain errors or omissions.
- Affiliation and metadata sources may be stale; real-time correctness is not guaranteed.
- Please verify important details with official paper pages, publishers, and OpenAlex records.

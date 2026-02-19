#!/usr/bin/env python3
"""Generate teams.json from researcher.json via OpenAlex."""

from __future__ import annotations

import json
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

OPENALEX_BASE = "https://api.openalex.org"
ROOT = Path(__file__).resolve().parents[1]
INPUT_PATH = ROOT / "data" / "researcher.json"
OUTPUTS = [ROOT / "data" / "teams.json", ROOT / "src" / "data" / "teams.json"]


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def fetch_json(url: str) -> dict[str, Any] | None:
    req = urllib.request.Request(url, headers={"User-Agent": "awesome-affective-computing/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None


def extract_id(raw: str) -> str:
    token = raw.split("/")[-1]
    return token if token.startswith("A") else f"A{token.lstrip('A')}"


def get_author(author_id: str) -> dict[str, Any] | None:
    norm = extract_id(author_id)
    return fetch_json(f"{OPENALEX_BASE}/authors/{norm}")


def search_author(name: str) -> dict[str, Any] | None:
    query = urllib.parse.quote(name)
    data = fetch_json(f"{OPENALEX_BASE}/authors?search={query}&per-page=5")
    if not data:
        return None
    candidates = data.get("results", [])
    if not candidates:
        return None

    normalized = name.strip().lower()
    for c in candidates:
        if c.get("display_name", "").strip().lower() == normalized:
            return c
    return max(candidates, key=lambda c: c.get("works_count", 0))


def concepts_to_directions(author: dict[str, Any]) -> list[str]:
    concepts = author.get("x_concepts") or []
    ranked = sorted(concepts, key=lambda c: c.get("score", 0), reverse=True)
    return [c.get("display_name", "") for c in ranked[:3] if c.get("display_name")]


def map_researcher(item: dict[str, Any]) -> dict[str, Any]:
    author = None
    if item.get("openalex_author_id"):
        author = get_author(item["openalex_author_id"])
    elif item.get("name"):
        author = search_author(item["name"])

    institution = "Unknown"
    country = "Unknown"
    homepage = ""
    directions: list[str] = []
    openalex_author_id = item.get("openalex_author_id", "")

    if author:
        inst = (author.get("last_known_institutions") or [{}])[0]
        institution = inst.get("display_name") or institution
        country = inst.get("country_code") or country
        homepage = author.get("orcid") or ""
        directions = concepts_to_directions(author)
        raw_id = author.get("id", openalex_author_id)
        openalex_author_id = raw_id.split("/")[-1] if raw_id else openalex_author_id

    return {
        "name": item.get("name", "Unknown"),
        "institution": institution,
        "country": country,
        "directions": directions,
        "homepage": item.get("homepage") or homepage,
        "google_scholar": item.get("google_scholar", ""),
        "openalex_author_id": openalex_author_id,
    }


def main() -> None:
    if not INPUT_PATH.exists():
        raise FileNotFoundError("Missing data/researcher.json")

    researchers = read_json(INPUT_PATH)
    teams = [map_researcher(r) for r in researchers]
    teams.sort(key=lambda t: (t["institution"], t["name"]))

    for out in OUTPUTS:
        write_json(out, teams)

    print(f"Generated {len(teams)} team entries from {INPUT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

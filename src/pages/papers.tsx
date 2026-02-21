import type {ReactNode} from 'react';
import {useEffect, useMemo, useState} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import {buildResearchDataUrl, useResearchDataBaseUrl} from '../lib/researchData';
import styles from './papers.module.css';

type WorkItem = {
  id: string;
  title: string;
  publication_year: number | null;
  publication_date?: string | null;
  tracked_author_rank?: number | null;
  tracked_author_position?: string | null;
  doi?: string | null;
  doi_url?: string | null;
  cited_by_count: number;
  primary_source: string | null;
  source?: {display_name: string | null};
  links?: {
    openalex: string | null;
    source_openalex: string | null;
    landing_page: string | null;
  };
  analysis: {
    is_interesting: boolean;
    relevance_score: number;
    tldr?: string;
    problem_directions?: string[];
    method_directions?: string[];
  };
};

type ResearcherProfile = {
  identity: {
    name: string;
    openalex_author_id: string;
  };
  works: WorkItem[];
};

type IndexRecord = {
  identity: {
    name: string;
    openalex_author_id: string;
  };
  profile_path: string;
};

type IndexFile = {
  researchers: IndexRecord[];
};

type PaperAuthor = {name: string; id: string; order: number};
type PaperView = WorkItem & {researchers: PaperAuthor[]};

function normalizeTitle(title: string) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeVenueName(name: string | null | undefined) {
  const raw = String(name || '').trim();
  if (!raw) return '-';
  if (raw.toLowerCase().includes('arxiv')) return 'arXiv';
  return raw;
}

function normalizeDoiText(doi: string | null | undefined) {
  const raw = String(doi || '').trim();
  if (!raw) return '';
  return raw
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .trim();
}

function inferVenueFromDoiText(doiText: string) {
  const doi = normalizeDoiText(doiText).toLowerCase();
  if (!doi) return '';
  if (doi.startsWith('10.1145/')) return 'ACM';
  if (doi.startsWith('10.1109/')) return 'IEEE';
  if (doi.startsWith('10.48550/arxiv.')) return 'arXiv';
  if (doi.startsWith('10.1016/')) return 'Elsevier';
  if (doi.startsWith('10.1007/')) return 'Springer';
  if (doi.startsWith('10.3389/')) return 'Frontiers';
  if (doi.startsWith('10.3233/')) return 'IOS Press';
  return '';
}

function getVenueLabel(work: WorkItem) {
  const venue = normalizeVenueName(work.source?.display_name || work.primary_source);
  if (venue !== '-') return venue;
  const inferred = inferVenueFromDoiText(work.doi_url || work.doi || '');
  if (inferred) return inferred;
  const doi = normalizeDoiText(work.doi_url || work.doi);
  if (doi) return `DOI: ${doi}`;
  return '-';
}

function formatYearMonth(dateText: string | null | undefined, year: number | null) {
  const raw = String(dateText || '').trim();
  if (raw) {
    const m = raw.match(/^(\d{4})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}`;
  }
  return String(year || '-');
}

function capitalizeFirst(text: string) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatPreviewList(items: string[] | undefined) {
  const normalized = (items || []).map((item) => String(item || '').trim()).filter(Boolean);
  if (normalized.length === 0) return '-';
  return normalized.map((item) => capitalizeFirst(item)).join(', ');
}

function getProblemDirections(analysis: WorkItem['analysis'] | undefined) {
  return Array.isArray(analysis?.problem_directions) ? analysis?.problem_directions : [];
}

function getMethodDirections(analysis: WorkItem['analysis'] | undefined) {
  return Array.isArray(analysis?.method_directions) ? analysis?.method_directions : [];
}

function authorPositionOrder(position: string | null | undefined) {
  const value = String(position || '').toLowerCase();
  if (value === 'first') return 0;
  if (value === 'middle') return 1;
  if (value === 'last') return 2;
  return 3;
}

function authorOrderFromWork(work: WorkItem) {
  const rank = Number(work.tracked_author_rank || 0);
  if (Number.isFinite(rank) && rank > 0) return rank;
  const fallback = authorPositionOrder(work.tracked_author_position);
  return fallback + 1000;
}

function mergePaperAuthors(existing: PaperAuthor[], next: PaperAuthor[]) {
  const merged = [...(existing || [])];
  for (const author of next || []) {
    if (!author?.id) continue;
    const existingIndex = merged.findIndex((item) => item.id === author.id);
    if (existingIndex >= 0) {
      if (author.order < merged[existingIndex].order) {
        merged[existingIndex] = author;
      }
      continue;
    }
    merged.push(author);
  }
  return merged.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.name.localeCompare(b.name, 'en', {sensitivity: 'base'});
  });
}

export default function PapersPage(): ReactNode {
  const dataBaseUrl = useResearchDataBaseUrl();
  const indexUrl = buildResearchDataUrl(dataBaseUrl, 'data/researchers/researchers.index.json');
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(100);
  const [profiles, setProfiles] = useState<ResearcherProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let disposed = false;
    async function load() {
      setLoading(true);
      try {
        const idxRes = await fetch(indexUrl);
        if (!idxRes.ok) throw new Error(`Failed to load index: ${idxRes.status}`);
        const indexJson = (await idxRes.json()) as IndexFile;
        const records = indexJson.researchers || [];
        const loaded = await Promise.all(
          records.map(async (record) => {
            const rel = String(record.profile_path || '').replace(/^\/+/, '');
            const profileUrl = buildResearchDataUrl(dataBaseUrl, rel);
            const res = await fetch(profileUrl);
            if (!res.ok) return null;
            return (await res.json()) as ResearcherProfile;
          }),
        );
        if (!disposed) setProfiles(loaded.filter(Boolean) as ResearcherProfile[]);
      } catch (err) {
        console.error(err);
        if (!disposed) setProfiles([]);
      } finally {
        if (!disposed) setLoading(false);
      }
    }
    load();
    return () => {
      disposed = true;
    };
  }, [dataBaseUrl]);

  const papers = useMemo(() => {
    const byTitle = new Map<string, PaperView>();

    for (const researcher of profiles) {
      for (const work of researcher.works || []) {
        if (!work.analysis?.is_interesting) continue;
        const key = normalizeTitle(work.title);
        if (!key) continue;

        const enriched: PaperView = {
          ...work,
          researchers: [
            {
              name: researcher.identity.name,
              id: researcher.identity.openalex_author_id,
              order: authorOrderFromWork(work),
            },
          ],
        };

        const existing = byTitle.get(key);
        if (!existing) {
          byTitle.set(key, enriched);
          continue;
        }

        const mergedResearchers = mergePaperAuthors(existing.researchers, enriched.researchers);

        if ((enriched.analysis.relevance_score || 0) > (existing.analysis.relevance_score || 0)) {
          byTitle.set(key, {...enriched, researchers: mergedResearchers});
          continue;
        }

        if ((enriched.cited_by_count || 0) > (existing.cited_by_count || 0)) {
          byTitle.set(key, {...enriched, researchers: mergedResearchers});
          continue;
        }

        byTitle.set(key, {...existing, researchers: mergedResearchers});
      }
    }

    return Array.from(byTitle.values()).sort((a, b) => {
      const dateA = String(a.publication_date || '');
      const dateB = String(b.publication_date || '');
      if (dateA && dateB && dateA !== dateB) return dateB.localeCompare(dateA);
      if ((b.publication_year || 0) !== (a.publication_year || 0)) {
        return (b.publication_year || 0) - (a.publication_year || 0);
      }
      return (b.analysis.relevance_score || 0) - (a.analysis.relevance_score || 0);
    });
  }, [profiles]);

  const filteredPapers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return papers;
    return papers.filter((paper) => {
      const yearText = String(paper.publication_year || '');
      return (
        paper.title.toLowerCase().includes(keyword) ||
        paper.researchers.some((item) => item.name.toLowerCase().includes(keyword)) ||
        (paper.source?.display_name || paper.primary_source || '').toLowerCase().includes(keyword) ||
        (paper.doi || paper.doi_url || '').toLowerCase().includes(keyword) ||
        yearText.includes(keyword)
      );
    });
  }, [papers, query]);

  useEffect(() => {
    setVisibleCount(100);
  }, [query]);

  const visiblePapers = useMemo(
    () => filteredPapers.slice(0, visibleCount),
    [filteredPapers, visibleCount],
  );

  const hasMore = visibleCount < filteredPapers.length;

  const papersByYear = useMemo(() => {
    const groups = new Map<string, PaperView[]>();
    for (const paper of visiblePapers) {
      const key = String(paper.publication_year || 'Unknown');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)?.push(paper);
    }
    return Array.from(groups.entries()).sort((a, b) => Number(b[0]) - Number(a[0]));
  }, [visiblePapers]);

  return (
    <Layout title="Papers">
      <main className={styles.page}>
        <div className="container">
          <Heading as="h1">Papers</Heading>
          <p>Main affective-related papers from tracked researchers (deduplicated by title).</p>
          <p className={styles.note}>
            Disclaimer: author order and venue are resolved from OpenAlex/DOI metadata; problem/method directions and TLDR are
            AI-generated and may contain errors.
          </p>
          <section className={styles.searchSection}>
            <label>
              Search
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="title / researcher / venue / year"
                type="text"
              />
            </label>
          </section>
          <p className={styles.resultCount}>Papers: {filteredPapers.length}</p>

          {loading ? (
            <p>Loading papers...</p>
          ) : filteredPapers.length === 0 ? (
            <p>No papers yet. Run `npm run researcher:build` first.</p>
          ) : (
            <>
              {papersByYear.map(([year, yearPapers]) => (
                <section className={styles.yearSection} key={year}>
                  <h2 className={styles.yearHeader}>{year}</h2>
                  <div className={styles.grid}>
                    {yearPapers.map((paper) => (
                      <article className={styles.card} key={paper.id}>
                        <span className={styles.yearBadge}>
                          {formatYearMonth(paper.publication_date, paper.publication_year)}
                        </span>

                        <h2 className={styles.titleScroll} title={paper.title}>
                          {paper.title}
                        </h2>

                        <p className={styles.rowLine}>
                          Researchers:{' '}
                          <span className={styles.rowLineValue}>
                            {paper.researchers.map((item, index) => (
                              <span key={item.id}>
                                {index > 0 ? ', ' : ''}
                                <Link className={styles.researcherLink} to={`/researchers/detail?id=${encodeURIComponent(item.id)}`}>
                                  {item.name}
                                </Link>
                              </span>
                            ))}
                          </span>
                        </p>

                        <p className={styles.rowLine}>
                          Venue:{' '}
                          <span className={styles.rowLineValue}>
                            {paper.links?.landing_page || paper.links?.openalex || paper.doi_url || paper.doi ? (
                              <a
                                href={paper.links?.landing_page || paper.links?.openalex || paper.doi_url || paper.doi || '#'}
                                rel="noreferrer"
                                target="_blank">
                                {getVenueLabel(paper)}
                              </a>
                            ) : (
                              getVenueLabel(paper)
                            )}
                          </span>
                        </p>

                        <p className={styles.rowLine}>
                          Source:{' '}
                          <span className={styles.rowLineValue}>
                            {paper.links?.openalex ? (
                              <a href={paper.links.openalex} rel="noreferrer" target="_blank">
                                OpenAlex
                              </a>
                            ) : (
                              '-'
                            )}
                          </span>
                        </p>

                        <div className={styles.blockScrollLg}>
                          <p className={styles.blockLabel}>TLDR</p>
                          <p className={styles.blockText}>{paper.analysis?.tldr || '-'}</p>
                        </div>

                        <div className={styles.blockScrollMd}>
                          <p className={styles.blockLabel}>Problem Directions</p>
                          <p className={styles.blockText}>{formatPreviewList(getProblemDirections(paper.analysis))}</p>
                        </div>

                        <div className={styles.blockScrollMd}>
                          <p className={styles.blockLabel}>Method Directions</p>
                          <p className={styles.blockText}>{formatPreviewList(getMethodDirections(paper.analysis))}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
              {hasMore && (
                <div className={styles.loadMoreWrap}>
                  <button
                    className={styles.loadMoreBtn}
                    onClick={() => setVisibleCount((count) => count + 100)}
                    type="button">
                    Load more
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </Layout>
  );
}

import type {ReactNode} from 'react';
import {useMemo} from 'react';
import {useState} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import profileData from '@site/data/researchers/researcher.profile.json';
import styles from './papers.module.css';

type WorkItem = {
  id: string;
  title: string;
  publication_year: number | null;
  publication_date?: string | null;
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
  };
};

type ResearcherProfile = {
  identity: {
    name: string;
    openalex_author_id: string;
  };
  works: WorkItem[];
};

type ProfileFile = {
  researchers: ResearcherProfile[];
};

const profile = profileData as ProfileFile;

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

function formatYearMonth(dateText: string | null | undefined, year: number | null) {
  const raw = String(dateText || '').trim();
  if (raw) {
    const m = raw.match(/^(\d{4})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}`;
  }
  return String(year || '-');
}

export default function PapersPage(): ReactNode {
  const [query, setQuery] = useState('');

  const papers = useMemo(() => {
    const byTitle = new Map<string, WorkItem & {researcherName: string; researcherId: string}>();

    for (const researcher of profile.researchers) {
      for (const work of researcher.works || []) {
        if (!work.analysis?.is_interesting) continue;
        const key = normalizeTitle(work.title);
        if (!key) continue;

        const enriched = {
          ...work,
          researcherName: researcher.identity.name,
          researcherId: researcher.identity.openalex_author_id,
        };

        const existing = byTitle.get(key);
        if (!existing) {
          byTitle.set(key, enriched);
          continue;
        }

        if ((enriched.analysis.relevance_score || 0) > (existing.analysis.relevance_score || 0)) {
          byTitle.set(key, enriched);
          continue;
        }

        if ((enriched.cited_by_count || 0) > (existing.cited_by_count || 0)) {
          byTitle.set(key, enriched);
        }
      }
    }

    return Array.from(byTitle.values()).sort((a, b) => {
      const dateA = String(a.publication_date || '');
      const dateB = String(b.publication_date || '');
      if (dateA && dateB && dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }
      if ((b.publication_year || 0) !== (a.publication_year || 0)) {
        return (b.publication_year || 0) - (a.publication_year || 0);
      }
      return (b.analysis.relevance_score || 0) - (a.analysis.relevance_score || 0);
    });
  }, []);

  const filteredPapers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return papers;

    return papers.filter((paper) => {
      const yearText = String(paper.publication_year || '');
      return (
        paper.title.toLowerCase().includes(keyword) ||
        paper.researcherName.toLowerCase().includes(keyword) ||
        (paper.source?.display_name || paper.primary_source || '').toLowerCase().includes(keyword) ||
        yearText.includes(keyword)
      );
    });
  }, [papers, query]);

  const papersByYear = useMemo(() => {
    const groups = new Map<string, (WorkItem & {researcherName: string; researcherId: string})[]>();
    for (const paper of filteredPapers) {
      const key = String(paper.publication_year || 'Unknown');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)?.push(paper);
    }
    return Array.from(groups.entries()).sort((a, b) => Number(b[0]) - Number(a[0]));
  }, [filteredPapers]);

  return (
    <Layout title="Papers">
      <main className={styles.page}>
        <div className="container">
          <Heading as="h1">Papers</Heading>
          <p>Main affective-related papers from tracked researchers (deduplicated by title).</p>
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

          {filteredPapers.length === 0 ? (
            <p>No papers yet. Run `npm run researcher:build` first.</p>
          ) : (
            papersByYear.map(([year, yearPapers]) => (
              <section className={styles.yearSection} key={year}>
                <h2 className={styles.yearHeader}>{year}</h2>
                <div className={styles.grid}>
                  {yearPapers.map((paper) => (
                    <article className={styles.card} key={paper.id}>
                      <div className={styles.cardTop}>
                        <span className={styles.yearBadge}>{formatYearMonth(paper.publication_date, paper.publication_year)}</span>
                      </div>

                      <h2 className={styles.title} title={paper.title}>
                        {paper.title}
                      </h2>

                      <p className={styles.metaLine}>
                        Researcher:{' '}
                        <Link className={styles.researcherLink} to={`/researchers/detail?id=${encodeURIComponent(paper.researcherId)}`}>
                          {paper.researcherName}
                        </Link>
                      </p>

                      <p className={styles.metaLine}>
                        Venue:{' '}
                        <a
                          href={paper.links?.landing_page || paper.links?.openalex || '#'}
                          rel="noreferrer"
                          target="_blank">
                          {normalizeVenueName(paper.source?.display_name || paper.primary_source)}
                        </a>
                      </p>

                      <div className={styles.actions}>
                        {paper.links?.openalex && (
                          <a href={paper.links.openalex} rel="noreferrer" target="_blank">
                            OpenAlex Source
                          </a>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </main>
    </Layout>
  );
}

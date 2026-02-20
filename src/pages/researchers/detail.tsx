import type {ReactNode} from 'react';
import {useEffect, useMemo, useState} from 'react';
import Link from '@docusaurus/Link';
import {useLocation} from '@docusaurus/router';
import useBaseUrl from '@docusaurus/useBaseUrl';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './detail.module.css';

type WorkAnalysis = {
  is_interesting: boolean;
  relevance_score: number;
  keywords: string[];
  research_directions: string[];
};

type WorkItem = {
  id: string;
  title: string;
  publication_year: number | null;
  publication_date?: string | null;
  doi?: string | null;
  doi_url?: string | null;
  primary_source: string | null;
  source?: {display_name: string | null};
  links?: {
    openalex: string | null;
    source_openalex: string | null;
    landing_page: string | null;
  };
  analysis: WorkAnalysis;
};

type ResearcherProfile = {
  identity: {
    name: string;
    openalex_author_id: string;
    google_scholar: string;
    openalex_author_url: string;
  };
  affiliation: {
    last_known_institution: string | null;
    last_known_country: string | null;
  };
  metrics: {
    h_index: number | null;
    cited_by_count: number;
  };
  topic_summary: {
    top_research_directions: {name: string; weight: number}[];
    trend_summary: string;
  };
  stats: {
    analyzed_works_count: number;
    interesting_works_count: number;
  };
  works: WorkItem[];
};

type IndexRecord = {
  identity: {
    name: string;
    openalex_author_id: string;
    google_scholar: string;
    openalex_author_url: string;
  };
  profile_path: string;
};

type IndexFile = {
  researchers: IndexRecord[];
};

function capitalizeFirst(text: string) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatList(items: string[] | undefined) {
  if (!items || items.length === 0) return '-';
  return items.map((item) => capitalizeFirst(item)).join(', ');
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

function formatInstitutionCountry(value: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  const alias: Record<string, string> = {
    中国: 'China',
    中华人民共和国: 'China',
    英国: 'United Kingdom',
    新西兰: 'New Zealand',
    美国: 'United States',
  };
  if (alias[raw]) return alias[raw];
  if (/^[A-Za-z]{2}$/.test(raw)) {
    try {
      const display = new Intl.DisplayNames(['en'], {type: 'region'});
      return display.of(raw.toUpperCase()) || raw.toUpperCase();
    } catch {
      return raw.toUpperCase();
    }
  }
  return raw;
}

export default function ResearcherDetailPage(): ReactNode {
  const location = useLocation();
  const baseUrlRoot = useBaseUrl('/');
  const indexUrl = useBaseUrl('data/researchers/researchers.index.json');
  const researcherId = useMemo(() => {
    const search = location.search || '';
    return new URLSearchParams(search).get('id') || '';
  }, [location.search]);

  const [researcher, setResearcher] = useState<ResearcherProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let disposed = false;
    async function loadProfile() {
      setLoading(true);
      try {
        const idxRes = await fetch(indexUrl);
        if (!idxRes.ok) throw new Error(`Failed to load index: ${idxRes.status}`);
        const indexJson = (await idxRes.json()) as IndexFile;
        const record = (indexJson.researchers || []).find((r) => r.identity.openalex_author_id === researcherId);
        if (!record) {
          if (!disposed) setResearcher(null);
          return;
        }
        const rel = String(record.profile_path || '').replace(/^\/+/, '');
        const profileUrl = `${baseUrlRoot}${rel}`;
        const res = await fetch(profileUrl);
        if (!res.ok) throw new Error(`Failed to load profile: ${res.status}`);
        const profile = (await res.json()) as ResearcherProfile;
        if (!disposed) setResearcher(profile);
      } catch (err) {
        console.error(err);
        if (!disposed) setResearcher(null);
      } finally {
        if (!disposed) setLoading(false);
      }
    }
    if (researcherId) loadProfile();
    else setLoading(false);
    return () => {
      disposed = true;
    };
  }, [indexUrl, researcherId]);

  if (loading) {
    return (
      <Layout title="Researcher Detail">
        <main className={styles.page}>
          <div className="container">
            <Heading as="h1">Researcher Detail</Heading>
            <p>Loading...</p>
          </div>
        </main>
      </Layout>
    );
  }

  if (!researcher) {
    return (
      <Layout title="Researcher Detail">
        <main className={styles.page}>
          <div className="container">
            <Heading as="h1">Researcher Detail</Heading>
            <p>Researcher not found. Please select from the Researchers page.</p>
            <Link to="/researchers">Back to Researchers</Link>
          </div>
        </main>
      </Layout>
    );
  }

  const interestingWorks = researcher.works
    .filter((work) => work.analysis?.is_interesting)
    .sort((a, b) => {
      const dateA = String(a.publication_date || '');
      const dateB = String(b.publication_date || '');
      if (dateA && dateB && dateA !== dateB) return dateA > dateB ? -1 : 1;
      const yearA = a.publication_year || 0;
      const yearB = b.publication_year || 0;
      if (yearA !== yearB) return yearB - yearA;
      return (b.analysis.relevance_score || 0) - (a.analysis.relevance_score || 0);
    });

  return (
    <Layout title={`${researcher.identity.name} - Detail`}>
      <main className={styles.page}>
        <div className="container">
          <p>
            <Link to="/researchers">Researchers</Link> / {researcher.identity.name}
          </p>

          <Heading as="h1">{researcher.identity.name}</Heading>
          <p>
            <a href={researcher.identity.google_scholar} rel="noreferrer" target="_blank">
              Google Scholar
            </a>{' '}
            |{' '}
            <a href={researcher.identity.openalex_author_url} rel="noreferrer" target="_blank">
              OpenAlex
            </a>
          </p>

          <div className={styles.metaGrid}>
            <div className={styles.metaCard}>
              <span className={styles.metaLabel}>Institution</span>
              <span className={styles.metaValue}>{researcher.affiliation.last_known_institution || '-'}</span>
            </div>
            <div className={styles.metaCard}>
              <span className={styles.metaLabel}>Institution Country</span>
              <span className={styles.metaValue}>{formatInstitutionCountry(researcher.affiliation.last_known_country)}</span>
            </div>
            <div className={styles.metaCard}>
              <span className={styles.metaLabel}>Analyzed / Affective-related</span>
              <span className={styles.metaValue}>
                {researcher.stats.analyzed_works_count} / {researcher.stats.interesting_works_count}
              </span>
            </div>
            <div className={styles.metaCard}>
              <span className={styles.metaLabel}>H-index / Citations</span>
              <span className={styles.metaValue}>
                {researcher.metrics.h_index ?? '-'} / {researcher.metrics.cited_by_count}
              </span>
            </div>
          </div>

          <Heading as="h2" className="margin-top--md">
            Top Research Directions
          </Heading>
          <div className={styles.directionList}>
            {researcher.topic_summary.top_research_directions.map((item) => (
              <span key={item.name} className={styles.directionTag}>
                {item.name}
              </span>
            ))}
          </div>

          <p className="margin-top--sm">{researcher.topic_summary.trend_summary || 'No trend summary yet.'}</p>

          <Heading as="h2" className="margin-top--md">
            Affective-related Papers ({interestingWorks.length})
          </Heading>
          <div className={styles.paperGrid}>
            {interestingWorks.map((work) => (
              <article className={styles.paperCard} key={work.id}>
                <div className={styles.paperTop}>
                  <span className={styles.paperDate}>{formatYearMonth(work.publication_date, work.publication_year)}</span>
                </div>
                <h3 className={styles.paperTitle} title={work.title}>
                  {work.title}
                </h3>
                <p className={styles.paperMeta}>
                  Venue:{' '}
                  {work.source?.display_name || work.primary_source || work.doi || work.doi_url ? (
                    <a
                      href={work.links?.landing_page || work.links?.openalex || work.links?.source_openalex || work.doi_url || work.doi || '#'}
                      rel="noreferrer"
                      target="_blank">
                      {getVenueLabel(work)}
                    </a>
                  ) : (
                    getVenueLabel(work)
                  )}
                </p>
                {work.links?.openalex && (
                  <p className={styles.paperMeta}>
                    <a href={work.links.openalex} rel="noreferrer" target="_blank">
                      Source(OpenAlex)
                    </a>
                  </p>
                )}
                <p className={styles.paperMeta}>Directions</p>
                <p className={styles.paperText}>{formatList(work.analysis.research_directions)}</p>
                <p className={styles.paperMeta}>Keywords</p>
                <p className={styles.paperText}>{formatList(work.analysis.keywords)}</p>
              </article>
            ))}
          </div>
        </div>
      </main>
    </Layout>
  );
}

import type {ReactNode} from 'react';
import {useMemo} from 'react';
import Link from '@docusaurus/Link';
import {useLocation} from '@docusaurus/router';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import profileData from '@site/data/researchers/researcher.profile.json';
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
  primary_source: string | null;
  source?: {display_name: string | null};
  links?: {
    openalex: string | null;
    source_openalex: string | null;
    landing_page: string | null;
  };
  openalex_analysis?: {
    primary_topic: {
      name: string | null;
      subfield: string | null;
      field: string | null;
      domain: string | null;
    } | null;
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

type ProfileFile = {
  generated_at: string | null;
  pipeline_version: string;
  researchers: ResearcherProfile[];
};

const profile = profileData as ProfileFile;

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
  const researcherId = useMemo(() => {
    const search = location.search || '';
    return new URLSearchParams(search).get('id') || '';
  }, [location.search]);

  const researcher = profile.researchers.find((item) => item.identity.openalex_author_id === researcherId);

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
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Title</th>
                  <th>Venue</th>
                  <th>Directions</th>
                  <th>Keywords</th>
                </tr>
              </thead>
              <tbody>
                {interestingWorks.map((work) => (
                  <tr key={work.id}>
                    <td>{work.publication_year || '-'}</td>
                    <td>{work.title}</td>
                    <td>
                      {work.source?.display_name || work.primary_source ? (
                        <a
                          href={
                            work.links?.landing_page || work.links?.openalex || work.links?.source_openalex || '#'
                          }
                          rel="noreferrer"
                          target="_blank">
                          {normalizeVenueName(work.source?.display_name || work.primary_source)}
                        </a>
                      ) : (
                        '-'
                      )}
                      <div>
                        {work.links?.openalex && (
                          <a href={work.links.openalex} rel="noreferrer" target="_blank">
                            Source(OpenAlex)
                          </a>
                        )}
                      </div>
                    </td>
                    <td>{formatList(work.analysis.research_directions)}</td>
                    <td>{formatList(work.analysis.keywords)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </Layout>
  );
}

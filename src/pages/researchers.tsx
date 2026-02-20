import type {ReactNode} from 'react';
import {useMemo, useState} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import profileData from '@site/data/researchers/researcher.profile.json';
import styles from './researchers.module.css';

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
  };
  stats: {
    analyzed_works_count: number;
    interesting_works_count: number;
  };
};

type ProfileFile = {
  generated_at: string | null;
  pipeline_version: string;
  researchers: ResearcherProfile[];
};

const profile = profileData as ProfileFile;

function formatTopDirections(researcher: ResearcherProfile) {
  return (researcher.topic_summary.top_research_directions || [])
    .slice(0, 3)
    .map((item) => item.name)
    .join(', ');
}

function formatDateOnly(value: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function formatInstitutionCountry(value: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return '';
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

export default function ResearchersPage(): ReactNode {
  const [countryFilter, setCountryFilter] = useState('All');
  const [universityFilter, setUniversityFilter] = useState('All');
  const [query, setQuery] = useState('');

  const countryOptions = useMemo(
    () =>
      uniqueSorted(
        profile.researchers.map((researcher) => formatInstitutionCountry(researcher.affiliation.last_known_country)),
      ),
    [],
  );
  const universityOptions = useMemo(
    () =>
      uniqueSorted(profile.researchers.map((researcher) => researcher.affiliation.last_known_institution || '')),
    [],
  );

  const filteredResearchers = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return profile.researchers.filter((researcher) => {
      const institutionCountry = formatInstitutionCountry(researcher.affiliation.last_known_country);
      const countryMatch =
        countryFilter === 'All' || institutionCountry === countryFilter;
      const universityMatch =
        universityFilter === 'All' || (researcher.affiliation.last_known_institution || '') === universityFilter;
      const keywordMatch =
        keyword.length === 0 ||
        researcher.identity.name.toLowerCase().includes(keyword) ||
        institutionCountry.toLowerCase().includes(keyword) ||
        (researcher.affiliation.last_known_institution || '').toLowerCase().includes(keyword) ||
        formatTopDirections(researcher).toLowerCase().includes(keyword);

      return countryMatch && universityMatch && keywordMatch;
    });
  }, [countryFilter, query, universityFilter]);

  return (
    <Layout title="Researchers">
      <main className={styles.page}>
        <div className="container">
          <Heading as="h1">Researchers</Heading>
          <p>Generated at: {formatDateOnly(profile.generated_at)}</p>
          <p className={styles.note}>
            Institution is shown by priority rule: seed (with Scholar) first, otherwise OpenAlex first institution.
            Country is resolved from institution name (geocoding lookup) and displayed as full country name.
          </p>

          {profile.researchers.length === 0 ? (
            <div className={styles.empty}>
              <p>No profile data yet.</p>
              <p>
                Run <code>npm run researcher:build</code>, then refresh this page.
              </p>
            </div>
          ) : (
            <>
              <section className={styles.filters}>
                <label>
                  Institution Country
                  <select value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)}>
                    <option value="All">All</option>
                    {countryOptions.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  University
                  <select value={universityFilter} onChange={(event) => setUniversityFilter(event.target.value)}>
                    <option value="All">All</option>
                    {universityOptions.map((university) => (
                      <option key={university} value={university}>
                        {university}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.searchWrap}>
                  Search
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="name / topic / institution country / university"
                    type="text"
                  />
                </label>
              </section>

              <p className={styles.resultCount}>Researchers: {filteredResearchers.length}</p>

              <div className={styles.grid}>
                {filteredResearchers.map((researcher) => (
                  <article className={styles.card} key={researcher.identity.openalex_author_id}>
                    <Heading as="h2" className={styles.name}>
                      {researcher.identity.name}
                    </Heading>

                    <p className={styles.meta}>
                      {researcher.affiliation.last_known_institution || '-'}
                      {' | '}
                      {formatInstitutionCountry(researcher.affiliation.last_known_country) || '-'}
                    </p>

                    <p className={styles.meta}>
                      Analyzed/Affective-related: {researcher.stats.analyzed_works_count}/
                      {researcher.stats.interesting_works_count}
                    </p>

                    <p className={styles.directions}>
                      Top directions: {formatTopDirections(researcher) || '-'}
                    </p>

                    <div className={styles.links}>
                      <a href={researcher.identity.google_scholar} rel="noreferrer" target="_blank">
                        Google Scholar
                      </a>
                      <a href={researcher.identity.openalex_author_url} rel="noreferrer" target="_blank">
                        OpenAlex
                      </a>
                      <Link to={`/researchers/detail?id=${encodeURIComponent(researcher.identity.openalex_author_id)}`}>
                        View Details
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </Layout>
  );
}

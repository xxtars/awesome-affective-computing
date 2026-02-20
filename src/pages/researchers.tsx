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
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

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

function splitNameParts(fullName: string) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return {familyName: '', givenName: ''};
  if (parts.length === 1) return {familyName: parts[0], givenName: ''};
  return {
    familyName: parts[parts.length - 1],
    givenName: parts.slice(0, -1).join(' '),
  };
}

function getNameInitial(text: string) {
  const normalized = String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const match = normalized.match(/[A-Za-z]/);
  return match ? match[0].toUpperCase() : '#';
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
  const [initialAxis, setInitialAxis] = useState<'family' | 'given'>('family');
  const [nameInitialFilter, setNameInitialFilter] = useState('All');
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
  const activeInitialOptions = useMemo(() => {
    return uniqueSorted(
      profile.researchers.map((researcher) => {
        const nameParts = splitNameParts(researcher.identity.name);
        const source = initialAxis === 'family' ? nameParts.familyName : nameParts.givenName;
        return getNameInitial(source);
      }),
    );
  }, [initialAxis]);

  const resetFilters = () => {
    setCountryFilter('All');
    setUniversityFilter('All');
    setInitialAxis('family');
    setNameInitialFilter('All');
    setQuery('');
  };

  const filteredResearchers = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    const matched = profile.researchers.filter((researcher) => {
      const nameParts = splitNameParts(researcher.identity.name);
      const familyInitial = getNameInitial(nameParts.familyName);
      const givenInitial = getNameInitial(nameParts.givenName);
      const institutionCountry = formatInstitutionCountry(researcher.affiliation.last_known_country);
      const countryMatch =
        countryFilter === 'All' || institutionCountry === countryFilter;
      const universityMatch =
        universityFilter === 'All' || (researcher.affiliation.last_known_institution || '') === universityFilter;
      const selectedInitial = initialAxis === 'family' ? familyInitial : givenInitial;
      const initialMatch = nameInitialFilter === 'All' || selectedInitial === nameInitialFilter;
      const keywordMatch =
        keyword.length === 0 ||
        researcher.identity.name.toLowerCase().includes(keyword) ||
        institutionCountry.toLowerCase().includes(keyword) ||
        (researcher.affiliation.last_known_institution || '').toLowerCase().includes(keyword) ||
        formatTopDirections(researcher).toLowerCase().includes(keyword);

      return countryMatch && universityMatch && initialMatch && keywordMatch;
    });

    return matched.sort((a, b) => {
      const aName = splitNameParts(a.identity.name);
      const bName = splitNameParts(b.identity.name);
      const familyCmp = aName.familyName.localeCompare(bName.familyName, 'en', {sensitivity: 'base'});
      if (familyCmp !== 0) return familyCmp;
      const givenCmp = aName.givenName.localeCompare(bName.givenName, 'en', {sensitivity: 'base'});
      if (givenCmp !== 0) return givenCmp;
      return a.identity.name.localeCompare(b.identity.name, 'en', {sensitivity: 'base'});
    });
  }, [countryFilter, initialAxis, nameInitialFilter, query, universityFilter]);

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
                <div className={styles.filterHeader}>
                  <span className={styles.filterTitle}>Name Initial</span>
                  <button className={styles.resetBtn} onClick={resetFilters} type="button">
                    Reset Filters
                  </button>
                </div>

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

                <div className={styles.initialBarWrap}>
                  <div className={styles.axisSwitch}>
                    <button
                      className={`${styles.axisBtn} ${initialAxis === 'family' ? styles.axisBtnActive : ''}`}
                      onClick={() => {
                        setInitialAxis('family');
                        setNameInitialFilter('All');
                      }}
                      type="button">
                      Family
                    </button>
                    <button
                      className={`${styles.axisBtn} ${initialAxis === 'given' ? styles.axisBtnActive : ''}`}
                      onClick={() => {
                        setInitialAxis('given');
                        setNameInitialFilter('All');
                      }}
                      type="button">
                      Given
                    </button>
                  </div>
                  <div className={styles.initialBar}>
                    <button
                      className={`${styles.initialBtn} ${nameInitialFilter === 'All' ? styles.initialBtnActive : ''}`}
                      onClick={() => setNameInitialFilter('All')}
                      type="button">
                      All
                    </button>
                    {ALPHABET.map((initial) => {
                      const enabled = activeInitialOptions.includes(initial);
                      return (
                        <button
                          className={`${styles.initialBtn} ${nameInitialFilter === initial ? styles.initialBtnActive : ''}`}
                          disabled={!enabled}
                          key={initial}
                          onClick={() => setNameInitialFilter(initial)}
                          type="button">
                          {initial}
                        </button>
                      );
                    })}
                  </div>
                </div>

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
                    </p>

                    <p className={styles.meta}>
                      {formatInstitutionCountry(researcher.affiliation.last_known_country) || '-'}
                    </p>

                    <p className={styles.directions}>
                      Top directions: <span className={styles.directionsText}>{formatTopDirections(researcher) || '-'}</span>
                    </p>

                    <p className={styles.meta}>
                      Analyzed/Affective-related: {researcher.stats.analyzed_works_count}/
                      {researcher.stats.interesting_works_count}
                    </p>

                    <div className={styles.links}>
                      <Link
                        className={styles.detailBtn}
                        to={`/researchers/detail?id=${encodeURIComponent(researcher.identity.openalex_author_id)}`}>
                        View Details
                      </Link>
                      <div className={styles.secondaryLinks}>
                        <a href={researcher.identity.google_scholar} rel="noreferrer" target="_blank">
                          Google Scholar
                        </a>
                        <a href={researcher.identity.openalex_author_url} rel="noreferrer" target="_blank">
                          OpenAlex
                        </a>
                      </div>
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

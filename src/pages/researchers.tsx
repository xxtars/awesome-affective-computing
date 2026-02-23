import type {ReactNode} from 'react';
import {useEffect, useMemo, useState} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import {buildResearchDataUrl, useResearchDataBaseUrl} from '../lib/researchData';
import {formatDirectionText} from '../lib/directionCase';
import styles from './researchers.module.css';

type ResearcherProfile = {
  identity: {
    name: string;
    openalex_author_id: string;
    google_scholar: string;
    openalex_author_url: string;
  };
  affiliation: {
    institutions?: string[];
    institution_countries?: (string | null)[];
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
    yearly_counts?: Array<{
      year: number;
      analyzed: number;
      interesting: number;
    }>;
  };
  works?: Array<{
    publication_year?: number | null;
    analysis?: {
      is_interesting?: boolean | null;
    };
  }>;
};

type IndexFile = {
  generated_at: string | null;
  pipeline_version: string;
  researchers: Array<{
    identity: ResearcherProfile['identity'];
    profile_path: string;
  }>;
};

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function formatTopDirections(researcher: ResearcherProfile) {
  return (researcher.topic_summary.top_research_directions || [])
    .slice(0, 3)
    .map((item) => formatDirectionText(item.name))
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

function splitInstitutionNames(value: string | null | undefined) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  return raw
    .split(/[;；]|\\s\\|\\s/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getInstitutions(researcher: ResearcherProfile) {
  const list = Array.isArray(researcher.affiliation?.institutions)
    ? researcher.affiliation.institutions.map((x) => String(x || '').trim()).filter(Boolean)
    : [];
  if (list.length > 0) return list;
  return splitInstitutionNames(researcher.affiliation?.last_known_institution);
}

function getInstitutionCountries(researcher: ResearcherProfile) {
  const list = Array.isArray(researcher.affiliation?.institution_countries)
    ? researcher.affiliation.institution_countries
        .map((x) => formatInstitutionCountry(x ? String(x).trim() : null))
        .filter(Boolean)
    : [];
  if (list.length > 0) return list;
  const fallback = formatInstitutionCountry(researcher.affiliation?.last_known_country || null);
  return fallback ? [fallback] : [];
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

function getWindowMinYear(
  windowType: 'all' | 'recent_5y' | 'recent_3y' | 'recent_1y',
  currentYear: number,
) {
  if (windowType === 'recent_1y') return currentYear;
  if (windowType === 'recent_3y') return currentYear - 2;
  if (windowType === 'recent_5y') return currentYear - 4;
  return null;
}

function getWindowStats(
  researcher: ResearcherProfile,
  windowType: 'all' | 'recent_5y' | 'recent_3y' | 'recent_1y',
  currentYear: number,
) {
  const minYear = getWindowMinYear(windowType, currentYear);
  const yearly = Array.isArray(researcher.stats?.yearly_counts)
    ? researcher.stats.yearly_counts
    : [];

  if (yearly.length > 0) {
    const scoped = yearly.filter((item) => minYear == null || Number(item.year) >= minYear);
    const analyzed = scoped.reduce((sum, item) => sum + Number(item.analyzed || 0), 0);
    const interesting = scoped.reduce((sum, item) => sum + Number(item.interesting || 0), 0);
    return {analyzed, interesting, ratio: analyzed > 0 ? interesting / analyzed : 0};
  }

  const works = Array.isArray(researcher.works) ? researcher.works : [];

  if (works.length === 0) {
    const analyzed = Number(researcher.stats?.analyzed_works_count || 0);
    const interesting = Number(researcher.stats?.interesting_works_count || 0);
    return {analyzed, interesting, ratio: analyzed > 0 ? interesting / analyzed : 0};
  }

  const scoped = works.filter((w) => {
    const year = w.publication_year;
    return Number.isFinite(year) && (minYear == null || Number(year) >= minYear);
  });
  if (scoped.length === 0) return {analyzed: 0, interesting: 0, ratio: 0};

  const analyzed = scoped.length;
  const interesting = scoped.filter((w) => Boolean(w.analysis?.is_interesting)).length;
  return {analyzed, interesting, ratio: analyzed > 0 ? interesting / analyzed : 0};
}

export default function ResearchersPage(): ReactNode {
  const dataBaseUrl = useResearchDataBaseUrl();
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [researchers, setResearchers] = useState<ResearcherProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [countryFilter, setCountryFilter] = useState('All');
  const [universityFilter, setUniversityFilter] = useState('All');
  const [initialAxis, setInitialAxis] = useState<'family' | 'given'>('family');
  const [nameInitialFilter, setNameInitialFilter] = useState('All');
  const [sortMetric, setSortMetric] = useState<'none' | 'affective_count' | 'affective_ratio'>('none');
  const [sortWindow, setSortWindow] = useState<'all' | 'recent_5y' | 'recent_3y' | 'recent_1y'>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let disposed = false;
    async function loadIndex() {
      setLoading(true);
      try {
        const url = buildResearchDataUrl(dataBaseUrl, 'data/researchers/researchers.index.json');
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to load index: ${res.status}`);
        const json = (await res.json()) as IndexFile;
        const loadedProfiles = await Promise.all(
          (json.researchers || []).map(async (researcher) => {
            const rel = String(researcher.profile_path || '').replace(/^\/+/, '');
            if (!rel) return null;
            const profileUrl = buildResearchDataUrl(dataBaseUrl, rel);
            const profileRes = await fetch(profileUrl);
            if (!profileRes.ok) return null;
            return (await profileRes.json()) as ResearcherProfile;
          }),
        );

        if (!disposed) {
          setGeneratedAt(json.generated_at || null);
          setResearchers(loadedProfiles.filter(Boolean) as ResearcherProfile[]);
        }
      } catch (err) {
        console.error(err);
        if (!disposed) {
          setGeneratedAt(null);
          setResearchers([]);
        }
      } finally {
        if (!disposed) setLoading(false);
      }
    }
    loadIndex();
    return () => {
      disposed = true;
    };
  }, [dataBaseUrl]);

  const countryOptions = useMemo(
    () =>
      uniqueSorted(
        researchers.flatMap((researcher) => getInstitutionCountries(researcher)),
      ),
    [researchers],
  );
  const universityOptions = useMemo(
    () =>
      uniqueSorted(
        researchers.flatMap((researcher) => getInstitutions(researcher)),
      ),
    [researchers],
  );
  const activeInitialOptions = useMemo(() => {
    return uniqueSorted(
      researchers.map((researcher) => {
        const nameParts = splitNameParts(researcher.identity.name);
        const source = initialAxis === 'family' ? nameParts.familyName : nameParts.givenName;
        return getNameInitial(source);
      }),
    );
  }, [initialAxis, researchers]);

  const resetFilters = () => {
    setCountryFilter('All');
    setUniversityFilter('All');
    setInitialAxis('family');
    setNameInitialFilter('All');
    setSortMetric('none');
    setSortWindow('all');
    setQuery('');
  };

  const filteredResearchers = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    const matched = researchers.filter((researcher) => {
      const nameParts = splitNameParts(researcher.identity.name);
      const familyInitial = getNameInitial(nameParts.familyName);
      const givenInitial = getNameInitial(nameParts.givenName);
      const countries = getInstitutionCountries(researcher);
      const institutions = getInstitutions(researcher);
      const countryMatch = countryFilter === 'All' || countries.includes(countryFilter);
      const universityMatch = universityFilter === 'All' || institutions.includes(universityFilter);
      const selectedInitial = initialAxis === 'family' ? familyInitial : givenInitial;
      const initialMatch = nameInitialFilter === 'All' || selectedInitial === nameInitialFilter;
      const keywordMatch =
        keyword.length === 0 ||
        researcher.identity.name.toLowerCase().includes(keyword) ||
        countries.join(' ').toLowerCase().includes(keyword) ||
        institutions.join(' ').toLowerCase().includes(keyword) ||
        formatTopDirections(researcher).toLowerCase().includes(keyword);

      return countryMatch && universityMatch && initialMatch && keywordMatch;
    });

    const currentYear = new Date().getFullYear();

    return matched.sort((a, b) => {
      const aWindow = getWindowStats(a, sortWindow, currentYear);
      const bWindow = getWindowStats(b, sortWindow, currentYear);
      const aName = splitNameParts(a.identity.name);
      const bName = splitNameParts(b.identity.name);
      const familyCmp = aName.familyName.localeCompare(bName.familyName, 'en', { sensitivity: 'base' });
      const givenCmp = aName.givenName.localeCompare(bName.givenName, 'en', { sensitivity: 'base' });

      if (sortMetric === 'none') {
        if (familyCmp !== 0) return familyCmp;
        if (givenCmp !== 0) return givenCmp;
      } else if (sortMetric === 'affective_ratio') {
        if (bWindow.ratio !== aWindow.ratio) return bWindow.ratio - aWindow.ratio;
        if (bWindow.interesting !== aWindow.interesting) return bWindow.interesting - aWindow.interesting;
      } else {
        if (bWindow.interesting !== aWindow.interesting) return bWindow.interesting - aWindow.interesting;
        if (bWindow.ratio !== aWindow.ratio) return bWindow.ratio - aWindow.ratio;
      }

      // Stable fallback by name.
      if (familyCmp !== 0) return familyCmp;
      if (givenCmp !== 0) return givenCmp;

      return a.identity.name.localeCompare(b.identity.name, 'en', {sensitivity: 'base'});
    });
  }, [countryFilter, initialAxis, nameInitialFilter, query, researchers, sortMetric, sortWindow, universityFilter]);

  const windowStatsById = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const map = new Map<string, {analyzed: number; interesting: number; ratio: number}>();
    filteredResearchers.forEach((researcher) => {
      map.set(
        researcher.identity.openalex_author_id,
        getWindowStats(researcher, sortWindow, currentYear),
      );
    });
    return map;
  }, [filteredResearchers, sortWindow]);

  return (
    <Layout title="Researchers">
      <main className={styles.page}>
        <div className="container">
          <Heading as="h1">Researchers</Heading>
          <p>Generated at: {formatDateOnly(generatedAt)}</p>
          <p className={styles.note}>
            Institution is shown by priority rule: Google Scholar first, then OpenAlex, otherwise ORCID.
            Institution country/region is resolved per institution from institution name (geocoding lookup) and
            displayed as full country name.
          </p>

          {loading ? (
            <div className={styles.empty}>
              <p>Loading researcher data...</p>
            </div>
          ) : researchers.length === 0 ? (
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
                  <button className={styles.resetBtn} onClick={resetFilters} type="button">
                    Reset Filters
                  </button>
                </div>

                <label>
                  Institution Country/Region
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
                  Institution
                  <select value={universityFilter} onChange={(event) => setUniversityFilter(event.target.value)}>
                    <option value="All">All</option>
                    {universityOptions.map((university) => (
                      <option key={university} value={university}>
                        {university}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Sort Metric
                  <select value={sortMetric} onChange={(event) => setSortMetric(event.target.value as typeof sortMetric)}>
                    <option value="none">None (family name A-Z)</option>
                    <option value="affective_count">Affective-related count (high to low)</option>
                    <option value="affective_ratio">Affective-related ratio (high to low)</option>
                  </select>
                </label>

                <label>
                  Time Window
                  <select value={sortWindow} onChange={(event) => setSortWindow(event.target.value as typeof sortWindow)}>
                    <option value="all">All time</option>
                    <option value="recent_5y">Recent 5 years</option>
                    <option value="recent_3y">Recent 3 years</option>
                    <option value="recent_1y">Recent 1 year</option>
                  </select>
                </label>

                <div className={styles.initialBarWrap}>
                  <div className={styles.initialTopRow}>
                    <span className={styles.initialLabel}>Name Initial</span>
                    <div className={styles.axisSwitch}>
                      <button
                        className={`${styles.axisBtn} ${initialAxis === 'family' ? styles.axisBtnActive : ''}`}
                        aria-pressed={initialAxis === 'family'}
                        onClick={() => {
                          setInitialAxis('family');
                          setNameInitialFilter('All');
                        }}
                        type="button">
                        Family
                      </button>
                      <button
                        className={`${styles.axisBtn} ${initialAxis === 'given' ? styles.axisBtnActive : ''}`}
                        aria-pressed={initialAxis === 'given'}
                        onClick={() => {
                          setInitialAxis('given');
                          setNameInitialFilter('All');
                        }}
                        type="button">
                        Given
                      </button>
                    </div>
                  </div>
                  <div className={styles.initialBar}>
                    <button
                      className={`${styles.initialBtn} ${nameInitialFilter === 'All' ? styles.initialBtnActive : ''}`}
                      aria-pressed={nameInitialFilter === 'All'}
                      onClick={() => setNameInitialFilter('All')}
                      type="button">
                      All
                    </button>
                    {ALPHABET.map((initial) => {
                      const enabled = activeInitialOptions.includes(initial);
                      return (
                        <button
                          className={`${styles.initialBtn} ${nameInitialFilter === initial ? styles.initialBtnActive : ''}`}
                          aria-pressed={nameInitialFilter === initial}
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
                    placeholder="name / topic / institution country/region / institution"
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

                    {(() => {
                      const institutions = getInstitutions(researcher);
                      const countries = getInstitutionCountries(researcher);
                      const pairedLines =
                        institutions.length > 0
                          ? institutions.map((institution, index) => {
                              const country = countries[index] || '-';
                              return `${institution}, ${country}`;
                            })
                          : ['-'];
                      const institutionCountryLabel = pairedLines.join('\n');
                      const directionsLabel = formatTopDirections(researcher) || '-';
                      return (
                        <>
                          <div className={styles.infoBlock}>
                            <p className={styles.infoLabel}>Institution</p>
                            <div className={`${styles.infoScroll} ${styles.infoScrollInstitution}`} title={institutionCountryLabel}>
                              {institutionCountryLabel}
                            </div>
                          </div>

                          <div className={styles.infoBlock}>
                            <p className={styles.infoLabel}>Top directions</p>
                            <div className={`${styles.infoScroll} ${styles.infoScrollDirections}`} title={directionsLabel}>
                              {directionsLabel}
                            </div>
                          </div>
                        </>
                      );
                    })()}

                    <p className={styles.meta}>
                      {(() => {
                        const stats = windowStatsById.get(researcher.identity.openalex_author_id) || {
                          analyzed: 0,
                          interesting: 0,
                        };
                        return `Analyzed/Affective-related: ${stats.analyzed}/${stats.interesting}`;
                      })()}
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

import type {ReactNode} from 'react';
import {useEffect, useMemo, useState} from 'react';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import Link from '@docusaurus/Link';

import researchersData from '../data/researchers.json';
import {
  getAuthorById,
  getAuthorCandidatesByName,
  pickBestAuthorCandidate,
  type OpenAlexAuthor,
} from '../lib/openalex';
import styles from './index.module.css';

type ResearcherItem = (typeof researchersData)[number];

type TeamItem = {
  name: string;
  institution: string;
  country: string;
  directions: string[];
  homepage?: string;
  google_scholar?: string;
  openalex_author_id?: string;
};

function getUniqueCountries(teams: TeamItem[]) {
  return Array.from(new Set(teams.map((t) => t.country))).sort();
}

function getUniqueDirections(teams: TeamItem[]) {
  return Array.from(new Set(teams.flatMap((t) => t.directions))).sort();
}

function groupByInstitution(teams: TeamItem[]) {
  return teams.reduce<Record<string, TeamItem[]>>((acc, team) => {
    const key = team.institution;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(team);
    return acc;
  }, {});
}

function pickDirections(author?: OpenAlexAuthor): string[] {
  const topics = (author?.topics ?? [])
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((topic) => topic.display_name);

  if (topics.length > 0) {
    return topics;
  }

  return (author?.x_concepts ?? [])
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((concept) => concept.display_name);
}

function normalizeCountry(code?: string): string {
  if (!code) {
    return 'Unknown';
  }
  return code.toUpperCase();
}

async function hydrateResearcher(researcher: ResearcherItem): Promise<TeamItem> {
  const fallback: TeamItem = {
    name: researcher.name,
    institution: 'Unknown Institution',
    country: 'Unknown',
    directions: [],
    homepage: undefined,
    google_scholar: researcher.google_scholar,
    openalex_author_id: researcher.openalex_author_id,
  };

  try {
    let authorId = researcher.openalex_author_id;

    if (!authorId) {
      const candidates = await getAuthorCandidatesByName(researcher.name);
      authorId = pickBestAuthorCandidate(researcher.name, candidates)?.id;
    }

    if (!authorId) {
      return fallback;
    }

    const author = await getAuthorById(authorId);
    const firstInstitution = author.last_known_institutions?.[0];

    return {
      ...fallback,
      name: author.display_name || researcher.name,
      openalex_author_id: author.id,
      institution: firstInstitution?.display_name ?? fallback.institution,
      country: normalizeCountry(firstInstitution?.country_code),
      directions: pickDirections(author),
    };
  } catch {
    return fallback;
  }
}

function TeamCard({team}: {team: TeamItem}) {
  const researcherLink = team.openalex_author_id
    ? `/researcher?id=${encodeURIComponent(team.openalex_author_id)}`
    : `/researcher?name=${encodeURIComponent(team.name)}`;

  return (
    <article className={styles.teamCard}>
      <Heading as="h3" className={styles.teamName}>
        <Link to={researcherLink}>{team.name}</Link>
      </Heading>
      <p className={styles.teamInstitution}>{team.institution}</p>

      <div className={styles.teamMeta}>
        <div className={styles.teamMetaRow}>
          <span className={styles.metaKey}>Country</span>
          <span>{team.country}</span>
        </div>
        <div className={styles.teamMetaRow}>
          <span className={styles.metaKey}>Directions</span>
          <div className={styles.directionTags}>
            {team.directions.length > 0 ? (
              team.directions.map((dir) => (
                <span key={dir} className={styles.directionTag}>
                  {dir}
                </span>
              ))
            ) : (
              <span>Unknown</span>
            )}
          </div>
        </div>
      </div>

      <div className={styles.teamPapers}>
        {team.homepage && (
          <a href={team.homepage} className={styles.paperLink} target="_blank" rel="noreferrer">
            Homepage
          </a>
        )}
        {team.google_scholar && (
          <a href={team.google_scholar} className={styles.paperLink} target="_blank" rel="noreferrer">
            Google Scholar
          </a>
        )}
      </div>
    </article>
  );
}

export default function Teams(): ReactNode {
  const [countryFilter, setCountryFilter] = useState('All');
  const [directionFilter, setDirectionFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadTeams() {
      setLoading(true);
      const hydrated = await Promise.all(researchersData.map((r) => hydrateResearcher(r)));
      if (active) {
        setTeams(hydrated);
        setLoading(false);
      }
    }

    loadTeams();

    return () => {
      active = false;
    };
  }, []);

  const countries = useMemo(() => getUniqueCountries(teams), [teams]);
  const directions = useMemo(() => getUniqueDirections(teams), [teams]);

  const filteredTeams = useMemo(() => {
    const q = query.trim().toLowerCase();

    return teams.filter((team) => {
      const countryMatch = countryFilter === 'All' || team.country === countryFilter;
      const directionMatch =
        directionFilter === 'All' || team.directions.includes(directionFilter);
      const searchMatch =
        q.length === 0 ||
        team.name.toLowerCase().includes(q) ||
        team.institution.toLowerCase().includes(q);

      return countryMatch && directionMatch && searchMatch;
    });
  }, [teams, countryFilter, directionFilter, query]);

  const groupedTeams = useMemo(() => groupByInstitution(filteredTeams), [filteredTeams]);

  return (
    <Layout title="Teams" description="Follow affective computing researchers by institution">
      <header className={styles.pageHeader}>
        <div className="container">
          <Heading as="h1" className={styles.pageTitle}>
            Teams & Researchers
          </Heading>
          <p className={styles.pageSubtitle}>
            {teams.length} researchers · grouped by institution · metadata from OpenAlex
          </p>
        </div>
      </header>

      <main className="container margin-vert--lg">
        <section className="margin-bottom--lg">
          <div className={styles.filterGrid}>
            <label>
              Country
              <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
                <option value="All">All</option>
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Research Direction
              <select
                value={directionFilter}
                onChange={(e) => setDirectionFilter(e.target.value)}>
                <option value="All">All</option>
                {directions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.searchInputWrap}>
              Search researcher / institution
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Imperial, Picard"
              />
            </label>
          </div>
        </section>

        <p className="margin-bottom--md">
          Showing {filteredTeams.length} of {teams.length} researchers
        </p>

        {loading && <p>Loading researchers from OpenAlex...</p>}

        {!loading &&
          Object.entries(groupedTeams)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([institution, members]) => (
              <section key={institution} className="margin-bottom--lg">
                <Heading as="h2">{institution}</Heading>
                <div className={styles.teamGrid}>
                  {members.map((team) => (
                    <TeamCard key={team.name} team={team} />
                  ))}
                </div>
              </section>
            ))}

        {!loading && filteredTeams.length === 0 && <p>No researchers matched the current filters.</p>}
      </main>
    </Layout>
  );
}

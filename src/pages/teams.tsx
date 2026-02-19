import type {ReactNode} from 'react';
import {useEffect, useMemo, useState} from 'react';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import Link from '@docusaurus/Link';

import teamsData from '../data/teams.json';
import papersData from '../data/papers.json';
import styles from './index.module.css';

type TeamItem = (typeof teamsData)[number];

function getUniqueCountries(teams: TeamItem[]) {
  return Array.from(new Set(teams.map((t) => t.country))).sort();
}

function getUniqueDirections(teams: TeamItem[]) {
  return Array.from(new Set(teams.flatMap((t) => t.directions))).sort();
}

function getPaperUrl(title: string): string | undefined {
  const paper = papersData.find((p) => p.title === title);
  return paper?.paperUrl;
}

function TeamCard({team}: {team: TeamItem}) {
  return (
    <div className={styles.teamCard}>
      <Heading as="h3" className={styles.teamName}>
        {team.name}
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
            {team.directions.map((dir) => (
              <Link
                key={dir}
                to={`/directions?direction=${encodeURIComponent(dir)}`}
                className={styles.directionTag}>
                {dir}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {team.representative_papers.length > 0 && (
        <div className={styles.teamPapers}>
          <p className={styles.teamPapersTitle}>Representative Papers</p>
          {team.representative_papers.map((title) => {
            const url = getPaperUrl(title);
            return url ? (
              <a
                key={title}
                href={url}
                className={styles.paperLink}
                target="_blank"
                rel="noreferrer">
                {title}
              </a>
            ) : (
              <span key={title} className={styles.paperLink}>
                {title}
              </span>
            );
          })}
        </div>
      )}

      <a
        href={team.website}
        className={styles.teamWebsite}
        target="_blank"
        rel="noreferrer">
        Visit Website →
      </a>
    </div>
  );
}

export default function Teams(): ReactNode {
  const [countryFilter, setCountryFilter] = useState('All');
  const [directionFilter, setDirectionFilter] = useState('All');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const team = params.get('team');
      if (team) {
        const found = teamsData.find((t) => t.name === team);
        if (found) {
          setCountryFilter(found.country);
        }
      }
    }
  }, []);

  const countries = useMemo(() => getUniqueCountries(teamsData), []);
  const directions = useMemo(() => getUniqueDirections(teamsData), []);

  const filteredTeams = useMemo(() => {
    return teamsData.filter((team) => {
      const countryMatch = countryFilter === 'All' || team.country === countryFilter;
      const directionMatch =
        directionFilter === 'All' || team.directions.includes(directionFilter);
      return countryMatch && directionMatch;
    });
  }, [countryFilter, directionFilter]);

  return (
    <Layout
      title="Teams"
      description="Leading affective computing research teams around the world">
      <header className={styles.pageHeader}>
        <div className="container">
          <Heading as="h1" className={styles.pageTitle}>
            Teams
          </Heading>
          <p className={styles.pageSubtitle}>
            {teamsData.length} research groups · filter by country and direction
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
          </div>
        </section>

        <p className="margin-bottom--md">
          Showing {filteredTeams.length} of {teamsData.length} teams
        </p>

        <div className={styles.teamGrid}>
          {filteredTeams.map((team) => (
            <TeamCard key={team.name} team={team} />
          ))}
        </div>

        {filteredTeams.length === 0 && (
          <p>No teams matched the current filters.</p>
        )}
      </main>
    </Layout>
  );
}

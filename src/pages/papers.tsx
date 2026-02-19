import type {ReactNode} from 'react';
import {useMemo, useState} from 'react';
import clsx from 'clsx';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import Link from '@docusaurus/Link';

import papersData from '../data/papers.json';
import styles from './index.module.css';

type PaperItem = (typeof papersData)[number];

function getUniqueOptions(items: PaperItem[], field: 'team' | 'direction' | 'country' | 'venue') {
  return Array.from(new Set(items.map((item) => item[field]))).sort();
}

function getAllTags(items: PaperItem[]) {
  return Array.from(new Set(items.flatMap((item) => item.tags))).sort();
}

export default function Papers(): ReactNode {
  const [teamFilter, setTeamFilter] = useState('All');
  const [directionFilter, setDirectionFilter] = useState('All');
  const [countryFilter, setCountryFilter] = useState('All');
  const [venueFilter, setVenueFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const teams = useMemo(() => getUniqueOptions(papersData, 'team'), []);
  const directions = useMemo(() => getUniqueOptions(papersData, 'direction'), []);
  const countries = useMemo(() => getUniqueOptions(papersData, 'country'), []);
  const venues = useMemo(() => getUniqueOptions(papersData, 'venue'), []);
  const tags = useMemo(() => getAllTags(papersData), []);

  const toggleTag = (tag: string) => {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
    );
  };

  const filteredPapers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return papersData.filter((item) => {
      const teamMatch = teamFilter === 'All' || item.team === teamFilter;
      const directionMatch = directionFilter === 'All' || item.direction === directionFilter;
      const countryMatch = countryFilter === 'All' || item.country === countryFilter;
      const venueMatch = venueFilter === 'All' || item.venue === venueFilter;
      const tagMatch =
        selectedTags.length === 0 ||
        selectedTags.every((t) => item.tags.includes(t));
      const keywordMatch =
        keyword.length === 0 ||
        item.title.toLowerCase().includes(keyword) ||
        item.team.toLowerCase().includes(keyword) ||
        item.direction.toLowerCase().includes(keyword) ||
        item.venue.toLowerCase().includes(keyword) ||
        item.tags.some((tag) => tag.toLowerCase().includes(keyword));
      return teamMatch && directionMatch && countryMatch && venueMatch && tagMatch && keywordMatch;
    });
  }, [countryFilter, directionFilter, query, selectedTags, teamFilter, venueFilter]);

  return (
    <Layout
      title="Papers"
      description="Browse affective computing research papers with advanced filtering">
      <header className={styles.pageHeader}>
        <div className="container">
          <Heading as="h1" className={styles.pageTitle}>
            Papers
          </Heading>
          <p className={styles.pageSubtitle}>
            {papersData.length} papers · filter by team, direction, country, venue, keyword, and tags
          </p>
        </div>
      </header>

      <main className="container margin-vert--lg">
        <section>
          <div className={styles.filterGrid}>
            <label>
              Team
              <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
                <option value="All">All</option>
                {teams.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Direction
              <select value={directionFilter} onChange={(e) => setDirectionFilter(e.target.value)}>
                <option value="All">All</option>
                {directions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
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
              Venue / Journal
              <select value={venueFilter} onChange={(e) => setVenueFilter(e.target.value)}>
                <option value="All">All</option>
                {venues.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.searchInputWrap}>
              Paper Keyword
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title / team / direction / venue / tags"
              />
            </label>
          </div>

          <div className={styles.tagSection}>
            <p className={styles.tagTitle}>Tags (multi-select, AND logic)</p>
            <div className={styles.tagList}>
              {tags.map((tag) => {
                const isActive = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    className={clsx(styles.tagButton, isActive && styles.tagButtonActive)}
                    onClick={() => toggleTag(tag)}>
                    {tag}
                  </button>
                );
              })}
              {selectedTags.length > 0 && (
                <button
                  type="button"
                  className={styles.clearTagButton}
                  onClick={() => setSelectedTags([])}>
                  Clear tags
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="margin-top--lg">
          <Heading as="h2">Papers ({filteredPapers.length})</Heading>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Team</th>
                  <th>Direction</th>
                  <th>Country</th>
                  <th>Venue</th>
                  <th>Year</th>
                  <th>Tags</th>
                </tr>
              </thead>
              <tbody>
                {filteredPapers.map((paper) => (
                  <tr key={`${paper.title}-${paper.year}`}>
                    <td>
                      <a href={paper.paperUrl} target="_blank" rel="noreferrer">
                        {paper.title}
                      </a>
                    </td>
                    <td>
                      <Link to={`/teams?team=${encodeURIComponent(paper.team)}`}>
                        {paper.team}
                      </Link>
                    </td>
                    <td>
                      <Link to={`/directions?direction=${encodeURIComponent(paper.direction)}`}>
                        {paper.direction}
                      </Link>
                    </td>
                    <td>{paper.country}</td>
                    <td>{paper.venue}</td>
                    <td>{paper.year}</td>
                    <td>
                      {paper.tags.map((tag) => (
                        <span key={tag} className={styles.tagPill}>
                          {tag}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredPapers.length === 0 && (
              <p className="margin-top--md">No papers matched current filters.</p>
            )}
          </div>
        </section>
      </main>
    </Layout>
  );
}

import type {ReactNode} from 'react';
import {useMemo, useState} from 'react';
import clsx from 'clsx';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

type PaperItem = {
  title: string;
  team: string;
  direction: string;
  country: string;
  venue: string;
  year: number;
  paperUrl: string;
  tags: string[];
};

const paperCollection: PaperItem[] = [
  {
    title: 'A Survey on Affective Computing and Intelligent Interaction',
    team: 'MIT Media Lab',
    direction: 'Affect Recognition',
    country: 'USA',
    venue: 'IEEE TPAMI',
    year: 2023,
    paperUrl: 'https://ieeexplore.ieee.org/',
    tags: ['survey', 'multimodal', 'benchmark'],
  },
  {
    title: 'Cross-cultural Emotion Understanding in Multimodal Signals',
    team: 'University of Cambridge',
    direction: 'Multimodal Emotion Analysis',
    country: 'UK',
    venue: 'ACM MM',
    year: 2024,
    paperUrl: 'https://dl.acm.org/',
    tags: ['multimodal', 'cross-cultural', 'dataset'],
  },
  {
    title: 'Large Language Models for Emotion-centric Human-Computer Interaction',
    team: 'Tsinghua University',
    direction: 'Emotion-aware LLM',
    country: 'China',
    venue: 'ACL',
    year: 2024,
    paperUrl: 'https://aclanthology.org/',
    tags: ['llm', 'dialogue', 'hci'],
  },
  {
    title: 'Facial Micro-expression Benchmark for Real-world Affective States',
    team: 'National University of Singapore',
    direction: 'Micro-expression',
    country: 'Singapore',
    venue: 'CVPR',
    year: 2022,
    paperUrl: 'https://openaccess.thecvf.com/',
    tags: ['vision', 'micro-expression', 'benchmark'],
  },
  {
    title: 'Affective Speech Foundation Model for Clinical Scenarios',
    team: 'University of Toronto',
    direction: 'Speech Emotion Recognition',
    country: 'Canada',
    venue: 'Interspeech',
    year: 2023,
    paperUrl: 'https://www.isca-archive.org/',
    tags: ['speech', 'clinical', 'foundation-model'],
  },
];

function getUniqueOptions(items: PaperItem[], field: 'team' | 'direction' | 'country' | 'venue') {
  return Array.from(new Set(items.map((item) => item[field]))).sort();
}

function getAllTags(items: PaperItem[]) {
  return Array.from(new Set(items.flatMap((item) => item.tags))).sort();
}

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();

  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">Awesome Affective Computing Collection</p>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  const [teamFilter, setTeamFilter] = useState('All');
  const [directionFilter, setDirectionFilter] = useState('All');
  const [countryFilter, setCountryFilter] = useState('All');
  const [venueFilter, setVenueFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const teams = useMemo(() => getUniqueOptions(paperCollection, 'team'), []);
  const directions = useMemo(() => getUniqueOptions(paperCollection, 'direction'), []);
  const countries = useMemo(() => getUniqueOptions(paperCollection, 'country'), []);
  const venues = useMemo(() => getUniqueOptions(paperCollection, 'venue'), []);
  const tags = useMemo(() => getAllTags(paperCollection), []);

  const toggleTag = (tag: string) => {
    setSelectedTags((currentTags) =>
      currentTags.includes(tag)
        ? currentTags.filter((item) => item !== tag)
        : [...currentTags, tag],
    );
  };

  const filteredPapers = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return paperCollection.filter((item) => {
      const teamMatch = teamFilter === 'All' || item.team === teamFilter;
      const directionMatch =
        directionFilter === 'All' || item.direction === directionFilter;
      const countryMatch = countryFilter === 'All' || item.country === countryFilter;
      const venueMatch = venueFilter === 'All' || item.venue === venueFilter;
      const tagMatch =
        selectedTags.length === 0 ||
        selectedTags.every((selectedTag) => item.tags.includes(selectedTag));
      const keywordMatch =
        keyword.length === 0 ||
        item.title.toLowerCase().includes(keyword) ||
        item.team.toLowerCase().includes(keyword) ||
        item.direction.toLowerCase().includes(keyword) ||
        item.venue.toLowerCase().includes(keyword) ||
        item.tags.some((tag) => tag.toLowerCase().includes(keyword));

      return (
        teamMatch &&
        directionMatch &&
        countryMatch &&
        venueMatch &&
        tagMatch &&
        keywordMatch
      );
    });
  }, [countryFilter, directionFilter, query, selectedTags, teamFilter, venueFilter]);

  return (
    <Layout title="Awesome Affective Computing Collection">
      <HomepageHeader />
      <main className="container margin-vert--lg">
        <section>
          <Heading as="h2">Filter Collection</Heading>
          <p>
            按团队、方向、国家、会议/期刊、关键词和 tag 组合检索。后续新增 tag 只需在论文数据里补充
            <code>tags</code> 字段即可自动生效。
          </p>
          <div className={styles.filterGrid}>
            <label>
              Team
              <select
                value={teamFilter}
                onChange={(event) => setTeamFilter(event.target.value)}>
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
              <select
                value={directionFilter}
                onChange={(event) => setDirectionFilter(event.target.value)}>
                <option value="All">All</option>
                {directions.map((direction) => (
                  <option key={direction} value={direction}>
                    {direction}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Country
              <select
                value={countryFilter}
                onChange={(event) => setCountryFilter(event.target.value)}>
                <option value="All">All</option>
                {countries.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Venue / Journal
              <select
                value={venueFilter}
                onChange={(event) => setVenueFilter(event.target.value)}>
                <option value="All">All</option>
                {venues.map((venue) => (
                  <option key={venue} value={venue}>
                    {venue}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.searchInputWrap}>
              Paper Keyword
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title / team / direction / venue / tags"
                type="text"
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
                    className={clsx(styles.tagButton, isActive && styles.tagButtonActive)}
                    onClick={() => toggleTag(tag)}
                    type="button">
                    {tag}
                  </button>
                );
              })}
              {selectedTags.length > 0 && (
                <button
                  className={styles.clearTagButton}
                  onClick={() => setSelectedTags([])}
                  type="button">
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
                      <a href={paper.paperUrl} rel="noreferrer" target="_blank">
                        {paper.title}
                      </a>
                    </td>
                    <td>{paper.team}</td>
                    <td>{paper.direction}</td>
                    <td>{paper.country}</td>
                    <td>{paper.venue}</td>
                    <td>{paper.year}</td>
                    <td>{paper.tags.join(', ')}</td>
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

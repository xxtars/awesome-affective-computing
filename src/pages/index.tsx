import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import papersData from '../data/papers.json';
import teamsData from '../data/teams.json';
import directionsData from '../data/directions.json';

import styles from './index.module.css';

function HeroSection() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={styles.hero}>
      <div className="container">
        <Heading as="h1" className={styles.heroTitle}>
          {siteConfig.title}
        </Heading>
        <p className={styles.heroSubtitle}>
          A curated collection of affective computing research papers, teams, and directions
        </p>
      </div>
    </header>
  );
}

function StatsSection() {
  const stats = [
    {label: 'Papers', value: papersData.length},
    {label: 'Teams', value: teamsData.length},
    {label: 'Directions', value: directionsData.length},
  ];

  return (
    <section className={styles.statsSection}>
      <div className="container">
        <div className={styles.statsGrid}>
          {stats.map((stat) => (
            <div key={stat.label} className={styles.statCard}>
              <span className={styles.statValue}>{stat.value}</span>
              <span className={styles.statLabel}>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const entryCards = [
  {
    to: '/papers',
    title: 'Papers',
    description:
      'Browse and filter the full collection of affective computing research papers by team, direction, country, venue, and tags.',
    icon: '📄',
  },
  {
    to: '/teams',
    title: 'Teams',
    description:
      'Explore leading research groups in affective computing around the world, filter by country and research direction.',
    icon: '🏛️',
  },
  {
    to: '/directions',
    title: 'Directions',
    description:
      'Discover the major research directions in affective computing with curated entry-point papers and related teams.',
    icon: '🧭',
  },
];

function EntryCards() {
  return (
    <section className={styles.cardsSection}>
      <div className="container">
        <div className={styles.cardsGrid}>
          {entryCards.map((card) => (
            <Link key={card.to} to={card.to} className={styles.entryCard}>
              <span className={styles.cardIcon}>{card.icon}</span>
              <Heading as="h2" className={styles.cardTitle}>
                {card.title}
              </Heading>
              <p className={styles.cardDescription}>{card.description}</p>
              <span className={styles.cardLink}>Browse {card.title} →</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="Home"
      description="A curated collection of affective computing research papers, teams, and directions">
      <HeroSection />
      <main>
        <StatsSection />
        <EntryCards />
      </main>
    </Layout>
  );
}

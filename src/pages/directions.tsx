import type {ReactNode} from 'react';
import {useEffect, useState} from 'react';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import Link from '@docusaurus/Link';

import directionsData from '../data/directions.json';
import papersData from '../data/papers.json';
import styles from './index.module.css';

type DirectionItem = (typeof directionsData)[number];

function getPaperUrl(title: string): string | undefined {
  const paper = papersData.find((p) => p.title === title);
  return paper?.paperUrl;
}

function DirectionBlock({direction}: {direction: DirectionItem}) {
  return (
    <div className={styles.directionBlock}>
      <Heading as="h2" className={styles.directionName}>
        {direction.name}
      </Heading>
      <p className={styles.directionDescription}>{direction.description}</p>

      <div className={styles.directionSections}>
        <div className={styles.directionSection}>
          <p className={styles.directionSectionTitle}>Related Teams</p>
          {direction.related_teams.map((teamName) => (
            <Link
              key={teamName}
              to={`/teams?team=${encodeURIComponent(teamName)}`}
              className={styles.directionListItem}>
              {teamName}
            </Link>
          ))}
        </div>

        <div className={styles.directionSection}>
          <p className={styles.directionSectionTitle}>Recommended Papers</p>
          {direction.recommended_papers.map((title) => {
            const url = getPaperUrl(title);
            return url ? (
              <a
                key={title}
                href={url}
                className={styles.directionListItem}
                target="_blank"
                rel="noreferrer">
                {title}
              </a>
            ) : (
              <span key={title} className={styles.directionListItem}>
                {title}
              </span>
            );
          })}
          <Link
            to={`/papers?direction=${encodeURIComponent(direction.name)}`}
            className={styles.directionListItem}
            style={{marginTop: '0.5rem', fontWeight: 600}}>
            All {direction.name} papers →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Directions(): ReactNode {
  const [highlighted, setHighlighted] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const dir = params.get('direction');
      if (dir) {
        setHighlighted(dir);
        setTimeout(() => {
          const el = document.getElementById(`direction-${encodeURIComponent(dir)}`);
          if (el) {
            el.scrollIntoView({behavior: 'smooth', block: 'start'});
          }
        }, 100);
      }
    }
  }, []);

  return (
    <Layout
      title="Directions"
      description="Major research directions in affective computing">
      <header className={styles.pageHeader}>
        <div className="container">
          <Heading as="h1" className={styles.pageTitle}>
            Directions
          </Heading>
          <p className={styles.pageSubtitle}>
            {directionsData.length} research directions with curated papers and teams
          </p>
        </div>
      </header>

      <main className="container margin-vert--lg">
        {directionsData.map((direction) => (
          <div
            key={direction.name}
            id={`direction-${encodeURIComponent(direction.name)}`}
            style={
              highlighted === direction.name
                ? {outline: '2px solid var(--ifm-color-primary)', borderRadius: '10px'}
                : undefined
            }>
            <DirectionBlock direction={direction} />
          </div>
        ))}
      </main>
    </Layout>
  );
}

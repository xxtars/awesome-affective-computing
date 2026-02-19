import type {ReactNode} from 'react';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import teamsData from '../data/teams.json';
import styles from './index.module.css';

export default function Teams(): ReactNode {
  return (
    <Layout title="Teams" description="Auto-generated from researcher.json">
      <header className={styles.pageHeader}>
        <div className="container">
          <Heading as="h1" className={styles.pageTitle}>
            Teams
          </Heading>
          <p className={styles.pageSubtitle}>Auto-generated from researcher.json</p>
        </div>
      </header>

      <main className="container margin-vert--lg">
        <div className={styles.teamGrid}>
          {teamsData.map((team) => (
            <article key={team.name} className={styles.teamCard}>
              <Heading as="h3" className={styles.teamName}>
                {team.name}
              </Heading>
              <p className={styles.teamInstitution}>{team.institution}</p>
              <p>{team.country}</p>
            </article>
          ))}
        </div>
      </main>
    </Layout>
  );
}

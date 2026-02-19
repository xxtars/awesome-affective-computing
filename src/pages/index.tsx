import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

export default function Home(): ReactNode {
  return (
    <Layout title="Home" description="Generate teams from researcher.json">
      <header className={styles.hero}>
        <div className="container">
          <Heading as="h1" className={styles.heroTitle}>
            Awesome Affective Computing
          </Heading>
          <p className={styles.heroSubtitle}>Only one workflow: generate teams from researcher.json</p>
          <Link to="/teams" className="button button--primary button--lg">
            View Teams
          </Link>
        </div>
      </header>
    </Layout>
  );
}

import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();

  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">AI-assisted Research Landscape Tracking</p>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout title="Affective Computing Research">
      <HomepageHeader />
      <main className={styles.mainContent}>
        <div className="container">
          <section className={styles.section}>
            <Heading as="h2">Project Purpose</Heading>
            <p>
              This project is an AI-assisted research landscape tracking workspace for affective computing research. It
              organizes researcher identities, paper-level analysis, and aggregated paper views for continuous
              updates.
            </p>
          </section>

          <section className={styles.section}>
            <Heading as="h2">Quick Access</Heading>
            <div className={styles.linkGrid}>
              <Link className={styles.linkCard} to="/researchers">
                <Heading as="h3">Researchers</Heading>
                <p>
                  Browse tracked researchers, search by name/institution country/university, and open detailed
                  profiles.
                </p>
              </Link>
              <Link className={styles.linkCard} to="/papers">
                <Heading as="h3">Papers</Heading>
                <p>Browse affective-related papers aggregated across tracked researchers.</p>
              </Link>
            </div>
          </section>

          <section className={styles.section}>
            <Heading as="h2">What You&apos;ll Find</Heading>
            <ul className={styles.list}>
              <li>Identity-based researcher tracking with OpenAlex as primary ID, enriched by optional ORCID/Google Scholar.</li>
              <li>Per-paper affective-related classification and AI-generated directions/keywords.</li>
              <li>Per-researcher cache and incremental updates for scalable maintenance.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <Heading as="h2">Data Sources & Priority</Heading>
            <ul className={styles.list}>
              <li>Seed fields: `name`, `openalex_author_id`, `orcid` (optional), `google_scholar` (optional).</li>
              <li>Institution priority: ORCID affiliation → Google Scholar profile affiliation → OpenAlex first institution.</li>
              <li>Institution country: geocoding result from institution name, with OpenAlex country code as fallback.</li>
              <li>Directions/keywords: AI-generated from OpenAlex metadata + abstract; may contain errors.</li>
              <li>Venue: OpenAlex primary source first, then DOI/Crossref resolution fallback.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <Heading as="h2">Workflow</Heading>
            <ul className={styles.list}>
              <li>Maintain seed records in `data/researchers/researcher.seed.json` with `name/openalex_author_id/orcid/google_scholar`.</li>
              <li>Run pipeline incrementally (supports per-name runs, concurrency, and frequent checkpoint saves).</li>
              <li>Institution resolution follows ORCID → Google Scholar → OpenAlex priority.</li>
              <li>Review outputs in Researchers/Papers pages and manually verify critical records.</li>
            </ul>
          </section>
        </div>

      </main>
    </Layout>
  );
}

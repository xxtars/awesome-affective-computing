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
        <p className={clsx('hero__subtitle', styles.heroSubtitle)}>
          AI-assisted Research Landscape Tracking for Affective Computing
        </p>
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
            <Heading as="h2" className={styles.sectionHeading}>
              <span className={styles.sectionIcon}>🔗</span> Quick Access
            </Heading>
            <div className={styles.linkGrid}>
              <Link className={styles.linkCard} to="/researchers">
                <span className={styles.cardIcon}>👤</span>
                <Heading as="h3">Researchers</Heading>
                <p>
                  Browse tracked researchers, filter by name, institution, or country, and open detailed
                  profiles with publication metrics.
                </p>
                <span className={styles.cardArrow}>Explore researchers →</span>
              </Link>
              <Link className={styles.linkCard} to="/papers">
                <span className={styles.cardIcon}>📄</span>
                <Heading as="h3">Papers</Heading>
                <p>Browse affective-related papers aggregated across all tracked researchers, grouped by year.</p>
                <span className={styles.cardArrow}>Explore papers →</span>
              </Link>
              <Link className={styles.linkCard} to="/landscape">
                <span className={styles.cardIcon}>🗺️</span>
                <Heading as="h3">Landscape</Heading>
                <p>Inspect L1/L2 taxonomy snapshots, trend visualizations, and stage-wise topic mappings.</p>
                <span className={styles.cardArrow}>Explore landscape →</span>
              </Link>
            </div>
          </section>

          <section className={styles.section}>
            <Heading as="h2" className={styles.sectionHeading}>
              <span className={styles.sectionIcon}>ℹ️</span> Project Purpose
            </Heading>
            <p>
              This project is an AI-assisted research landscape tracking workspace for affective computing research.
              It organizes researcher identities, paper-level analysis, and aggregated paper views for continuous
              updates — powered by OpenAlex, ORCID, Google Scholar, and Qwen-generated summaries.
            </p>
          </section>

          <section className={styles.section}>
            <Heading as="h2" className={styles.sectionHeading}>
              <span className={styles.sectionIcon}>✨</span> What You&apos;ll Find
            </Heading>
            <ul className={styles.list}>
              <li>Identity-based researcher tracking with OpenAlex as primary ID, enriched by optional ORCID/Google Scholar.</li>
              <li>Per-paper affective-related classification and AI-generated directions/TLDR.</li>
              <li>Per-researcher cache and incremental updates for scalable maintenance.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <Heading as="h2" className={styles.sectionHeading}>
              <span className={styles.sectionIcon}>🗂️</span> Data Sources &amp; Priority
            </Heading>
            <ul className={styles.list}>
              <li>Seed fields: <code>name</code>, <code>openalex_author_id</code>, <code>orcid</code> (optional), <code>google_scholar</code> (optional).</li>
              <li>Institution priority: Google Scholar profile affiliation → ORCID affiliation → OpenAlex first institution.</li>
              <li>Institution country/region: geocoding result from institution name, with OpenAlex country code as fallback.</li>
              <li>Directions/TLDR: AI-generated from OpenAlex metadata + abstract; may contain errors.</li>
              <li>Venue: OpenAlex primary source first, then DOI/Crossref resolution fallback.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <Heading as="h2" className={styles.sectionHeading}>
              <span className={styles.sectionIcon}>⚙️</span> Workflow
            </Heading>
            <ul className={styles.list}>
              <li>Maintain seed records in <code>data/researchers/researcher.seed.json</code> with <code>name / openalex_author_id / orcid / google_scholar</code>.</li>
              <li>Run pipeline incrementally — supports per-name runs, concurrency, and frequent checkpoint saves.</li>
              <li>Institution resolution follows Google Scholar → ORCID → OpenAlex priority.</li>
              <li>Review outputs in Researchers/Papers pages and manually verify critical records.</li>
            </ul>
          </section>

        </div>
      </main>
    </Layout>
  );
}

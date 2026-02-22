import type {ReactNode} from 'react';
import {useEffect, useMemo, useState} from 'react';
import {Fragment} from 'react';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import {buildResearchDataUrl, useResearchDataBaseUrl} from '../lib/researchData';
import styles from './landscape.module.css';

type Axis = 'problem' | 'method';

type TaxonomySummary = {
  generated_at?: string | null;
};

type TaxonomyAxisData = {
  axis: Axis;
  assignments: Array<{
    publication_year?: number | null;
    l1_name?: string | null;
  }>;
};

type YearPoint = {year: number; total: number; byL1: Record<string, number>};

const COLORS = [
  '#2a9d8f',
  '#e76f51',
  '#457b9d',
  '#f4a261',
  '#8ab17d',
  '#7b6d8d',
  '#4d908e',
  '#f28482',
  '#6d597a',
  '#90be6d',
];

const EMPTY_DATA: TaxonomyAxisData = {axis: 'problem', assignments: []};

function normalize(text: string) {
  return String(text || '').trim().toLowerCase();
}

function compactDate(text: string | null | undefined) {
  if (!text) return '-';
  const m = String(text).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : String(text);
}

function buildSeries(assignments: TaxonomyAxisData['assignments']) {
  const byYear = new Map<number, YearPoint>();
  for (const item of assignments || []) {
    const year = Number(item.publication_year || 0);
    const l1 = String(item.l1_name || '').trim();
    if (!Number.isFinite(year) || year < 1900 || !l1) continue;
    if (!byYear.has(year)) byYear.set(year, {year, total: 0, byL1: {}});
    const p = byYear.get(year)!;
    p.total += 1;
    p.byL1[l1] = (p.byL1[l1] || 0) + 1;
  }
  return Array.from(byYear.values()).sort((a, b) => a.year - b.year);
}

function topL1(points: YearPoint[], topN: number) {
  const counter = new Map<string, number>();
  for (const p of points) {
    for (const [k, v] of Object.entries(p.byL1)) counter.set(k, (counter.get(k) || 0) + v);
  }
  return Array.from(counter.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([k]) => k);
}

export default function LandscapePage(): ReactNode {
  const dataBaseUrl = useResearchDataBaseUrl();
  const [axis, setAxis] = useState<Axis>('problem');
  const [topN, setTopN] = useState(8);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<TaxonomySummary | null>(null);
  const [problemData, setProblemData] = useState<TaxonomyAxisData>(EMPTY_DATA);
  const [methodData, setMethodData] = useState<TaxonomyAxisData>({...EMPTY_DATA, axis: 'method'});

  useEffect(() => {
    let disposed = false;
    async function loadAll() {
      setLoading(true);
      try {
        const summaryUrl = buildResearchDataUrl(dataBaseUrl, 'data/taxonomy/taxonomy.summary.json');
        const problemUrl = buildResearchDataUrl(dataBaseUrl, 'data/taxonomy/problem/taxonomy.json');
        const methodUrl = buildResearchDataUrl(dataBaseUrl, 'data/taxonomy/method/taxonomy.json');
        const [sRes, pRes, mRes] = await Promise.all([fetch(summaryUrl), fetch(problemUrl), fetch(methodUrl)]);

        if (disposed) return;
        setSummary(sRes.ok ? ((await sRes.json()) as TaxonomySummary) : null);
        setProblemData(pRes.ok ? ((await pRes.json()) as TaxonomyAxisData) : EMPTY_DATA);
        setMethodData(mRes.ok ? ((await mRes.json()) as TaxonomyAxisData) : {...EMPTY_DATA, axis: 'method'});
      } catch (err) {
        console.error(err);
        if (!disposed) {
          setSummary(null);
          setProblemData(EMPTY_DATA);
          setMethodData({...EMPTY_DATA, axis: 'method'});
        }
      } finally {
        if (!disposed) setLoading(false);
      }
    }
    loadAll();
    return () => {
      disposed = true;
    };
  }, [dataBaseUrl]);

  const current = axis === 'problem' ? problemData : methodData;
  const points = useMemo(() => buildSeries(current.assignments || []), [current.assignments]);
  const l1List = useMemo(() => {
    const names = topL1(points, Math.max(1, topN));
    const keyword = normalize(query);
    if (!keyword) return names;
    return names.filter((x) => normalize(x).includes(keyword));
  }, [points, topN, query]);

  const yearMin = points.length > 0 ? points[0].year : 0;
  const yearMax = points.length > 0 ? points[points.length - 1].year : 0;
  const maxCount = useMemo(() => {
    let m = 1;
    for (const p of points) {
      for (const l1 of l1List) m = Math.max(m, Number(p.byL1[l1] || 0));
    }
    return m;
  }, [points, l1List]);

  return (
    <Layout title="Landscape">
      <main className={styles.page}>
        <div className="container">
          <Heading as="h1">Landscape</Heading>
          <p className={styles.muted}>Trend-first view for topic evolution. Generated at: {compactDate(summary?.generated_at)}</p>

          <div className={styles.controls}>
            <div>
              <label className={styles.controlLabel}>Axis</label>
              <select className={styles.controlSelect} value={axis} onChange={(e) => setAxis(e.target.value as Axis)}>
                <option value="problem">Problem</option>
                <option value="method">Method</option>
              </select>
            </div>
            <div>
              <label className={styles.controlLabel}>Top Topics</label>
              <select className={styles.controlSelect} value={topN} onChange={(e) => setTopN(Number(e.target.value))}>
                <option value={5}>Top 5</option>
                <option value={8}>Top 8</option>
                <option value={10}>Top 10</option>
                <option value={12}>Top 12</option>
              </select>
            </div>
            <div>
              <label className={styles.controlLabel}>Filter Topic Name</label>
              <input
                className={styles.controlInput}
                placeholder="type topic keyword"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <p>Loading landscape snapshot...</p>
          ) : points.length === 0 ? (
            <p>No trend data yet.</p>
          ) : (
            <>
              <section className={styles.panel}>
                <Heading as="h2">Topic Trend Lines</Heading>
                <p className={styles.muted}>
                  Years: {yearMin} - {yearMax} · Topics shown: {l1List.length}
                </p>
                <div className={styles.lineWrap}>
                  {l1List.map((name, idx) => {
                    const color = COLORS[idx % COLORS.length];
                    const values = points.map((p) => Number(p.byL1[name] || 0));
                    return (
                      <div className={styles.lineRow} key={name}>
                        <div className={styles.lineLabel}>
                          <span className={styles.dot} style={{backgroundColor: color}} />
                          {name}
                        </div>
                        <div className={styles.sparkline}>
                          {values.map((v, i) => (
                            <div
                              key={`${name}-${points[i].year}`}
                              className={styles.bar}
                              title={`${points[i].year}: ${v}`}
                              style={{
                                height: `${Math.max(6, (v / maxCount) * 52)}px`,
                                backgroundColor: color,
                                opacity: 0.2 + v / maxCount,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className={styles.yearRow}>
                  {points.map((p) => (
                    <span key={p.year}>{p.year}</span>
                  ))}
                </div>
              </section>

              <section className={styles.panel}>
                <Heading as="h2">Year × Topic Heatmap</Heading>
                <p className={styles.muted}>Darker cells mean higher paper count in that year-topic intersection.</p>
                <div className={styles.heatmap} style={{['--heat-years' as any]: points.length}}>
                  <div className={styles.heatHead}>Topic</div>
                  {points.map((p) => (
                    <div className={styles.heatHead} key={`h-${p.year}`}>
                      {p.year}
                    </div>
                  ))}

                  {l1List.map((name) => (
                    <Fragment key={`row-${name}`}>
                      <div className={styles.heatTopic} key={`t-${name}`}>
                        {name}
                      </div>
                      {points.map((p) => {
                        const v = Number(p.byL1[name] || 0);
                        const intensity = v <= 0 ? 0 : Math.max(0.12, v / maxCount);
                        return (
                          <div
                            key={`${name}-${p.year}`}
                            className={styles.heatCell}
                            title={`${name} · ${p.year}: ${v}`}
                            style={{background: `rgba(42,157,143,${intensity})`}}
                          >
                            {v > 0 ? v : ''}
                          </div>
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </Layout>
  );
}

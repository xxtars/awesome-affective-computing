import fs from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  const args = {
    src: "data/researchers",
    out: "static/data/researchers",
    taxonomySrc: "",
    taxonomyOut: "",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--src") args.src = argv[++i];
    else if (token === "--out") args.out = argv[++i];
    else if (token === "--taxonomy-src") args.taxonomySrc = argv[++i];
    else if (token === "--taxonomy-out") args.taxonomyOut = argv[++i];
  }
  return args;
}

async function loadJson(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content);
}

async function saveJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function copyTaxonomySnapshot({ srcRoot, outRoot }) {
  const axes = ["problem", "method"];
  await fs.rm(outRoot, { recursive: true, force: true });
  await fs.mkdir(outRoot, { recursive: true });

  const summaryPath = path.join(srcRoot, "taxonomy.summary.json");
  try {
    const summary = await loadJson(summaryPath);
    await saveJson(path.join(outRoot, "taxonomy.summary.json"), summary);
  } catch {
    await saveJson(path.join(outRoot, "taxonomy.summary.json"), {
      generated_at: null,
      axes: [],
    });
  }

  const keepFiles = [
    "taxonomy.json",
    "taxonomy.l1.json",
    "taxonomy.l2.json",
    "topics.candidates.json",
    "topics.assignments.json",
    "l1.second_level.items.json",
    "l1.second_level.assignments.json",
    "l1.second_level.clusters.json",
    "l1.naming.json",
  ];

  for (const axis of axes) {
    const axisSrc = path.join(srcRoot, axis);
    const axisOut = path.join(outRoot, axis);
    await fs.mkdir(axisOut, { recursive: true });

    for (const file of keepFiles) {
      const from = path.join(axisSrc, file);
      const to = path.join(axisOut, file);
      try {
        const content = await loadJson(from);
        await saveJson(to, content);
      } catch {
        if (file === "taxonomy.json") {
          await saveJson(to, {
            axis,
            generated_at: null,
            meta: {},
            l1_categories: [],
            l2_categories: [],
            assignments: [],
          });
        }
      }
    }
  }
}

function pickSource(source) {
  return {
    display_name: source?.display_name || null,
  };
}

function pickLinks(links) {
  return {
    openalex: links?.openalex || null,
    source_openalex: links?.source_openalex || null,
    landing_page: links?.landing_page || null,
  };
}

function pickAnalysis(analysis) {
  const problemDirections = Array.isArray(analysis?.problem_directions)
    ? analysis.problem_directions.map((x) => String(x || "").trim()).filter(Boolean)
    : [];
  const methodDirections = Array.isArray(analysis?.method_directions)
    ? analysis.method_directions.map((x) => String(x || "").trim()).filter(Boolean)
    : [];
  const legacyDirections = Array.isArray(analysis?.research_directions)
    ? analysis.research_directions.map((x) => String(x || "").trim()).filter(Boolean)
    : [];
  const resolvedProblem = problemDirections.length > 0 ? problemDirections : legacyDirections.slice(0, 3);
  const resolvedMethod = methodDirections.length > 0 ? methodDirections : legacyDirections.slice(3, 6);

  return {
    is_interesting: Boolean(analysis?.is_interesting),
    relevance_score: Number(analysis?.relevance_score || 0),
    tldr: String(analysis?.tldr || "").trim(),
    problem_directions: resolvedProblem,
    method_directions: resolvedMethod,
  };
}

function toPublicWork(work) {
  return {
    id: work?.id || "",
    title: work?.title || "",
    publication_year: work?.publication_year ?? null,
    publication_date: work?.publication_date || null,
    tracked_author_rank: work?.tracked_author_rank ?? null,
    tracked_author_position: work?.tracked_author_position ?? null,
    doi: work?.doi || null,
    doi_url: work?.doi_url || null,
    cited_by_count: Number(work?.cited_by_count || 0),
    primary_source: work?.primary_source || null,
    source: pickSource(work?.source),
    links: pickLinks(work?.links),
    analysis: pickAnalysis(work?.analysis),
  };
}

function toPublicProfile(profile) {
  const interestingWorks = Array.isArray(profile?.works)
    ? profile.works.filter((work) => work?.analysis?.is_interesting).map(toPublicWork)
    : [];

  return {
    identity: {
      name: profile?.identity?.name || "",
      openalex_author_id: profile?.identity?.openalex_author_id || "",
      google_scholar: profile?.identity?.google_scholar || "",
      openalex_author_url: profile?.identity?.openalex_author_url || "",
    },
    affiliation: {
      institutions: Array.isArray(profile?.affiliation?.institutions)
        ? profile.affiliation.institutions.map((x) => String(x || "").trim()).filter(Boolean)
        : [],
      institution_countries: Array.isArray(profile?.affiliation?.institution_countries)
        ? profile.affiliation.institution_countries.map((x) => (x ? String(x).trim() : null))
        : [],
      last_known_institution: profile?.affiliation?.last_known_institution || null,
      last_known_country: profile?.affiliation?.last_known_country || null,
    },
    metrics: {
      h_index: profile?.metrics?.h_index ?? null,
      cited_by_count: Number(profile?.metrics?.cited_by_count || 0),
    },
    topic_summary: {
      top_research_directions: Array.isArray(profile?.topic_summary?.top_research_directions)
        ? profile.topic_summary.top_research_directions
            .map((item) => ({
              name: String(item?.name || "").trim(),
              weight: Number(item?.weight || 0),
            }))
            .filter((item) => item.name)
        : [],
      trend_summary: String(profile?.topic_summary?.trend_summary || "").trim(),
    },
    stats: {
      analyzed_works_count: Number(profile?.stats?.analyzed_works_count || 0),
      interesting_works_count: Number(profile?.stats?.interesting_works_count || 0),
    },
    works: interestingWorks,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const srcRoot = path.resolve(args.src);
  const outRoot = path.resolve(args.out);
  const taxonomySrcRoot = args.taxonomySrc
    ? path.resolve(args.taxonomySrc)
    : path.resolve(srcRoot, "../taxonomy");
  const taxonomyOutRoot = args.taxonomyOut
    ? path.resolve(args.taxonomyOut)
    : path.resolve(outRoot, "../taxonomy");

  const srcIndexPath = path.join(srcRoot, "researchers.index.json");
  const sourceIndex = await loadJson(srcIndexPath);
  const researchers = Array.isArray(sourceIndex?.researchers) ? sourceIndex.researchers : [];

  await fs.rm(outRoot, { recursive: true, force: true });
  await fs.mkdir(path.join(outRoot, "profiles"), { recursive: true });

  const outResearchers = [];
  for (const record of researchers) {
    const relPath = String(record?.profile_path || "").replace(/^\/+/, "");
    if (!relPath) continue;
    const normalizedRelPath = relPath
      .replace(/^data-repo\/data\/researchers\//, "")
      .replace(/^data\/researchers\//, "");
    const sourceProfilePath = path.resolve(srcRoot, normalizedRelPath);
    const sourceProfile = await loadJson(sourceProfilePath);
    const publicProfile = toPublicProfile(sourceProfile);
    const targetProfilePath = path.join(outRoot, "profiles", path.basename(relPath));
    await saveJson(targetProfilePath, publicProfile);

    outResearchers.push({
      identity: {
        name: publicProfile.identity.name,
        openalex_author_id: publicProfile.identity.openalex_author_id,
        google_scholar: publicProfile.identity.google_scholar,
        openalex_author_url: publicProfile.identity.openalex_author_url,
      },
      profile_path: `data/researchers/profiles/${path.basename(relPath)}`,
    });
  }

  const outIndex = {
    generated_at: sourceIndex?.generated_at || null,
    pipeline_version: sourceIndex?.pipeline_version || "v0.1.0",
    researchers: outResearchers,
  };
  await saveJson(path.join(outRoot, "researchers.index.json"), outIndex);
  await copyTaxonomySnapshot({
    srcRoot: taxonomySrcRoot,
    outRoot: taxonomyOutRoot,
  });

  console.log(`Exported public snapshot: ${outResearchers.length} researchers`);
  console.log(`Exported taxonomy snapshot: ${taxonomyOutRoot}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

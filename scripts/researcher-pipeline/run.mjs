import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const OPENALEX_BASE_URL = "https://api.openalex.org";
const CROSSREF_BASE_URL = "https://api.crossref.org";
const ORCID_BASE_URL = "https://pub.orcid.org/v3.0";
const DEFAULT_QWEN_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
const DEFAULT_INTEREST_TOPICS = ["emotion"];

function parseArgs(argv) {
  const args = {
    seed: "data/researchers/researcher.seed.json",
    out: "data/researchers/researchers.index.json",
    cache: "data/researchers/cache",
    model: process.env.QWEN_MODEL || "qwen-plus",
    skipAi: false,
    maxPapers: null,
    delayMs: 200,
    fullRefresh: false,
    concurrency: 4,
    saveEvery: 1,
    researcherNames: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--seed") args.seed = argv[++i];
    else if (token === "--out") args.out = argv[++i];
    else if (token === "--cache") args.cache = argv[++i];
    else if (token === "--model") args.model = argv[++i];
    else if (token === "--max-papers") args.maxPapers = Number(argv[++i]);
    else if (token === "--delay-ms") args.delayMs = Number(argv[++i]);
    else if (token === "--concurrency") args.concurrency = Number(argv[++i]);
    else if (token === "--save-every") args.saveEvery = Number(argv[++i]);
    else if (token === "--researcher-name") {
      const raw = String(argv[++i] || "");
      const names = raw.split(",").map((x) => x.trim()).filter(Boolean);
      args.researcherNames.push(...names);
    }
    else if (token === "--skip-ai") args.skipAi = true;
    else if (token === "--full-refresh") args.fullRefresh = true;
  }

  return args;
}

function normalizeAuthorId(rawId) {
  if (!rawId) throw new Error("openalex_author_id is required");
  const clean = String(rawId).trim();
  if (clean.startsWith("https://openalex.org/")) {
    const id = clean.split("/").pop();
    return id.toUpperCase();
  }
  return clean.toUpperCase().startsWith("A") ? clean.toUpperCase() : `A${clean}`;
}

function normalizeOrcid(rawOrcid) {
  const raw = String(rawOrcid || "").trim();
  if (!raw) return "";
  const idMatch =
    raw.match(/(\d{4}-\d{4}-\d{4}-[\dX]{4})/i)?.[1] ||
    raw.match(/(\d{15}[\dX])/i)?.[1];
  if (!idMatch) return "";
  const compact = idMatch.replace(/-/g, "").toUpperCase();
  if (compact.length !== 16) return "";
  const withDash = `${compact.slice(0, 4)}-${compact.slice(4, 8)}-${compact.slice(8, 12)}-${compact.slice(12)}`;
  return `https://orcid.org/${withDash}`;
}

function normalizeOrcidKey(orcid) {
  return normalizeOrcid(orcid).replace(/^https?:\/\/orcid\.org\//i, "").toUpperCase();
}

function invertedIndexToText(indexObj) {
  if (!indexObj || typeof indexObj !== "object") return "";
  let maxPos = -1;
  for (const positions of Object.values(indexObj)) {
    if (Array.isArray(positions)) {
      for (const pos of positions) {
        if (typeof pos === "number" && pos > maxPos) maxPos = pos;
      }
    }
  }
  if (maxPos < 0) return "";

  const tokens = new Array(maxPos + 1).fill("");
  for (const [word, positions] of Object.entries(indexObj)) {
    if (!Array.isArray(positions)) continue;
    for (const pos of positions) {
      if (typeof pos === "number" && pos >= 0 && pos < tokens.length) {
        tokens[pos] = word;
      }
    }
  }
  return tokens.join(" ").replace(/\s+/g, " ").trim();
}

async function loadJson(filePath, fallback = null) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}

async function saveJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "awesome-affective-computing-researcher-pipeline/1.0",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

async function fetchOrcidJson(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "awesome-affective-computing-researcher-pipeline/1.0",
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ORCID HTTP ${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

function normalizeInstitutionKey(name) {
  return String(name || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function countryNameFromCode(code) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized || normalized.length !== 2) return null;
  try {
    const display = new Intl.DisplayNames(["en"], { type: "region" });
    const name = display.of(normalized);
    return name || null;
  } catch {
    return null;
  }
}

function normalizeCountryNameToEnglish(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^[A-Za-z]{2}$/.test(raw)) return countryNameFromCode(raw);

  const alias = {
    "中国": "China",
    "中华人民共和国": "China",
    "英国": "United Kingdom",
    "新西兰": "New Zealand",
    "美国": "United States",
  };
  if (alias[raw]) return alias[raw];
  return raw;
}

async function lookupCountryByInstitutionName(institutionName) {
  const query = String(institutionName || "").trim();
  if (!query) return null;

  const url = new URL(`${NOMINATIM_BASE_URL}/search`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", query);

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "awesome-affective-computing-researcher-pipeline/1.0",
    },
  });
  if (!res.ok) return null;
  const payload = await res.json();
  const first = Array.isArray(payload) ? payload[0] : null;
  const countryCode = first?.address?.country_code;
  if (typeof countryCode === "string" && countryCode.trim()) {
    return countryNameFromCode(countryCode);
  }
  const country = first?.address?.country;
  return normalizeCountryNameToEnglish(country);
}

async function resolveInstitutionCountryName({
  institutionName,
  institutionCountryCache,
  institutionCountryCachePath,
}) {
  const key = normalizeInstitutionKey(institutionName);
  if (!key) return null;
  if (Object.prototype.hasOwnProperty.call(institutionCountryCache, key)) {
    const normalizedCached = normalizeCountryNameToEnglish(institutionCountryCache[key]);
    if (normalizedCached !== institutionCountryCache[key]) {
      institutionCountryCache[key] = normalizedCached;
      await saveJson(institutionCountryCachePath, institutionCountryCache);
    }
    return normalizedCached;
  }

  let resolved = null;
  try {
    // Query country from institution name (independent from OpenAlex author country).
    resolved = await lookupCountryByInstitutionName(institutionName);
    // Keep a small delay for public geocoding endpoint etiquette.
    await sleep(1000);
  } catch {
    resolved = null;
  }

  institutionCountryCache[key] = normalizeCountryNameToEnglish(resolved);
  await saveJson(institutionCountryCachePath, institutionCountryCache);
  return institutionCountryCache[key];
}

async function fetchAuthorProfile(authorId) {
  const url = `${OPENALEX_BASE_URL}/authors/${authorId}`;
  return fetchJson(url);
}

function pickOrcidAffiliationFromRecord(record) {
  const groups = [];
  const activities = record?.["activities-summary"] || {};
  const employments = activities?.employments?.["affiliation-group"] || [];
  const educations = activities?.educations?.["affiliation-group"] || [];
  groups.push(...(Array.isArray(employments) ? employments : []));
  groups.push(...(Array.isArray(educations) ? educations : []));

  for (const group of groups) {
    const summaries = Array.isArray(group?.summaries) ? group.summaries : [];
    for (const summary of summaries) {
      const payload =
        summary?.["employment-summary"] ||
        summary?.["education-summary"] ||
        summary?.["affiliation-summary"] ||
        null;
      const org = payload?.organization || {};
      const institution = String(org?.name || "").trim();
      const countryCode = String(org?.address?.country || "").trim();
      if (!institution) continue;
      return {
        institution,
        country: normalizeCountryNameToEnglish(countryCode) || countryNameFromCode(countryCode) || null,
      };
    }
  }
  return { institution: null, country: null };
}

async function fetchOrcidAffiliation(orcid) {
  const normalized = normalizeOrcid(orcid);
  if (!normalized) return { institution: null, country: null };
  const key = normalizeOrcidKey(normalized);
  if (!key) return { institution: null, country: null };
  const record = await fetchOrcidJson(`${ORCID_BASE_URL}/${key}/record`);
  return pickOrcidAffiliationFromRecord(record);
}

function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

async function fetchGoogleScholarAffiliation(googleScholarUrl) {
  const urlValue = String(googleScholarUrl || "").trim();
  if (!urlValue) return null;
  const res = await fetch(urlValue, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; awesome-affective-computing-researcher-pipeline/1.0)",
    },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const match = html.match(/<div[^>]*class="gsc_prf_il"[^>]*>([\s\S]*?)<\/div>/i);
  if (!match?.[1]) return null;
  const cleaned = decodeHtmlEntities(match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
  return cleaned || null;
}

function normalizeDoi(doiValue) {
  const raw = String(doiValue || "").trim();
  if (!raw) return "";
  return raw
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .trim()
    .toLowerCase();
}

function inferVenueFromDoiPrefix(doi) {
  if (!doi) return null;
  if (doi.startsWith("10.1145/")) return "ACM";
  if (doi.startsWith("10.1109/")) return "IEEE";
  if (doi.startsWith("10.48550/arxiv.")) return "arXiv";
  if (doi.startsWith("10.1016/")) return "Elsevier";
  if (doi.startsWith("10.1007/")) return "Springer";
  if (doi.startsWith("10.3389/")) return "Frontiers";
  if (doi.startsWith("10.3233/")) return "IOS Press";
  return null;
}

function parseDoiFromAnyText(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return normalizeDoi(raw);
}

function isGenericPublisherLabel(name) {
  const normalized = String(name || "").trim().toLowerCase();
  return [
    "acm",
    "ieee",
    "elsevier",
    "springer",
    "frontiers media sa",
    "ios press",
    "wiley",
    "taylor & francis",
    "mdpi ag",
  ].includes(normalized);
}

function pickCrossrefVenueName(message) {
  const containerTitle = Array.isArray(message?.["container-title"]) ? message["container-title"][0] : null;
  const eventName = typeof message?.event?.name === "string" ? message.event.name : null;
  const shortContainer = Array.isArray(message?.["short-container-title"])
    ? message["short-container-title"][0]
    : null;
  const title = Array.isArray(message?.title) ? message.title[0] : null;
  const publisher = typeof message?.publisher === "string" ? message.publisher : null;

  const primary = String(eventName || containerTitle || shortContainer || "").trim();
  if (primary) return primary;
  const titleValue = String(title || "").trim();
  if (titleValue && /proceedings|conference|symposium|workshop/i.test(titleValue)) {
    return titleValue;
  }
  return String(publisher || "").trim() || null;
}

function getParentProceedingsDoi(doi, message) {
  const relationPartOf = message?.relation?.["is-part-of"];
  if (Array.isArray(relationPartOf)) {
    for (const rel of relationPartOf) {
      const candidate = parseDoiFromAnyText(rel?.id || rel?.id_type || "");
      if (candidate) return candidate;
    }
  }

  const relationIsPartOf = message?.relation?.is_part_of;
  if (Array.isArray(relationIsPartOf)) {
    for (const rel of relationIsPartOf) {
      const candidate = parseDoiFromAnyText(rel?.id || "");
      if (candidate) return candidate;
    }
  }

  if (doi.startsWith("10.1145/")) {
    const suffix = doi.replace(/^10\.1145\//, "");
    if (suffix.includes(".")) {
      const parent = `10.1145/${suffix.split(".")[0]}`;
      if (parent !== doi) return parent;
    }
  }
  return "";
}

async function fetchCrossrefVenueByDoi(doi) {
  const url = `${CROSSREF_BASE_URL}/works/${encodeURIComponent(doi)}`;
  const payload = await fetchJson(url);
  const message = payload?.message || {};

  const direct = pickCrossrefVenueName(message);
  if (direct && !isGenericPublisherLabel(direct)) return direct;

  const parentDoi = getParentProceedingsDoi(doi, message);
  if (parentDoi && parentDoi !== doi) {
    try {
      const parentUrl = `${CROSSREF_BASE_URL}/works/${encodeURIComponent(parentDoi)}`;
      const parentPayload = await fetchJson(parentUrl);
      const parentMessage = parentPayload?.message || {};
      const parentTitle = Array.isArray(parentMessage?.title) ? parentMessage.title[0] : null;
      const parentVenue = String(
        parentTitle || pickCrossrefVenueName(parentMessage) || ""
      ).trim();
      if (parentVenue) return parentVenue;
    } catch {
      // Fall through to direct/prefix fallback.
    }
  }

  if (direct) return direct;
  return null;
}

async function resolveVenueFromDoi({
  doiValue,
  doiVenueCache,
  doiVenueCachePath,
}) {
  const doi = normalizeDoi(doiValue);
  if (!doi) return null;
  if (Object.prototype.hasOwnProperty.call(doiVenueCache, doi)) {
    return doiVenueCache[doi];
  }

  let resolved = null;
  try {
    resolved = await fetchCrossrefVenueByDoi(doi);
    await sleep(150);
  } catch {
    resolved = null;
  }
  if (!resolved) resolved = inferVenueFromDoiPrefix(doi);

  doiVenueCache[doi] = resolved || null;
  await saveJson(doiVenueCachePath, doiVenueCache);
  return doiVenueCache[doi];
}

function normalizeTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeNameForMatch(name) {
  return String(name || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function sanitizeForPath(text) {
  return String(text || "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/ /g, "_");
}

function getScholarUserId(googleScholarUrl) {
  try {
    const url = new URL(String(googleScholarUrl || ""));
    return url.searchParams.get("user") || null;
  } catch {
    return null;
  }
}

function getResearcherCachePath(cacheRoot, researcher, authorId) {
  const safeName = sanitizeForPath(researcher.name || "unknown");
  const scholarId = sanitizeForPath(getScholarUserId(researcher.google_scholar) || "no-scholar");
  const safeAuthorId = sanitizeForPath(String(authorId || "unknown").toLowerCase());
  const folder = `${safeName}__${scholarId}__${safeAuthorId}`;
  return path.join(cacheRoot, folder, "paper-analysis-cache.json");
}

function getProfilesDir(indexPath) {
  return path.join(path.dirname(indexPath), "profiles");
}

function getProfileFilePathByAuthorId(indexPath, authorId) {
  return path.join(getProfilesDir(indexPath), `${String(authorId || "").toUpperCase()}.json`);
}

function getStaticMirrorIndexPath(indexPath) {
  return path.join(process.cwd(), "static", "data", "researchers", path.basename(indexPath));
}

function getStaticMirrorProfilePathByAuthorId(indexPath, authorId) {
  return path.join(
    path.dirname(getStaticMirrorIndexPath(indexPath)),
    "profiles",
    `${String(authorId || "").toUpperCase()}.json`
  );
}

function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

function makeIndexRecord(profile, indexPath) {
  const authorId = profile?.identity?.openalex_author_id;
  return {
    identity: profile.identity,
    affiliation: profile.affiliation,
    metrics: profile.metrics,
    topic_summary: profile.topic_summary,
    stats: profile.stats,
    profile_path: toPosixPath(path.relative(process.cwd(), getProfileFilePathByAuthorId(indexPath, authorId))),
  };
}

async function saveIndexAndProfileWithStaticMirror({ indexPath, indexData, authorId, profileData }) {
  const profilePath = getProfileFilePathByAuthorId(indexPath, authorId);

  await saveJson(profilePath, profileData);
  await saveJson(indexPath, indexData);

  if (process.env.RESEARCHER_DISABLE_STATIC_MIRROR === "1") {
    return;
  }

  const mirrorIndexPath = getStaticMirrorIndexPath(indexPath);
  const mirrorProfilePath = getStaticMirrorProfilePathByAuthorId(indexPath, authorId);
  await saveJson(mirrorProfilePath, profileData);
  await saveJson(mirrorIndexPath, indexData);
}

function isPreprintWork(work) {
  const type = String(work?.type || "").toLowerCase();
  const sourceName = String(work?.source?.display_name || work?.primary_source || "").toLowerCase();
  return type === "preprint" || sourceName.includes("arxiv");
}

function isArxivOrgSource(work) {
  const sourceName = String(work?.source?.display_name || work?.primary_source || "").toLowerCase();
  return sourceName === "arxiv.org";
}

function publishedVenuePriority(work) {
  const sourceType = String(work?.source?.type || "").toLowerCase();
  if (sourceType === "journal") return 5;
  if (sourceType === "conference") return 4;
  if (sourceType === "book_series") return 3;
  if (sourceType === "repository") return 1;
  return 2;
}

function isBetterWorkCandidate(candidate, current) {
  const candidatePreprint = isPreprintWork(candidate);
  const currentPreprint = isPreprintWork(current);
  if (candidatePreprint !== currentPreprint) return !candidatePreprint;

  if (candidatePreprint && currentPreprint) {
    const candidateArxivOrg = isArxivOrgSource(candidate);
    const currentArxivOrg = isArxivOrgSource(current);
    if (candidateArxivOrg !== currentArxivOrg) return candidateArxivOrg;
  }

  const venueA = publishedVenuePriority(candidate);
  const venueB = publishedVenuePriority(current);
  if (venueA !== venueB) return venueA > venueB;

  const citeA = candidate.cited_by_count || 0;
  const citeB = current.cited_by_count || 0;
  if (citeA !== citeB) return citeA > citeB;

  const dateA = candidate.publication_date || "";
  const dateB = current.publication_date || "";
  if (dateA !== dateB) return dateA > dateB;

  const idA = String(candidate.id || "");
  const idB = String(current.id || "");
  return idA > idB;
}

function dedupeWorksByTitle(works) {
  const byTitle = new Map();
  for (const work of works) {
    const key = normalizeTitle(work.title);
    if (!key) {
      byTitle.set(`__id__${work.id}`, work);
      continue;
    }
    const existing = byTitle.get(key);
    if (!existing || isBetterWorkCandidate(work, existing)) {
      byTitle.set(key, work);
    }
  }
  return Array.from(byTitle.values());
}

async function fetchAuthorWorks(
  authorId,
  { maxPapers = null, knownWorkIds = null, fullRefresh = false, resolveVenueByDoi = null } = {}
) {
  const works = [];
  const dedupedByTitle = new Map();
  let cursor = "*";
  const perPage = 200;
  const knownIds = knownWorkIds && !fullRefresh ? knownWorkIds : null;

  while (cursor) {
    const url = new URL(`${OPENALEX_BASE_URL}/works`);
    url.searchParams.set("filter", `author.id:https://openalex.org/${authorId}`);
    url.searchParams.set("per-page", String(perPage));
    url.searchParams.set("cursor", cursor);
    url.searchParams.set("sort", "publication_date:desc");

    const payload = await fetchJson(url.toString());
    const pageResults = payload.results || [];
    let pageKnownCount = 0;
    for (const work of pageResults) {
      if (knownIds && knownIds.has(work.id)) {
        pageKnownCount += 1;
        continue;
      }
      const abstract = invertedIndexToText(work.abstract_inverted_index);
      const primaryLocation = work.primary_location || null;
      const primarySource = primaryLocation?.source || null;
      const doiVenue =
        !primarySource?.display_name && typeof resolveVenueByDoi === "function"
          ? await resolveVenueByDoi(work.doi)
          : null;
      const trackedAuthorship = Array.isArray(work.authorships)
        ? work.authorships.find((item) => String(item?.author?.id || "") === `https://openalex.org/${authorId}`)
        : null;
      const trackedAuthorRank = Array.isArray(work.authorships)
        ? work.authorships.findIndex((item) => String(item?.author?.id || "") === `https://openalex.org/${authorId}`) + 1
        : 0;
      const trackedAuthorPosition =
        typeof trackedAuthorship?.author_position === "string"
          ? trackedAuthorship.author_position.toLowerCase()
          : null;
      const primaryTopic = work.primary_topic || null;
      const mappedWork = {
        id: work.id,
        openalex_url: work.id || null,
        title: work.display_name || "",
        publication_year: work.publication_year || null,
        publication_date: work.publication_date || null,
        tracked_author_rank: trackedAuthorRank > 0 ? trackedAuthorRank : null,
        tracked_author_position: trackedAuthorPosition,
        doi: work.doi || null,
        doi_url: work.doi ? `https://doi.org/${String(work.doi).replace(/^https?:\/\/doi.org\//, "")}` : null,
        type: work.type || null,
        type_crossref: work.type_crossref || null,
        language: work.language || null,
        is_retracted: Boolean(work.is_retracted),
        is_paratext: Boolean(work.is_paratext),
        cited_by_count: work.cited_by_count || 0,
        primary_source: primarySource?.display_name || doiVenue || null,
        source: {
          id: primarySource?.id || null,
          display_name: primarySource?.display_name || doiVenue || null,
          type: primarySource?.type || null,
          issn_l: primarySource?.issn_l || null,
          is_in_doaj: primarySource?.is_in_doaj ?? null,
          host_organization_name: primarySource?.host_organization_name || null,
          host_organization_lineage_names: primarySource?.host_organization_lineage_names || [],
        },
        links: {
          openalex: work.id || null,
          landing_page: primaryLocation?.landing_page_url || null,
          pdf: primaryLocation?.pdf_url || null,
          primary_topic_openalex: primaryTopic?.id || null,
          source_openalex: primarySource?.id || null,
        },
        concepts: (work.concepts || []).slice(0, 8).map((c) => c.display_name).filter(Boolean),
        abstract,
        openalex_analysis: {
          primary_topic: primaryTopic
            ? {
                id: primaryTopic.id || null,
                name: primaryTopic.display_name || null,
                score: typeof primaryTopic.score === "number" ? primaryTopic.score : null,
                subfield: primaryTopic.subfield?.display_name || null,
                field: primaryTopic.field?.display_name || null,
                domain: primaryTopic.domain?.display_name || null,
              }
            : null,
          topics: (work.topics || []).slice(0, 12).map((t) => ({
            id: t.id || null,
            name: t.display_name || null,
            score: typeof t.score === "number" ? t.score : null,
            subfield: t.subfield?.display_name || null,
            field: t.field?.display_name || null,
            domain: t.domain?.display_name || null,
          })),
          concepts: (work.concepts || []).slice(0, 20).map((c) => ({
            id: c.id || null,
            name: c.display_name || null,
            score: typeof c.score === "number" ? c.score : null,
            level: typeof c.level === "number" ? c.level : null,
          })),
          keywords: (work.keywords || []).slice(0, 20).map((k) => ({
            id: k.id || null,
            name: k.display_name || null,
            score: typeof k.score === "number" ? k.score : null,
          })),
          sustainable_development_goals: (work.sustainable_development_goals || []).slice(0, 17).map((s) => ({
            id: s.id || null,
            display_name: s.display_name || null,
            score: typeof s.score === "number" ? s.score : null,
          })),
          open_access: work.open_access || null,
          citation_normalized_percentile: work.citation_normalized_percentile || null,
          fwci: typeof work.fwci === "number" ? work.fwci : null,
          counts_by_year: work.counts_by_year || [],
          institutions_distinct_count: work.institutions_distinct_count || 0,
          countries_distinct_count: work.countries_distinct_count || 0,
          referenced_works_count: Array.isArray(work.referenced_works) ? work.referenced_works.length : 0,
        },
      };
      works.push(mappedWork);

      const titleKey = normalizeTitle(mappedWork.title);
      if (titleKey) {
        const existing = dedupedByTitle.get(titleKey);
        if (!existing || isBetterWorkCandidate(mappedWork, existing)) {
          dedupedByTitle.set(titleKey, mappedWork);
        }
      }

      if (maxPapers && dedupedByTitle.size >= maxPapers) {
        return dedupeWorksByTitle(works).slice(0, maxPapers);
      }
    }

    // Incremental mode: once we hit a full known page, we can stop paging.
    if (knownIds && pageResults.length > 0 && pageKnownCount === pageResults.length) {
      break;
    }

    cursor = payload.meta?.next_cursor || null;
    if (!cursor) break;
  }

  return dedupeWorksByTitle(works);
}

function paperCacheKey(work) {
  const fingerprint = `${work.id}|${work.title}|${work.abstract}`;
  return crypto.createHash("sha256").update(fingerprint).digest("hex");
}

function getInterestTopics(researcher) {
  if (Array.isArray(researcher?.interest_topics) && researcher.interest_topics.length > 0) {
    return researcher.interest_topics;
  }
  return DEFAULT_INTEREST_TOPICS;
}

function shortenText(text, maxChars = 1800) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars)} ...`;
}

function buildPaperFilterPrompt(work) {
  return `You are doing Stage-1 filtering for affective/emotion-related research.\n\nPaper title:\n${work.title}\n\nReturn strict JSON:\n{\n  "is_interesting": boolean,\n  "relevance_score": number,\n  "confidence": number,\n  "reason": string\n}\n\nRules:\n- Use title only.\n- If title is clearly affective/emotion-related, set is_interesting=true.\n- If title is clearly not related, set is_interesting=false.\n- If uncertain, lean conservative and set is_interesting=false.\n- relevance_score in [0,1].\n- confidence in [0,1].\n- reason: one short sentence (<=16 words).\n- Output valid JSON only.`;
}

function buildPaperExtractionPrompt(researcher, work) {
  return `You are doing Stage-2 extraction for an already-selected affective/emotion-related paper.\n\nResearcher: ${researcher.name}\nInterest topics: ${getInterestTopics(researcher).join(", ")}\n\nPaper metadata:\n- Title: ${work.title}\n- Year: ${work.publication_year || "unknown"}\n- Venue: ${work.primary_source || "unknown"}\n- Concepts: ${(work.concepts || []).join(", ") || "none"}\n- Abstract: ${shortenText(work.abstract || "(empty)")}\n\nReturn strict JSON:\n{\n  "reason": string,\n  "evidence": string[],\n  "tldr": string,\n  "research_directions": string[]\n}\n\nRules:\n- reason: one concise sentence.\n- evidence: 1-3 short concrete clues from title/abstract/concepts.\n- TLDR: 1 sentence only, 18-40 words; focus on problem + method + contribution; neutral and factual.\n- research_directions: 2-5 items; noun phrases (2-6 words), lowercase, avoid overlap/synonyms.\n- Ground everything in given metadata only; do not invent facts.\n- Output valid JSON only.`;
}

function buildSummaryPrompt(researcher, analyzedWorks) {
  const interesting = analyzedWorks
    .filter((w) => w.analysis?.is_interesting)
    .map((w) => ({
      title: w.title,
      year: w.publication_year,
      cited_by_count: w.cited_by_count,
      directions: w.analysis.research_directions || [],
    }));

  return `Based on interesting papers for researcher ${researcher.name}, summarize research directions and evolution.\n\nInput papers JSON:\n${JSON.stringify(interesting)}\n\nReturn strict JSON:\n{\n  "top_research_directions": [{"name": string, "weight": number}],\n  "trend_summary": string,\n  "representative_papers": [{"title": string, "why": string}]\n}\n\nRules for top_research_directions:\n- Keep direction labels concise and stable (noun phrases).\n- max 8 directions\n- weight in [0,1], sorted desc\n- Do NOT turn directions into timeline sentences.\n\nRules for trend_summary:\n- Write 1 paragraph (120-220 words), academic and neutral tone.\n- Divide the timeline into fixed 5-year windows, starting from the earliest full year in input.\n- Mention explicit year ranges for each 5-year window (e.g., 2011-2015, 2016-2020, 2021-2025).\n- Describe evolution window by window (earliest -> latest), then summarize the latest window as current focus.\n- Do NOT use vague absolute-time words without window anchors.\n- Ground statements in the input years/titles/directions only; do not invent facts.\n- If data in some window is sparse, explicitly say evidence is limited for that window.\n- Use consistent terminology across windows; avoid renaming the same direction with synonyms.\n- If no meaningful shift is observed between windows, explicitly state continuity instead of forcing a transition.\n- Avoid generic praise or vague wording.\n\nRules for representative_papers:\n- max 8 items\n- why should explain representativeness for direction/evolution, not only citation count.`;
}

async function callQwenChat({
  apiKey,
  baseUrl,
  model,
  userPrompt,
  temperature = 0,
  maxTokens = 420,
  enableThinking = false,
}) {
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const body = {
    model,
    temperature,
    max_tokens: maxTokens,
    enable_thinking: enableThinking,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "You are a precise research analysis assistant. Return valid JSON only." },
      { role: "user", content: userPrompt },
    ],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Qwen API error: ${res.status} ${res.statusText} - ${text}`);
  }

  const payload = JSON.parse(text);
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("Qwen API returned empty content");

  return JSON.parse(content);
}

function clamp01(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  if (num < 0) return 0;
  if (num > 1) return 1;
  return num;
}

function normalizePaperFilter(raw) {
  return {
    is_interesting: Boolean(raw?.is_interesting),
    relevance_score: clamp01(raw?.relevance_score, 0),
    confidence: clamp01(raw?.confidence, 0),
    reason: typeof raw?.reason === "string" ? raw.reason : "",
  };
}

function normalizePaperExtraction(raw) {
  const directions = Array.isArray(raw?.research_directions)
    ? raw.research_directions.filter(Boolean).slice(0, 10)
    : [];
  const evidence = Array.isArray(raw?.evidence) ? raw.evidence.filter(Boolean).slice(0, 3) : [];
  const tldr = typeof raw?.tldr === "string" ? raw.tldr.trim() : "";

  return {
    reason: typeof raw?.reason === "string" ? raw.reason : "",
    evidence,
    tldr,
    research_directions: directions,
  };
}

function fallbackSummary(analyzedWorks) {
  const directionCounts = new Map();
  for (const work of analyzedWorks) {
    const analysis = work.analysis;
    if (!analysis?.is_interesting) continue;
    for (const direction of analysis.research_directions || []) {
      directionCounts.set(direction, (directionCounts.get(direction) || 0) + 1);
    }
  }

  const total = [...directionCounts.values()].reduce((a, b) => a + b, 0) || 1;
  const top = [...directionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, weight: Number((count / total).toFixed(3)) }));

  const representatives = analyzedWorks
    .filter((w) => w.analysis?.is_interesting)
    .sort((a, b) => b.cited_by_count - a.cited_by_count)
    .slice(0, 8)
    .map((w) => ({ title: w.title, why: `Highly cited (${w.cited_by_count}).` }));

  return {
    top_research_directions: top,
    trend_summary: "AI summary unavailable. Generated by frequency fallback.",
    representative_papers: representatives,
  };
}

function buildCachedWorkIdSet(cache) {
  const ids = new Set();
  for (const entry of Object.values(cache || {})) {
    const paperId = entry?.paper_id;
    if (typeof paperId === "string" && paperId) ids.add(paperId);
  }
  return ids;
}

async function backfillVenueFromDoiForWorks(works, resolveVenueByDoi) {
  if (!Array.isArray(works) || typeof resolveVenueByDoi !== "function") return;
  for (const work of works) {
    if (!work) continue;
    const hasSource = String(work?.source?.display_name || work?.primary_source || "").trim().length > 0;
    if (hasSource) continue;
    const doi = work?.doi || work?.doi_url || null;
    if (!doi) continue;
    const venue = await resolveVenueByDoi(doi);
    if (!venue) continue;
    work.primary_source = venue;
    work.source = {
      ...(work.source || {}),
      display_name: venue,
    };
  }
}

async function analyzePaper({ researcher, work, args, cache, qwenConfig }) {
  const cacheKey = paperCacheKey(work);
  const cachedEntry = cache[cacheKey];
  if (cachedEntry && !args.fullRefresh) {
    if (cachedEntry.analysis && typeof cachedEntry.analysis === "object") {
      return { analysis: cachedEntry.analysis, fromCache: true };
    }
    return { analysis: cachedEntry, fromCache: true };
  }

  if (args.skipAi) {
    const skipped = {
      is_interesting: false,
      relevance_score: 0,
      confidence: 0,
      reason: "AI skipped by --skip-ai",
      evidence: [],
      tldr: "",
      research_directions: [],
    };
    cache[cacheKey] = {
      paper_id: work.id,
      title: work.title,
      researcher_name: researcher.name,
      researcher_openalex_author_id: normalizeAuthorId(researcher.openalex_author_id),
      researcher_orcid: normalizeOrcid(researcher.orcid) || null,
      updated_at: new Date().toISOString(),
      analysis: skipped,
    };
    return { analysis: skipped, fromCache: false };
  }

  const stage1Prompt = buildPaperFilterPrompt(work);
  let attempt = 0;
  let lastErr = null;

  while (attempt < 3) {
    attempt += 1;
    try {
      const filterRaw = await callQwenChat({
        apiKey: qwenConfig.apiKey,
        baseUrl: qwenConfig.baseUrl,
        model: args.model,
        userPrompt: stage1Prompt,
        temperature: 0,
        maxTokens: 120,
      });
      const stage1 = normalizePaperFilter(filterRaw);
      let normalized = {
        ...stage1,
        evidence: [],
        tldr: "",
        research_directions: [],
      };

      if (stage1.is_interesting) {
        const extractionRaw = await callQwenChat({
          apiKey: qwenConfig.apiKey,
          baseUrl: qwenConfig.baseUrl,
          model: args.model,
          userPrompt: buildPaperExtractionPrompt(researcher, work),
          temperature: 0,
          maxTokens: 260,
        });
        const stage2 = normalizePaperExtraction(extractionRaw);
        normalized = {
          ...stage1,
          ...stage2,
        };
      }

      cache[cacheKey] = {
        paper_id: work.id,
        title: work.title,
        researcher_name: researcher.name,
        researcher_openalex_author_id: normalizeAuthorId(researcher.openalex_author_id),
        researcher_orcid: normalizeOrcid(researcher.orcid) || null,
        updated_at: new Date().toISOString(),
        analysis: normalized,
      };
      return { analysis: normalized, fromCache: false };
    } catch (err) {
      lastErr = err;
      await sleep(500 * attempt);
    }
  }

  throw lastErr;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const seed = await loadJson(args.seed);
  if (!seed?.researchers?.length) {
    throw new Error(`No researchers found in ${args.seed}`);
  }
  const seedResearchers = seed.researchers;
  const selectedResearchers =
    args.researcherNames.length === 0
      ? seedResearchers
      : seedResearchers.filter((r) =>
          args.researcherNames.some(
            (target) => normalizeNameForMatch(target) === normalizeNameForMatch(r.name)
          )
        );
  if (selectedResearchers.length === 0) {
    throw new Error(
      `No researcher matched --researcher-name in seed. Input: ${args.researcherNames.join(", ")}`
    );
  }

  const qwenApiKey = process.env.QWEN_API_KEY;
  if (!args.skipAi && !qwenApiKey) {
    throw new Error("QWEN_API_KEY is required unless --skip-ai is set");
  }
  const qwenBaseUrl = process.env.QWEN_BASE_URL || DEFAULT_QWEN_BASE_URL;
  const workerCount = Math.max(1, Math.floor(args.concurrency || 1));
  const lowWatermark = Math.max(1, workerCount * 6);
  const highWatermark = Math.max(lowWatermark + 1, workerCount * 12);

  const previousIndex = (await loadJson(args.out, null)) || null;
  const legacyMonolithPath = path.join(path.dirname(args.out), "researcher.profile.json");
  const legacyOutput = (await loadJson(legacyMonolithPath, null)) || null;
  const institutionCountryCachePath = path.join(args.cache, "institution-country-cache.json");
  const institutionCountryCache = (await loadJson(institutionCountryCachePath, {})) || {};
  const scholarAffiliationCachePath = path.join(args.cache, "scholar-affiliation-cache.json");
  const scholarAffiliationCache = (await loadJson(scholarAffiliationCachePath, {})) || {};
  const doiVenueCachePath = path.join(args.cache, "doi-venue-cache.json");
  const doiVenueCache = (await loadJson(doiVenueCachePath, {})) || {};
  const previousIndexResearchers =
    Array.isArray(previousIndex?.researchers) && previousIndex.researchers.length > 0
      ? previousIndex.researchers
      : Array.isArray(legacyOutput?.researchers)
      ? legacyOutput.researchers.map((profile) => makeIndexRecord(profile, args.out))
      : [];
  const outputResearchers = [...previousIndexResearchers];
  const generatedAt = new Date().toISOString();
  const output = {
    generated_at: generatedAt,
    pipeline_version: "v0.1.0",
    run_config: {
      model: args.model,
      skip_ai: args.skipAi,
      full_refresh: args.fullRefresh,
      max_papers: args.maxPapers,
      delay_ms: args.delayMs,
      concurrency: args.concurrency,
      save_every: args.saveEvery,
      researcher_names:
        args.researcherNames.length > 0 ? args.researcherNames : selectedResearchers.map((r) => r.name),
    },
    researchers: outputResearchers,
  };

  console.log("[build-config] researcher pipeline");
  console.log(`  seed: ${args.seed}`);
  console.log(`  out: ${args.out}`);
  console.log(`  cache: ${args.cache}`);
  console.log(`  model: ${args.model}`);
  console.log(`  qwen_base_url: ${qwenBaseUrl}`);
  console.log(`  qwen_api_key: ${qwenApiKey ? "set" : "missing"}`);
  console.log(`  full_refresh: ${args.fullRefresh}`);
  console.log(`  skip_ai: ${args.skipAi}`);
  console.log(`  max_papers: ${args.maxPapers ?? "none"}`);
  console.log(`  delay_ms: ${args.delayMs}`);
  console.log(`  concurrency: ${workerCount}`);
  console.log(`  save_every: ${Math.max(1, Math.floor(args.saveEvery || 1))}`);
  console.log(`  queue_low_watermark: ${lowWatermark}`);
  console.log(`  queue_high_watermark: ${highWatermark}`);
  console.log(`  selected_researchers: ${selectedResearchers.length}`);
  if (args.researcherNames.length > 0) {
    console.log(`  researcher_name_filter: ${args.researcherNames.join(", ")}`);
  }

  const researcherContexts = [];
  const analysisTasks = [];
  let taskCursor = 0;
  let analyzedCount = 0;
  let completedCount = 0;
  let producerCursor = 0;
  let inFlightResearchers = 0;
  let producerDone = false;
  let producerError = null;
  const producerWorkerCount = 2;
  const outstandingTasks = () => analysisTasks.length - completedCount;

  async function prepareResearcherContext(researcher) {
    const authorId = normalizeAuthorId(researcher.openalex_author_id);
    const previousIndexRecord = previousIndexResearchers.find(
      (item) => item?.identity?.openalex_author_id === authorId
    );
    const previousProfilePath = previousIndexRecord?.profile_path
      ? path.resolve(process.cwd(), previousIndexRecord.profile_path)
      : getProfileFilePathByAuthorId(args.out, authorId);
    const previousResearcher =
      (await loadJson(previousProfilePath, null)) ||
      legacyOutput?.researchers?.find((item) => item?.identity?.openalex_author_id === authorId) ||
      null;
    const cachePath = getResearcherCachePath(args.cache, researcher, authorId);
    const cache = (await loadJson(cachePath, {})) || {};
    const previousWorks = Array.isArray(previousResearcher?.works) ? previousResearcher.works : [];
    const knownWorkIds = buildCachedWorkIdSet(cache);

    console.log(`Fetching OpenAlex author: ${authorId}`);
    const authorProfile = await fetchAuthorProfile(authorId);
    const effectiveOrcid = normalizeOrcid(researcher.orcid) || normalizeOrcid(authorProfile.orcid) || null;
    const runtimeResearcher = {
      ...researcher,
      orcid: effectiveOrcid,
    };

    console.log(`Fetching works for ${researcher.name} (${args.fullRefresh ? "full" : "incremental"})`);
    const newWorks = await fetchAuthorWorks(authorId, {
      maxPapers: args.maxPapers,
      knownWorkIds,
      fullRefresh: args.fullRefresh,
      resolveVenueByDoi: (doi) =>
        resolveVenueFromDoi({
          doiValue: doi,
          doiVenueCache,
          doiVenueCachePath,
        }),
    });
    console.log(`Fetched ${newWorks.length} uncached works`);

    const ctx = {
      researcher,
      authorId,
      runtimeResearcher,
      previousResearcher,
      previousWorks,
      authorProfile,
      effectiveOrcid,
      cachePath,
      cache,
      analyzedNewWorks: [...newWorks],
      aiCalledCount: 0,
      processedSinceFlush: 0,
      saveEvery: Math.max(1, Math.floor(args.saveEvery || 1)),
      cacheSaveChain: Promise.resolve(),
      queueCacheSave: null,
    };
    ctx.queueCacheSave = async () => {
      ctx.cacheSaveChain = ctx.cacheSaveChain.then(() => saveJson(ctx.cachePath, ctx.cache));
      await ctx.cacheSaveChain;
    };
    return ctx;
  }

  const producer = (async () => {
    try {
      const producerWorkers = new Array(producerWorkerCount).fill(null).map(async () => {
        while (true) {
          if (outstandingTasks() >= highWatermark) {
            await sleep(80);
            continue;
          }

          const currentIndex = producerCursor;
          if (currentIndex >= selectedResearchers.length) break;
          producerCursor += 1;

          const researcher = selectedResearchers[currentIndex];
          inFlightResearchers += 1;
          try {
            const ctx = await prepareResearcherContext(researcher);
            researcherContexts.push(ctx);
            for (let i = 0; i < ctx.analyzedNewWorks.length; i += 1) {
              analysisTasks.push({
                ctx,
                i,
                work: ctx.analyzedNewWorks[i],
              });
            }
          } finally {
            inFlightResearchers -= 1;
          }

          if (outstandingTasks() < lowWatermark) {
            continue;
          }
        }
      });
      await Promise.all(producerWorkers);
    } catch (err) {
      producerError = err;
    } finally {
      producerDone = true;
    }
  })();

  const workers = new Array(workerCount).fill(null).map(async () => {
    while (true) {
      if (producerError) throw producerError;

      const taskIndex = taskCursor;
      if (taskIndex < analysisTasks.length) {
        taskCursor += 1;
        const task = analysisTasks[taskIndex];
        const { ctx, i, work } = task;
        const { analysis, fromCache } = await analyzePaper({
          researcher: ctx.runtimeResearcher,
          work,
          args,
          cache: ctx.cache,
          qwenConfig: { apiKey: qwenApiKey, baseUrl: qwenBaseUrl },
        });
        ctx.analyzedNewWorks[i] = { ...work, analysis };
        if (!fromCache) {
          ctx.aiCalledCount += 1;
          if (args.delayMs > 0) await sleep(args.delayMs);
        }

        analyzedCount += 1;
        completedCount += 1;
        ctx.processedSinceFlush += 1;
        if (ctx.processedSinceFlush >= ctx.saveEvery) {
          ctx.processedSinceFlush = 0;
          await ctx.queueCacheSave();
        }
        process.stdout.write(`Analyzing new paper ${analyzedCount}/${analysisTasks.length}\r`);
        continue;
      }

      if (producerDone && inFlightResearchers === 0) break;
      await sleep(50);
    }
  });

  await Promise.all(workers);
  await producer;
  if (producerError) throw producerError;
  for (const ctx of researcherContexts) {
    await ctx.cacheSaveChain;
  }
  if (analysisTasks.length > 0) process.stdout.write("\n");

  for (const ctx of researcherContexts) {
    const {
      researcher,
      authorId,
      previousResearcher,
      previousWorks,
      authorProfile,
      effectiveOrcid,
      cachePath,
      cache,
      analyzedNewWorks,
      aiCalledCount,
    } = ctx;

    const mergedWorks = [...analyzedNewWorks];
    if (!args.fullRefresh) {
      for (const oldWork of previousWorks) {
        if (!oldWork?.id) continue;
        if (analyzedNewWorks.some((nw) => nw.id === oldWork.id)) continue;
        mergedWorks.push(oldWork);
      }
    }
    const dedupedMergedWorks = dedupeWorksByTitle(mergedWorks);
    await backfillVenueFromDoiForWorks(
      dedupedMergedWorks,
      (doi) =>
        resolveVenueFromDoi({
          doiValue: doi,
          doiVenueCache,
          doiVenueCachePath,
        })
    );

    dedupedMergedWorks.sort((a, b) => {
      const dateA = a.publication_date || "";
      const dateB = b.publication_date || "";
      if (dateA && dateB) return dateA > dateB ? -1 : dateA < dateB ? 1 : 0;
      const yearA = a.publication_year || 0;
      const yearB = b.publication_year || 0;
      return yearB - yearA;
    });

    const interestingWorks = dedupedMergedWorks.filter((w) => w.analysis?.is_interesting);

    const shouldRecomputeSummary =
      args.fullRefresh || analyzedNewWorks.length > 0 || !previousResearcher?.topic_summary;
    let topicSummary = shouldRecomputeSummary
      ? fallbackSummary(dedupedMergedWorks)
      : previousResearcher.topic_summary;
    if (!args.skipAi && shouldRecomputeSummary) {
      try {
        const summaryRaw = await callQwenChat({
          apiKey: qwenApiKey,
          baseUrl: qwenBaseUrl,
          model: args.model,
          userPrompt: buildSummaryPrompt(researcher, dedupedMergedWorks),
          temperature: 0,
          maxTokens: 1000,
        });
        topicSummary = {
          top_research_directions: Array.isArray(summaryRaw?.top_research_directions)
            ? summaryRaw.top_research_directions.slice(0, 8).map((d) => ({
                name: String(d?.name || ""),
                weight: clamp01(d?.weight, 0),
              }))
            : topicSummary.top_research_directions,
          trend_summary:
            typeof summaryRaw?.trend_summary === "string"
              ? summaryRaw.trend_summary
              : topicSummary.trend_summary,
          representative_papers: Array.isArray(summaryRaw?.representative_papers)
            ? summaryRaw.representative_papers.slice(0, 8).map((p) => ({
                title: String(p?.title || ""),
                why: String(p?.why || ""),
              }))
            : topicSummary.representative_papers,
        };
      } catch (err) {
        console.warn(`Summary generation failed, fallback used: ${err.message}`);
      }
    }

    const nextResearcherProfile = {
      identity: {
        name: researcher.name,
        orcid: effectiveOrcid,
        google_scholar: researcher.google_scholar,
        openalex_author_id: authorId,
        openalex_author_url: `https://openalex.org/${authorId}`,
      },
      affiliation: {
        last_known_institution: null,
        last_known_country: null,
        source: "google_scholar_preferred_orcid_openalex_fallback",
      },
      metrics: {
        works_count: authorProfile.works_count || 0,
        cited_by_count: authorProfile.cited_by_count || 0,
        h_index: authorProfile.summary_stats?.h_index || null,
        i10_index: authorProfile.summary_stats?.i10_index || null,
      },
      topic_summary: topicSummary,
      stats: {
        analyzed_works_count: dedupedMergedWorks.length,
        interesting_works_count: interestingWorks.length,
        new_works_count: analyzedNewWorks.length,
        deduped_works_count: dedupedMergedWorks.length,
        ai_called_count: aiCalledCount,
        summary_recomputed: shouldRecomputeSummary,
      },
      works: dedupedMergedWorks,
    };
    let orcidAffiliation = { institution: null, country: null };
    try {
      orcidAffiliation = await fetchOrcidAffiliation(effectiveOrcid);
    } catch {
      orcidAffiliation = { institution: null, country: null };
    }
    const scholarKey = getScholarUserId(researcher.google_scholar) || String(researcher.google_scholar || "").trim();
    let scholarAffiliation = null;
    if (scholarKey) {
      if (Object.prototype.hasOwnProperty.call(scholarAffiliationCache, scholarKey)) {
        scholarAffiliation = scholarAffiliationCache[scholarKey] || null;
      } else {
        try {
          scholarAffiliation = await fetchGoogleScholarAffiliation(researcher.google_scholar);
        } catch {
          scholarAffiliation = null;
        }
        scholarAffiliationCache[scholarKey] = scholarAffiliation || null;
        await saveJson(scholarAffiliationCachePath, scholarAffiliationCache);
      }
    }
    const selectedInstitution =
      scholarAffiliation ||
      authorProfile.last_known_institutions?.[0]?.display_name ||
      orcidAffiliation.institution ||
      null;
    nextResearcherProfile.affiliation.source =
      scholarAffiliation
        ? "google_scholar"
        : authorProfile.last_known_institutions?.[0]?.display_name
        ? "openalex"
        : orcidAffiliation.institution
        ? "orcid"
        : "openalex";
    const countryFromInstitution = selectedInstitution
      ? await resolveInstitutionCountryName({
          institutionName: selectedInstitution,
          institutionCountryCache,
          institutionCountryCachePath,
        })
      : null;
    nextResearcherProfile.affiliation.last_known_institution = selectedInstitution;
    nextResearcherProfile.affiliation.last_known_country =
      normalizeCountryNameToEnglish(orcidAffiliation.country) ||
      normalizeCountryNameToEnglish(countryFromInstitution) ||
      countryNameFromCode(authorProfile.last_known_institutions?.[0]?.country_code) ||
      null;

    const nextIndexRecord = makeIndexRecord(nextResearcherProfile, args.out);
    const existingIndex = output.researchers.findIndex(
      (item) => item?.identity?.openalex_author_id === authorId
    );
    if (existingIndex >= 0) output.researchers[existingIndex] = nextIndexRecord;
    else output.researchers.push(nextIndexRecord);

    // Save checkpoint after each researcher to avoid losing progress.
    output.generated_at = new Date().toISOString();
    await saveJson(cachePath, cache);
    output.researchers.sort((a, b) =>
      String(a?.identity?.name || "").localeCompare(String(b?.identity?.name || ""))
    );
    await saveIndexAndProfileWithStaticMirror({
      indexPath: args.out,
      indexData: output,
      authorId,
      profileData: nextResearcherProfile,
    });
    console.log(`Checkpoint saved for ${researcher.name}`);
  }
  console.log(`Index exported to ${args.out}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

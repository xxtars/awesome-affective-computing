import fs from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  const args = {
    seed: "data/researchers/researcher.seed.json",
    out: "data/researchers/researchers.index.json",
    cache: "data/researchers/cache",
    name: "",
    googleScholar: "",
    openalexAuthorId: "",
    orcid: "",
    removeAuthorId: "",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--seed") args.seed = argv[++i];
    else if (token === "--out") args.out = argv[++i];
    else if (token === "--cache") args.cache = argv[++i];
    else if (token === "--name") args.name = argv[++i] || "";
    else if (token === "--google-scholar") args.googleScholar = argv[++i] || "";
    else if (token === "--openalex-author-id") args.openalexAuthorId = argv[++i] || "";
    else if (token === "--orcid") args.orcid = argv[++i] || "";
    else if (token === "--remove-author-id") args.removeAuthorId = argv[++i] || "";
  }
  return args;
}

function normalizeAuthorId(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const fromUrl = raw.match(/\/authors\/(A\d+)\b/i)?.[1] || raw.match(/\b(A\d+)\b/i)?.[1] || raw;
  return fromUrl.toUpperCase();
}

function normalizeScholar(value) {
  const raw = String(value || "").trim();
  return raw || null;
}

function normalizeOrcid(rawOrcid) {
  const raw = String(rawOrcid || "").trim();
  if (!raw) return null;
  const idMatch =
    raw.match(/(\d{4}-\d{4}-\d{4}-[\dX]{4})/i)?.[1] ||
    raw.match(/(\d{15}[\dX])/i)?.[1];
  if (!idMatch) return null;
  const compact = idMatch.replace(/-/g, "").toUpperCase();
  if (compact.length !== 16) return null;
  const withDash = `${compact.slice(0, 4)}-${compact.slice(4, 8)}-${compact.slice(8, 12)}-${compact.slice(12)}`;
  return `https://orcid.org/${withDash}`;
}

async function loadJson(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function saveJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), {recursive: true});
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function removeIfExists(filePath) {
  await fs.rm(filePath, {force: true, recursive: true});
}

async function cleanupOldAuthorData({oldAuthorId, outPath, cacheRoot}) {
  if (!oldAuthorId) return;

  const oldUpper = String(oldAuthorId).toUpperCase();
  const oldLower = String(oldAuthorId).toLowerCase();
  const root = process.cwd();

  const profilePath = path.join(path.dirname(outPath), "profiles", `${oldUpper}.json`);
  const staticRoot = path.join(root, "static", "data", "researchers");
  const staticProfilePath = path.join(staticRoot, "profiles", `${oldUpper}.json`);
  const staticIndexPath = path.join(staticRoot, path.basename(outPath));

  await removeIfExists(profilePath);
  await removeIfExists(staticProfilePath);

  const indexJson = await loadJson(outPath);
  if (indexJson && Array.isArray(indexJson.researchers)) {
    indexJson.researchers = indexJson.researchers.filter(
      (item) => normalizeAuthorId(item?.identity?.openalex_author_id) !== oldUpper,
    );
    await saveJson(outPath, indexJson);
  }

  const staticIndexJson = await loadJson(staticIndexPath);
  if (staticIndexJson && Array.isArray(staticIndexJson.researchers)) {
    staticIndexJson.researchers = staticIndexJson.researchers.filter(
      (item) => normalizeAuthorId(item?.identity?.openalex_author_id) !== oldUpper,
    );
    await saveJson(staticIndexPath, staticIndexJson);
  }

  const cacheAbs = path.resolve(root, cacheRoot);
  const dirs = await fs.readdir(cacheAbs, {withFileTypes: true}).catch(() => []);
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    if (dir.name.endsWith(`__${oldLower}`)) {
      await removeIfExists(path.join(cacheAbs, dir.name));
    }
  }

  console.log(`Cleaned old author data: ${oldUpper}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const seedPath = path.resolve(process.cwd(), args.seed);
  const outPath = path.resolve(process.cwd(), args.out);
  const authorId = normalizeAuthorId(args.openalexAuthorId);
  const removeAuthorId = normalizeAuthorId(args.removeAuthorId);
  const name = String(args.name || "").trim();
  const orcid = normalizeOrcid(args.orcid);
  const googleScholar = normalizeScholar(args.googleScholar);

  if (!authorId) throw new Error("Missing --openalex-author-id");
  if (!name) throw new Error("Missing --name");

  const seed = await loadJson(seedPath);
  if (!Array.isArray(seed?.researchers)) {
    throw new Error(`Invalid seed format in ${seedPath}: researchers[] is required`);
  }

  const existingIndex = seed.researchers.findIndex((item) => {
    const existingAuthorId = normalizeAuthorId(item?.openalex_author_id);
    return existingAuthorId === authorId;
  });

  const existingRecord = existingIndex >= 0 ? seed.researchers[existingIndex] : null;
  const hasScholarInput = String(args.googleScholar || "").trim().length > 0;
  const hasOrcidInput = String(args.orcid || "").trim().length > 0;

  const nextRecord = {
    name,
    google_scholar: hasScholarInput ? googleScholar : normalizeScholar(existingRecord?.google_scholar),
    openalex_author_id: authorId,
    orcid: hasOrcidInput ? orcid : normalizeOrcid(existingRecord?.orcid),
  };

  if (existingIndex >= 0) {
    seed.researchers[existingIndex] = nextRecord;
    console.log(`Updated seed researcher: ${name} (${authorId})`);
  } else {
    seed.researchers.push(nextRecord);
    console.log(`Added seed researcher: ${name} (${authorId})`);
  }

  seed.researchers.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "en"));

  if (removeAuthorId && removeAuthorId !== authorId) {
    const before = seed.researchers.length;
    seed.researchers = seed.researchers.filter(
      (item) => normalizeAuthorId(item?.openalex_author_id) !== removeAuthorId,
    );
    if (seed.researchers.length !== before) {
      console.log(`Removed old seed record: ${removeAuthorId}`);
    }
  }

  await saveJson(seedPath, seed);

  if (removeAuthorId && removeAuthorId !== authorId) {
    await cleanupOldAuthorData({
      oldAuthorId: removeAuthorId,
      outPath,
      cacheRoot: args.cache,
    });
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});

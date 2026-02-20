import fs from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  const args = {
    seed: "data/researchers/researcher.seed.json",
    name: "",
    googleScholar: "",
    openalexAuthorId: "",
    affiliation: "",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--seed") args.seed = argv[++i];
    else if (token === "--name") args.name = argv[++i] || "";
    else if (token === "--google-scholar") args.googleScholar = argv[++i] || "";
    else if (token === "--openalex-author-id") args.openalexAuthorId = argv[++i] || "";
    else if (token === "--affiliation") args.affiliation = argv[++i] || "";
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

async function loadJson(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content);
}

async function saveJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), {recursive: true});
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const seedPath = path.resolve(process.cwd(), args.seed);
  const authorId = normalizeAuthorId(args.openalexAuthorId);
  const name = String(args.name || "").trim();
  const affiliation = String(args.affiliation || "").trim();
  const googleScholar = normalizeScholar(args.googleScholar);

  if (!authorId) throw new Error("Missing --openalex-author-id");
  if (!name) throw new Error("Missing --name");
  if (!affiliation) throw new Error("Missing --affiliation");

  const seed = await loadJson(seedPath);
  if (!Array.isArray(seed?.researchers)) {
    throw new Error(`Invalid seed format in ${seedPath}: researchers[] is required`);
  }

  const existingIndex = seed.researchers.findIndex((item) => {
    const existingAuthorId = normalizeAuthorId(item?.openalex_author_id);
    return existingAuthorId === authorId;
  });

  const nextRecord = {
    name,
    google_scholar: googleScholar,
    openalex_author_id: authorId,
    affiliation,
  };

  if (existingIndex >= 0) {
    seed.researchers[existingIndex] = nextRecord;
    console.log(`Updated seed researcher: ${name} (${authorId})`);
  } else {
    seed.researchers.push(nextRecord);
    console.log(`Added seed researcher: ${name} (${authorId})`);
  }

  seed.researchers.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "en"));
  await saveJson(seedPath, seed);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});

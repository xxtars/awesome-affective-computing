const OPENALEX_BASE_URL = 'https://api.openalex.org';

export type OpenAlexAuthorCandidate = {
  id: string;
  display_name: string;
  works_count: number;
  last_known_institutions?: {display_name: string; country_code?: string}[];
  x_concepts?: {display_name: string; score: number}[];
};

export type OpenAlexAuthor = {
  id: string;
  display_name: string;
  last_known_institutions?: {display_name: string; country_code?: string}[];
  x_concepts?: {display_name: string; score: number}[];
  topics?: {display_name: string; score: number}[];
};

export type OpenAlexWork = {
  id: string;
  title: string;
  publication_year: number;
  primary_location?: {
    source?: {display_name?: string};
    landing_page_url?: string;
  };
  doi?: string;
  authorships?: {
    author?: {display_name?: string};
  }[];
  concepts?: {display_name: string; score: number}[];
};

type OpenAlexListResponse<T> = {
  results: T[];
};

function extractEntityId(openalexId: string): string {
  return openalexId.includes('/') ? openalexId.split('/').pop() ?? openalexId : openalexId;
}

export async function getAuthorCandidatesByName(name: string): Promise<OpenAlexAuthorCandidate[]> {
  const resp = await fetch(
    `${OPENALEX_BASE_URL}/authors?search=${encodeURIComponent(name)}&per-page=5`,
  );

  if (!resp.ok) {
    throw new Error(`Failed to search author by name: ${resp.status}`);
  }

  const data = (await resp.json()) as OpenAlexListResponse<OpenAlexAuthorCandidate>;
  return data.results;
}

export async function getWorksByAuthorId(
  authorId: string,
  opts?: {perPage?: number},
): Promise<OpenAlexWork[]> {
  const normalizedId = extractEntityId(authorId);
  const perPage = opts?.perPage ?? 50;

  const resp = await fetch(
    `${OPENALEX_BASE_URL}/works?filter=authorships.author.id:A${normalizedId.replace(/^A/, '')}&sort=publication_year:desc&per-page=${perPage}`,
  );

  if (!resp.ok) {
    throw new Error(`Failed to fetch works: ${resp.status}`);
  }

  const data = (await resp.json()) as OpenAlexListResponse<OpenAlexWork>;
  return data.results;
}

export async function getAuthorById(authorId: string): Promise<OpenAlexAuthor> {
  const normalizedId = extractEntityId(authorId).replace(/^A/, '');
  const resp = await fetch(`${OPENALEX_BASE_URL}/authors/A${normalizedId}`);

  if (!resp.ok) {
    throw new Error(`Failed to fetch author: ${resp.status}`);
  }

  return (await resp.json()) as OpenAlexAuthor;
}

export function pickBestAuthorCandidate(
  inputName: string,
  candidates: OpenAlexAuthorCandidate[],
): OpenAlexAuthorCandidate | undefined {
  const normalized = inputName.trim().toLowerCase();

  const exact = candidates.find((c) => c.display_name.trim().toLowerCase() === normalized);
  if (exact) return exact;

  return [...candidates].sort((a, b) => b.works_count - a.works_count)[0];
}

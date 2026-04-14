const BASE_URL = "https://app.trueranker.com/data";

export interface TrueRankerKeyword {
  keyword: string;
  position: number | null;         // null = not in top results
  previousPosition: number | null;
  url: string | null;
}

export interface TrueRankerSummary {
  totalKeywords: number;
  top3: number;
  top10: number;
  top20: number;
  visibility: number; // 0–100
}

// CTR weights for visibility score
const CTR_WEIGHTS: Record<number, number> = {
  1: 0.28, 2: 0.15, 3: 0.11, 4: 0.08, 5: 0.07,
  6: 0.06, 7: 0.05, 8: 0.04, 9: 0.03, 10: 0.03,
};

function positionCtr(pos: number): number {
  if (pos >= 1 && pos <= 10) return CTR_WEIGHTS[pos] ?? 0.01;
  if (pos <= 20) return 0.01;
  return 0;
}

/** YYYYMMDD format required by TrueRanker */
function toTruerankerDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * Returns last N days as start/end in YYYYMMDD format.
 * Defaults to last 30 days to capture enough rank history.
 */
export function trDateRange(days = 30): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return { start: toTruerankerDate(start), end: toTruerankerDate(end) };
}

// ── Raw API types ─────────────────────────────────────────────

interface RawRankEntry {
  rank: number;
  url: string | null;
}

interface RawKeyword {
  keyword: string;
  rank: Record<string, RawRankEntry>; // keys are "YYYY-MM-DD"
}

interface RawKeywordListResponse {
  ok: boolean;
  data?: { keywords?: RawKeyword[] };
  error?: string;
}

// ── Core fetcher ──────────────────────────────────────────────

async function fetchKeywords(
  projectId: string,
  apiKey: string,
  start: string,
  end: string
): Promise<RawKeyword[]> {
  const url = `${BASE_URL}/project/keyword/list?key=${encodeURIComponent(apiKey)}&project=${encodeURIComponent(projectId)}&start=${start}&end=${end}`;

  const res = await fetch(url, { next: { revalidate: 3600 } });

  if (!res.ok) {
    throw new Error(`TrueRanker API ${res.status}: ${res.statusText}`);
  }

  const json: RawKeywordListResponse = await res.json();

  if (!json.ok) {
    throw new Error(`TrueRanker error: ${json.error ?? "unknown error"}`);
  }

  return json.data?.keywords ?? [];
}

// ── Exported functions ────────────────────────────────────────

export async function getProjectRankings(
  projectId: string,
  apiKey: string
): Promise<TrueRankerKeyword[]> {
  const { start, end } = trDateRange(30);
  const rawKeywords = await fetchKeywords(projectId, apiKey, start, end);

  return rawKeywords.map((kw) => {
    // Sort dates descending — most recent first
    const dates = Object.keys(kw.rank).sort().reverse();
    const latestDate   = dates[0] ?? null;
    const previousDate = dates[1] ?? null;

    const currentEntry  = latestDate   ? kw.rank[latestDate]   : null;
    const previousEntry = previousDate ? kw.rank[previousDate] : null;

    // rank === 0 means "not in results" → treat as null
    const position         = currentEntry  && currentEntry.rank  > 0 ? currentEntry.rank  : null;
    const previousPosition = previousEntry && previousEntry.rank > 0 ? previousEntry.rank : null;
    const url              = currentEntry?.url ?? null;

    return { keyword: kw.keyword, position, previousPosition, url };
  });
}

export async function getProjectSummary(
  projectId: string,
  apiKey: string
): Promise<TrueRankerSummary> {
  const keywords = await getProjectRankings(projectId, apiKey);

  const positioned = keywords.filter((k) => k.position !== null && k.position > 0);

  const top3  = positioned.filter((k) => k.position! <= 3).length;
  const top10 = positioned.filter((k) => k.position! <= 10).length;
  const top20 = positioned.filter((k) => k.position! <= 20).length;

  const totalCtr = keywords.reduce((acc, k) => {
    return acc + (k.position !== null && k.position > 0 ? positionCtr(k.position) : 0);
  }, 0);

  const visibility =
    keywords.length > 0 ? Math.round((totalCtr / keywords.length) * 100) : 0;

  return { totalKeywords: keywords.length, top3, top10, top20, visibility };
}

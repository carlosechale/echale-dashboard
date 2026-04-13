import { google } from "googleapis";

// ── Types ─────────────────────────────────────────────────────

export interface GscKeyword {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;       // 0–1
  position: number;
}

export interface GscData {
  clicks: number;
  impressions: number;
  ctr: number;       // 0–1
  position: number;
  keywords: GscKeyword[];
}

// ── Auth ──────────────────────────────────────────────────────

function buildAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error(
      "Faltan variables de entorno: GOOGLE_SERVICE_ACCOUNT_EMAIL y/o GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"
    );
  }

  // In .env files the newline is stored as the literal string \n
  const privateKey = rawKey.replace(/\\n/g, "\n");

  return new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: privateKey },
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
}

// ── Main function ─────────────────────────────────────────────

/**
 * Fetches Search Console performance data for a property.
 *
 * @param propertyUrl  Exact property URL as registered in GSC (e.g. "https://ejemplo.com/")
 * @param startDate    "YYYY-MM-DD"
 * @param endDate      "YYYY-MM-DD"
 */
export async function getSearchConsoleData(
  propertyUrl: string,
  startDate: string,
  endDate: string
): Promise<GscData> {
  const auth = buildAuth();
  const sc = google.searchconsole({ version: "v1", auth });

  // Run both requests in parallel: totals (no dimension) + top 10 keywords
  const [totalsRes, keywordsRes] = await Promise.all([
    sc.searchanalytics.query({
      siteUrl: propertyUrl,
      requestBody: { startDate, endDate, rowLimit: 1 },
    }),
    sc.searchanalytics.query({
      siteUrl: propertyUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ["query"],
        rowLimit: 25, // fetch more, then sort + slice client-side
      },
    }),
  ]);

  // Totals: GSC returns one row when no dimension is set
  const totalsRow = totalsRes.data.rows?.[0];
  const clicks      = totalsRow?.clicks      ?? 0;
  const impressions = totalsRow?.impressions  ?? 0;
  const ctr         = totalsRow?.ctr         ?? 0;
  const position    = totalsRow?.position    ?? 0;

  // Keywords — sort by clicks desc, keep top 10
  const keywords: GscKeyword[] = (keywordsRes.data.rows ?? [])
    .map((row) => ({
      query:       row.keys?.[0] ?? "",
      clicks:      row.clicks      ?? 0,
      impressions: row.impressions ?? 0,
      ctr:         row.ctr         ?? 0,
      position:    row.position    ?? 0,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);

  return { clicks, impressions, ctr, position, keywords };
}

// ── Date range helper ─────────────────────────────────────────

/**
 * Returns { startDate, endDate } as "YYYY-MM-DD" strings.
 * Ends yesterday because GSC data lags ~1–2 days.
 */
export function gscDateRange(days: number): { startDate: string; endDate: string } {
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));

  function fmt(d: Date) {
    return d.toISOString().split("T")[0];
  }
  return { startDate: fmt(start), endDate: fmt(end) };
}

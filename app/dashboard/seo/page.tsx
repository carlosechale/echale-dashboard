import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSearchConsoleData, gscDateRange, type GscData } from "@/lib/gsc";
import {
  getProjectRankings,
  getProjectSummary,
  type TrueRankerKeyword,
  type TrueRankerSummary,
} from "@/lib/trueranker";
import SeoClientSelect from "./SeoClientSelect";

export const metadata: Metadata = { title: "SEO — Échale" };

// ── Config ────────────────────────────────────────────────────

const VALID_DAYS = [7, 28, 90] as const;
type Days = (typeof VALID_DAYS)[number];

const DAY_LABELS: Record<Days, string> = {
  7:  "7 días",
  28: "28 días",
  90: "90 días",
};

// ── Helpers ───────────────────────────────────────────────────

function fmtNum(n: number) {
  return n.toLocaleString("es-ES");
}

function fmtPct(n: number) {
  return (n * 100).toFixed(1) + "%";
}

function fmtPos(n: number) {
  return n.toFixed(1);
}

// ── Page ──────────────────────────────────────────────────────

export default async function SeoPage({
  searchParams,
}: {
  searchParams: { client_id?: string; days?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/dashboard");

  // Load all active clients for the selector
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, gsc_property_url, trueranker_project_id")
    .eq("active", true)
    .order("name");

  const rawDays = Number(searchParams.days ?? "28");
  const days: Days = VALID_DAYS.includes(rawDays as Days) ? (rawDays as Days) : 28;

  const selectedId = searchParams.client_id ?? "";
  const selectedClient = (clients ?? []).find((c) => c.id === selectedId) ?? null;

  const truerankerApiKey = process.env.TRUERANKER_API_KEY ?? "";

  // Fetch GSC + TrueRanker data in parallel
  let gscData: GscData | null = null;
  let gscError: string | null = null;
  let trRankings: TrueRankerKeyword[] | null = null;
  let trSummary: TrueRankerSummary | null = null;
  let trError: string | null = null;

  if (selectedClient) {
    const [gscResult, trResult] = await Promise.allSettled([
      selectedClient.gsc_property_url
        ? (async () => {
            const { startDate, endDate } = gscDateRange(days);
            return getSearchConsoleData(selectedClient.gsc_property_url!, startDate, endDate);
          })()
        : Promise.resolve(null),
      selectedClient.trueranker_project_id && truerankerApiKey
        ? (async () => {
            const [rankings, summary] = await Promise.all([
              getProjectRankings(selectedClient.trueranker_project_id!, truerankerApiKey),
              getProjectSummary(selectedClient.trueranker_project_id!, truerankerApiKey),
            ]);
            return { rankings, summary };
          })()
        : Promise.resolve(null),
    ]);

    if (gscResult.status === "fulfilled") {
      gscData = gscResult.value;
    } else {
      gscError = gscResult.reason instanceof Error
        ? gscResult.reason.message
        : "Error al conectar con Google Search Console";
    }

    if (trResult.status === "fulfilled" && trResult.value) {
      trRankings = trResult.value.rankings;
      trSummary  = trResult.value.summary;
    } else if (trResult.status === "rejected") {
      trError = trResult.reason instanceof Error
        ? trResult.reason.message
        : "Error al conectar con TrueRanker";
    }
  }

  const hasGsc         = !!selectedClient?.gsc_property_url;
  const hasTrueranker  = !!selectedClient?.trueranker_project_id;
  const hasNoIntegrations = selectedId && !hasGsc && !hasTrueranker;

  const baseHref = (newParams: Record<string, string>) => {
    const p = new URLSearchParams({
      ...(selectedId ? { client_id: selectedId } : {}),
      days: String(days),
      ...newParams,
    });
    return `/dashboard/seo?${p}`;
  };

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
            SEO
          </h1>
          <p className="text-sm font-sans text-muted mt-1">
            Rankings y datos de búsqueda orgánica por cliente.
          </p>
        </div>

        {/* Period tabs */}
        <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1 self-start">
          {VALID_DAYS.map((d) => (
            <Link
              key={d}
              href={baseHref({ days: String(d) })}
              className={`px-3 py-1.5 rounded-md text-xs font-sans font-medium transition-colors ${
                days === d
                  ? "bg-accent text-background"
                  : "text-muted hover:text-foreground hover:bg-white/5"
              }`}
            >
              {DAY_LABELS[d]}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Client selector ── */}
      <SeoClientSelect
        clients={(clients ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          hasGsc: !!c.gsc_property_url,
          hasTrueranker: !!c.trueranker_project_id,
        }))}
        selectedId={selectedId}
        days={days}
      />

      {/* ── No client selected ── */}
      {!selectedId && (
        <div className="bg-surface border border-border rounded-2xl flex flex-col items-center justify-center py-20 gap-2">
          <p className="text-muted text-sm font-sans">Selecciona un cliente para ver sus datos SEO.</p>
        </div>
      )}

      {/* ── Client without any integration ── */}
      {hasNoIntegrations && (
        <div className="bg-surface border border-border rounded-2xl flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-border flex items-center justify-center">
            <svg className="w-5 h-5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <p className="text-foreground text-sm font-sans font-medium">Sin integraciones SEO configuradas</p>
          <p className="text-muted text-xs font-sans">
            Añade GSC o TrueRanker Project ID en{" "}
            <Link href="/dashboard/clientes" className="text-accent hover:underline">
              Clientes
            </Link>
            .
          </p>
        </div>
      )}

      {/* ── GSC error ── */}
      {gscError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-6 py-5">
          <p className="text-red-400 text-sm font-sans font-medium">Error Google Search Console</p>
          <p className="text-red-400/70 text-xs font-sans mt-1">{gscError}</p>
        </div>
      )}

      {/* ── TrueRanker error ── */}
      {trError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-6 py-5">
          <p className="text-red-400 text-sm font-sans font-medium">Error TrueRanker</p>
          <p className="text-red-400/70 text-xs font-sans mt-1">{trError}</p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          SECCIÓN 1 — Google Search Console
      ══════════════════════════════════════════════════════ */}
      {gscData && selectedClient && (
        <>
          {/* Section label */}
          <div className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center">
              <IconSearch />
            </span>
            <h2 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
              Google Search Console
            </h2>
            <span className="text-xs text-muted font-sans">· últimos {DAY_LABELS[days]}</span>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard label="Clics"         value={fmtNum(gscData.clicks)}       icon={<IconClick />}   accent />
            <KpiCard label="Impresiones"   value={fmtNum(gscData.impressions)}  icon={<IconEye />} />
            <KpiCard label="CTR medio"     value={fmtPct(gscData.ctr)}          icon={<IconPercent />} />
            <KpiCard label="Posición media" value={fmtPos(gscData.position)}    icon={<IconRanking />} invertAccent />
          </div>

          {/* Top keywords table */}
          <div className="bg-surface border border-border rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-border flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-foreground">Top keywords</h2>
              <span className="text-xs font-sans text-muted">
                {gscData.keywords.length} términos · últimos {DAY_LABELS[days]}
              </span>
            </div>

            {gscData.keywords.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-muted text-sm font-sans">Sin datos de keywords en este período.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-sans">
                  <thead>
                    <tr className="border-b border-border">
                      <Th align="left">#</Th>
                      <Th align="left">Keyword</Th>
                      <Th>Clics</Th>
                      <Th>Impresiones</Th>
                      <Th>CTR</Th>
                      <Th>Posición</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {gscData.keywords.map((kw, i) => (
                      <tr
                        key={kw.query}
                        className={`border-b border-border/50 hover:bg-white/[0.02] transition-colors ${
                          i === gscData!.keywords.length - 1 ? "border-b-0" : ""
                        }`}
                      >
                        <td className="px-6 py-4 text-muted/50 tabular-nums text-xs w-8">{i + 1}</td>
                        <td className="px-6 py-4 text-foreground font-medium max-w-xs truncate">{kw.query}</td>
                        <Td><span className="text-accent font-semibold">{fmtNum(kw.clicks)}</span></Td>
                        <Td>{fmtNum(kw.impressions)}</Td>
                        <Td>{fmtPct(kw.ctr)}</Td>
                        <Td><PositionBadge pos={kw.position} /></Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════
          SECCIÓN 2 — Rankings TrueRanker
      ══════════════════════════════════════════════════════ */}
      {trSummary && trRankings && selectedClient && (
        <>
          {/* Section label */}
          <div className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center">
              <IconRankingFill />
            </span>
            <h2 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
              Rankings TrueRanker
            </h2>
            <span className="text-xs text-muted font-sans">· {trSummary.totalKeywords} keywords rastreadas</span>
          </div>

          {/* Summary KPI cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Top 3"
              value={fmtNum(trSummary.top3)}
              icon={<IconMedal />}
              accent
            />
            <KpiCard
              label="Top 10"
              value={fmtNum(trSummary.top10)}
              icon={<IconTop10 />}
            />
            <KpiCard
              label="Top 20"
              value={fmtNum(trSummary.top20)}
              icon={<IconTop20 />}
            />
            <KpiCard
              label="Visibilidad"
              value={trSummary.visibility + "%"}
              icon={<IconVisibility />}
            />
          </div>

          {/* Rankings table */}
          <div className="bg-surface border border-border rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-border flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-foreground">
                Posiciones por keyword
              </h2>
              <span className="text-xs font-sans text-muted">
                {trRankings.length} keywords
              </span>
            </div>

            {trRankings.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-muted text-sm font-sans">Sin keywords rastreadas en este proyecto.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-sans">
                  <thead>
                    <tr className="border-b border-border">
                      <Th align="left">#</Th>
                      <Th align="left">Keyword</Th>
                      <Th>Posición</Th>
                      <Th>Cambio</Th>
                      <Th align="left">URL posicionada</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {trRankings
                      .slice()
                      .sort((a, b) => {
                        if (a.position === null) return 1;
                        if (b.position === null) return -1;
                        return a.position - b.position;
                      })
                      .map((kw, i) => (
                        <tr
                          key={kw.keyword + i}
                          className={`border-b border-border/50 hover:bg-white/[0.02] transition-colors ${
                            i === trRankings!.length - 1 ? "border-b-0" : ""
                          }`}
                        >
                          <td className="px-6 py-4 text-muted/50 tabular-nums text-xs w-8">{i + 1}</td>
                          <td className="px-6 py-4 text-foreground font-medium max-w-[220px] truncate">
                            {kw.keyword}
                          </td>
                          <Td>
                            {kw.position !== null ? (
                              <PositionBadge pos={kw.position} />
                            ) : (
                              <span className="text-muted/40 text-xs">—</span>
                            )}
                          </Td>
                          <Td>
                            <PositionChange
                              current={kw.position}
                              previous={kw.previousPosition}
                            />
                          </Td>
                          <td className="px-6 py-4 text-muted max-w-[240px]">
                            {kw.url ? (
                              <span
                                className="text-xs font-mono truncate block"
                                title={kw.url}
                              >
                                {kw.url.replace(/^https?:\/\/[^/]+/, "")}
                              </span>
                            ) : (
                              <span className="text-muted/40 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* TrueRanker configured but no API key set on server */}
      {hasTrueranker && !truerankerApiKey && !trError && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl px-6 py-5">
          <p className="text-yellow-400 text-sm font-sans font-medium">TRUERANKER_API_KEY no configurado</p>
          <p className="text-yellow-400/70 text-xs font-sans mt-1">
            Añade la variable de entorno TRUERANKER_API_KEY en el servidor para activar los rankings.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon,
  accent,
  invertAccent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: boolean;
  invertAccent?: boolean;
}) {
  return (
    <div className={`rounded-xl p-5 border flex flex-col gap-3 ${
      accent ? "bg-accent/10 border-accent/20" : "bg-surface border-border"
    }`}>
      <div className="flex items-center justify-between">
        <p className="text-muted text-xs font-sans uppercase tracking-widest">{label}</p>
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${
          accent ? "bg-accent/20 text-accent" : "bg-white/5 text-muted"
        }`}>
          {icon}
        </span>
      </div>
      <p className={`font-display text-3xl font-bold ${
        accent ? "text-accent" : invertAccent ? "text-foreground" : "text-foreground"
      }`}>
        {value}
      </p>
    </div>
  );
}

function PositionBadge({ pos }: { pos: number }) {
  let cls = "text-red-400 bg-red-400/10";
  if (pos <= 3)       cls = "text-accent bg-accent/10";
  else if (pos <= 10) cls = "text-yellow-400 bg-yellow-400/10";
  return (
    <span className={`inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-medium tabular-nums ${cls}`}>
      {fmtPos(pos)}
    </span>
  );
}

function PositionChange({
  current,
  previous,
}: {
  current: number | null;
  previous: number | null;
}) {
  if (current === null || previous === null) {
    return <span className="text-muted/40 text-xs">—</span>;
  }
  // Lower position number = better ranking
  const diff = previous - current; // positive = improved
  if (diff === 0) {
    return <span className="text-muted/50 text-xs tabular-nums">0</span>;
  }
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium tabular-nums ${
        diff > 0 ? "text-accent" : "text-red-400"
      }`}
    >
      {diff > 0 ? (
        <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      ) : (
        <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      )}
      {Math.abs(diff)}
    </span>
  );
}

function Th({ children, align = "right" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-6 py-3.5 text-xs font-sans font-medium text-muted uppercase tracking-wider ${
      align === "left" ? "text-left" : "text-right"
    }`}>
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="px-6 py-4 text-right tabular-nums text-muted whitespace-nowrap">
      {children}
    </td>
  );
}

// ── Icons ─────────────────────────────────────────────────────

function IconSearch() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconClick() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 14l3.5 3.5" /><path d="M9 3l3 6 2-1 1 6 2-1 1 4H5l3-5-2-1 3-9z" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconPercent() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  );
}

function IconRanking() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function IconRankingFill() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconMedal() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="15" r="6" /><path d="M8.56 2.9A7 7 0 0 1 18.45 5" /><path d="M3.89 5.6A7 7 0 0 1 8.56 2.9" /><line x1="12" y1="9" x2="12" y2="15" />
    </svg>
  );
}

function IconTop10() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><polyline points="9 9 12 6 12 18" />
    </svg>
  );
}

function IconTop20() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function IconVisibility() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 20h.01" /><path d="M7 20v-4" /><path d="M12 20v-8" /><path d="M17 20V8" /><path d="M22 4v16" />
    </svg>
  );
}

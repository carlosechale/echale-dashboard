import { createClient } from "@/lib/supabase/server";
import LineChart, { type ChartDay } from "@/components/ui/LineChart";
import { getSearchConsoleData, gscDateRange, type GscData } from "@/lib/gsc";
import {
  getProjectRankings,
  getProjectSummary,
  type TrueRankerKeyword,
  type TrueRankerSummary,
} from "@/lib/trueranker";

// ── Helpers ──────────────────────────────────────────────────

function currentMonthLabel(): string {
  return new Date().toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

function pct(num: number, den: number): number {
  if (!den) return 0;
  return Math.round((num / den) * 100);
}

function fmt(n: number): string {
  return n.toLocaleString("es-ES");
}

function fmtEur(n: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtEurDec(n: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

// ── Data fetching ────────────────────────────────────────────

async function getClientData(userId: string) {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("client_id")
    .eq("id", userId)
    .single();

  const clientId = profile?.client_id as string | null;
  if (!clientId) return null;

  const since = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  })();

  const [{ data: client }, { data: ghlRows }, { data: metaRows }] =
    await Promise.all([
      supabase
        .from("clients")
        .select("name, gsc_property_url, trueranker_project_id")
        .eq("id", clientId)
        .single(),
      supabase
        .from("metrics_ghl")
        .select("fecha, leads, agendados, presenciales, cerrados")
        .eq("client_id", clientId)
        .gte("fecha", since)
        .order("fecha"),
      supabase
        .from("metrics_meta")
        .select("gasto, leads")
        .eq("client_id", clientId)
        .gte("fecha", since),
    ]);

  const ghl = (ghlRows ?? []).reduce(
    (acc, r) => ({
      leads:        acc.leads        + (r.leads        ?? 0),
      agendados:    acc.agendados    + (r.agendados    ?? 0),
      presenciales: acc.presenciales + (r.presenciales ?? 0),
      cerrados:     acc.cerrados     + (r.cerrados     ?? 0),
    }),
    { leads: 0, agendados: 0, presenciales: 0, cerrados: 0 }
  );

  const meta = (metaRows ?? []).reduce(
    (acc, r) => ({ gasto: acc.gasto + (r.gasto ?? 0), leads: acc.leads + (r.leads ?? 0) }),
    { gasto: 0, leads: 0 }
  );

  const totalLeads = ghl.leads || meta.leads;
  const cpl = totalLeads > 0 ? meta.gasto / totalLeads : 0;

  const chartData: ChartDay[] = (ghlRows ?? []).map((r) => ({
    day:      parseInt(r.fecha.split("-")[2], 10),
    leads:    r.leads    ?? 0,
    cerrados: r.cerrados ?? 0,
  }));

  // Fetch SEO data in parallel (failures are isolated)
  const truerankerApiKey = process.env.TRUERANKER_API_KEY ?? "";

  const [gscResult, trResult] = await Promise.allSettled([
    client?.gsc_property_url
      ? (async (): Promise<GscData> => {
          const { startDate, endDate } = gscDateRange(28);
          return getSearchConsoleData(client.gsc_property_url!, startDate, endDate);
        })()
      : Promise.resolve(null),
    client?.trueranker_project_id && truerankerApiKey
      ? (async (): Promise<{ rankings: TrueRankerKeyword[]; summary: TrueRankerSummary }> => {
          const [rankings, summary] = await Promise.all([
            getProjectRankings(client.trueranker_project_id!, truerankerApiKey),
            getProjectSummary(client.trueranker_project_id!, truerankerApiKey),
          ]);
          return { rankings, summary };
        })()
      : Promise.resolve(null),
  ]);

  const gscData: GscData | null =
    gscResult.status === "fulfilled" ? gscResult.value : null;

  const trData =
    trResult.status === "fulfilled" ? trResult.value : null;

  return {
    clientName: client?.name ?? "Mi cuenta",
    hasGsc: !!client?.gsc_property_url,
    hasTrueranker: !!(client?.trueranker_project_id && truerankerApiKey),
    totals: { ...ghl, leads: totalLeads },
    meta: { gasto: meta.gasto, cpl },
    rates: {
      agendamiento:   pct(ghl.agendados,    totalLeads),
      presencialidad: pct(ghl.presenciales, ghl.agendados),
      cierre:         pct(ghl.cerrados,     ghl.presenciales),
    },
    chartData,
    gscData,
    trRankings: trData?.rankings ?? null,
    trSummary:  trData?.summary  ?? null,
  };
}

// ── Component ────────────────────────────────────────────────

interface Props { userId: string }

export default async function ClientDashboard({ userId }: Props) {
  const data = await getClientData(userId);
  const month = currentMonthLabel();

  if (!data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-foreground font-display text-lg font-semibold">
            Sin cuenta asignada
          </p>
          <p className="text-muted text-sm font-sans">
            Contacta a tu agencia para vincular tu cuenta.
          </p>
        </div>
      </div>
    );
  }

  const { totals, meta, rates, chartData, gscData, trRankings, trSummary } = data;
  const hasSeoSection = data.hasGsc || data.hasTrueranker;

  // Top 10 keywords sorted by position
  const topKeywords = trRankings
    ? trRankings
        .filter((k) => k.position !== null)
        .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
        .slice(0, 10)
    : [];

  return (
    <div className="space-y-10">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-muted text-xs font-sans uppercase tracking-widest mb-1.5">
            Resumen mensual
          </p>
          <h1 className="font-display text-3xl font-bold text-foreground leading-tight">
            {data.clientName}
          </h1>
          <p className="text-muted text-sm font-sans mt-1 capitalize">{month}</p>
        </div>
        <span className="mt-1 inline-flex items-center gap-1.5 bg-accent/10 border border-accent/20 text-accent text-xs font-sans font-medium px-3 py-1.5 rounded-full capitalize shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          En curso
        </span>
      </div>

      {/* ══════════════════════════════════════════════════════
          SECCIÓN 1 — Pipeline GHL
      ══════════════════════════════════════════════════════ */}
      <section className="space-y-5">
        <SectionHeader icon={<IconPipeline />} title="Pipeline GHL" />

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Leads"        value={fmt(totals.leads)}        />
          <KpiCard label="Agendados"    value={fmt(totals.agendados)}    />
          <KpiCard label="Presenciales" value={fmt(totals.presenciales)} />
          <KpiCard label="Cerrados"     value={fmt(totals.cerrados)} accent />
        </div>

        {/* Rate cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <RateCard
            label="Tasa de agendamiento"
            subtitle="Agendados / Leads"
            value={rates.agendamiento}
            thresholds={[30, 15]}
          />
          <RateCard
            label="Tasa de presencialidad"
            subtitle="Presenciales / Agendados"
            value={rates.presencialidad}
            thresholds={[60, 40]}
          />
          <RateCard
            label="Tasa de cierre"
            subtitle="Cerrados / Presenciales"
            value={rates.cierre}
            thresholds={[30, 15]}
          />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SECCIÓN 2 — Inversión Meta Ads
      ══════════════════════════════════════════════════════ */}
      <section className="space-y-5">
        <SectionHeader icon={<IconMeta />} title="Inversión Meta Ads" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Investment card */}
          <div className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-5">
            <div>
              <p className="text-muted text-xs font-sans mb-1">Gasto total</p>
              <p className="font-display text-4xl font-bold text-foreground">
                {fmtEur(meta.gasto)}
              </p>
            </div>
            <div className="h-px bg-border" />
            <div>
              <p className="text-muted text-xs font-sans mb-1">CPL · Coste por lead</p>
              <p className="font-display text-3xl font-bold text-accent">
                {fmtEurDec(meta.cpl)}
              </p>
            </div>
          </div>

          {/* Line chart */}
          <div className="lg:col-span-2 bg-surface border border-border rounded-2xl p-6">
            <p className="text-muted text-xs font-sans uppercase tracking-widest mb-4">
              Evolución del mes
            </p>
            <LineChart data={chartData} />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SECCIÓN 3 — SEO
      ══════════════════════════════════════════════════════ */}
      {hasSeoSection && (
        <section className="space-y-5">
          <SectionHeader icon={<IconSeo />} title="SEO · Posicionamiento orgánico" />

          {/* Google Search Console */}
          {gscData && (
            <div className="space-y-4">
              <p className="text-muted text-xs font-sans uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-muted/50" />
                Google Search Console · últimos 28 días
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                  label="Clics"
                  value={fmt(gscData.clicks)}
                  accent
                />
                <KpiCard
                  label="Impresiones"
                  value={fmt(gscData.impressions)}
                />
                <KpiCard
                  label="CTR medio"
                  value={(gscData.ctr * 100).toFixed(1) + "%"}
                />
                <KpiCard
                  label="Posición media"
                  value={gscData.position.toFixed(1)}
                />
              </div>
            </div>
          )}

          {/* TrueRanker */}
          {trSummary && (
            <div className="space-y-4">
              <p className="text-muted text-xs font-sans uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-muted/50" />
                Rankings · {trSummary.totalKeywords} keywords rastreadas
              </p>

              {/* Summary cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Top 3"       value={fmt(trSummary.top3)}               accent />
                <KpiCard label="Top 10"      value={fmt(trSummary.top10)}              />
                <KpiCard label="Top 20"      value={fmt(trSummary.top20)}              />
                <KpiCard label="Visibilidad" value={trSummary.visibility + "%"}        />
              </div>

              {/* Top 10 keywords table */}
              {topKeywords.length > 0 && (
                <div className="bg-surface border border-border rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-border">
                    <p className="font-display text-sm font-semibold text-foreground">
                      Top keywords
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm font-sans">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="px-5 py-3 text-left text-xs font-sans font-medium text-muted uppercase tracking-wider w-8">#</th>
                          <th className="px-5 py-3 text-left text-xs font-sans font-medium text-muted uppercase tracking-wider">Keyword</th>
                          <th className="px-5 py-3 text-right text-xs font-sans font-medium text-muted uppercase tracking-wider">Posición</th>
                          <th className="px-5 py-3 text-right text-xs font-sans font-medium text-muted uppercase tracking-wider">Cambio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topKeywords.map((kw, i) => (
                          <tr
                            key={kw.keyword + i}
                            className={`border-b border-border/50 hover:bg-white/[0.02] transition-colors ${
                              i === topKeywords.length - 1 ? "border-b-0" : ""
                            }`}
                          >
                            <td className="px-5 py-3.5 text-muted/40 tabular-nums text-xs">
                              {i + 1}
                            </td>
                            <td className="px-5 py-3.5 text-foreground font-medium max-w-[180px] sm:max-w-xs truncate">
                              {kw.keyword}
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <PositionBadge pos={kw.position!} />
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <PositionChange
                                current={kw.position}
                                previous={kw.previousPosition}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────

function SectionHeader({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3 pb-1 border-b border-border">
      <span className="w-7 h-7 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
        {icon}
      </span>
      <h2 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
        {title}
      </h2>
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-xl p-5 border ${
      accent ? "bg-accent/10 border-accent/20" : "bg-surface border-border"
    }`}>
      <p className="text-muted text-xs font-sans uppercase tracking-widest">{label}</p>
      <p className={`mt-2 font-display text-4xl font-bold ${accent ? "text-accent" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

function RateCard({
  label,
  subtitle,
  value,
  thresholds,
}: {
  label: string;
  subtitle: string;
  value: number;
  thresholds: [number, number];
}) {
  const [good, ok] = thresholds;
  let ringColor = "border-red-500/30";
  let textColor = "text-red-400";
  let bgColor   = "bg-red-500/5";
  let barColor  = "bg-red-400";

  if (value >= good) {
    ringColor = "border-accent/30"; textColor = "text-accent";
    bgColor   = "bg-accent/5";      barColor  = "bg-accent";
  } else if (value >= ok) {
    ringColor = "border-yellow-500/30"; textColor = "text-yellow-400";
    bgColor   = "bg-yellow-500/5";      barColor  = "bg-yellow-400";
  }

  return (
    <div className={`rounded-xl p-5 border ${bgColor} ${ringColor}`}>
      <p className="text-muted text-xs font-sans uppercase tracking-widest">{label}</p>
      <p className={`mt-2 font-display text-4xl font-bold ${textColor}`}>{value}%</p>
      <p className="mt-1 text-muted text-xs font-sans">{subtitle}</p>
      <div className="mt-4 h-1 bg-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}

function PositionBadge({ pos }: { pos: number }) {
  let cls = "text-red-400 bg-red-400/10";
  if (pos <= 3)       cls = "text-accent bg-accent/10";
  else if (pos <= 10) cls = "text-yellow-400 bg-yellow-400/10";
  return (
    <span className={`inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-medium tabular-nums ${cls}`}>
      {pos}
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
  const diff = previous - current; // positive = improved (lower number = better rank)
  if (diff === 0) {
    return <span className="text-muted/50 text-xs tabular-nums">—</span>;
  }
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium tabular-nums ${
      diff > 0 ? "text-accent" : "text-red-400"
    }`}>
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

// ── Icons ─────────────────────────────────────────────────────

function IconPipeline() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconMeta() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

function IconSeo() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

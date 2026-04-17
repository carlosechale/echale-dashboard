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

function pct(num: number, den: number): number | null {
  if (!den) return null;
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

function monthStart(offset = 0): string {
  const d = new Date();
  const t = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-01`;
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

  const since     = monthStart(0);   // first day current month
  const prevSince = monthStart(-1);  // first day previous month

  const [
    { data: client },
    { data: ghlRows },
    { data: metaRows },
    { data: prevGhlRows },
    { data: prevMetaRows },
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("name, gsc_property_url, trueranker_project_id, ticket_medio, objetivo_leads")
      .eq("id", clientId)
      .single(),
    supabase
      .from("metrics_ghl")
      .select("fecha, leads, agendados, presenciales, cerrados, facturacion_real")
      .eq("client_id", clientId)
      .gte("fecha", since)
      .order("fecha"),
    supabase
      .from("metrics_meta")
      .select("gasto")
      .eq("client_id", clientId)
      .gte("fecha", since),
    supabase
      .from("metrics_ghl")
      .select("leads, agendados, presenciales, cerrados")
      .eq("client_id", clientId)
      .eq("fecha", prevSince)
      .maybeSingle(),
    supabase
      .from("metrics_meta")
      .select("gasto")
      .eq("client_id", clientId)
      .eq("fecha", prevSince)
      .maybeSingle(),
  ]);

  // Current month aggregates
  const ghl = (ghlRows ?? []).reduce(
    (acc, r) => ({
      leads:           acc.leads           + (r.leads           ?? 0),
      agendados:       acc.agendados       + (r.agendados       ?? 0),
      presenciales:    acc.presenciales    + (r.presenciales    ?? 0),
      cerrados:        acc.cerrados        + (r.cerrados        ?? 0),
      facturacionReal: acc.facturacionReal + (r.facturacion_real ?? 0),
    }),
    { leads: 0, agendados: 0, presenciales: 0, cerrados: 0, facturacionReal: 0 }
  );
  const meta = (metaRows ?? []).reduce(
    (acc, r) => ({ gasto: acc.gasto + (r.gasto ?? 0) }),
    { gasto: 0 }
  );

  const totalLeads = ghl.leads;
  const cpl = meta.gasto > 0 && totalLeads > 0 ? meta.gasto / totalLeads : null;

  // Previous month values (single row per metric table)
  const prevGhl = prevGhlRows
    ? {
        leads:        prevGhlRows.leads        ?? 0,
        agendados:    prevGhlRows.agendados    ?? 0,
        presenciales: prevGhlRows.presenciales ?? 0,
        cerrados:     prevGhlRows.cerrados     ?? 0,
      }
    : null;

  const prevMeta = prevMetaRows
    ? { gasto: prevMetaRows.gasto ?? 0 }
    : null;

  const prevTotalLeads = prevGhl ? prevGhl.leads : null;
  const prevCpl =
    prevMeta && prevMeta.gasto > 0 && prevTotalLeads && prevTotalLeads > 0
      ? prevMeta.gasto / prevTotalLeads
      : null;

  // ROI data
  const objetivoLeads  = (client?.objetivo_leads as number) ?? 0;
  const facturacionReal = ghl.facturacionReal;
  const roi =
    facturacionReal > 0 && meta.gasto > 0
      ? ((facturacionReal - meta.gasto) / meta.gasto) * 100
      : null;

  // Chart data
  const chartData: ChartDay[] = (ghlRows ?? []).map((r) => ({
    day:      parseInt(r.fecha.split("-")[2], 10),
    leads:    r.leads    ?? 0,
    cerrados: r.cerrados ?? 0,
  }));

  // SEO data (parallel, isolated failures)
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
  const trData = trResult.status === "fulfilled" ? trResult.value : null;

  return {
    clientName:     client?.name ?? "Mi cuenta",
    hasGsc:         !!client?.gsc_property_url,
    hasTrueranker:  !!(client?.trueranker_project_id && truerankerApiKey),
    objetivoLeads,
    totals:         { ...ghl, leads: totalLeads },
    meta:           { gasto: meta.gasto, cpl },
    prev: prevGhl
      ? {
          leads:        prevGhl.leads,
          agendados:    prevGhl.agendados,
          presenciales: prevGhl.presenciales,
          cerrados:     prevGhl.cerrados,
          gasto:        prevMeta?.gasto ?? null,
          cpl:          prevCpl,
        }
      : null,
    rates: {
      agendamiento:   pct(ghl.agendados,    totalLeads),
      presencialidad: ghl.presenciales === 0 ? null : pct(ghl.presenciales, ghl.agendados),
      cierre:         pct(ghl.cerrados,     ghl.presenciales),
    },
    roi:          { facturacionReal, roi },
    chartData,
    gscData,
    trRankings:   trData?.rankings ?? null,
    trSummary:    trData?.summary  ?? null,
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
          <p className="text-foreground font-display text-lg font-semibold">Sin cuenta asignada</p>
          <p className="text-muted text-sm font-sans">Contacta a tu agencia para vincular tu cuenta.</p>
        </div>
      </div>
    );
  }

  const { totals, meta, rates, chartData, gscData, trRankings, trSummary, prev } = data;
  const hasSeoSection = data.hasGsc || data.hasTrueranker;
  const hasRoiSection = data.roi.facturacionReal > 0 || data.objetivoLeads > 0;

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
        <span className="mt-1 inline-flex items-center gap-1.5 bg-accent/10 border border-accent/20 text-accent text-xs font-sans font-medium px-3 py-1.5 rounded-full shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          En curso
        </span>
      </div>

      {/* ══════════════════════════════════════════════════════
          SECCIÓN 1 — Pipeline GHL
      ══════════════════════════════════════════════════════ */}
      <section className="space-y-5">
        <SectionHeader icon={<IconPipeline />} title="Pipeline GHL" />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Leads"
            value={fmt(totals.leads)}
            delta={prev ? totals.leads - prev.leads : null}
          />
          <KpiCard
            label="Agendados"
            value={fmt(totals.agendados)}
            delta={prev ? totals.agendados - prev.agendados : null}
          />
          <KpiCard
            label="Presenciales"
            value={fmt(totals.presenciales)}
            delta={prev ? totals.presenciales - prev.presenciales : null}
          />
          <KpiCard
            label="Cerrados"
            value={fmt(totals.cerrados)}
            delta={prev ? totals.cerrados - prev.cerrados : null}
            accent
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <RateCard label="Tasa de agendamiento"   subtitle="Agendados / Leads"       value={rates.agendamiento}   thresholds={[30, 15]} />
          <RateCard label="Tasa de presencialidad" subtitle="Presenciales / Agendados" value={rates.presencialidad} thresholds={[60, 40]} />
          <RateCard label="Tasa de cierre"         subtitle="Cerrados / Presenciales"  value={rates.cierre}         thresholds={[30, 15]} />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SECCIÓN 2 — Inversión Meta Ads
      ══════════════════════════════════════════════════════ */}
      <section className="space-y-5">
        <SectionHeader icon={<IconMeta />} title="Inversión Meta Ads" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-5">
            <div>
              <p className="text-muted text-xs font-sans mb-1">Gasto total</p>
              <p className="font-display text-4xl font-bold text-foreground">
                {fmtEur(meta.gasto)}
              </p>
              {prev?.gasto !== null && prev?.gasto !== undefined && (
                <DeltaTag
                  delta={meta.gasto - prev.gasto}
                  formatter={(v) => fmtEur(Math.abs(v))}
                  invertColor
                />
              )}
            </div>
            <div className="h-px bg-border" />
            <div>
              <p className="text-muted text-xs font-sans mb-1">CPL · Coste por lead</p>
              <p className="font-display text-3xl font-bold text-accent">
                {meta.cpl !== null ? fmtEurDec(meta.cpl) : "—"}
              </p>
              {meta.cpl !== null && prev?.cpl !== null && prev?.cpl !== undefined && (
                <DeltaTag
                  delta={meta.cpl - prev.cpl}
                  formatter={(v) => fmtEurDec(Math.abs(v))}
                  invertColor
                />
              )}
            </div>
          </div>

          <div className="lg:col-span-2 bg-surface border border-border rounded-2xl p-6">
            <p className="text-muted text-xs font-sans uppercase tracking-widest mb-4">
              Evolución del mes
            </p>
            <LineChart data={chartData} />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SECCIÓN 3 — ROI
      ══════════════════════════════════════════════════════ */}
      {hasRoiSection && (
        <section className="space-y-5">
          <SectionHeader icon={<IconRoi />} title="ROI · Retorno de inversión" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Facturación real */}
            <div className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-1">
              <p className="text-muted text-xs font-sans uppercase tracking-widest">
                Facturación real
              </p>
              {data.roi.facturacionReal > 0 ? (
                <>
                  <p className="mt-1 font-display text-3xl font-bold text-foreground">
                    {fmtEur(data.roi.facturacionReal)}
                  </p>
                  <p className="text-muted/60 text-xs font-sans mt-1">
                    Suma del valor de oportunidades cerradas
                  </p>
                </>
              ) : (
                <p className="mt-1 font-display text-2xl font-bold text-muted/40">
                  Sin datos
                </p>
              )}
            </div>

            {/* ROI */}
            <div className={`rounded-2xl p-5 border flex flex-col gap-1 ${
              data.roi.roi === null
                ? "bg-surface border-border"
                : data.roi.roi >= 0
                ? "bg-accent/10 border-accent/20"
                : "bg-red-500/10 border-red-500/20"
            }`}>
              <p className="text-muted text-xs font-sans uppercase tracking-widest">ROI</p>
              {data.roi.roi === null ? (
                <p className="mt-1 font-display text-2xl font-bold text-muted/40">
                  Sin datos
                </p>
              ) : (
                <>
                  <p className={`mt-1 font-display text-3xl font-bold ${
                    data.roi.roi >= 0 ? "text-accent" : "text-red-400"
                  }`}>
                    {data.roi.roi >= 0 ? "+" : ""}{data.roi.roi.toFixed(0)}%
                  </p>
                  <p className="text-muted/60 text-xs font-sans mt-1">
                    (Facturación − Gasto) / Gasto
                  </p>
                </>
              )}
            </div>

            {/* Objetivo de leads */}
            {data.objetivoLeads > 0 && (
              <div className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-3">
                <div>
                  <p className="text-muted text-xs font-sans uppercase tracking-widest">
                    Objetivo leads
                  </p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <p className="font-display text-3xl font-bold text-foreground">
                      {fmt(totals.leads)}
                    </p>
                    <p className="text-muted text-sm font-sans">
                      / {fmt(data.objetivoLeads)}
                    </p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="h-2 bg-border rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        totals.leads >= data.objetivoLeads ? "bg-accent" : "bg-accent/60"
                      }`}
                      style={{
                        width: `${Math.min((totals.leads / data.objetivoLeads) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-muted/60 text-xs font-sans text-right">
                    {Math.round((totals.leads / data.objetivoLeads) * 100)}% del objetivo
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════
          SECCIÓN 4 — SEO
      ══════════════════════════════════════════════════════ */}
      {hasSeoSection && (
        <section className="space-y-5">
          <SectionHeader icon={<IconSeo />} title="SEO · Posicionamiento orgánico" />

          {gscData && (
            <div className="space-y-4">
              <p className="text-muted text-xs font-sans uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-muted/50" />
                Google Search Console · últimos 28 días
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Clics"          value={fmt(gscData.clicks)}                          accent />
                <KpiCard label="Impresiones"    value={fmt(gscData.impressions)}                     />
                <KpiCard label="CTR medio"      value={(gscData.ctr * 100).toFixed(1) + "%"}         />
                <KpiCard label="Posición media" value={gscData.position.toFixed(1)}                  />
              </div>
            </div>
          )}

          {trSummary && (
            <div className="space-y-4">
              <p className="text-muted text-xs font-sans uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-muted/50" />
                Rankings · {trSummary.totalKeywords} keywords rastreadas
              </p>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Top 3"       value={fmt(trSummary.top3)}         accent />
                <KpiCard label="Top 10"      value={fmt(trSummary.top10)}        />
                <KpiCard label="Top 20"      value={fmt(trSummary.top20)}        />
                <KpiCard label="Visibilidad" value={trSummary.visibility + "%"}  />
              </div>

              {topKeywords.length > 0 && (
                <div className="bg-surface border border-border rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-border">
                    <p className="font-display text-sm font-semibold text-foreground">Top keywords</p>
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
                            <td className="px-5 py-3.5 text-muted/40 tabular-nums text-xs">{i + 1}</td>
                            <td className="px-5 py-3.5 text-foreground font-medium max-w-[180px] sm:max-w-xs truncate">
                              {kw.keyword}
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <PositionBadge pos={kw.position!} />
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <PositionChange current={kw.position} previous={kw.previousPosition} />
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

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
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
  delta,
  invertColor = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  delta?: number | null;
  invertColor?: boolean;
}) {
  return (
    <div className={`rounded-xl p-5 border ${accent ? "bg-accent/10 border-accent/20" : "bg-surface border-border"}`}>
      <p className="text-muted text-xs font-sans uppercase tracking-widest">{label}</p>
      <p className={`mt-2 font-display text-4xl font-bold ${accent ? "text-accent" : "text-foreground"}`}>
        {value}
      </p>
      {delta !== null && delta !== undefined && (
        <DeltaTag delta={delta} invertColor={invertColor} />
      )}
    </div>
  );
}

function DeltaTag({
  delta,
  formatter,
  invertColor = false,
}: {
  delta: number;
  formatter?: (v: number) => string;
  invertColor?: boolean;
}) {
  if (delta === 0) {
    return (
      <p className="mt-1.5 text-muted/50 text-xs font-sans">
        = igual que el mes anterior
      </p>
    );
  }

  // invertColor: true means lower delta is better (e.g. gasto, CPL)
  const isPositive = delta > 0;
  const isGood = invertColor ? !isPositive : isPositive;
  const label = formatter ? formatter(delta) : String(Math.abs(delta));

  return (
    <p className={`mt-1.5 text-xs font-sans flex items-center gap-0.5 ${
      isGood ? "text-accent" : "text-red-400"
    }`}>
      {isPositive ? (
        <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      ) : (
        <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      )}
      {label} vs mes anterior
    </p>
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
  value: number | null;
  thresholds: [number, number];
}) {
  if (value === null) {
    return (
      <div className="rounded-xl p-5 border bg-surface border-border">
        <p className="text-muted text-xs font-sans uppercase tracking-widest">{label}</p>
        <p className="mt-2 font-display text-4xl font-bold text-muted/30">—</p>
        <p className="mt-1 text-muted text-xs font-sans">{subtitle}</p>
        <div className="mt-4 h-1 bg-border rounded-full overflow-hidden" />
      </div>
    );
  }

  const [good, ok] = thresholds;
  let ringColor = "border-red-500/30", textColor = "text-red-400",
      bgColor = "bg-red-500/5", barColor = "bg-red-400";

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
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(value, 100)}%` }} />
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

function PositionChange({ current, previous }: { current: number | null; previous: number | null }) {
  if (current === null || previous === null) return <span className="text-muted/40 text-xs">—</span>;
  const diff = previous - current;
  if (diff === 0) return <span className="text-muted/50 text-xs">—</span>;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium tabular-nums ${diff > 0 ? "text-accent" : "text-red-400"}`}>
      {diff > 0 ? (
        <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
      ) : (
        <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
      )}
      {Math.abs(diff)}
    </span>
  );
}

// ── Icons ─────────────────────────────────────────────────────

function IconPipeline() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconMeta() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
    </svg>
  );
}

function IconRoi() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
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

import { createClient } from "@/lib/supabase/server";
import LineChart, { type ChartDay } from "@/components/ui/LineChart";

// ── Helpers ─────────────────────────────────────────────────

function startOfCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function currentMonthLabel(): string {
  return new Date().toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

function pct(num: number, den: number): number {
  if (!den) return 0;
  return Math.round((num / den) * 100);
}

function fmt(n: number): string {
  return n.toLocaleString("es-MX");
}

function fmtMXN(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);
}

// ── Data fetching ────────────────────────────────────────────

async function getClientData(userId: string) {
  const supabase = await createClient();
  const since = startOfCurrentMonth();

  const { data: profile } = await supabase
    .from("profiles")
    .select("client_id")
    .eq("id", userId)
    .single();

  const clientId = profile?.client_id as string | null;
  if (!clientId) return null;

  const [{ data: client }, { data: ghlRows }, { data: metaRows }] =
    await Promise.all([
      supabase.from("clients").select("name").eq("id", clientId).single(),
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

  // Aggregate GHL totals
  const ghl = (ghlRows ?? []).reduce(
    (acc, r) => ({
      leads:        acc.leads        + (r.leads        ?? 0),
      agendados:    acc.agendados    + (r.agendados    ?? 0),
      presenciales: acc.presenciales + (r.presenciales ?? 0),
      cerrados:     acc.cerrados     + (r.cerrados     ?? 0),
    }),
    { leads: 0, agendados: 0, presenciales: 0, cerrados: 0 }
  );

  // Aggregate Meta totals
  const meta = (metaRows ?? []).reduce(
    (acc, r) => ({ gasto: acc.gasto + (r.gasto ?? 0), leads: acc.leads + (r.leads ?? 0) }),
    { gasto: 0, leads: 0 }
  );

  const totalLeads = ghl.leads || meta.leads;
  const cpl = totalLeads > 0 ? meta.gasto / totalLeads : 0;

  // Chart data — one point per day
  const chartData: ChartDay[] = (ghlRows ?? []).map((r) => ({
    day:      parseInt(r.fecha.split("-")[2], 10),
    leads:    r.leads    ?? 0,
    cerrados: r.cerrados ?? 0,
  }));

  return {
    clientName: client?.name ?? "Mi clínica",
    totals: { ...ghl, leads: totalLeads },
    meta: { gasto: meta.gasto, cpl },
    rates: {
      agendamiento:   pct(ghl.agendados,    totalLeads),
      presencialidad: pct(ghl.presenciales, ghl.agendados),
      cierre:         pct(ghl.cerrados,     ghl.presenciales),
    },
    chartData,
  };
}

// ── Component ────────────────────────────────────────────────

interface Props { userId: string }

export default async function ClientDashboard({ userId }: Props) {
  const data = await getClientData(userId);
  const month = currentMonthLabel();

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-foreground font-display text-lg font-semibold">
            Sin clínica asignada
          </p>
          <p className="text-muted text-sm font-sans">
            Contacta a tu agencia para vincular tu cuenta.
          </p>
        </div>
      </div>
    );
  }

  const { totals, meta, rates, chartData } = data;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-muted text-xs font-sans uppercase tracking-widest mb-1">
            Resumen del mes
          </p>
          <h1 className="font-display text-3xl font-bold text-foreground">
            {data.clientName}
          </h1>
        </div>
        <span className="mt-1 inline-flex items-center gap-1.5 bg-accent/10 border border-accent/20 text-accent text-xs font-sans font-medium px-3 py-1.5 rounded-full capitalize">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          {month}
        </span>
      </div>

      {/* ── KPI cards: pipeline ── */}
      <div>
        <p className="text-muted text-xs font-sans uppercase tracking-widest mb-3">
          Pipeline
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Leads"        value={fmt(totals.leads)}        />
          <KpiCard label="Agendados"    value={fmt(totals.agendados)}    />
          <KpiCard label="Presenciales" value={fmt(totals.presenciales)} />
          <KpiCard label="Cerrados"     value={fmt(totals.cerrados)} accent />
        </div>
      </div>

      {/* ── Rate cards ── */}
      <div>
        <p className="text-muted text-xs font-sans uppercase tracking-widest mb-3">
          Tasas de conversión
        </p>
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
      </div>

      {/* ── Bottom row: inversión + gráfico ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Investment card */}
        <div className="bg-surface border border-border rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <p className="text-muted text-xs font-sans uppercase tracking-widest mb-4">
              Inversión Meta Ads
            </p>
            <div className="space-y-5">
              <div>
                <p className="text-muted text-xs font-sans mb-1">Gasto total</p>
                <p className="font-display text-4xl font-bold text-foreground">
                  {fmtMXN(meta.gasto)}
                </p>
              </div>
              <div className="h-px bg-border" />
              <div>
                <p className="text-muted text-xs font-sans mb-1">CPL (Coste por lead)</p>
                <p className="font-display text-3xl font-bold text-accent">
                  {fmtMXN(meta.cpl)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Line chart */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-muted text-xs font-sans uppercase tracking-widest">
              Evolución del mes
            </p>
          </div>
          <LineChart data={chartData} />
        </div>
      </div>

    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────

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
    <div
      className={`rounded-xl p-5 border ${
        accent ? "bg-accent/10 border-accent/20" : "bg-surface border-border"
      }`}
    >
      <p className="text-muted text-xs font-sans uppercase tracking-widest">
        {label}
      </p>
      <p
        className={`mt-2 font-display text-4xl font-bold ${
          accent ? "text-accent" : "text-foreground"
        }`}
      >
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
    ringColor = "border-accent/30";
    textColor = "text-accent";
    bgColor   = "bg-accent/5";
    barColor  = "bg-accent";
  } else if (value >= ok) {
    ringColor = "border-yellow-500/30";
    textColor = "text-yellow-400";
    bgColor   = "bg-yellow-500/5";
    barColor  = "bg-yellow-400";
  }

  const barWidth = Math.min(value, 100);

  return (
    <div className={`rounded-xl p-5 border ${bgColor} ${ringColor}`}>
      <p className="text-muted text-xs font-sans uppercase tracking-widest">
        {label}
      </p>
      <p className={`mt-2 font-display text-4xl font-bold ${textColor}`}>
        {value}%
      </p>
      <p className="mt-1 text-muted text-xs font-sans">{subtitle}</p>

      {/* Progress bar */}
      <div className="mt-4 h-1 bg-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
}

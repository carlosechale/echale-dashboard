import { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MonthlyLineChart, { type ChartMonth } from "@/components/ui/MonthlyLineChart";

// ── Types ─────────────────────────────────────────────────────

interface MonthRow {
  fecha: string;
  label: string;
  leads: number;
  agendados: number;
  presenciales: number;
  cerrados: number;
  gasto: number;
  cpl: number;
  tasa_agendamiento: number;
  tasa_presencialidad: number;
  tasa_cierre: number;
}

// ── Helpers ──────────────────────────────────────────────────

function pct(num: number, den: number) {
  return den ? Math.round((num / den) * 100) : 0;
}

function fmt(n: number) {
  return n.toLocaleString("es-ES");
}

function fmtEur(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/** "2025-04-01" → "Abr 25" */
function shortMonthLabel(fecha: string): string {
  return new Date(fecha + "T12:00:00").toLocaleDateString("es-ES", {
    month: "short",
    year: "2-digit",
  });
}

/** "2025-04-01" → "Abril 2025" */
function longMonthLabel(fecha: string): string {
  return new Date(fecha + "T12:00:00").toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });
}

/** Returns the first-day-of-month ISO strings for the last N months (oldest first) */
function monthsInRange(n: number): string[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
}

// ── Data fetching ─────────────────────────────────────────────

async function getClientDetail(id: string, rangeMonths: number) {
  const supabase = await createClient();

  const months = monthsInRange(rangeMonths);
  const since  = months[0];

  const [{ data: client }, { data: ghlRows }, { data: metaRows }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, slug, active")
      .eq("id", id)
      .single(),
    supabase
      .from("metrics_ghl")
      .select("fecha, leads, agendados, presenciales, cerrados")
      .eq("client_id", id)
      .gte("fecha", since)
      .order("fecha"),
    supabase
      .from("metrics_meta")
      .select("fecha, gasto, cpl")
      .eq("client_id", id)
      .gte("fecha", since)
      .order("fecha"),
  ]);

  if (!client) return null;

  // Index raw rows by fecha
  const ghlByFecha: Record<string, typeof ghlRows extends (infer T)[] | null ? T : never> = {};
  for (const r of ghlRows ?? []) ghlByFecha[r.fecha] = r;

  const metaByFecha: Record<string, typeof metaRows extends (infer T)[] | null ? T : never> = {};
  for (const r of metaRows ?? []) metaByFecha[r.fecha] = r;

  // Build one row per month in the range (fill zeros for missing months)
  const rows: MonthRow[] = months.map((fecha) => {
    const g = ghlByFecha[fecha];
    const m = metaByFecha[fecha];

    const leads        = g?.leads        ?? 0;
    const agendados    = g?.agendados    ?? 0;
    const presenciales = g?.presenciales ?? 0;
    const cerrados     = g?.cerrados     ?? 0;
    const gasto        = m?.gasto        ?? 0;
    const cpl          = m?.cpl          ?? 0;

    return {
      fecha,
      label: longMonthLabel(fecha),
      leads,
      agendados,
      presenciales,
      cerrados,
      gasto,
      cpl,
      tasa_agendamiento:   pct(agendados,    leads),
      tasa_presencialidad: pct(presenciales, agendados),
      tasa_cierre:         pct(cerrados,     presenciales),
    };
  });

  // Totals for the period
  const totals = rows.reduce(
    (acc, r) => ({
      leads:        acc.leads        + r.leads,
      agendados:    acc.agendados    + r.agendados,
      presenciales: acc.presenciales + r.presenciales,
      cerrados:     acc.cerrados     + r.cerrados,
      gasto:        acc.gasto        + r.gasto,
    }),
    { leads: 0, agendados: 0, presenciales: 0, cerrados: 0, gasto: 0 }
  );
  const totalCPL = totals.leads > 0 ? totals.gasto / totals.leads : 0;

  // Chart data — one point per month
  const chartData: ChartMonth[] = rows.map((r) => ({
    label:    shortMonthLabel(r.fecha),
    leads:    r.leads,
    cerrados: r.cerrados,
  }));

  return { client, rows, totals: { ...totals, cpl: totalCPL }, chartData };
}

// ── Page ──────────────────────────────────────────────────────

const VALID_RANGES = [3, 6, 12] as const;
type Range = (typeof VALID_RANGES)[number];

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", params.id)
    .single();
  return { title: client ? `${client.name} — Échale` : "Cliente — Échale" };
}

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { range?: string };
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

  const rawRange = Number(searchParams.range ?? "3");
  const range: Range = VALID_RANGES.includes(rawRange as Range) ? (rawRange as Range) : 3;

  const detail = await getClientDetail(params.id, range);
  if (!detail) notFound();

  const { client, rows, totals, chartData } = detail;

  // Only show months that have at least some data
  const hasData = rows.some((r) => r.leads + r.cerrados + r.gasto > 0);

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <div>
        <Link
          href="/dashboard/clientes"
          className="inline-flex items-center gap-1.5 text-xs font-sans text-muted hover:text-foreground transition-colors mb-4"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Todos los clientes
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
              {client.name}
            </h1>
            <code className="text-xs font-mono text-muted bg-white/5 border border-border rounded px-2 py-0.5">
              {client.slug}
            </code>
            <span className={`inline-flex items-center gap-1.5 text-xs font-sans font-medium px-2.5 py-1 rounded-full border ${
              client.active
                ? "text-accent bg-accent/10 border-accent/20"
                : "text-muted bg-white/5 border-border"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${client.active ? "bg-accent" : "bg-muted"}`} />
              {client.active ? "Activo" : "Inactivo"}
            </span>
          </div>

          {/* Range selector */}
          <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1">
            {VALID_RANGES.map((r) => (
              <Link
                key={r}
                href={`/dashboard/clientes/${client.id}?range=${r}`}
                className={`px-3 py-1.5 rounded-md text-xs font-sans font-medium transition-colors ${
                  range === r
                    ? "bg-accent text-background"
                    : "text-muted hover:text-foreground hover:bg-white/5"
                }`}
              >
                {r}M
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPI Summary cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-6 gap-4">
        <KpiCard label="Leads"        value={fmt(totals.leads)}        />
        <KpiCard label="Agendados"    value={fmt(totals.agendados)}    />
        <KpiCard label="Presenciales" value={fmt(totals.presenciales)} />
        <KpiCard label="Cerrados"     value={fmt(totals.cerrados)}     accent />
        <KpiCard label="Gasto Meta"   value={`€${fmtEur(totals.gasto)}`} />
        <KpiCard label="CPL"          value={totals.cpl > 0 ? `€${fmtEur(totals.cpl)}` : "—"} />
      </div>

      {/* ── Line chart ── */}
      <div className="bg-surface border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">
              Evolución mes a mes
            </h2>
            <p className="text-xs font-sans text-muted mt-0.5">
              Últimos {range} meses
            </p>
          </div>
        </div>
        {hasData ? (
          <MonthlyLineChart data={chartData} />
        ) : (
          <EmptyState message="Sin datos en el período seleccionado." />
        )}
      </div>

      {/* ── Monthly history table ── */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-foreground">
            Historial mes a mes
          </h2>
          <span className="text-xs font-sans text-muted">
            {range} meses
          </span>
        </div>

        {!hasData ? (
          <EmptyState message="Sin registros en el período seleccionado." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="border-b border-border">
                  <Th align="left">Mes</Th>
                  <Th>Leads</Th>
                  <Th>Agendados</Th>
                  <Th>% Agend.</Th>
                  <Th>Presenciales</Th>
                  <Th>% Presenc.</Th>
                  <Th>Cerrados</Th>
                  <Th>% Cierre</Th>
                  <Th>Gasto Meta</Th>
                  <Th>CPL</Th>
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map((row, i) => {
                  const isEmpty = row.leads + row.agendados + row.presenciales + row.cerrados + row.gasto === 0;
                  return (
                    <tr
                      key={row.fecha}
                      className={`border-b border-border/50 transition-colors ${
                        i === rows.length - 1 ? "border-b-0" : ""
                      } ${isEmpty ? "opacity-40" : "hover:bg-white/[0.02]"}`}
                    >
                      <td className="px-6 py-4 font-medium text-foreground whitespace-nowrap capitalize">
                        {row.label}
                      </td>
                      <Td>{fmt(row.leads)}</Td>
                      <Td>{fmt(row.agendados)}</Td>
                      <Td><RateBadge value={row.tasa_agendamiento}   thresholds={[30, 15]} empty={isEmpty} /></Td>
                      <Td>{fmt(row.presenciales)}</Td>
                      <Td><RateBadge value={row.tasa_presencialidad} thresholds={[60, 40]} empty={isEmpty} /></Td>
                      <Td>{fmt(row.cerrados)}</Td>
                      <Td><RateBadge value={row.tasa_cierre}         thresholds={[30, 15]} empty={isEmpty} /></Td>
                      <Td>{row.gasto > 0 ? `€${fmtEur(row.gasto)}` : "—"}</Td>
                      <Td>{row.cpl > 0 ? `€${fmtEur(row.cpl)}` : "—"}</Td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Totals row */}
              <tfoot>
                <tr className="bg-white/[0.02] border-t border-border">
                  <td className="px-6 py-4 font-display font-semibold text-foreground text-xs uppercase tracking-wider whitespace-nowrap">
                    Total período
                  </td>
                  <Td bold>{fmt(totals.leads)}</Td>
                  <Td bold>{fmt(totals.agendados)}</Td>
                  <Td bold><RateBadge value={pct(totals.agendados, totals.leads)} thresholds={[30, 15]} /></Td>
                  <Td bold>{fmt(totals.presenciales)}</Td>
                  <Td bold><RateBadge value={pct(totals.presenciales, totals.agendados)} thresholds={[60, 40]} /></Td>
                  <Td bold>{fmt(totals.cerrados)}</Td>
                  <Td bold><RateBadge value={pct(totals.cerrados, totals.presenciales)} thresholds={[30, 15]} /></Td>
                  <Td bold>{totals.gasto > 0 ? `€${fmtEur(totals.gasto)}` : "—"}</Td>
                  <Td bold>{totals.cpl > 0 ? `€${fmtEur(totals.cpl)}` : "—"}</Td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function KpiCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-5 border ${accent ? "bg-accent/10 border-accent/20" : "bg-surface border-border"}`}>
      <p className="text-muted text-xs font-sans uppercase tracking-widest">{label}</p>
      <p className={`mt-2 font-display text-2xl font-bold ${accent ? "text-accent" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

function Th({ children, align = "right" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-6 py-3.5 text-xs font-sans font-medium text-muted uppercase tracking-wider whitespace-nowrap ${
      align === "left" ? "text-left" : "text-right"
    }`}>
      {children}
    </th>
  );
}

function Td({ children, bold }: { children: React.ReactNode; bold?: boolean }) {
  return (
    <td className={`px-6 py-4 text-right tabular-nums whitespace-nowrap ${
      bold ? "font-semibold text-foreground" : "text-muted"
    }`}>
      {children}
    </td>
  );
}

function RateBadge({
  value,
  thresholds,
  empty,
}: {
  value: number;
  thresholds: [number, number];
  empty?: boolean;
}) {
  if (empty) return <span className="text-muted/40 text-xs font-sans">—</span>;

  const [good, ok] = thresholds;
  let cls = "text-red-400 bg-red-400/10";
  if (value >= good) cls = "text-accent bg-accent/10";
  else if (value >= ok) cls = "text-yellow-400 bg-yellow-400/10";

  return (
    <span className={`inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-medium font-sans tabular-nums ${cls}`}>
      {value}%
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-2">
      <p className="text-muted text-sm font-sans">{message}</p>
      <p className="text-muted/50 text-xs font-sans">
        Carga métricas o sincroniza GHL para verlos aquí.
      </p>
    </div>
  );
}

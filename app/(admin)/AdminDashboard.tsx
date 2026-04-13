import { createClient } from "@/lib/supabase/server";
import type { ClientMonthSummary } from "@/types";

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

async function getAdminDashboardData(): Promise<ClientMonthSummary[]> {
  const supabase = await createClient();
  const since = startOfCurrentMonth();

  const [{ data: clients }, { data: ghlRows }, { data: metaRows }] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, name")
        .eq("active", true)
        .order("name"),
      supabase
        .from("metrics_ghl")
        .select("client_id, leads, agendados, presenciales, cerrados")
        .gte("fecha", since),
      supabase
        .from("metrics_meta")
        .select("client_id, gasto, leads")
        .gte("fecha", since),
    ]);

  if (!clients?.length) return [];

  // Aggregate GHL per client
  const ghlByClient: Record<string, { leads: number; agendados: number; presenciales: number; cerrados: number }> = {};
  for (const row of ghlRows ?? []) {
    if (!ghlByClient[row.client_id]) {
      ghlByClient[row.client_id] = { leads: 0, agendados: 0, presenciales: 0, cerrados: 0 };
    }
    ghlByClient[row.client_id].leads       += row.leads       ?? 0;
    ghlByClient[row.client_id].agendados   += row.agendados   ?? 0;
    ghlByClient[row.client_id].presenciales+= row.presenciales?? 0;
    ghlByClient[row.client_id].cerrados    += row.cerrados    ?? 0;
  }

  // Aggregate Meta per client
  const metaByClient: Record<string, { gasto: number; leads: number }> = {};
  for (const row of metaRows ?? []) {
    if (!metaByClient[row.client_id]) {
      metaByClient[row.client_id] = { gasto: 0, leads: 0 };
    }
    metaByClient[row.client_id].gasto += row.gasto ?? 0;
    metaByClient[row.client_id].leads += row.leads ?? 0;
  }

  return clients.map((c) => {
    const ghl  = ghlByClient[c.id]  ?? { leads: 0, agendados: 0, presenciales: 0, cerrados: 0 };
    const meta = metaByClient[c.id] ?? { gasto: 0, leads: 0 };
    const totalLeads = ghl.leads || meta.leads;
    const cpl = totalLeads > 0 ? meta.gasto / totalLeads : 0;

    return {
      client_id:            c.id,
      client_name:          c.name,
      leads:                totalLeads,
      agendados:            ghl.agendados,
      presenciales:         ghl.presenciales,
      cerrados:             ghl.cerrados,
      gasto:                meta.gasto,
      cpl,
      tasa_agendamiento:    pct(ghl.agendados,    totalLeads),
      tasa_presencialidad:  pct(ghl.presenciales, ghl.agendados),
      tasa_cierre:          pct(ghl.cerrados,     ghl.presenciales),
    };
  });
}

// ── Component ────────────────────────────────────────────────

export default async function AdminDashboard() {
  const rows = await getAdminDashboardData();

  // Agency-wide totals
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

  const month = currentMonthLabel();

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Panel de agencia
          </h1>
          <p className="mt-1 text-muted text-sm font-sans">
            Métricas consolidadas de todos los clientes activos.
          </p>
        </div>
        <span className="mt-1 inline-flex items-center gap-1.5 bg-accent/10 border border-accent/20 text-accent text-xs font-sans font-medium px-3 py-1.5 rounded-full capitalize">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          {month}
        </span>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Leads totales"     value={fmt(totals.leads)}        />
        <KpiCard label="Cerrados"          value={fmt(totals.cerrados)}      accent />
        <KpiCard label="Gasto Meta Ads"    value={fmtMXN(totals.gasto)}     />
        <KpiCard label="CPL promedio"      value={fmtMXN(totalCPL)}         />
      </div>

      {/* ── Clients table ── */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-foreground">
            Resumen por cliente
          </h2>
          <span className="text-xs text-muted font-sans">
            {rows.length} cliente{rows.length !== 1 ? "s" : ""} activo{rows.length !== 1 ? "s" : ""}
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <p className="text-muted text-sm font-sans">Sin datos para el mes actual.</p>
            <p className="text-muted/50 text-xs font-sans">Agrega clientes y carga métricas para verlas aquí.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="border-b border-border">
                  <Th align="left">Cliente</Th>
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
                {rows.map((row, i) => (
                  <tr
                    key={row.client_id}
                    className={`border-b border-border/50 hover:bg-white/[0.02] transition-colors ${
                      i === rows.length - 1 ? "border-b-0" : ""
                    }`}
                  >
                    <td className="px-6 py-4 font-medium text-foreground whitespace-nowrap">
                      {row.client_name}
                    </td>
                    <Td>{fmt(row.leads)}</Td>
                    <Td>{fmt(row.agendados)}</Td>
                    <Td><RateBadge value={row.tasa_agendamiento} thresholds={[30, 15]} /></Td>
                    <Td>{fmt(row.presenciales)}</Td>
                    <Td><RateBadge value={row.tasa_presencialidad} thresholds={[60, 40]} /></Td>
                    <Td>{fmt(row.cerrados)}</Td>
                    <Td><RateBadge value={row.tasa_cierre} thresholds={[30, 15]} /></Td>
                    <Td>{fmtMXN(row.gasto)}</Td>
                    <Td>{fmtMXN(row.cpl)}</Td>
                  </tr>
                ))}
              </tbody>
              {/* Totals row */}
              <tfoot>
                <tr className="bg-white/[0.02] border-t border-border">
                  <td className="px-6 py-4 font-display font-semibold text-foreground text-xs uppercase tracking-wider">
                    Total agencia
                  </td>
                  <Td bold>{fmt(totals.leads)}</Td>
                  <Td bold>{fmt(totals.agendados)}</Td>
                  <Td bold><RateBadge value={pct(totals.agendados, totals.leads)} thresholds={[30, 15]} /></Td>
                  <Td bold>{fmt(totals.presenciales)}</Td>
                  <Td bold><RateBadge value={pct(totals.presenciales, totals.agendados)} thresholds={[60, 40]} /></Td>
                  <Td bold>{fmt(totals.cerrados)}</Td>
                  <Td bold><RateBadge value={pct(totals.cerrados, totals.presenciales)} thresholds={[30, 15]} /></Td>
                  <Td bold>{fmtMXN(totals.gasto)}</Td>
                  <Td bold>{fmtMXN(totalCPL)}</Td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
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
        accent
          ? "bg-accent/10 border-accent/20"
          : "bg-surface border-border"
      }`}
    >
      <p className="text-muted text-xs font-sans uppercase tracking-widest">
        {label}
      </p>
      <p
        className={`mt-2 font-display text-3xl font-bold ${
          accent ? "text-accent" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Th({ children, align = "right" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className={`px-6 py-3.5 text-xs font-sans font-medium text-muted uppercase tracking-wider ${
        align === "left" ? "text-left" : "text-right"
      }`}
    >
      {children}
    </th>
  );
}

function Td({ children, bold }: { children: React.ReactNode; bold?: boolean }) {
  return (
    <td className={`px-6 py-4 text-right tabular-nums whitespace-nowrap ${bold ? "font-semibold text-foreground" : "text-muted"}`}>
      {children}
    </td>
  );
}

/**
 * Color badge for percentage rates.
 * thresholds: [good, ok] — above good = green, above ok = yellow, below ok = red
 */
function RateBadge({ value, thresholds }: { value: number; thresholds: [number, number] }) {
  const [good, ok] = thresholds;
  let color = "text-red-400 bg-red-400/10";
  if (value >= good) color = "text-accent bg-accent/10";
  else if (value >= ok) color = "text-yellow-400 bg-yellow-400/10";

  return (
    <span className={`inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-medium font-sans tabular-nums ${color}`}>
      {value}%
    </span>
  );
}

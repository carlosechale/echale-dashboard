import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import VentasBarChart from "./VentasBarChart";

export const metadata: Metadata = {
  title: "Ventas — Échale",
};

// ── Helpers ─────────────────────────────────────────────────

function startOfMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function prevMonthRange(): { since: string; until: string } {
  const d = new Date();
  const until = new Date(d.getFullYear(), d.getMonth(), 0);
  const since = new Date(until.getFullYear(), until.getMonth(), 1);
  return {
    since: since.toISOString().split("T")[0],
    until: until.toISOString().split("T")[0],
  };
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

function pct(num: number, den: number): number | null {
  if (!den) return null;
  return Math.round((num / den) * 100);
}

// ── Types ────────────────────────────────────────────────────

type SalesRow = {
  paid_inversion: number;
  paid_leads: number;
  paid_agendas: number;
  paid_cierres: number;
  paid_ventas: number;
  organico_leads: number;
  organico_agendas: number;
  organico_cierres: number;
  organico_ventas: number;
  outbound_llamadas: number;
  outbound_contactos: number;
  outbound_leads: number;
  outbound_agendas: number;
  outbound_cierres: number;
  outbound_ventas: number;
};

const ZERO: SalesRow = {
  paid_inversion: 0, paid_leads: 0, paid_agendas: 0, paid_cierres: 0, paid_ventas: 0,
  organico_leads: 0, organico_agendas: 0, organico_cierres: 0, organico_ventas: 0,
  outbound_llamadas: 0, outbound_contactos: 0, outbound_leads: 0, outbound_agendas: 0,
  outbound_cierres: 0, outbound_ventas: 0,
};

function aggregate(rows: SalesRow[]): SalesRow {
  return rows.reduce((acc, r) => ({
    paid_inversion:    acc.paid_inversion    + (r.paid_inversion    ?? 0),
    paid_leads:        acc.paid_leads        + (r.paid_leads        ?? 0),
    paid_agendas:      acc.paid_agendas      + (r.paid_agendas      ?? 0),
    paid_cierres:      acc.paid_cierres      + (r.paid_cierres      ?? 0),
    paid_ventas:       acc.paid_ventas       + (r.paid_ventas       ?? 0),
    organico_leads:    acc.organico_leads    + (r.organico_leads    ?? 0),
    organico_agendas:  acc.organico_agendas  + (r.organico_agendas  ?? 0),
    organico_cierres:  acc.organico_cierres  + (r.organico_cierres  ?? 0),
    organico_ventas:   acc.organico_ventas   + (r.organico_ventas   ?? 0),
    outbound_llamadas: acc.outbound_llamadas + (r.outbound_llamadas ?? 0),
    outbound_contactos:acc.outbound_contactos+(r.outbound_contactos ?? 0),
    outbound_leads:    acc.outbound_leads    + (r.outbound_leads    ?? 0),
    outbound_agendas:  acc.outbound_agendas  + (r.outbound_agendas  ?? 0),
    outbound_cierres:  acc.outbound_cierres  + (r.outbound_cierres  ?? 0),
    outbound_ventas:   acc.outbound_ventas   + (r.outbound_ventas   ?? 0),
  }), { ...ZERO });
}

const COLS = "paid_inversion,paid_leads,paid_agendas,paid_cierres,paid_ventas,organico_leads,organico_agendas,organico_cierres,organico_ventas,outbound_llamadas,outbound_contactos,outbound_leads,outbound_agendas,outbound_cierres,outbound_ventas";

// ── Page ─────────────────────────────────────────────────────

export default async function VentasPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/dashboard");

  const currSince = startOfMonth(new Date());
  const { since: prevSince, until: prevUntil } = prevMonthRange();

  const [{ data: currRows }, { data: prevRows }] = await Promise.all([
    supabase.from("agency_sales_daily").select(COLS).gte("fecha", currSince),
    supabase.from("agency_sales_daily").select(COLS).gte("fecha", prevSince).lte("fecha", prevUntil),
  ]);

  const curr = aggregate((currRows ?? []) as SalesRow[]);
  const prev = aggregate((prevRows ?? []) as SalesRow[]);

  // Current month totals
  const leads   = curr.paid_leads    + curr.organico_leads    + curr.outbound_leads;
  const agendas = curr.paid_agendas  + curr.organico_agendas  + curr.outbound_agendas;
  const cierres = curr.paid_cierres  + curr.organico_cierres  + curr.outbound_cierres;
  const ventas  = curr.paid_ventas   + curr.organico_ventas   + curr.outbound_ventas;

  // Previous month totals
  const prevLeads   = prev.paid_leads   + prev.organico_leads   + prev.outbound_leads;
  const prevAgendas = prev.paid_agendas + prev.organico_agendas + prev.outbound_agendas;
  const prevCierres = prev.paid_cierres + prev.organico_cierres + prev.outbound_cierres;
  const prevVentas  = prev.paid_ventas  + prev.organico_ventas  + prev.outbound_ventas;

  const closeRate     = pct(cierres, leads);
  const prevCloseRate = pct(prevCierres, prevLeads);
  const cac  = cierres > 0 && curr.paid_inversion > 0 ? curr.paid_inversion / cierres : null;
  const roas = curr.paid_inversion > 0 ? ventas / curr.paid_inversion : null;

  const month = new Date().toLocaleDateString("es-ES", { month: "long", year: "numeric" });

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Ventas agencia</h1>
          <p className="mt-1 text-muted text-sm font-sans">
            Pipeline comercial por canal del mes actual.
          </p>
        </div>
        <span className="mt-1 inline-flex items-center gap-1.5 bg-accent/10 border border-accent/20 text-accent text-xs font-sans font-medium px-3 py-1.5 rounded-full capitalize">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          {month}
        </span>
      </div>

      {/* KPI row 1 */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Leads totales"
          value={fmt(leads)}
          delta={leads - prevLeads}
          prevValue={prevLeads}
        />
        <KpiCard
          label="Agendas"
          value={fmt(agendas)}
          delta={agendas - prevAgendas}
          prevValue={prevAgendas}
        />
        <KpiCard
          label="Cierres"
          value={fmt(cierres)}
          delta={cierres - prevCierres}
          prevValue={prevCierres}
          accent
        />
        <KpiCard
          label="Close Rate"
          value={closeRate !== null ? `${closeRate}%` : "—"}
          delta={closeRate !== null && prevCloseRate !== null ? closeRate - prevCloseRate : null}
          isPoints
        />
      </div>

      {/* KPI row 2 */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard
          label="Ventas"
          value={fmtEur(ventas)}
          delta={ventas - prevVentas}
          prevValue={prevVentas}
          isCurrency
        />
        <KpiCard
          label="CAC (inversión/cierre)"
          value={cac !== null ? fmtEur(cac) : "—"}
        />
        <KpiCard
          label="ROAS"
          value={roas !== null ? `${roas.toFixed(1)}×` : "—"}
        />
      </div>

      {/* Channel cards */}
      <div>
        <h2 className="font-display text-lg font-semibold text-foreground mb-4">Desglose por canal</h2>
        <div className="grid grid-cols-3 gap-4">
          <ChannelCard
            label="Paid Media"
            colorClass="text-accent"
            leads={curr.paid_leads}
            agendas={curr.paid_agendas}
            cierres={curr.paid_cierres}
            ventas={curr.paid_ventas}
          />
          <ChannelCard
            label="Orgánico"
            colorClass="text-muted"
            leads={curr.organico_leads}
            agendas={curr.organico_agendas}
            cierres={curr.organico_cierres}
            ventas={curr.organico_ventas}
          />
          <ChannelCard
            label="Outbound"
            colorClass="text-foreground"
            leads={curr.outbound_leads}
            agendas={curr.outbound_agendas}
            cierres={curr.outbound_cierres}
            ventas={curr.outbound_ventas}
            href="/dashboard/ventas/outbound"
          />
        </div>
      </div>

      {/* Bar chart */}
      <div className="bg-surface border border-border rounded-2xl p-6">
        <h2 className="font-display text-base font-semibold text-foreground mb-6">
          Leads por canal — mes actual
        </h2>
        <VentasBarChart
          paid={curr.paid_leads}
          organico={curr.organico_leads}
          outbound={curr.outbound_leads}
        />
      </div>

    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────

function KpiCard({
  label,
  value,
  accent,
  delta,
  prevValue,
  isCurrency,
  isPoints,
}: {
  label: string;
  value: string;
  accent?: boolean;
  delta?: number | null;
  prevValue?: number;
  isCurrency?: boolean;
  isPoints?: boolean;
}) {
  const showDelta = delta !== null && delta !== undefined;

  let deltaLabel = "";
  if (showDelta && delta !== 0) {
    const sign = delta > 0 ? "+" : "";
    if (isPoints) {
      deltaLabel = `${sign}${delta} pp`;
    } else if (isCurrency) {
      deltaLabel = `${sign}${new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(delta)}`;
    } else if (prevValue !== undefined && prevValue > 0) {
      const pctChange = Math.round(((delta) / prevValue) * 100);
      deltaLabel = `${sign}${delta} (${sign}${pctChange}%)`;
    } else {
      deltaLabel = `${sign}${delta}`;
    }
  }

  return (
    <div
      className={`rounded-xl p-5 border ${
        accent ? "bg-accent/10 border-accent/20" : "bg-surface border-border"
      }`}
    >
      <p className="text-muted text-xs font-sans uppercase tracking-widest">{label}</p>
      <p
        className={`mt-2 font-display text-3xl font-bold ${
          accent ? "text-accent" : "text-foreground"
        }`}
      >
        {value}
      </p>
      {showDelta && deltaLabel && (
        <p className={`mt-1.5 text-xs font-sans ${delta > 0 ? "text-accent" : delta < 0 ? "text-red-400" : "text-muted"}`}>
          {deltaLabel} vs mes ant.
        </p>
      )}
    </div>
  );
}

function ChannelCard({
  label,
  colorClass,
  leads,
  agendas,
  cierres,
  ventas,
  href,
}: {
  label: string;
  colorClass: string;
  leads: number;
  agendas: number;
  cierres: number;
  ventas: number;
  href?: string;
}) {
  const inner = (
    <div className="bg-surface border border-border rounded-xl p-5 space-y-4 hover:border-border/80 transition-colors">
      <div className="flex items-center justify-between">
        <p className={`font-display text-sm font-semibold ${colorClass}`}>{label}</p>
        {href && (
          <span className="text-muted text-xs font-sans">Ver tracker →</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Leads"   value={leads.toString()} />
        <Stat label="Agendas" value={agendas.toString()} />
        <Stat label="Cierres" value={cierres.toString()} />
        <Stat label="Ventas"  value={new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(ventas)} />
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{inner}</Link>;
  }
  return inner;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted text-[10px] font-sans uppercase tracking-widest">{label}</p>
      <p className="mt-0.5 font-display text-xl font-bold text-foreground tabular-nums">{value}</p>
    </div>
  );
}

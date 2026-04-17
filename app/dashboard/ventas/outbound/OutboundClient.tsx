"use client";

import { useState, useTransition } from "react";
import { incrementOutbound, decrementOutbound } from "../actions";

type OutboundField = "llamadas" | "contactos" | "leads" | "agendas";

interface Counts {
  llamadas: number;
  contactos: number;
  leads: number;
  agendas: number;
}

interface HistoryRow {
  fecha: string;
  outbound_llamadas: number;
  outbound_contactos: number;
  outbound_leads: number;
  outbound_agendas: number;
  outbound_cierres: number;
  outbound_ventas: number;
}

interface Props {
  initial: Counts;
  history: HistoryRow[];
}

function pct(num: number, den: number): string {
  if (!den) return "—";
  return `${Math.round((num / den) * 100)}%`;
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

const COUNTERS: { field: OutboundField; label: string }[] = [
  { field: "llamadas", label: "Llamadas realizadas" },
  { field: "contactos", label: "Contactos efectivos" },
  { field: "leads",    label: "Leads conseguidos" },
  { field: "agendas",  label: "Agendas conseguidas" },
];

export default function OutboundClient({ initial, history }: Props) {
  const [counts, setCounts] = useState<Counts>(initial);
  const [isPending, startTransition] = useTransition();

  function handleIncrement(field: OutboundField) {
    setCounts((prev) => ({ ...prev, [field]: prev[field] + 1 }));
    startTransition(async () => {
      const result = await incrementOutbound(field);
      if (result.error) {
        setCounts((prev) => ({ ...prev, [field]: prev[field] - 1 }));
      }
    });
  }

  function handleDecrement(field: OutboundField) {
    setCounts((prev) => ({ ...prev, [field]: Math.max(0, prev[field] - 1) }));
    startTransition(async () => {
      const result = await decrementOutbound(field);
      if (result.error) {
        setCounts((prev) => ({ ...prev, [field]: prev[field] + 1 }));
      }
    });
  }

  const today = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-8">

      <p className="text-muted text-sm font-sans capitalize">{today}</p>

      {/* Counter cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {COUNTERS.map(({ field, label }) => (
          <div key={field} className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-4">
            <p className="text-muted text-xs font-sans uppercase tracking-widest leading-snug">
              {label}
            </p>
            <p className="font-display text-5xl font-bold text-foreground tabular-nums">
              {counts[field]}
            </p>
            <div className="mt-auto flex items-center gap-2">
              <button
                onClick={() => handleDecrement(field)}
                disabled={isPending || counts[field] === 0}
                className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/5 border border-border text-muted font-display font-bold text-lg hover:bg-white/10 hover:text-foreground active:scale-95 transition-all disabled:opacity-30"
                aria-label={`Restar ${label}`}
              >
                −
              </button>
              <button
                onClick={() => handleIncrement(field)}
                disabled={isPending}
                className="flex-1 flex items-center justify-center py-2.5 rounded-lg bg-accent/10 border border-accent/20 text-accent font-display font-bold text-2xl hover:bg-accent/20 active:scale-95 transition-all disabled:opacity-40"
                aria-label={`Sumar ${label}`}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Rate cards */}
      <div className="grid grid-cols-3 gap-4">
        <RateCard label="Tasa contacto" value={pct(counts.contactos, counts.llamadas)} note="contactos / llamadas" />
        <RateCard label="Tasa lead"     value={pct(counts.leads, counts.contactos)}    note="leads / contactos" />
        <RateCard label="Tasa agenda"   value={pct(counts.agendas, counts.leads)}      note="agendas / leads" />
      </div>

      {/* History table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-foreground">
            Historial — últimos 30 días
          </h2>
          <span className="text-xs text-muted font-sans">{history.length} días con datos</span>
        </div>

        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-muted text-sm font-sans">Sin datos en los últimos 30 días.</p>
            <p className="text-muted/50 text-xs font-sans">Empieza a registrar llamadas con los contadores de arriba.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="border-b border-border">
                  <Th align="left">Fecha</Th>
                  <Th>Llamadas</Th>
                  <Th>Contactos</Th>
                  <Th>T. Contacto</Th>
                  <Th>Leads</Th>
                  <Th>T. Lead</Th>
                  <Th>Agendas</Th>
                  <Th>T. Agenda</Th>
                  <Th>Cierres</Th>
                  <Th>Ventas</Th>
                </tr>
              </thead>
              <tbody>
                {history.map((row, i) => (
                  <tr
                    key={row.fecha}
                    className={`border-b border-border/50 hover:bg-white/[0.02] transition-colors ${
                      i === history.length - 1 ? "border-b-0" : ""
                    }`}
                  >
                    <td className="px-6 py-4 text-foreground font-medium whitespace-nowrap">
                      {new Date(row.fecha + "T00:00:00").toLocaleDateString("es-ES", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </td>
                    <Td>{fmt(row.outbound_llamadas)}</Td>
                    <Td>{fmt(row.outbound_contactos)}</Td>
                    <Td>{pct(row.outbound_contactos, row.outbound_llamadas)}</Td>
                    <Td>{fmt(row.outbound_leads)}</Td>
                    <Td>{pct(row.outbound_leads, row.outbound_contactos)}</Td>
                    <Td>{fmt(row.outbound_agendas)}</Td>
                    <Td>{pct(row.outbound_agendas, row.outbound_leads)}</Td>
                    <Td>{fmt(row.outbound_cierres)}</Td>
                    <Td>{fmtEur(row.outbound_ventas)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function RateCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <p className="text-muted text-xs font-sans uppercase tracking-widest">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold text-foreground">{value}</p>
      <p className="mt-1 text-muted/50 text-[10px] font-sans">{note}</p>
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

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="px-6 py-4 text-right tabular-nums whitespace-nowrap text-muted">
      {children}
    </td>
  );
}

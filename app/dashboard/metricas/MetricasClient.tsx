"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Client } from "@/types";
import type { MetricRow } from "./page";
import { upsertMetrics, deleteMetrics } from "./actions";

// ── GHL sync ─────────────────────────────────────────────────

async function syncGhl(client_id: string) {
  const res = await fetch("/api/sync/ghl", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Error al sincronizar");
  return data as { leads: number; agendados: number; presenciales: number; cerrados: number };
}

// ── Meta sync ─────────────────────────────────────────────────

async function syncMeta(client_id: string) {
  const res = await fetch("/api/sync/meta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Error al sincronizar Meta");
  return data as { spend: number; leads: number; cpl: number };
}

// ── Constants ────────────────────────────────────────────────

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const now = new Date();
const YEARS = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

const EMPTY: FormState = {
  client_id: "",
  month: String(now.getMonth() + 1).padStart(2, "0"),
  year: String(now.getFullYear()),
  leads: "",
  agendados: "",
  presenciales: "",
  cerrados: "",
  gasto: "",
  cpl: "",
};

interface FormState {
  client_id: string;
  month: string;
  year: string;
  leads: string;
  agendados: string;
  presenciales: string;
  cerrados: string;
  gasto: string;
  cpl: string;
}

// ── Component ────────────────────────────────────────────────

export default function MetricasClient({
  clients,
  initialRows,
}: {
  clients: Pick<Client, "id" | "name">[];
  initialRows: MetricRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);
  const [syncStatus, setSyncStatus] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingMeta, setIsSyncingMeta] = useState(false);

  async function handleSync() {
    if (!form.client_id) {
      setSyncStatus({ type: "error", msg: "Selecciona un cliente antes de sincronizar." });
      return;
    }
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const result = await syncGhl(form.client_id);
      setSyncStatus({
        type: "success",
        msg: `GHL sincronizado: ${result.leads} leads · ${result.agendados} agendados · ${result.presenciales} presenciales · ${result.cerrados} cerrados`,
      });
      router.refresh();
    } catch (err) {
      setSyncStatus({
        type: "error",
        msg: err instanceof Error ? err.message : "Error al sincronizar GHL",
      });
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleSyncMeta() {
    if (!form.client_id) {
      setSyncStatus({ type: "error", msg: "Selecciona un cliente antes de sincronizar." });
      return;
    }
    setIsSyncingMeta(true);
    setSyncStatus(null);
    try {
      const result = await syncMeta(form.client_id);
      setSyncStatus({
        type: "success",
        msg: `Meta sincronizado: €${result.spend.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gasto · ${result.leads} leads · €${result.cpl.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CPL`,
      });
      router.refresh();
    } catch (err) {
      setSyncStatus({
        type: "error",
        msg: err instanceof Error ? err.message : "Error al sincronizar Meta",
      });
    } finally {
      setIsSyncingMeta(false);
    }
  }

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function startEdit(row: MetricRow) {
    const [year, month] = row.fecha.split("-");
    setForm({
      client_id: row.client_id,
      month,
      year,
      leads: String(row.leads),
      agendados: String(row.agendados),
      presenciales: String(row.presenciales),
      cerrados: String(row.cerrados),
      gasto: String(row.gasto),
      cpl: String(row.cpl),
    });
    setEditingKey(`${row.client_id}_${row.fecha}`);
    setStatus(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setForm(EMPTY);
    setEditingKey(null);
    setStatus(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.client_id) {
      setStatus({ type: "error", msg: "Selecciona un cliente." });
      return;
    }
    setStatus(null);

    startTransition(async () => {
      const result = await upsertMetrics({
        client_id: form.client_id,
        fecha: `${form.year}-${form.month}-01`,
        leads: Number(form.leads) || 0,
        agendados: Number(form.agendados) || 0,
        presenciales: Number(form.presenciales) || 0,
        cerrados: Number(form.cerrados) || 0,
        gasto: Number(form.gasto) || 0,
        cpl: Number(form.cpl) || 0,
      });

      if ("error" in result && result.error) {
        setStatus({ type: "error", msg: result.error });
      } else {
        setStatus({
          type: "success",
          msg: editingKey
            ? "Métricas actualizadas correctamente."
            : "Métricas guardadas correctamente.",
        });
        setForm(EMPTY);
        setEditingKey(null);
        router.refresh();
      }
    });
  }

  function handleDelete(row: MetricRow) {
    const label = `${row.client_name} · ${formatFecha(row.fecha)}`;
    if (!confirm(`¿Eliminar métricas de ${label}?`)) return;

    startTransition(async () => {
      await deleteMetrics(row.client_id, row.fecha);
      if (editingKey === `${row.client_id}_${row.fecha}`) cancelEdit();
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      {/* ── Form ── */}
      <form
        onSubmit={handleSubmit}
        className="bg-surface border border-border rounded-2xl p-6 space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="font-display text-base font-semibold text-foreground">
            {editingKey ? "Editar métricas" : "Nueva entrada"}
          </h2>
          <div className="flex items-center gap-3">
            {editingKey && (
              <button
                type="button"
                onClick={cancelEdit}
                className="text-xs text-muted hover:text-foreground font-sans transition-colors"
              >
                Cancelar edición
              </button>
            )}
            <button
              type="button"
              onClick={handleSync}
              disabled={isSyncing || isSyncingMeta || !form.client_id}
              className="inline-flex items-center gap-1.5 text-xs font-sans font-medium border border-accent/30 text-accent bg-accent/5 hover:bg-accent/10 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={!form.client_id ? "Selecciona un cliente primero" : "Importar métricas GHL del mes actual"}
            >
              {isSyncing ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Sincronizando…
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 4 1 10 7 10" />
                    <path d="M3.51 15a9 9 0 1 0 .49-4.95" />
                  </svg>
                  Sincronizar GHL
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleSyncMeta}
              disabled={isSyncingMeta || isSyncing || !form.client_id}
              className="inline-flex items-center gap-1.5 text-xs font-sans font-medium border border-accent/30 text-accent bg-accent/5 hover:bg-accent/10 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={!form.client_id ? "Selecciona un cliente primero" : "Importar métricas Meta Ads del mes actual"}
            >
              {isSyncingMeta ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Sincronizando…
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 4 1 10 7 10" />
                    <path d="M3.51 15a9 9 0 1 0 .49-4.95" />
                  </svg>
                  Sincronizar Meta
                </>
              )}
            </button>
          </div>
        </div>

        {/* GHL sync status */}
        {syncStatus && (
          <div
            className={`rounded-lg px-4 py-3 text-sm font-sans ${
              syncStatus.type === "success"
                ? "bg-accent/10 border border-accent/20 text-accent"
                : "bg-red-500/10 border border-red-500/20 text-red-400"
            }`}
          >
            {syncStatus.msg}
          </div>
        )}

        {/* Cliente + Fecha */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <FieldLabel>Cliente</FieldLabel>
            <Select
              value={form.client_id}
              onChange={(v) => set("client_id", v)}
              disabled={!!editingKey}
            >
              <option value="">Selecciona cliente…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel>Mes</FieldLabel>
            <Select
              value={form.month}
              onChange={(v) => set("month", v)}
              disabled={!!editingKey}
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={String(i + 1).padStart(2, "0")}>
                  {m}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel>Año</FieldLabel>
            <Select
              value={form.year}
              onChange={(v) => set("year", v)}
              disabled={!!editingKey}
            >
              {YEARS.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {editingKey && (
          <p className="text-xs text-muted font-sans -mt-2">
            El cliente y la fecha no se pueden cambiar durante la edición.
          </p>
        )}

        {/* GHL */}
        <div className="border-t border-border pt-5 space-y-4">
          <p className="text-xs font-sans font-semibold text-muted uppercase tracking-widest">
            GHL
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <NumberField
              label="Leads"
              value={form.leads}
              onChange={(v) => set("leads", v)}
            />
            <NumberField
              label="Agendados"
              value={form.agendados}
              onChange={(v) => set("agendados", v)}
            />
            <NumberField
              label="Presenciales"
              value={form.presenciales}
              onChange={(v) => set("presenciales", v)}
            />
            <NumberField
              label="Cerrados"
              value={form.cerrados}
              onChange={(v) => set("cerrados", v)}
            />
          </div>
        </div>

        {/* Meta */}
        <div className="border-t border-border pt-5 space-y-4">
          <p className="text-xs font-sans font-semibold text-muted uppercase tracking-widest">
            Meta Ads
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <NumberField
              label="Gasto total (€)"
              value={form.gasto}
              onChange={(v) => set("gasto", v)}
              step="0.01"
            />
            <NumberField
              label="CPL (€)"
              value={form.cpl}
              onChange={(v) => set("cpl", v)}
              step="0.01"
            />
          </div>
        </div>

        {/* Status */}
        {status && (
          <div
            className={`rounded-lg px-4 py-3 text-sm font-sans ${
              status.type === "success"
                ? "bg-accent/10 border border-accent/20 text-accent"
                : "bg-red-500/10 border border-red-500/20 text-red-400"
            }`}
          >
            {status.msg}
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 bg-accent text-background font-display font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed accent-glow-sm"
          >
            {isPending
              ? "Guardando…"
              : editingKey
              ? "Actualizar métricas"
              : "Guardar métricas"}
          </button>
        </div>
      </form>

      {/* ── Table ── */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-foreground">
            Últimos registros
          </h2>
          <span className="text-xs text-muted font-sans">
            {initialRows.length} registro{initialRows.length !== 1 ? "s" : ""}
          </span>
        </div>

        {initialRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-muted text-sm font-sans">Sin registros aún.</p>
            <p className="text-muted/50 text-xs font-sans">
              Usa el formulario de arriba para agregar métricas.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="border-b border-border">
                  <Th align="left">Cliente</Th>
                  <Th align="left">Periodo</Th>
                  <Th>Leads</Th>
                  <Th>Agend.</Th>
                  <Th>Presenc.</Th>
                  <Th>Cerrados</Th>
                  <Th>Gasto</Th>
                  <Th>CPL</Th>
                  <Th align="right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {initialRows.map((row, i) => {
                  const key = `${row.client_id}_${row.fecha}`;
                  const isEditing = editingKey === key;
                  return (
                    <tr
                      key={key}
                      className={`border-b border-border/50 transition-colors ${
                        i === initialRows.length - 1 ? "border-b-0" : ""
                      } ${
                        isEditing
                          ? "bg-accent/5"
                          : "hover:bg-white/[0.02]"
                      }`}
                    >
                      <td className="px-6 py-4 text-foreground font-medium whitespace-nowrap">
                        {row.client_name}
                      </td>
                      <td className="px-6 py-4 text-muted whitespace-nowrap capitalize">
                        {formatFecha(row.fecha)}
                      </td>
                      <Td>{row.leads}</Td>
                      <Td>{row.agendados}</Td>
                      <Td>{row.presenciales}</Td>
                      <Td>{row.cerrados}</Td>
                      <Td>€{fmtEur(row.gasto)}</Td>
                      <Td>€{fmtEur(row.cpl)}</Td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-3">
                          <button
                            onClick={() => startEdit(row)}
                            disabled={isPending}
                            className="text-xs font-sans text-muted hover:text-accent transition-colors disabled:opacity-40"
                          >
                            Editar
                          </button>
                          <span className="text-border text-xs">|</span>
                          <button
                            onClick={() => handleDelete(row)}
                            disabled={isPending}
                            className="text-xs font-sans text-muted hover:text-red-400 transition-colors disabled:opacity-40"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────

function formatFecha(fecha: string): string {
  return new Date(fecha + "T12:00:00").toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });
}

function fmtEur(n: number): string {
  return n.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ── Primitives ────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-sans font-medium text-muted mb-1.5 uppercase tracking-wider">
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  disabled,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm font-sans text-foreground focus:outline-none focus:border-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </select>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = "1",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="number"
        min="0"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm font-sans text-foreground placeholder:text-muted/40 focus:outline-none focus:border-accent transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
    </div>
  );
}

function Th({
  children,
  align = "right",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
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
    <td className="px-6 py-4 text-right tabular-nums text-muted whitespace-nowrap">
      {children}
    </td>
  );
}

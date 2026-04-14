"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Client } from "@/types";
import { changePasswordAction } from "./actions";

// ── Types ─────────────────────────────────────────────────────

interface SyncLog {
  id: string;
  client_id: string;
  tipo: string;
  status: string;
  mensaje: string;
  created_at: string;
  clients: { name: string } | null;
}

// ── Helpers ───────────────────────────────────────────────────

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const inputCls =
  "w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm font-sans text-foreground placeholder:text-muted/40 focus:outline-none focus:border-accent transition-colors";

function StatusBanner({ status }: { status: { type: "success" | "error"; msg: string } }) {
  return (
    <div
      className={`rounded-lg px-4 py-3 text-sm font-sans ${
        status.type === "success"
          ? "bg-accent/10 border border-accent/20 text-accent"
          : "bg-red-500/10 border border-red-500/20 text-red-400"
      }`}
    >
      {status.msg}
    </div>
  );
}

// ── Integration badge ─────────────────────────────────────────

function IntegrationBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-sans px-2 py-0.5 rounded-full border ${
        active
          ? "text-accent bg-accent/10 border-accent/20"
          : "text-muted/50 bg-white/5 border-border"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-accent" : "bg-muted/40"}`} />
      {label}
    </span>
  );
}

// ── Tab button ────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-sans font-medium rounded-lg transition-colors ${
        active
          ? "bg-accent/10 text-accent"
          : "text-muted hover:text-foreground hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────

export default function ConfiguracionAdminClient({
  clients,
  logs,
}: {
  clients: Client[];
  logs: SyncLog[];
}) {
  const [tab, setTab] = useState<"integraciones" | "logs" | "cuenta">("integraciones");
  const [isPending, startTransition] = useTransition();

  // Password form
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: "error", msg: "Las contraseñas no coinciden." });
      return;
    }
    setPasswordStatus(null);
    startTransition(async () => {
      const result = await changePasswordAction(newPassword);
      if ("error" in result && result.error) {
        setPasswordStatus({ type: "error", msg: result.error });
      } else {
        setPasswordStatus({ type: "success", msg: "Contraseña actualizada correctamente." });
        setNewPassword("");
        setConfirmPassword("");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Tab nav */}
      <div className="flex items-center gap-1 bg-surface border border-border rounded-xl p-1 w-fit">
        <TabButton active={tab === "integraciones"} onClick={() => setTab("integraciones")}>
          Integraciones
        </TabButton>
        <TabButton active={tab === "logs"} onClick={() => setTab("logs")}>
          Logs de sincronización
        </TabButton>
        <TabButton active={tab === "cuenta"} onClick={() => setTab("cuenta")}>
          Mi cuenta
        </TabButton>
      </div>

      {/* ── Tab: Integraciones ── */}
      {tab === "integraciones" && (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-foreground">
                Estado de integraciones
              </h2>
              <p className="text-xs font-sans text-muted mt-0.5">
                Integraciones activas por cliente. Haz clic en "Configurar" para editar.
              </p>
            </div>
          </div>

          {clients.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-muted text-sm font-sans">Sin clientes activos.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-sans">
                <thead>
                  <tr className="border-b border-border">
                    <Th align="left">Cliente</Th>
                    <Th>GHL</Th>
                    <Th>Meta Ads</Th>
                    <Th>GSC</Th>
                    <Th>TrueRanker</Th>
                    <Th align="right">Acción</Th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client, i) => (
                    <tr
                      key={client.id}
                      className={`border-b border-border/50 hover:bg-white/[0.02] transition-colors ${
                        i === clients.length - 1 ? "border-b-0" : ""
                      }`}
                    >
                      <td className="px-6 py-4 text-foreground font-medium whitespace-nowrap">
                        {client.name}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <IntegrationBadge
                          active={!!(client.ghl_api_key && client.ghl_location_id)}
                          label="GHL"
                        />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <IntegrationBadge
                          active={!!client.meta_ad_account_id}
                          label="Meta"
                        />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <IntegrationBadge
                          active={!!client.gsc_property_url}
                          label="GSC"
                        />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <IntegrationBadge
                          active={!!client.trueranker_project_id}
                          label="TR"
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/dashboard/clientes?configure=${client.id}`}
                          className="text-xs font-sans text-accent hover:text-accent-dim transition-colors"
                        >
                          Configurar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Logs ── */}
      {tab === "logs" && (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-border">
            <h2 className="font-display text-base font-semibold text-foreground">
              Logs de sincronización
            </h2>
            <p className="text-xs font-sans text-muted mt-0.5">
              Últimas 50 operaciones de sincronización.
            </p>
          </div>

          {logs.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-muted text-sm font-sans">Sin logs aún. Las sincronizaciones aparecerán aquí.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-sans">
                <thead>
                  <tr className="border-b border-border">
                    <Th align="left">Fecha</Th>
                    <Th align="left">Cliente</Th>
                    <Th>Tipo</Th>
                    <Th>Estado</Th>
                    <Th align="left">Mensaje</Th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr
                      key={log.id}
                      className={`border-b border-border/50 hover:bg-white/[0.02] transition-colors ${
                        i === logs.length - 1 ? "border-b-0" : ""
                      }`}
                    >
                      <td className="px-6 py-3.5 text-muted whitespace-nowrap">
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="px-6 py-3.5 text-foreground font-medium whitespace-nowrap">
                        {log.clients?.name ?? "—"}
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <span className="inline-block text-xs font-mono font-medium text-muted bg-white/5 border border-border rounded px-2 py-0.5 uppercase">
                          {log.tipo}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-sans px-2 py-0.5 rounded-full border ${
                            log.status === "success"
                              ? "text-accent bg-accent/10 border-accent/20"
                              : "text-red-400 bg-red-500/10 border-red-500/20"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              log.status === "success" ? "bg-accent" : "bg-red-400"
                            }`}
                          />
                          {log.status === "success" ? "OK" : "Error"}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-muted text-xs max-w-xs truncate">
                        {log.mensaje}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Mi cuenta ── */}
      {tab === "cuenta" && (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-border">
            <h2 className="font-display text-base font-semibold text-foreground">Mi cuenta</h2>
            <p className="text-xs font-sans text-muted mt-0.5">Cambia tu contraseña de acceso.</p>
          </div>
          <div className="px-6 py-6">
            <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-sm">
              <div>
                <label className="block text-xs font-sans font-medium text-muted mb-1.5 uppercase tracking-wider">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className={`${inputCls} pr-10`}
                  />
                  <EyeToggle show={showNew} onToggle={() => setShowNew((v) => !v)} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-sans font-medium text-muted mb-1.5 uppercase tracking-wider">
                  Confirmar contraseña
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite la contraseña"
                    className={`${inputCls} pr-10`}
                  />
                  <EyeToggle show={showConfirm} onToggle={() => setShowConfirm((v) => !v)} />
                </div>
              </div>
              {passwordStatus && <StatusBanner status={passwordStatus} />}
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-2 bg-accent text-background font-display font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed accent-glow-sm"
              >
                {isPending ? "Guardando…" : "Cambiar contraseña"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function EyeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      tabIndex={-1}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
    >
      {show ? (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      ) : (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}

function Th({
  children,
  align = "center",
}: {
  children: React.ReactNode;
  align?: "left" | "center" | "right";
}) {
  const alignClass =
    align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center";
  return (
    <th className={`px-6 py-3.5 text-xs font-sans font-medium text-muted uppercase tracking-wider ${alignClass}`}>
      {children}
    </th>
  );
}

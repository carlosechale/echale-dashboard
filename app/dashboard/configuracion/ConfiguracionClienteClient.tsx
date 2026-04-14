"use client";

import { useState, useTransition } from "react";
import { changePasswordAction, updateObjetivoLeadsAction } from "./actions";

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

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden">
      <div className="px-6 py-5 border-b border-border">
        <h2 className="font-display text-base font-semibold text-foreground">{title}</h2>
      </div>
      <div className="px-6 py-6">{children}</div>
    </div>
  );
}

export default function ConfiguracionClienteClient({
  objetivoLeads,
}: {
  objetivoLeads: number;
}) {
  const [isPending, startTransition] = useTransition();

  // Password form
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Objetivo leads form
  const [objetivo, setObjetivo] = useState(String(objetivoLeads || ""));
  const [objetivoStatus, setObjetivoStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

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

  function handleObjetivoSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = parseInt(objetivo, 10);
    if (isNaN(val) || val < 0) {
      setObjetivoStatus({ type: "error", msg: "Introduce un número válido." });
      return;
    }
    setObjetivoStatus(null);
    startTransition(async () => {
      const result = await updateObjetivoLeadsAction(val);
      if ("error" in result && result.error) {
        setObjetivoStatus({ type: "error", msg: result.error });
      } else {
        setObjetivoStatus({ type: "success", msg: "Objetivo actualizado." });
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Objetivo mensual */}
      <SectionCard title="Objetivo mensual de leads">
        <form onSubmit={handleObjetivoSubmit} className="space-y-4 max-w-sm">
          <p className="text-sm font-sans text-muted">
            Define cuántos leads quieres conseguir cada mes. Aparecerá como barra de progreso en tu panel.
          </p>
          <div>
            <label className="block text-xs font-sans font-medium text-muted mb-1.5 uppercase tracking-wider">
              Objetivo de leads / mes
            </label>
            <input
              type="number"
              min="0"
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
              placeholder="ej. 50"
              className={inputCls}
            />
          </div>
          {objetivoStatus && <StatusBanner status={objetivoStatus} />}
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 bg-accent text-background font-display font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed accent-glow-sm"
          >
            {isPending ? "Guardando…" : "Guardar objetivo"}
          </button>
        </form>
      </SectionCard>

      {/* Cambiar contraseña */}
      <SectionCard title="Mi cuenta">
        <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-sm">
          <p className="text-sm font-sans text-muted">Cambia tu contraseña de acceso.</p>
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
      </SectionCard>
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

"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Client } from "@/types";
import { createClientAction, toggleClientActive } from "./actions";

// ── Helpers ──────────────────────────────────────────────────

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Types ─────────────────────────────────────────────────────

interface FormState {
  name: string;
  slug: string;
  email: string;
  password: string;
}

const EMPTY: FormState = { name: "", slug: "", email: "", password: "" };

// ── Component ─────────────────────────────────────────────────

export default function ClientesClient({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [slugManual, setSlugManual] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Auto-generate slug from name unless the user has edited it manually
  useEffect(() => {
    if (!slugManual) {
      setForm((prev) => ({ ...prev, slug: toSlug(prev.name) }));
    }
  }, [form.name, slugManual]);

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function openModal() {
    setForm(EMPTY);
    setSlugManual(false);
    setStatus(null);
    setShowModal(true);
    setShowPassword(false);
  }

  function closeModal() {
    if (isPending) return;
    setShowModal(false);
    setStatus(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.slug || !form.email || !form.password) {
      setStatus({ type: "error", msg: "Todos los campos son obligatorios." });
      return;
    }
    setStatus(null);

    startTransition(async () => {
      const result = await createClientAction({
        name: form.name,
        slug: form.slug,
        email: form.email,
        password: form.password,
      });

      if ("error" in result && result.error) {
        setStatus({ type: "error", msg: result.error });
      } else {
        setShowModal(false);
        router.refresh();
      }
    });
  }

  function handleToggle(client: Client) {
    setTogglingId(client.id);
    startTransition(async () => {
      await toggleClientActive(client.id, !client.active);
      setTogglingId(null);
      router.refresh();
    });
  }

  return (
    <>
      {/* ── Table card ── */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-base font-semibold text-foreground">
              Todos los clientes
            </h2>
            <span className="text-xs font-sans text-muted bg-white/5 border border-border rounded-full px-2.5 py-0.5">
              {clients.length}
            </span>
          </div>

          <button
            onClick={openModal}
            className="inline-flex items-center gap-2 bg-accent text-background font-display font-semibold text-sm px-4 py-2 rounded-lg hover:bg-accent-dim transition-colors accent-glow-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nuevo cliente
          </button>
        </div>

        {clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <p className="text-muted text-sm font-sans">Sin clientes aún.</p>
            <p className="text-muted/50 text-xs font-sans">
              Pulsa "Nuevo cliente" para empezar.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="border-b border-border">
                  <Th align="left">Nombre</Th>
                  <Th align="left">Slug</Th>
                  <Th>Estado</Th>
                  <Th>Alta</Th>
                  <Th align="right">Acciones</Th>
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <code className="text-xs font-mono text-muted bg-white/5 border border-border rounded px-1.5 py-0.5">
                        {client.slug}
                      </code>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-sans font-medium px-2.5 py-1 rounded-full border ${
                          client.active
                            ? "text-accent bg-accent/10 border-accent/20"
                            : "text-muted bg-white/5 border-border"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            client.active ? "bg-accent" : "bg-muted"
                          }`}
                        />
                        {client.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-muted whitespace-nowrap">
                      {formatDate(client.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleToggle(client)}
                        disabled={isPending && togglingId === client.id}
                        className="text-xs font-sans text-muted hover:text-foreground transition-colors disabled:opacity-40"
                      >
                        {togglingId === client.id
                          ? "Guardando…"
                          : client.active
                          ? "Desactivar"
                          : "Activar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl">
            {/* Modal header */}
            <div className="px-6 py-5 border-b border-border flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-foreground">
                Nuevo cliente
              </h2>
              <button
                onClick={closeModal}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
              {/* Name */}
              <div>
                <FieldLabel>Nombre del cliente</FieldLabel>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="ej. Clínica Dental Madrid"
                  autoFocus
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm font-sans text-foreground placeholder:text-muted/40 focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              {/* Slug */}
              <div>
                <FieldLabel>Slug</FieldLabel>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugManual(true);
                    set("slug", e.target.value);
                  }}
                  placeholder="clinica-dental-madrid"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-muted/40 focus:outline-none focus:border-accent transition-colors"
                />
                <p className="text-xs font-sans text-muted/60 mt-1.5">
                  Se genera automáticamente. Puedes editarlo manualmente.
                </p>
              </div>

              <div className="border-t border-border pt-5 space-y-4">
                <p className="text-xs font-sans font-semibold text-muted uppercase tracking-widest">
                  Acceso del cliente
                </p>

                {/* Email */}
                <div>
                  <FieldLabel>Email</FieldLabel>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="cliente@ejemplo.com"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm font-sans text-foreground placeholder:text-muted/40 focus:outline-none focus:border-accent transition-colors"
                  />
                </div>

                {/* Password */}
                <div>
                  <FieldLabel>Contraseña</FieldLabel>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(e) => set("password", e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      className="w-full bg-background border border-border rounded-lg px-3 py-2.5 pr-10 text-sm font-sans text-foreground placeholder:text-muted/40 focus:outline-none focus:border-accent transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <IconEyeOff /> : <IconEye />}
                    </button>
                  </div>
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

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isPending}
                  className="text-sm font-sans text-muted hover:text-foreground transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-2 bg-accent text-background font-display font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed accent-glow-sm"
                >
                  {isPending ? "Creando…" : "Crear cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ── Primitives ────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-sans font-medium text-muted mb-1.5 uppercase tracking-wider">
      {children}
    </label>
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

function IconEye() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

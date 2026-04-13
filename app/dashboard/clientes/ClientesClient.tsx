"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Client } from "@/types";
import { createClientAction, updateClientAction, toggleClientActive } from "./actions";

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

interface CreateForm {
  name: string;
  slug: string;
  email: string;
  password: string;
  ghl_api_key: string;
  ghl_location_id: string;
}

interface EditForm {
  name: string;
  slug: string;
  ghl_api_key: string;
  ghl_location_id: string;
  gsc_property_url: string;
}

const EMPTY_CREATE: CreateForm = {
  name: "", slug: "", email: "", password: "", ghl_api_key: "", ghl_location_id: "",
};

// ── Component ─────────────────────────────────────────────────

export default function ClientesClient({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE);
  const [slugManual, setSlugManual] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showCreateApiKey, setShowCreateApiKey] = useState(false);
  const [createStatus, setCreateStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Edit modal
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: "", slug: "", ghl_api_key: "", ghl_location_id: "", gsc_property_url: "" });
  const [editSlugManual, setEditSlugManual] = useState(false);
  const [showEditApiKey, setShowEditApiKey] = useState(false);
  const [editStatus, setEditStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Toggle
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // ── Auto-slug for create ──
  useEffect(() => {
    if (!slugManual) {
      setCreateForm((prev) => ({ ...prev, slug: toSlug(prev.name) }));
    }
  }, [createForm.name, slugManual]);

  // ── Auto-slug for edit ──
  useEffect(() => {
    if (!editSlugManual && editingClient) {
      setEditForm((prev) => ({ ...prev, slug: toSlug(prev.name) }));
    }
  }, [editForm.name, editSlugManual, editingClient]);

  // ── Create ──
  function openCreate() {
    setCreateForm(EMPTY_CREATE);
    setSlugManual(false);
    setShowPassword(false);
    setShowCreateApiKey(false);
    setCreateStatus(null);
    setShowCreate(true);
  }

  function closeCreate() {
    if (isPending) return;
    setShowCreate(false);
    setCreateStatus(null);
  }

  function setC(field: keyof CreateForm, value: string) {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createForm.name || !createForm.slug || !createForm.email || !createForm.password) {
      setCreateStatus({ type: "error", msg: "Nombre, slug, email y contraseña son obligatorios." });
      return;
    }
    setCreateStatus(null);
    startTransition(async () => {
      const result = await createClientAction(createForm);
      if ("error" in result && result.error) {
        setCreateStatus({ type: "error", msg: result.error });
      } else {
        setShowCreate(false);
        router.refresh();
      }
    });
  }

  // ── Edit ──
  function openEdit(client: Client) {
    setEditingClient(client);
    setEditForm({
      name: client.name,
      slug: client.slug,
      ghl_api_key: client.ghl_api_key ?? "",
      ghl_location_id: client.ghl_location_id ?? "",
      gsc_property_url: client.gsc_property_url ?? "",
    });
    setEditSlugManual(true); // don't auto-overwrite existing slug on open
    setShowEditApiKey(false);
    setEditStatus(null);
  }

  function closeEdit() {
    if (isPending) return;
    setEditingClient(null);
    setEditStatus(null);
  }

  function setE(field: keyof EditForm, value: string) {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editForm.name || !editForm.slug || !editingClient) {
      setEditStatus({ type: "error", msg: "Nombre y slug son obligatorios." });
      return;
    }
    setEditStatus(null);
    startTransition(async () => {
      const result = await updateClientAction({ id: editingClient.id, ...editForm });
      if ("error" in result && result.error) {
        setEditStatus({ type: "error", msg: result.error });
      } else {
        setEditingClient(null);
        router.refresh();
      }
    });
  }

  // ── Toggle ──
  function handleToggle(client: Client) {
    setTogglingId(client.id);
    startTransition(async () => {
      await toggleClientActive(client.id, !client.active);
      setTogglingId(null);
      router.refresh();
    });
  }

  // ── Render ──
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
            onClick={openCreate}
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
                  <Th>GHL</Th>
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
                      {client.ghl_api_key && client.ghl_location_id ? (
                        <span className="inline-flex items-center gap-1 text-xs font-sans text-accent">
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Configurado
                        </span>
                      ) : (
                        <span className="text-xs font-sans text-muted/50">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-sans font-medium px-2.5 py-1 rounded-full border ${
                          client.active
                            ? "text-accent bg-accent/10 border-accent/20"
                            : "text-muted bg-white/5 border-border"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${client.active ? "bg-accent" : "bg-muted"}`} />
                        {client.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-muted whitespace-nowrap">
                      {formatDate(client.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-3">
                        <Link
                          href={`/dashboard/clientes/${client.id}`}
                          className="text-xs font-sans text-accent hover:text-accent-dim transition-colors"
                        >
                          Ver detalle
                        </Link>
                        <span className="text-border text-xs">|</span>
                        <button
                          onClick={() => openEdit(client)}
                          className="text-xs font-sans text-muted hover:text-foreground transition-colors"
                        >
                          Editar
                        </button>
                        <span className="text-border text-xs">|</span>
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create Modal ── */}
      {showCreate && (
        <Modal onClose={closeCreate}>
          <ModalHeader title="Nuevo cliente" onClose={closeCreate} />
          <form onSubmit={handleCreate} className="px-6 py-6 space-y-5">
            <div>
              <FieldLabel>Nombre del cliente</FieldLabel>
              <input
                type="text"
                value={createForm.name}
                onChange={(e) => setC("name", e.target.value)}
                placeholder="ej. Clínica Dental Madrid"
                autoFocus
                className={inputCls}
              />
            </div>

            <div>
              <FieldLabel>Slug</FieldLabel>
              <input
                type="text"
                value={createForm.slug}
                onChange={(e) => { setSlugManual(true); setC("slug", e.target.value); }}
                placeholder="clinica-dental-madrid"
                className={`${inputCls} font-mono`}
              />
              <p className="text-xs font-sans text-muted/60 mt-1.5">
                Se genera automáticamente. Puedes editarlo manualmente.
              </p>
            </div>

            {/* GHL credentials */}
            <GhlSection
              apiKey={createForm.ghl_api_key}
              locationId={createForm.ghl_location_id}
              showApiKey={showCreateApiKey}
              onToggleShow={() => setShowCreateApiKey((v) => !v)}
              onChangeApiKey={(v) => setC("ghl_api_key", v)}
              onChangeLocationId={(v) => setC("ghl_location_id", v)}
            />

            <div className="border-t border-border pt-5 space-y-4">
              <p className="text-xs font-sans font-semibold text-muted uppercase tracking-widest">
                Acceso del cliente
              </p>
              <div>
                <FieldLabel>Email</FieldLabel>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setC("email", e.target.value)}
                  placeholder="cliente@ejemplo.com"
                  className={inputCls}
                />
              </div>
              <div>
                <FieldLabel>Contraseña</FieldLabel>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={createForm.password}
                    onChange={(e) => setC("password", e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className={`${inputCls} pr-10`}
                  />
                  <EyeToggle show={showPassword} onToggle={() => setShowPassword((v) => !v)} />
                </div>
              </div>
            </div>

            {createStatus && <StatusBanner status={createStatus} />}

            <ModalActions
              isPending={isPending}
              onCancel={closeCreate}
              submitLabel="Crear cliente"
              pendingLabel="Creando…"
            />
          </form>
        </Modal>
      )}

      {/* ── Edit Modal ── */}
      {editingClient && (
        <Modal onClose={closeEdit}>
          <ModalHeader title={`Editar · ${editingClient.name}`} onClose={closeEdit} />
          <form onSubmit={handleEdit} className="px-6 py-6 space-y-5">
            <div>
              <FieldLabel>Nombre del cliente</FieldLabel>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => { setEditSlugManual(false); setE("name", e.target.value); }}
                autoFocus
                className={inputCls}
              />
            </div>

            <div>
              <FieldLabel>Slug</FieldLabel>
              <input
                type="text"
                value={editForm.slug}
                onChange={(e) => { setEditSlugManual(true); setE("slug", e.target.value); }}
                className={`${inputCls} font-mono`}
              />
            </div>

            {/* GHL credentials */}
            <GhlSection
              apiKey={editForm.ghl_api_key}
              locationId={editForm.ghl_location_id}
              showApiKey={showEditApiKey}
              onToggleShow={() => setShowEditApiKey((v) => !v)}
              onChangeApiKey={(v) => setE("ghl_api_key", v)}
              onChangeLocationId={(v) => setE("ghl_location_id", v)}
            />

            {/* GSC */}
            <div className="border-t border-border pt-5 space-y-4">
              <p className="text-xs font-sans font-semibold text-muted uppercase tracking-widest">
                Google Search Console
              </p>
              <div>
                <FieldLabel>URL de la propiedad</FieldLabel>
                <input
                  type="url"
                  value={editForm.gsc_property_url}
                  onChange={(e) => setE("gsc_property_url", e.target.value)}
                  placeholder="https://ejemplo.com/"
                  className={inputCls}
                />
                <p className="text-xs font-sans text-muted/60 mt-1.5">
                  Debe coincidir exactamente con la propiedad en GSC (incluye la barra final).
                </p>
              </div>
            </div>

            {editStatus && <StatusBanner status={editStatus} />}

            <ModalActions
              isPending={isPending}
              onCancel={closeEdit}
              submitLabel="Guardar cambios"
              pendingLabel="Guardando…"
            />
          </form>
        </Modal>
      )}
    </>
  );
}

// ── Shared sub-components ─────────────────────────────────────

function GhlSection({
  apiKey,
  locationId,
  showApiKey,
  onToggleShow,
  onChangeApiKey,
  onChangeLocationId,
}: {
  apiKey: string;
  locationId: string;
  showApiKey: boolean;
  onToggleShow: () => void;
  onChangeApiKey: (v: string) => void;
  onChangeLocationId: (v: string) => void;
}) {
  return (
    <div className="border-t border-border pt-5 space-y-4">
      <p className="text-xs font-sans font-semibold text-muted uppercase tracking-widest">
        GoHighLevel
      </p>
      <div>
        <FieldLabel>GHL API Key</FieldLabel>
        <div className="relative">
          <input
            type={showApiKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => onChangeApiKey(e.target.value)}
            placeholder="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9…"
            className={`${inputCls} pr-10 font-mono text-xs`}
          />
          <EyeToggle show={showApiKey} onToggle={onToggleShow} />
        </div>
      </div>
      <div>
        <FieldLabel>GHL Location ID</FieldLabel>
        <input
          type="text"
          value={locationId}
          onChange={(e) => onChangeLocationId(e.target.value)}
          placeholder="xxxxxxxxxxxxxxxxxxxxxxxx"
          className={`${inputCls} font-mono text-xs`}
        />
      </div>
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl my-auto">
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="px-6 py-5 border-b border-border flex items-center justify-between">
      <h2 className="font-display text-base font-semibold text-foreground">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

function ModalActions({
  isPending,
  onCancel,
  submitLabel,
  pendingLabel,
}: {
  isPending: boolean;
  onCancel: () => void;
  submitLabel: string;
  pendingLabel: string;
}) {
  return (
    <div className="flex items-center justify-end gap-3 pt-1">
      <button
        type="button"
        onClick={onCancel}
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
        {isPending ? pendingLabel : submitLabel}
      </button>
    </div>
  );
}

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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-sans font-medium text-muted mb-1.5 uppercase tracking-wider">
      {children}
    </label>
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

const inputCls =
  "w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm font-sans text-foreground placeholder:text-muted/40 focus:outline-none focus:border-accent transition-colors";

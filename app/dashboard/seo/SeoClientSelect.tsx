"use client";

import { useRouter } from "next/navigation";

interface ClientOption {
  id: string;
  name: string;
  hasGsc: boolean;
  hasTrueranker: boolean;
}

function clientLabel(c: ClientOption): string {
  const missing: string[] = [];
  if (!c.hasGsc)        missing.push("sin GSC");
  if (!c.hasTrueranker) missing.push("sin TR");
  return missing.length ? `${c.name} (${missing.join(" · ")})` : c.name;
}

export default function SeoClientSelect({
  clients,
  selectedId,
  days,
}: {
  clients: ClientOption[];
  selectedId: string;
  days: number;
}) {
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    const params = new URLSearchParams({ days: String(days) });
    if (id) params.set("client_id", id);
    router.push(`/dashboard/seo?${params}`);
  }

  return (
    <div className="flex items-center gap-3">
      <label className="text-xs font-sans font-medium text-muted uppercase tracking-wider whitespace-nowrap">
        Cliente
      </label>
      <select
        value={selectedId}
        onChange={handleChange}
        className="bg-surface border border-border rounded-lg px-3 py-2.5 text-sm font-sans text-foreground focus:outline-none focus:border-accent transition-colors min-w-56"
      >
        <option value="">Selecciona un cliente…</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {clientLabel(c)}
          </option>
        ))}
      </select>
    </div>
  );
}

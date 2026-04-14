import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MetricasClient from "./MetricasClient";

export const metadata: Metadata = {
  title: "Métricas — Échale",
};

export interface MetricRow {
  client_id: string;
  client_name: string;
  fecha: string;
  leads: number;
  agendados: number;
  presenciales: number;
  cerrados: number;
  gasto: number;
  cpl: number;
}

export interface SyncClientInfo {
  id: string;
  name: string;
  last_sync_at: string | null;
  has_ghl: boolean;
  has_meta: boolean;
}

export default async function MetricasPage() {
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

  // Fetch active clients (dropdown + sync status)
  const { data: clientsRaw } = await supabase
    .from("clients")
    .select("id, name, ghl_api_key, ghl_location_id, meta_ad_account_id, last_sync_at")
    .eq("active", true)
    .order("name");

  const clients = (clientsRaw ?? []).map((c) => ({ id: c.id, name: c.name }));

  const syncClients: SyncClientInfo[] = (clientsRaw ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    last_sync_at: c.last_sync_at ?? null,
    has_ghl: !!(c.ghl_api_key && c.ghl_location_id),
    has_meta: !!c.meta_ad_account_id,
  }));

  // Fetch last 10 GHL records (most recent first)
  const { data: ghlRows } = await supabase
    .from("metrics_ghl")
    .select("client_id, fecha, leads, agendados, presenciales, cerrados")
    .order("fecha", { ascending: false })
    .limit(10);

  // Fetch Meta rows for the same client+fecha combinations
  const keys = (ghlRows ?? []).map((r) => r.fecha);
  const { data: metaRows } = await supabase
    .from("metrics_meta")
    .select("client_id, fecha, gasto, cpl")
    .in("fecha", keys.length ? keys : ["__none__"]);

  const clientMap = Object.fromEntries(
    (clients ?? []).map((c) => [c.id, c.name])
  );

  const metaByKey: Record<string, { gasto: number; cpl: number }> = {};
  for (const row of metaRows ?? []) {
    metaByKey[`${row.client_id}_${row.fecha}`] = {
      gasto: row.gasto ?? 0,
      cpl: row.cpl ?? 0,
    };
  }

  const rows: MetricRow[] = (ghlRows ?? []).map((row) => {
    const meta = metaByKey[`${row.client_id}_${row.fecha}`] ?? {
      gasto: 0,
      cpl: 0,
    };
    return {
      client_id: row.client_id,
      client_name: clientMap[row.client_id] ?? "—",
      fecha: row.fecha,
      leads: row.leads ?? 0,
      agendados: row.agendados ?? 0,
      presenciales: row.presenciales ?? 0,
      cerrados: row.cerrados ?? 0,
      gasto: meta.gasto,
      cpl: meta.cpl,
    };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">
          Métricas
        </h1>
        <p className="mt-1 text-muted text-sm font-sans">
          Entrada manual de métricas por cliente y mes.
        </p>
      </div>

      <MetricasClient clients={clients} initialRows={rows} syncClients={syncClients} />
    </div>
  );
}

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

  // Fetch active clients for the dropdown
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .eq("active", true)
    .order("name");

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

      <MetricasClient clients={clients ?? []} initialRows={rows} />
    </div>
  );
}

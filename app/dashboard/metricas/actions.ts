"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface UpsertPayload {
  client_id: string;
  fecha: string; // "YYYY-MM-01"
  leads: number;
  agendados: number;
  presenciales: number;
  cerrados: number;
  gasto: number;
  cpl: number;
}

export async function upsertMetrics(data: UpsertPayload) {
  const supabase = await createClient();

  const { client_id, fecha, leads, agendados, presenciales, cerrados, gasto, cpl } = data;

  const [ghlResult, metaResult] = await Promise.all([
    supabase
      .from("metrics_ghl")
      .upsert(
        { client_id, fecha, leads, agendados, presenciales, cerrados },
        { onConflict: "client_id,fecha" }
      ),
    supabase
      .from("metrics_meta")
      .upsert(
        { client_id, fecha, gasto, cpl },
        { onConflict: "client_id,fecha" }
      ),
  ]);

  if (ghlResult.error) return { error: ghlResult.error.message };
  if (metaResult.error) return { error: metaResult.error.message };

  revalidatePath("/dashboard/metricas");
  return { success: true as const };
}

export async function deleteMetrics(client_id: string, fecha: string) {
  const supabase = await createClient();

  await Promise.all([
    supabase.from("metrics_ghl").delete().eq("client_id", client_id).eq("fecha", fecha),
    supabase.from("metrics_meta").delete().eq("client_id", client_id).eq("fecha", fecha),
  ]);

  revalidatePath("/dashboard/metricas");
  return { success: true as const };
}

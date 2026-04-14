import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getContacts, getOpportunities } from "@/lib/ghl";
import { getMetaAdsData } from "@/lib/meta";

export async function POST(request: NextRequest) {
  // 1 — Auth: verify CRON_SECRET in Authorization header
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // 2 — Fetch all active clients that have GHL or Meta credentials
  const { data: clients, error: clientsError } = await supabase
    .from("clients")
    .select("id, name, ghl_api_key, ghl_location_id, meta_ad_account_id")
    .eq("active", true)
    .or("ghl_api_key.not.is.null,meta_ad_account_id.not.is.null");

  if (clientsError) {
    return NextResponse.json({ error: clientsError.message }, { status: 500 });
  }

  const accessToken = process.env.META_ACCESS_TOKEN;

  // 3 — Build current-month date range
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const fecha = `${year}-${month}-01`;

  const lastDay = new Date(year, now.getMonth() + 1, 0);
  const lastDayStr = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;
  const ghlStartDate = `${fecha}T00:00:00Z`;
  const ghlEndDate = `${lastDayStr}T23:59:59Z`;

  // 4 — Process all clients in parallel
  const syncErrors: { client: string; service: string; error: string }[] = [];
  let syncedCount = 0;

  await Promise.all(
    (clients ?? []).map(async (client) => {
      let syncedSomething = false;

      // GHL sync
      if (client.ghl_api_key && client.ghl_location_id) {
        try {
          const [leads, opps] = await Promise.all([
            getContacts(client.ghl_api_key, client.ghl_location_id, ghlStartDate, ghlEndDate),
            getOpportunities(client.ghl_api_key, client.ghl_location_id),
          ]);

          const { error } = await supabase
            .from("metrics_ghl")
            .upsert(
              {
                client_id: client.id,
                fecha,
                leads,
                agendados:        opps.agendados,
                presenciales:     opps.presenciales,
                cerrados:         opps.cerrados,
                facturacion_real: opps.facturacionReal,
              },
              { onConflict: "client_id,fecha" }
            );

          if (error) {
            syncErrors.push({ client: client.name, service: "GHL", error: error.message });
            await supabase.from("sync_logs").insert({
              client_id: client.id, tipo: "ghl", status: "error", mensaje: error.message,
            });
          } else {
            syncedSomething = true;
            await supabase.from("sync_logs").insert({
              client_id: client.id,
              tipo: "ghl",
              status: "success",
              mensaje: `Leads: ${leads} · Agendados: ${opps.agendados} · Cerrados: ${opps.cerrados} · Facturación: €${opps.facturacionReal}`,
            });
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Error desconocido";
          syncErrors.push({ client: client.name, service: "GHL", error: errMsg });
          await supabase.from("sync_logs").insert({
            client_id: client.id, tipo: "ghl", status: "error", mensaje: errMsg,
          });
        }
      }

      // Meta sync
      if (client.meta_ad_account_id && accessToken) {
        try {
          const metaData = await getMetaAdsData(
            client.meta_ad_account_id,
            accessToken,
            fecha,
            lastDayStr
          );

          const { error } = await supabase
            .from("metrics_meta")
            .upsert(
              {
                client_id: client.id,
                fecha,
                gasto: metaData.spend,
                cpl: metaData.cpl,
              },
              { onConflict: "client_id,fecha" }
            );

          if (error) {
            syncErrors.push({ client: client.name, service: "Meta", error: error.message });
            await supabase.from("sync_logs").insert({
              client_id: client.id, tipo: "meta", status: "error", mensaje: error.message,
            });
          } else {
            syncedSomething = true;
            await supabase.from("sync_logs").insert({
              client_id: client.id,
              tipo: "meta",
              status: "success",
              mensaje: `Gasto: €${metaData.spend.toFixed(2)} · Leads: ${metaData.leads} · CPL: €${metaData.cpl.toFixed(2)}`,
            });
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Error desconocido";
          syncErrors.push({ client: client.name, service: "Meta", error: errMsg });
          await supabase.from("sync_logs").insert({
            client_id: client.id, tipo: "meta", status: "error", mensaje: errMsg,
          });
        }
      }

      // Update last_sync_at on any successful sync
      if (syncedSomething) {
        syncedCount++;
        await supabase
          .from("clients")
          .update({ last_sync_at: new Date().toISOString() })
          .eq("id", client.id);
      }
    })
  );

  return NextResponse.json({
    success: true,
    fecha,
    synced: syncedCount,
    total: (clients ?? []).length,
    errors: syncErrors,
  });
}

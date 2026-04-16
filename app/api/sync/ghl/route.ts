import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getContacts, getOpportunities } from "@/lib/ghl";

export async function POST(request: NextRequest) {
  // 1 — Auth: only admins can trigger syncs
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const adminSupabase = createAdminClient();

  // 2 — Parse body
  const body = await request.json().catch(() => ({}));
  const { client_id } = body as { client_id?: string };
  if (!client_id) {
    return NextResponse.json({ error: "client_id requerido" }, { status: 400 });
  }

  // 3 — Load client credentials
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("name, ghl_api_key, ghl_location_id")
    .eq("id", client_id)
    .single();

  if (clientError || !client) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  if (!client.ghl_api_key || !client.ghl_location_id) {
    return NextResponse.json(
      { error: "El cliente no tiene credenciales GHL configuradas" },
      { status: 422 }
    );
  }

  // 4 — Current-month date range
  const now = new Date();
  const year  = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const fecha = `${year}-${month}-01`;

  // Last moment of the current month
  const lastDay = new Date(year, now.getMonth() + 1, 0);
  const endDate = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}T23:59:59Z`;
  const startDate = `${fecha}T00:00:00Z`;

  // 5 — Call GHL API
  let leads: number;
  let opps: { agendados: number; presenciales: number; cerrados: number; facturacionReal: number };

  try {
    [leads, opps] = await Promise.all([
      getContacts(client.ghl_api_key, client.ghl_location_id, startDate, endDate),
      getOpportunities(client.ghl_api_key, client.ghl_location_id),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al conectar con GHL";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // 6 — Upsert into metrics_ghl
  const { error: upsertError } = await adminSupabase
    .from("metrics_ghl")
    .upsert(
      {
        client_id,
        fecha,
        leads,
        agendados:       opps.agendados,
        presenciales:    opps.presenciales,
        cerrados:        opps.cerrados,
        facturacion_real: opps.facturacionReal,
      },
      { onConflict: "client_id,fecha" }
    );

  if (upsertError) {
    await adminSupabase.from("sync_logs").insert({
      client_id,
      tipo: "ghl",
      status: "error",
      mensaje: upsertError.message,
    });
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  await adminSupabase.from("sync_logs").insert({
    client_id,
    tipo: "ghl",
    status: "success",
    mensaje: `Leads: ${leads} · Agendados: ${opps.agendados} · Cerrados: ${opps.cerrados} · Facturación: €${opps.facturacionReal}`,
  });

  return NextResponse.json({
    success: true,
    client: client.name,
    fecha,
    leads,
    agendados:        opps.agendados,
    presenciales:     opps.presenciales,
    cerrados:         opps.cerrados,
    facturacion_real: opps.facturacionReal,
  });
}

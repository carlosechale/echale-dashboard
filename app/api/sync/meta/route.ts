import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMetaAdsData } from "@/lib/meta";

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
    .select("name, meta_ad_account_id")
    .eq("id", client_id)
    .single();

  if (clientError || !client) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  if (!client.meta_ad_account_id) {
    return NextResponse.json(
      { error: "El cliente no tiene Meta Ad Account ID configurado" },
      { status: 422 }
    );
  }

  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json(
      { error: "META_ACCESS_TOKEN no configurado en el servidor" },
      { status: 500 }
    );
  }

  // 4 — Current-month date range
  const now = new Date();
  const year  = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const fecha = `${year}-${month}-01`;

  const lastDay = new Date(year, now.getMonth() + 1, 0);
  const startDate = fecha;
  const endDate = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;

  // 5 — Call Meta API
  let metaData: { spend: number; leads: number; cpl: number };

  try {
    metaData = await getMetaAdsData(
      client.meta_ad_account_id,
      accessToken,
      startDate,
      endDate
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al conectar con Meta";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // 6 — Upsert into metrics_meta
  const { error: upsertError } = await supabase
    .from("metrics_meta")
    .upsert(
      {
        client_id,
        fecha,
        gasto: metaData.spend,
        cpl: metaData.cpl,
      },
      { onConflict: "client_id,fecha" }
    );

  if (upsertError) {
    await adminSupabase.from("sync_logs").insert({
      client_id,
      tipo: "meta",
      status: "error",
      mensaje: upsertError.message,
    });
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  await adminSupabase.from("sync_logs").insert({
    client_id,
    tipo: "meta",
    status: "success",
    mensaje: `Gasto: €${metaData.spend.toFixed(2)} · Leads: ${metaData.leads} · CPL: €${metaData.cpl.toFixed(2)}`,
  });

  return NextResponse.json({
    success: true,
    client: client.name,
    fecha,
    spend: metaData.spend,
    leads: metaData.leads,
    cpl: metaData.cpl,
  });
}

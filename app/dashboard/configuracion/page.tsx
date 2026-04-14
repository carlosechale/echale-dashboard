import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Client } from "@/types";
import ConfiguracionAdminClient from "./ConfiguracionAdminClient";
import ConfiguracionClienteClient from "./ConfiguracionClienteClient";

export const metadata: Metadata = {
  title: "Configuración — Échale",
};

export default async function ConfiguracionPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, client_id")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "client";

  // ── Admin view ──────────────────────────────────────────────
  if (role === "admin") {
    const [{ data: clients }, { data: logs }] = await Promise.all([
      supabase
        .from("clients")
        .select("id, name, slug, active, created_at, ghl_api_key, ghl_location_id, gsc_property_url, meta_ad_account_id, trueranker_project_id, last_sync_at, objetivo_leads")
        .eq("active", true)
        .order("name", { ascending: true }),
      supabase
        .from("sync_logs")
        .select("id, client_id, tipo, status, mensaje, created_at, clients(name)")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    return (
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
            Configuración
          </h1>
          <p className="text-sm font-sans text-muted mt-1">
            Gestiona integraciones, revisa logs y actualiza tu cuenta.
          </p>
        </div>

        <ConfiguracionAdminClient
          clients={(clients as Client[]) ?? []}
          logs={((logs ?? []) as unknown as {
            id: string;
            client_id: string;
            tipo: string;
            status: string;
            mensaje: string;
            created_at: string;
            clients: { name: string } | null;
          }[])}
        />
      </div>
    );
  }

  // ── Client view ─────────────────────────────────────────────
  let objetivoLeads = 0;
  if (profile?.client_id) {
    const { data: clientData } = await supabase
      .from("clients")
      .select("objetivo_leads")
      .eq("id", profile.client_id)
      .single();
    objetivoLeads = clientData?.objetivo_leads ?? 0;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
          Configuración
        </h1>
        <p className="text-sm font-sans text-muted mt-1">
          Ajusta tus objetivos y gestiona tu cuenta.
        </p>
      </div>

      <ConfiguracionClienteClient objetivoLeads={objetivoLeads} />
    </div>
  );
}

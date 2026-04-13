import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Client } from "@/types";
import ClientesClient from "./ClientesClient";

export const metadata: Metadata = {
  title: "Clientes — Échale",
};

export default async function ClientesPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/dashboard");

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, slug, active, created_at, ghl_api_key, ghl_location_id, gsc_property_url")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
          Clientes
        </h1>
        <p className="text-sm font-sans text-muted mt-1">
          Gestiona los clientes de la agencia y sus accesos.
        </p>
      </div>

      <ClientesClient clients={(clients as Client[]) ?? []} />
    </div>
  );
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

// ── Auth guard ────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" as const, supabase: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { error: "Sin permisos" as const, supabase: null };

  return { error: null, supabase };
}

// ── Create ────────────────────────────────────────────────────

export interface CreateClientPayload {
  name: string;
  slug: string;
  email: string;
  password: string;
  ghl_api_key: string;
  ghl_location_id: string;
}

export async function createClientAction(data: CreateClientPayload) {
  const { error: authError, supabase } = await requireAdmin();
  if (authError || !supabase) return { error: authError ?? "Error de autenticación" };

  const { name, slug, email, password, ghl_api_key, ghl_location_id } = data;

  // Check slug uniqueness
  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .eq("slug", slug)
    .single();

  if (existing) return { error: "El slug ya está en uso. Elige otro." };

  // Create the client row
  const { data: newClient, error: clientError } = await supabase
    .from("clients")
    .insert({
      name,
      slug,
      active: true,
      ghl_api_key: ghl_api_key || null,
      ghl_location_id: ghl_location_id || null,
    })
    .select()
    .single();

  if (clientError) return { error: clientError.message };

  // Create the Supabase Auth user (no email confirmation required)
  const admin = createAdminClient();
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authErr) {
    await supabase.from("clients").delete().eq("id", newClient.id);
    return { error: authErr.message };
  }

  // Set role + client_id on the auto-created profile
  const { error: profileError } = await admin
    .from("profiles")
    .update({ role: "client", client_id: newClient.id })
    .eq("id", authData.user.id);

  if (profileError) {
    await admin.auth.admin.deleteUser(authData.user.id);
    await supabase.from("clients").delete().eq("id", newClient.id);
    return { error: profileError.message };
  }

  revalidatePath("/dashboard/clientes");
  return { success: true as const };
}

// ── Update ────────────────────────────────────────────────────

export interface UpdateClientPayload {
  id: string;
  name: string;
  slug: string;
  ghl_api_key: string;
  ghl_location_id: string;
  gsc_property_url: string;
  meta_ad_account_id: string;
  trueranker_project_id: string;
}

export async function updateClientAction(data: UpdateClientPayload) {
  const { error: authError, supabase } = await requireAdmin();
  if (authError || !supabase) return { error: authError ?? "Error de autenticación" };

  const {
    id, name, slug,
    ghl_api_key, ghl_location_id,
    gsc_property_url, meta_ad_account_id, trueranker_project_id,
  } = data;

  // Check slug uniqueness (excluding current client)
  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .eq("slug", slug)
    .neq("id", id)
    .single();

  if (existing) return { error: "El slug ya está en uso. Elige otro." };

  const { error } = await supabase
    .from("clients")
    .update({
      name,
      slug,
      ghl_api_key: ghl_api_key || null,
      ghl_location_id: ghl_location_id || null,
      gsc_property_url: gsc_property_url || null,
      meta_ad_account_id: meta_ad_account_id || null,
      trueranker_project_id: trueranker_project_id || null,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/clientes");
  return { success: true as const };
}

// ── Toggle active ─────────────────────────────────────────────

export async function toggleClientActive(clientId: string, active: boolean) {
  const { error: authError, supabase } = await requireAdmin();
  if (authError || !supabase) return { error: authError ?? "Error de autenticación" };

  const { error } = await supabase
    .from("clients")
    .update({ active })
    .eq("id", clientId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/clientes");
  return { success: true as const };
}

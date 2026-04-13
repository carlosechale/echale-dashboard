"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export interface CreateClientPayload {
  name: string;
  slug: string;
  email: string;
  password: string;
}

export async function createClientAction(data: CreateClientPayload) {
  const { name, slug, email, password } = data;

  // 1 — Verify the caller is an admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { error: "Sin permisos" };

  // 2 — Check slug uniqueness
  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .eq("slug", slug)
    .single();

  if (existing) return { error: "El slug ya está en uso. Elige otro." };

  // 3 — Create the client row
  const { data: newClient, error: clientError } = await supabase
    .from("clients")
    .insert({ name, slug, active: true })
    .select()
    .single();

  if (clientError) return { error: clientError.message };

  // 4 — Create the Supabase Auth user (service role, no email confirmation)
  const admin = createAdminClient();
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    // Roll back the client row
    await supabase.from("clients").delete().eq("id", newClient.id);
    return { error: authError.message };
  }

  // 5 — Update the auto-created profile with role + client_id
  const { error: profileError } = await admin
    .from("profiles")
    .update({ role: "client", client_id: newClient.id })
    .eq("id", authData.user.id);

  if (profileError) {
    // Roll back both
    await admin.auth.admin.deleteUser(authData.user.id);
    await supabase.from("clients").delete().eq("id", newClient.id);
    return { error: profileError.message };
  }

  revalidatePath("/dashboard/clientes");
  return { success: true as const };
}

export async function toggleClientActive(clientId: string, active: boolean) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { error: "Sin permisos" };

  const { error } = await supabase
    .from("clients")
    .update({ active })
    .eq("id", clientId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/clientes");
  return { success: true as const };
}

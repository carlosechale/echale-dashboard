"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ── Change password ───────────────────────────────────────────

export async function changePasswordAction(newPassword: string) {
  if (!newPassword || newPassword.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) return { error: error.message };
  return { success: true as const };
}

// ── Update objetivo leads (client only) ──────────────────────

export async function updateObjetivoLeadsAction(objetivo_leads: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, client_id")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "client" || !profile.client_id) {
    return { error: "Sin permisos" };
  }

  const { error } = await supabase
    .from("clients")
    .update({ objetivo_leads })
    .eq("id", profile.client_id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true as const };
}

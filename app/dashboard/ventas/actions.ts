"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type OutboundField = "llamadas" | "contactos" | "leads" | "agendas";

async function requireAdmin() {
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
  return supabase;
}

async function upsertOutboundField(
  field: OutboundField,
  delta: 1 | -1
): Promise<{ value?: number; error?: string }> {
  const supabase = await requireAdmin();
  const today = new Date().toISOString().split("T")[0];
  const col = `outbound_${field}`;

  const { data: existing } = await supabase
    .from("agency_sales_daily")
    .select(`id, ${col}`)
    .eq("fecha", today)
    .maybeSingle();

  if (existing) {
    const row = existing as unknown as Record<string, number>;
    const newVal = Math.max(0, (row[col] ?? 0) + delta);
    const { error } = await supabase
      .from("agency_sales_daily")
      .update({ [col]: newVal })
      .eq("fecha", today);
    if (error) return { error: error.message };
    return { value: newVal };
  } else {
    if (delta < 0) return { value: 0 };
    const { error } = await supabase
      .from("agency_sales_daily")
      .insert({ fecha: today, [col]: 1 });
    if (error) return { error: error.message };
    return { value: 1 };
  }
}

export async function incrementOutbound(
  field: OutboundField
): Promise<{ value?: number; error?: string }> {
  return upsertOutboundField(field, 1);
}

export async function decrementOutbound(
  field: OutboundField
): Promise<{ value?: number; error?: string }> {
  return upsertOutboundField(field, -1);
}

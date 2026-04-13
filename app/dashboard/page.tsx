import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminDashboard from "@/app/(admin)/AdminDashboard";
import ClientDashboard from "@/app/(client)/ClientDashboard";
import type { UserRole } from "@/types";

export const metadata: Metadata = {
  title: "Dashboard — Échale",
};

export default async function DashboardPage() {
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

  const role: UserRole = profile?.role ?? "client";

  return role === "admin"
    ? <AdminDashboard />
    : <ClientDashboard userId={user.id} />;
}

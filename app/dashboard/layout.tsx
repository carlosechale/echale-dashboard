import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/ui/Sidebar";
import ClientTopBar from "@/components/ui/ClientTopBar";
import type { UserRole } from "@/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, client_id")
    .eq("id", user.id)
    .single();

  const role: UserRole = profile?.role ?? "client";

  // For clients, fetch the clinic name to display in the topbar
  let clientName: string | null = null;
  if (role === "client" && profile?.client_id) {
    const { data: client } = await supabase
      .from("clients")
      .select("name")
      .eq("id", profile.client_id)
      .single();
    clientName = client?.name ?? null;
  }

  // ── Admin layout: fixed sidebar ──
  if (role === "admin") {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar role="admin" />
        <main className="flex-1 ml-64 p-8">{children}</main>
      </div>
    );
  }

  // ── Client layout: fixed topbar, no sidebar ──
  return (
    <div className="min-h-screen bg-background">
      <ClientTopBar clientName={clientName} />
      <main className="pt-16">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}

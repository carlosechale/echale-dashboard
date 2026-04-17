import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import OutboundClient from "./OutboundClient";

export const metadata: Metadata = {
  title: "Outbound — Ventas — Échale",
};

export default async function OutboundPage() {
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

  const today = new Date().toISOString().split("T")[0];
  const since = new Date();
  since.setDate(since.getDate() - 29);
  const sinceStr = since.toISOString().split("T")[0];

  const [{ data: todayRow }, { data: historyRows }] = await Promise.all([
    supabase
      .from("agency_sales_daily")
      .select("outbound_llamadas, outbound_contactos, outbound_leads, outbound_agendas")
      .eq("fecha", today)
      .maybeSingle(),
    supabase
      .from("agency_sales_daily")
      .select(
        "fecha, outbound_llamadas, outbound_contactos, outbound_leads, outbound_agendas, outbound_cierres, outbound_ventas"
      )
      .gte("fecha", sinceStr)
      .order("fecha", { ascending: false }),
  ]);

  const initial = {
    llamadas: todayRow?.outbound_llamadas ?? 0,
    contactos: todayRow?.outbound_contactos ?? 0,
    leads:    todayRow?.outbound_leads    ?? 0,
    agendas:  todayRow?.outbound_agendas  ?? 0,
  };

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Link
            href="/dashboard/ventas"
            className="text-muted text-sm font-sans hover:text-foreground transition-colors"
          >
            Ventas
          </Link>
          <span className="text-muted/40 text-sm font-sans">/</span>
          <span className="text-foreground text-sm font-sans">Outbound</span>
        </div>
        <h1 className="font-display text-3xl font-bold text-foreground">Tracker Outbound</h1>
        <p className="mt-1 text-muted text-sm font-sans">
          Cold calling — registro en tiempo real por día.
        </p>
      </div>

      <OutboundClient initial={initial} history={historyRows ?? []} />
    </div>
  );
}

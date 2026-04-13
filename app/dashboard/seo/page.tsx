import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSearchConsoleData, gscDateRange, type GscData } from "@/lib/gsc";
import SeoClientSelect from "./SeoClientSelect";

export const metadata: Metadata = { title: "SEO — Échale" };

// ── Config ────────────────────────────────────────────────────

const VALID_DAYS = [7, 28, 90] as const;
type Days = (typeof VALID_DAYS)[number];

const DAY_LABELS: Record<Days, string> = {
  7:  "7 días",
  28: "28 días",
  90: "90 días",
};

// ── Helpers ───────────────────────────────────────────────────

function fmtNum(n: number) {
  return n.toLocaleString("es-ES");
}

function fmtPct(n: number) {
  return (n * 100).toFixed(1) + "%";
}

function fmtPos(n: number) {
  return n.toFixed(1);
}

// ── Page ──────────────────────────────────────────────────────

export default async function SeoPage({
  searchParams,
}: {
  searchParams: { client_id?: string; days?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/dashboard");

  // Load all active clients for the selector
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, gsc_property_url")
    .eq("active", true)
    .order("name");

  const rawDays = Number(searchParams.days ?? "28");
  const days: Days = VALID_DAYS.includes(rawDays as Days) ? (rawDays as Days) : 28;

  const selectedId = searchParams.client_id ?? "";
  const selectedClient = (clients ?? []).find((c) => c.id === selectedId) ?? null;

  // Fetch GSC data if we have a valid client with a property URL
  let gscData: GscData | null = null;
  let gscError: string | null = null;

  if (selectedClient?.gsc_property_url) {
    try {
      const { startDate, endDate } = gscDateRange(days);
      gscData = await getSearchConsoleData(
        selectedClient.gsc_property_url,
        startDate,
        endDate
      );
    } catch (err) {
      gscError = err instanceof Error ? err.message : "Error al conectar con Google Search Console";
    }
  }

  const baseHref = (newParams: Record<string, string>) => {
    const p = new URLSearchParams({
      ...(selectedId ? { client_id: selectedId } : {}),
      days: String(days),
      ...newParams,
    });
    return `/dashboard/seo?${p}`;
  };

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
            SEO
          </h1>
          <p className="text-sm font-sans text-muted mt-1">
            Datos de Google Search Console por cliente.
          </p>
        </div>

        {/* Period tabs */}
        <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1 self-start">
          {VALID_DAYS.map((d) => (
            <Link
              key={d}
              href={baseHref({ days: String(d) })}
              className={`px-3 py-1.5 rounded-md text-xs font-sans font-medium transition-colors ${
                days === d
                  ? "bg-accent text-background"
                  : "text-muted hover:text-foreground hover:bg-white/5"
              }`}
            >
              {DAY_LABELS[d]}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Client selector ── */}
      <SeoClientSelect
        clients={(clients ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          hasGsc: !!c.gsc_property_url,
        }))}
        selectedId={selectedId}
        days={days}
      />

      {/* ── No client selected ── */}
      {!selectedId && (
        <div className="bg-surface border border-border rounded-2xl flex flex-col items-center justify-center py-20 gap-2">
          <p className="text-muted text-sm font-sans">Selecciona un cliente para ver sus datos SEO.</p>
        </div>
      )}

      {/* ── Client without GSC configured ── */}
      {selectedId && !selectedClient?.gsc_property_url && (
        <div className="bg-surface border border-border rounded-2xl flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-border flex items-center justify-center">
            <svg className="w-5 h-5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <p className="text-foreground text-sm font-sans font-medium">Sin propiedad GSC configurada</p>
          <p className="text-muted text-xs font-sans">
            Añade la URL de la propiedad GSC en la sección{" "}
            <Link href="/dashboard/clientes" className="text-accent hover:underline">
              Clientes
            </Link>
            .
          </p>
        </div>
      )}

      {/* ── GSC error ── */}
      {gscError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-6 py-5">
          <p className="text-red-400 text-sm font-sans font-medium">Error al obtener datos</p>
          <p className="text-red-400/70 text-xs font-sans mt-1">{gscError}</p>
        </div>
      )}

      {/* ── Data ── */}
      {gscData && selectedClient && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Clics"
              value={fmtNum(gscData.clicks)}
              icon={<IconClick />}
              accent
            />
            <KpiCard
              label="Impresiones"
              value={fmtNum(gscData.impressions)}
              icon={<IconEye />}
            />
            <KpiCard
              label="CTR medio"
              value={fmtPct(gscData.ctr)}
              icon={<IconPercent />}
            />
            <KpiCard
              label="Posición media"
              value={fmtPos(gscData.position)}
              icon={<IconRanking />}
              invertAccent
            />
          </div>

          {/* Keywords table */}
          <div className="bg-surface border border-border rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-border flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-foreground">
                Top keywords
              </h2>
              <span className="text-xs font-sans text-muted">
                {gscData.keywords.length} términos · últimos {DAY_LABELS[days]}
              </span>
            </div>

            {gscData.keywords.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-muted text-sm font-sans">Sin datos de keywords en este período.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-sans">
                  <thead>
                    <tr className="border-b border-border">
                      <Th align="left">#</Th>
                      <Th align="left">Keyword</Th>
                      <Th>Clics</Th>
                      <Th>Impresiones</Th>
                      <Th>CTR</Th>
                      <Th>Posición</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {gscData.keywords.map((kw, i) => (
                      <tr
                        key={kw.query}
                        className={`border-b border-border/50 hover:bg-white/[0.02] transition-colors ${
                          i === gscData!.keywords.length - 1 ? "border-b-0" : ""
                        }`}
                      >
                        <td className="px-6 py-4 text-muted/50 tabular-nums text-xs w-8">
                          {i + 1}
                        </td>
                        <td className="px-6 py-4 text-foreground font-medium max-w-xs truncate">
                          {kw.query}
                        </td>
                        <Td>
                          <span className="text-accent font-semibold">{fmtNum(kw.clicks)}</span>
                        </Td>
                        <Td>{fmtNum(kw.impressions)}</Td>
                        <Td>{fmtPct(kw.ctr)}</Td>
                        <Td>
                          <PositionBadge pos={kw.position} />
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon,
  accent,
  invertAccent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: boolean;
  invertAccent?: boolean;
}) {
  return (
    <div className={`rounded-xl p-5 border flex flex-col gap-3 ${
      accent ? "bg-accent/10 border-accent/20" : "bg-surface border-border"
    }`}>
      <div className="flex items-center justify-between">
        <p className="text-muted text-xs font-sans uppercase tracking-widest">{label}</p>
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${
          accent ? "bg-accent/20 text-accent" : "bg-white/5 text-muted"
        }`}>
          {icon}
        </span>
      </div>
      <p className={`font-display text-3xl font-bold ${
        accent ? "text-accent" : invertAccent ? "text-foreground" : "text-foreground"
      }`}>
        {value}
      </p>
    </div>
  );
}

function PositionBadge({ pos }: { pos: number }) {
  let cls = "text-red-400 bg-red-400/10";
  if (pos <= 3)  cls = "text-accent bg-accent/10";
  else if (pos <= 10) cls = "text-yellow-400 bg-yellow-400/10";
  return (
    <span className={`inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-medium tabular-nums ${cls}`}>
      {fmtPos(pos)}
    </span>
  );
}

function Th({ children, align = "right" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-6 py-3.5 text-xs font-sans font-medium text-muted uppercase tracking-wider ${
      align === "left" ? "text-left" : "text-right"
    }`}>
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="px-6 py-4 text-right tabular-nums text-muted whitespace-nowrap">
      {children}
    </td>
  );
}

// ── Icons ─────────────────────────────────────────────────────

function IconClick() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 14l3.5 3.5" /><path d="M9 3l3 6 2-1 1 6 2-1 1 4H5l3-5-2-1 3-9z" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconPercent() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  );
}

function IconRanking() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

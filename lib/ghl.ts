/**
 * GoHighLevel API v2 service
 * Base URL: https://services.leadconnectorhq.com
 */

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

// Stage names as configured in the client's GHL pipeline
const STAGES_AGENDADOS   = ["Agendado", "Confirmado"]; // sumados
const STAGE_PRESENCIALES = "Valorado";
const STAGE_CERRADOS     = "Cliente";

function ghlHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    Version: GHL_VERSION,
    "Content-Type": "application/json",
  };
}

// ── Contacts ─────────────────────────────────────────────────

/**
 * Returns the total number of contacts created in [startDate, endDate].
 * startDate / endDate: ISO 8601 strings (e.g. "2025-04-01T00:00:00Z")
 */
export async function getContacts(
  apiKey: string,
  locationId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  const params = new URLSearchParams({
    locationId,
    startDate,
    endDate,
    limit: "1", // only need meta.total
  });

  const res = await fetch(`${GHL_BASE}/contacts/?${params}`, {
    headers: ghlHeaders(apiKey),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`GHL Contacts [${res.status}]: ${body}`);
  }

  const data = await res.json();
  return data.meta?.total ?? 0;
}

// ── Opportunities ─────────────────────────────────────────────

interface OpportunityCounts {
  agendados: number;
  presenciales: number;
  cerrados: number;
}

/**
 * Fetches all opportunities for the location (paginating as needed) and
 * returns counts grouped into the three tracked pipeline stages.
 *
 * Stage → metric mapping:
 *   "Cita Agendada"  → agendados
 *   "Cita Realizada" → presenciales
 *   "Ganado"         → cerrados
 */
export async function getOpportunities(
  apiKey: string,
  locationId: string
): Promise<OpportunityCounts> {
  const headers = ghlHeaders(apiKey);

  // 1 — Build stageId → stageName map from pipeline definitions
  const stageMap: Record<string, string> = {};
  const pipelinesRes = await fetch(
    `${GHL_BASE}/opportunities/pipelines?locationId=${locationId}`,
    { headers, cache: "no-store" }
  );
  if (pipelinesRes.ok) {
    const pipelinesData = await pipelinesRes.json();
    for (const pipeline of pipelinesData.pipelines ?? []) {
      for (const stage of pipeline.stages ?? []) {
        stageMap[stage.id] = stage.name;
      }
    }
  }

  // 2 — Paginate through all opportunities and accumulate stage counts
  const stageCounts: Record<string, number> = {};
  const LIMIT = 100;
  let page = 1;
  let fetched = 0;
  let total = Infinity;

  while (fetched < total) {
    const params = new URLSearchParams({
      location_id: locationId,
      page: String(page),
      limit: String(LIMIT),
    });

    const res = await fetch(`${GHL_BASE}/opportunities/search?${params}`, {
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text().catch(() => res.statusText);
      throw new Error(`GHL Opportunities [${res.status}]: ${body}`);
    }

    const data = await res.json();
    const opportunities: {
      pipelineStageId?: string;
      pipelineStage?: { name?: string };
    }[] = data.opportunities ?? [];

    if (page === 1) {
      total = data.meta?.total ?? opportunities.length;
    }

    for (const opp of opportunities) {
      const stageName =
        stageMap[opp.pipelineStageId ?? ""] ??
        opp.pipelineStage?.name ??
        "";
      if (stageName) {
        stageCounts[stageName] = (stageCounts[stageName] ?? 0) + 1;
      }
    }

    fetched += opportunities.length;
    if (opportunities.length < LIMIT) break; // last page
    page++;
  }

  return {
    agendados:    STAGES_AGENDADOS.reduce((sum, s) => sum + (stageCounts[s] ?? 0), 0),
    presenciales: stageCounts[STAGE_PRESENCIALES] ?? 0,
    cerrados:     stageCounts[STAGE_CERRADOS]     ?? 0,
  };
}

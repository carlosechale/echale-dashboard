/**
 * Meta Marketing API v18 service
 * Docs: https://developers.facebook.com/docs/marketing-api/insights
 */

const META_BASE = "https://graph.facebook.com/v18.0";

export interface MetaAdsData {
  spend: number;      // gasto total en €/USD
  leads: number;      // total de leads (action_type = lead)
  cpl: number;        // cost per lead
}

/**
 * Fetches ad insights for the given ad account and date range.
 *
 * @param adAccountId  - Ad Account ID, with or without "act_" prefix
 * @param accessToken  - Meta Marketing API access token
 * @param startDate    - "YYYY-MM-DD"
 * @param endDate      - "YYYY-MM-DD"
 */
export async function getMetaAdsData(
  adAccountId: string,
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<MetaAdsData> {
  // Normalise account ID — ensure "act_" prefix
  const accountId = adAccountId.startsWith("act_")
    ? adAccountId
    : `act_${adAccountId}`;

  const params = new URLSearchParams({
    access_token: accessToken,
    time_range: JSON.stringify({ since: startDate, until: endDate }),
    fields: "spend,actions,cost_per_action_type",
    level: "account",
  });

  const res = await fetch(`${META_BASE}/${accountId}/insights?${params}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`Meta API [${res.status}]: ${body}`);
  }

  const json = await res.json();

  if (json.error) {
    throw new Error(`Meta API error: ${json.error.message}`);
  }

  const insight = json.data?.[0];

  if (!insight) {
    // No data for this period — return zeros
    return { spend: 0, leads: 0, cpl: 0 };
  }

  const spend = parseFloat(insight.spend ?? "0");

  // Sum all actions with action_type === "lead"
  const actions: { action_type: string; value: string }[] = insight.actions ?? [];
  const leads = actions
    .filter((a) => a.action_type === "lead")
    .reduce((sum, a) => sum + parseFloat(a.value ?? "0"), 0);

  // Cost per lead from cost_per_action_type
  const cpaEntries: { action_type: string; value: string }[] =
    insight.cost_per_action_type ?? [];
  const cplEntry = cpaEntries.find((a) => a.action_type === "lead");
  const cpl = cplEntry ? parseFloat(cplEntry.value ?? "0") : leads > 0 ? spend / leads : 0;

  return {
    spend: Math.round(spend * 100) / 100,
    leads: Math.round(leads),
    cpl: Math.round(cpl * 100) / 100,
  };
}

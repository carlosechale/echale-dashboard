export type UserRole = "admin" | "client";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  client_id: string | null;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  created_at: string;
  ghl_api_key: string | null;
  ghl_location_id: string | null;
  gsc_property_url: string | null;
  meta_ad_account_id: string | null;
  trueranker_project_id: string | null;
  last_sync_at: string | null;
}

export interface MetricsGHL {
  id: string;
  client_id: string;
  fecha: string;
  leads: number;
  agendados: number;
  presenciales: number;
  cerrados: number;
  created_at: string;
}

export interface MetricsMeta {
  id: string;
  client_id: string;
  fecha: string;
  gasto: number;
  cpl: number;
  created_at: string;
}

/** Métricas del mes agregadas por cliente */
export interface ClientMonthSummary {
  client_id: string;
  client_name: string;
  leads: number;
  agendados: number;
  presenciales: number;
  cerrados: number;
  gasto: number;
  cpl: number;
  tasa_agendamiento: number;   // agendados / leads
  tasa_presencialidad: number; // presenciales / agendados
  tasa_cierre: number;         // cerrados / presenciales
}

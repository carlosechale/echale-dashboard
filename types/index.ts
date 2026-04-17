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
  objetivo_leads: number;
}

export interface MetricsGHL {
  id: string;
  client_id: string;
  fecha: string;
  leads: number;
  agendados: number;
  presenciales: number;
  cerrados: number;
  facturacion_real: number;
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

export interface AgencySalesDaily {
  id: string;
  fecha: string;
  paid_inversion: number;
  paid_leads: number;
  paid_agendas: number;
  paid_cierres: number;
  paid_ventas: number;
  organico_leads: number;
  organico_agendas: number;
  organico_cierres: number;
  organico_ventas: number;
  outbound_llamadas: number;
  outbound_contactos: number;
  outbound_leads: number;
  outbound_agendas: number;
  outbound_cierres: number;
  outbound_ventas: number;
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
  cpl: number | null;           // null cuando leads = 0
  tasa_agendamiento: number | null;   // null cuando leads = 0
  tasa_presencialidad: number | null; // null cuando agendados = 0
  tasa_cierre: number | null;         // null cuando presenciales = 0
}

// CarVector API client — specs, images, federal recalls.
// Docs verified live 2026-06-28: https://carvector.io/docs/api
//
// Base URL: https://api.carvector.io/v1. Bearer auth via Authorization header (every endpoint
// except /v1/status). All responses are JSON; forward-compatible (new optional fields may
// appear — parse leniently, don't fail on unknown keys).
//
// NOTE: the real docs gate /v1/vehicles/{id}/tsbs behind a "Business plan" and
// /v1/vehicles/{id}/complaints behind a "Pro plan" — the vault's Data-Sources.md assumed
// TSBs were free-tier CarVector. That assumption is wrong; flagged as a decision to make
// before Phase 1 TSB work (pay for a plan, or drop TSBs from MVP — see vault 03-Decisions).
// Complaints are sourced from NHTSA's free API instead (lib/data-pipeline/nhtsa.ts), which the
// spec already intended, so that part is unaffected.
//
// Every record written to Supabase from this module must carry data_source: 'CarVector' and
// data_fetched_at: new Date() at the call site, per Guiding-Principles "no fabricated data".

const BASE_URL = process.env.CARVECTOR_API_BASE_URL || "https://api.carvector.io/v1";

function apiKey(): string {
  const key = process.env.CARVECTOR_API_KEY;
  if (!key) throw new Error("CARVECTOR_API_KEY is not set");
  return key;
}

async function carvectorFetch<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  });

  if (!res.ok) {
    throw new Error(`CarVector ${path} failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

export interface CarVectorVehicleSummary {
  id: string;
  year: number;
  make: string;
  model: string;
  [key: string]: unknown;
}

export interface CarVectorVehicleSearchResponse {
  count: number;
  limit: number;
  offset: number;
  results: CarVectorVehicleSummary[];
}

// GET /v1/vehicles — search by year/make/model. Paginated (limit max 100, default 25).
export function searchVehicles(params: {
  year?: number;
  make?: string;
  model?: string;
  limit?: number;
  offset?: number;
}): Promise<CarVectorVehicleSearchResponse> {
  return carvectorFetch<CarVectorVehicleSearchResponse>("/vehicles", params);
}

export interface CarVectorVehicleDetail {
  id: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  submodel: string | null;
  horsepower: number | null;
  cylinders: number | null;
  displacement_l: number | null;
  transmission: string | null;
  drive_type: string | null;
  fuel_type: string | null;
  body_class: string | null;
  doors: number | null;
  image_url: string | null;
  image_type: "illustration" | null;
  recall_count: number;
  complaint_count: number;
  tsb_count: number;
  investigation_count: number;
  [key: string]: unknown;
}

// GET /v1/vehicles/{id} — full specs for one vehicle.
export function getVehicle(id: string): Promise<CarVectorVehicleDetail> {
  return carvectorFetch<CarVectorVehicleDetail>(`/vehicles/${id}`);
}

export interface CarVectorRecall {
  campaign_id: string;
  component: string;
  summary: string;
  consequence: string;
  remedy: string;
  // MM/DD/YYYY (US format) — a frozen legacy format specific to this endpoint, confirmed
  // against a live response with day=28 (e.g. "05/28/2026", unambiguous since no month is 28).
  // Every other CarVector endpoint uses ISO YYYY-MM-DD. Parse accordingly, don't assume ISO here.
  report_received: string;
  potentially_affected: number | null;
  completion_rate: number | null;
}

export interface CarVectorRecallsResponse {
  vehicle_id: string;
  count: number;
  recalls: CarVectorRecall[];
}

// GET /v1/vehicles/{id}/recalls — federal recall campaigns mapped to a vehicle, newest first.
export function getVehicleRecalls(id: string): Promise<CarVectorRecallsResponse> {
  return carvectorFetch<CarVectorRecallsResponse>(`/vehicles/${id}/recalls`);
}

// GET /v1/status — no auth required. Useful for a pipeline health check before a full run.
export function getStatus(): Promise<{ status: string; data_updated: string; schema_version: number }> {
  return carvectorFetch("/status");
}

// Parses CarVector's recall date format (MM/DD/YYYY) into a JS Date. Returns null for
// unparseable or invalid input rather than throwing — recall ingestion should skip a bad row,
// not crash the whole pipeline run.
export function parseCarVectorRecallDate(value: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const [, mm, dd, yyyy] = match;
  const date = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

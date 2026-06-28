// NHTSA API client — federal recalls and owner complaints.
// Both endpoints verified live 2026-06-28, no API key required, free/open per
// vault 05-Setup-Checklist.md.
//
// Recalls:    https://api.nhtsa.gov/recalls/recallsByVehicle?make=&model=&modelYear=
// Complaints: https://api.nhtsa.gov/complaints/complaintsByVehicle?make=&model=&modelYear=
//
// Every record written to Supabase from this module must carry data_source: 'NHTSA' and
// data_fetched_at: new Date() at the call site, per Guiding-Principles "no fabricated data".

const BASE_URL = process.env.NHTSA_API_BASE_URL || "https://api.nhtsa.gov";

export interface NhtsaRecall {
  Manufacturer: string;
  NHTSACampaignNumber: string;
  parkIt: boolean;
  parkOutSide: boolean;
  overTheAirUpdate: boolean;
  // MM/DD/YYYY (US format), same legacy quirk as CarVector's recalls endpoint — confirmed
  // against CarVector's day=28 example; NHTSA is a US agency feed so the same convention applies.
  ReportReceivedDate: string;
  Component: string;
  Summary: string;
  Consequence: string;
  Remedy: string;
  Notes: string;
  ModelYear: string;
  Make: string;
  Model: string;
}

export interface NhtsaRecallsResponse {
  Count: number;
  Message: string;
  results: NhtsaRecall[];
}

export async function getRecallsByVehicle(params: {
  make: string;
  model: string;
  modelYear: number;
}): Promise<NhtsaRecallsResponse> {
  const url = new URL(`${BASE_URL}/recalls/recallsByVehicle`);
  url.searchParams.set("make", params.make);
  url.searchParams.set("model", params.model);
  url.searchParams.set("modelYear", String(params.modelYear));

  const res = await fetch(url);
  // Quirk confirmed live: NHTSA returns HTTP 400 (not 200) when a query has zero matching
  // results, with a normal-looking { Count: 0, results: [] } body. Only treat genuine server
  // errors (5xx) or an unparseable body as failures — a 400 with a valid empty-results shape
  // just means "no recalls for this vehicle," not an error.
  const body = (await res.json().catch(() => null)) as NhtsaRecallsResponse | null;
  if (!body || !Array.isArray(body.results)) {
    throw new Error(`NHTSA recalls fetch failed: ${res.status} ${res.statusText}`);
  }
  return body;
}

export interface NhtsaComplaintProduct {
  type: string;
  productYear: string;
  productMake: string;
  productModel: string;
  manufacturer: string;
}

export interface NhtsaComplaint {
  odiNumber: number;
  manufacturer: string;
  crash: boolean;
  fire: boolean;
  numberOfInjuries: number;
  numberOfDeaths: number;
  // MM/DD/YYYY — confirmed via a live response with day=30 (unambiguous).
  dateOfIncident: string;
  dateComplaintFiled: string;
  vin: string | null;
  components: string;
  summary: string;
  products: NhtsaComplaintProduct[];
}

export interface NhtsaComplaintsResponse {
  count: number;
  message: string;
  results: NhtsaComplaint[];
}

export async function getComplaintsByVehicle(params: {
  make: string;
  model: string;
  modelYear: number;
}): Promise<NhtsaComplaintsResponse> {
  const url = new URL(`${BASE_URL}/complaints/complaintsByVehicle`);
  url.searchParams.set("make", params.make);
  url.searchParams.set("model", params.model);
  url.searchParams.set("modelYear", String(params.modelYear));

  const res = await fetch(url);
  // Same zero-results-returns-400 quirk as the recalls endpoint — see comment above.
  const body = (await res.json().catch(() => null)) as NhtsaComplaintsResponse | null;
  if (!body || !Array.isArray(body.results)) {
    throw new Error(`NHTSA complaints fetch failed: ${res.status} ${res.statusText}`);
  }
  return body;
}

// Parses NHTSA's DD/MM/YYYY recall date format into a JS Date. Returns null for unparseable
// input — skip the row, don't crash the pipeline run.
export function parseNhtsaRecallDate(value: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
}

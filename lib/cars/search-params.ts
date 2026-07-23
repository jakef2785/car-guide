// Parse + validate car browse/search query params and turn them into a Prisma where clause.
// Type-only Prisma import keeps this unit-testable with no DB/runtime client. Invalid params are
// ignored (lenient), never fatal.
//
// NOTE on year: the VCA catalogue is the current on-sale set with no real per-variant model year
// (every variant is stamped a snapshot year internally), so there is deliberately NO year filter
// here — filtering/sorting on a fake year would be misleading. Real model years live in the MOT
// reliability data and drive the per-model reliability year picker instead.
import type { Prisma } from "@prisma/client";
import { z } from "zod";

export type SortKey = "make" | "mpg" | "co2" | "power";
export const SORT_KEYS: SortKey[] = ["make", "mpg", "co2", "power"];

export type CarSearchParams = {
  q?: string;
  make?: string; // make name
  fuel?: string;
  transmission?: string; // "Manual" | "Automatic"
  body?: string;
  engineFrom?: number; // cc
  engineTo?: number;
  powerFrom?: number; // PS
  powerTo?: number;
  mpgMin?: number; // combined
  co2Max?: number; // g/km
  reliability?: "better"; // only models better than their year-average in at least one model year
  sort?: SortKey;
  page?: number; // 1-based; parsed leniently, anything invalid means page 1
};

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const str = z.string().trim().min(1).max(100).optional().catch(undefined);
// Empty/whitespace strings mean "absent", NOT zero — a plain GET form submits every field, so
// ?fuel=Petrol&engineTo=&co2Max=… must not become engineTo:0/co2Max:0 (which would exclude every
// car with data; z.coerce.number alone does Number("") === 0).
const posNum = z
  .preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.coerce.number().min(0).max(100000).optional()
  )
  .catch(undefined);

export function parseCarSearchParams(raw: RawParams): CarSearchParams {
  const out: CarSearchParams = {};
  const set = <K extends keyof CarSearchParams>(k: K, v: CarSearchParams[K] | undefined) => {
    if (v !== undefined) out[k] = v;
  };

  set("q", str.parse(first(raw.q)));
  set("make", str.parse(first(raw.make)));
  set("fuel", str.parse(first(raw.fuel)));
  set("transmission", str.parse(first(raw.transmission)));
  set("body", str.parse(first(raw.body)));
  set("engineFrom", posNum.parse(first(raw.engineFrom)));
  set("engineTo", posNum.parse(first(raw.engineTo)));
  set("powerFrom", posNum.parse(first(raw.powerFrom)));
  set("powerTo", posNum.parse(first(raw.powerTo)));
  set("mpgMin", posNum.parse(first(raw.mpgMin)));
  set("co2Max", posNum.parse(first(raw.co2Max)));

  if (first(raw.reliability) === "better") out.reliability = "better";
  const sort = first(raw.sort);
  if (sort && (SORT_KEYS as string[]).includes(sort)) out.sort = sort as SortKey;

  const page = posNum.parse(first(raw.page));
  if (page !== undefined && Number.isInteger(page) && page >= 2) out.page = page;

  return out;
}

// Build the Prisma `where` for the standard filters. The reliability filter is applied separately
// in the query layer (it needs a column-to-column comparison Prisma can't express in `where`).
export function buildModelWhere(params: CarSearchParams): Prisma.ModelWhereInput {
  const and: Prisma.ModelWhereInput[] = [];

  if (params.q) {
    and.push({
      OR: [
        { name: { contains: params.q, mode: "insensitive" } },
        { make: { name: { contains: params.q, mode: "insensitive" } } },
      ],
    });
  }
  if (params.make) and.push({ make: { name: { equals: params.make, mode: "insensitive" } } });
  if (params.body) and.push({ bodyType: { equals: params.body, mode: "insensitive" } });

  // Spec filters all apply to the SAME variant (a model matches if one of its variants satisfies
  // every spec constraint) — so they go inside a single `variants: { some: {...} }`.
  const variantSome: Prisma.VariantWhereInput = {};
  if (params.fuel) variantSome.fuelType = { equals: params.fuel, mode: "insensitive" };
  if (params.transmission) variantSome.transmission = { equals: params.transmission, mode: "insensitive" };

  const engine = range(params.engineFrom, params.engineTo);
  if (engine) variantSome.engineSizeCc = engine;
  const power = range(params.powerFrom, params.powerTo);
  if (power) variantSome.horsepower = power;
  if (params.mpgMin !== undefined) variantSome.mpgCombined = { gte: params.mpgMin };
  if (params.co2Max !== undefined) variantSome.co2Gkm = { lte: Math.round(params.co2Max) };

  if (Object.keys(variantSome).length > 0) and.push({ variants: { some: variantSome } });

  return and.length > 0 ? { AND: and } : {};
}

function range(from?: number, to?: number): { gte?: number; lte?: number } | null {
  if (from === undefined && to === undefined) return null;
  return {
    ...(from !== undefined ? { gte: Math.round(from) } : {}),
    ...(to !== undefined ? { lte: Math.round(to) } : {}),
  };
}

// True if any spec/text/reliability filter is active (used to decide "browse" vs "results" UI).
export function hasActiveFilters(p: CarSearchParams): boolean {
  return Boolean(
    p.q || p.make || p.fuel || p.transmission || p.body || p.reliability ||
      p.engineFrom !== undefined || p.engineTo !== undefined ||
      p.powerFrom !== undefined || p.powerTo !== undefined ||
      p.mpgMin !== undefined || p.co2Max !== undefined,
  );
}

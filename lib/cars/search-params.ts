// Parse + validate car browse/search query params and turn them into a Prisma where clause.
// Type-only Prisma import keeps this unit-testable with no DB/runtime client. Invalid params are
// ignored (lenient), never fatal — see vault 02-Phases/Phase-2-Design.md "Search & filter".
import type { Prisma } from "@prisma/client";
import { z } from "zod";

export type CarSearchParams = {
  q?: string;
  fuel?: string;
  body?: string;
  yearFrom?: number;
  yearTo?: number;
};

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const str = z.string().trim().min(1).max(100).optional().catch(undefined);
const year = z.coerce.number().int().min(1980).max(2100).optional().catch(undefined);

export function parseCarSearchParams(raw: RawParams): CarSearchParams {
  const out: CarSearchParams = {};
  const q = str.parse(first(raw.q));
  const fuel = str.parse(first(raw.fuel));
  const body = str.parse(first(raw.body));
  const yearFrom = year.parse(first(raw.yearFrom));
  const yearTo = year.parse(first(raw.yearTo));
  if (q) out.q = q;
  if (fuel) out.fuel = fuel;
  if (body) out.body = body;
  if (yearFrom !== undefined) out.yearFrom = yearFrom;
  if (yearTo !== undefined) out.yearTo = yearTo;
  return out;
}

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
  if (params.body) {
    and.push({ bodyType: { equals: params.body, mode: "insensitive" } });
  }

  const variantSome: Prisma.VariantWhereInput = {};
  if (params.fuel) variantSome.fuelType = { equals: params.fuel, mode: "insensitive" };
  if (params.yearFrom !== undefined || params.yearTo !== undefined) {
    variantSome.year = {
      ...(params.yearFrom !== undefined ? { gte: params.yearFrom } : {}),
      ...(params.yearTo !== undefined ? { lte: params.yearTo } : {}),
    };
  }
  if (Object.keys(variantSome).length > 0) {
    and.push({ variants: { some: variantSome } });
  }

  return and.length > 0 ? { AND: and } : {};
}

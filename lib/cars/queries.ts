import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildModelWhere, type CarSearchParams } from "@/lib/cars/search-params";
import type { ModelCardModel } from "@/components/cars/ModelCard";

// Columns needed to build a ModelCard. Kept in one place so list/byMake stay consistent.
const cardSelect = {
  name: true,
  slug: true,
  bodyType: true,
  make: { select: { name: true, slug: true } },
  variants: {
    select: {
      fuelType: true,
      transmission: true,
      engineSizeCc: true,
      horsepower: true,
      mpgCombined: true,
      co2Gkm: true,
      dataSource: true,
      dataFetchedAt: true,
    },
  },
  _count: { select: { recalls: true } },
} satisfies Prisma.ModelSelect;

type ModelWithCard = Prisma.ModelGetPayload<{ select: typeof cardSelect }>;

function toCardModel(m: ModelWithCard): ModelCardModel {
  return {
    makeName: m.make?.name ?? "",
    makeSlug: m.make?.slug ?? "",
    modelName: m.name,
    modelSlug: m.slug,
    bodyType: m.bodyType,
    recallCount: m._count.recalls,
    variantCount: m.variants.length,
    variants: m.variants.map((v) => ({
      fuelType: v.fuelType,
      transmission: v.transmission,
      engineSizeCc: v.engineSizeCc,
      horsepower: v.horsepower,
      mpgCombined: v.mpgCombined?.toString() ?? null,
      co2Gkm: v.co2Gkm,
      dataSource: v.dataSource,
      dataFetchedAt: v.dataFetchedAt,
    })),
  };
}

// --- Sorting: derive a per-model value from its variants (Prisma can't order by a nested aggregate
// cleanly), then sort the mapped cards in memory. The result set is bounded (~hundreds of models).
function maxMpg(m: ModelCardModel): number {
  return Math.max(0, ...m.variants.map((v) => Number(v.mpgCombined)).filter((n) => Number.isFinite(n)));
}
function minCo2(m: ModelCardModel): number {
  const vals = m.variants.map((v) => v.co2Gkm).filter((n): n is number => n !== null && n > 0);
  return vals.length ? Math.min(...vals) : Infinity;
}
function maxPower(m: ModelCardModel): number {
  return Math.max(0, ...m.variants.map((v) => v.horsepower ?? 0));
}

function sortCards(cards: ModelCardModel[], sort: CarSearchParams["sort"]): ModelCardModel[] {
  if (sort === "mpg") return [...cards].sort((a, b) => maxMpg(b) - maxMpg(a));
  if (sort === "co2") return [...cards].sort((a, b) => minCo2(a) - minCo2(b));
  if (sort === "power") return [...cards].sort((a, b) => maxPower(b) - maxPower(a));
  return cards; // "make" / default — already ordered by make then model in the query
}

// Model IDs whose MOT reliability beats the same-year average in at least one model year. Needs a
// column-to-column comparison, so it's raw SQL rather than a Prisma `where`.
async function betterThanAverageModelIds(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ model_id: string }[]>`
    SELECT DISTINCT model_id FROM mot_reliability
    WHERE model_id IS NOT NULL AND defects_per_100 IS NOT NULL AND year_avg_per_100 IS NOT NULL
      AND defects_per_100 < year_avg_per_100`;
  return rows.map((r) => r.model_id);
}

export async function listModels(params: CarSearchParams): Promise<ModelCardModel[]> {
  const clauses: Prisma.ModelWhereInput[] = [buildModelWhere(params)];
  if (params.reliability === "better") {
    clauses.push({ id: { in: await betterThanAverageModelIds() } });
  }
  const models = await prisma.model.findMany({
    where: { AND: clauses },
    select: cardSelect,
    orderBy: [{ make: { name: "asc" } }, { name: "asc" }],
  });
  return sortCards(models.map(toCardModel), params.sort);
}

export type FilterFacets = {
  makes: string[];
  fuels: string[];
  transmissions: string[];
  bodies: string[];
  engine: { min: number; max: number };
  power: { min: number; max: number };
  mpg: { min: number; max: number };
  co2: { min: number; max: number };
};

function num(v: Prisma.Decimal | number | null, fallback: number): number {
  if (v === null || v === undefined) return fallback;
  return typeof v === "number" ? v : Number(v);
}

// Filter options drawn from the real data, so the sidebar never offers a value that returns nothing.
export async function listFilterFacets(): Promise<FilterFacets> {
  const [makes, fuels, transmissions, bodies, agg] = await Promise.all([
    prisma.make.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    prisma.variant.findMany({ where: { fuelType: { not: null } }, distinct: ["fuelType"], select: { fuelType: true } }),
    prisma.variant.findMany({ where: { transmission: { not: null } }, distinct: ["transmission"], select: { transmission: true } }),
    prisma.model.findMany({ where: { bodyType: { not: null } }, distinct: ["bodyType"], select: { bodyType: true } }),
    prisma.variant.aggregate({
      _min: { engineSizeCc: true, horsepower: true, mpgCombined: true, co2Gkm: true },
      _max: { engineSizeCc: true, horsepower: true, mpgCombined: true, co2Gkm: true },
    }),
  ]);

  return {
    makes: makes.map((m) => m.name),
    fuels: fuels.map((f) => f.fuelType!).sort(),
    transmissions: transmissions.map((t) => t.transmission!).sort(),
    bodies: bodies.map((b) => b.bodyType!).sort(),
    engine: { min: agg._min.engineSizeCc ?? 0, max: agg._max.engineSizeCc ?? 0 },
    power: { min: agg._min.horsepower ?? 0, max: agg._max.horsepower ?? 0 },
    mpg: { min: Math.floor(num(agg._min.mpgCombined, 0)), max: Math.ceil(num(agg._max.mpgCombined, 0)) },
    co2: { min: agg._min.co2Gkm ?? 0, max: agg._max.co2Gkm ?? 0 },
  };
}

export async function getMakeBySlug(slug: string) {
  return prisma.make.findUnique({ where: { slug } });
}

export async function listModelsByMake(makeSlug: string): Promise<ModelCardModel[]> {
  const models = await prisma.model.findMany({
    where: { make: { slug: makeSlug } },
    select: cardSelect,
    orderBy: { name: "asc" },
  });
  return models.map(toCardModel);
}

export async function listMakes() {
  return prisma.make.findMany({ orderBy: { name: "asc" }, select: { name: true, slug: true } });
}

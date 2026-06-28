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
    orderBy: { year: "desc" },
    select: {
      year: true,
      fuelType: true,
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
    variants: m.variants.map((v) => ({
      year: v.year,
      fuelType: v.fuelType,
      mpgCombined: v.mpgCombined?.toString() ?? null,
      co2Gkm: v.co2Gkm,
      dataSource: v.dataSource,
      dataFetchedAt: v.dataFetchedAt,
    })),
  };
}

export async function listModels(params: CarSearchParams): Promise<ModelCardModel[]> {
  const models = await prisma.model.findMany({
    where: buildModelWhere(params),
    select: cardSelect,
    orderBy: [{ make: { name: "asc" } }, { name: "asc" }],
  });
  return models.map(toCardModel);
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

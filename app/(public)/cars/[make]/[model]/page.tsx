// Phase 1 deliverable: a single model page rendering real seeded data — specs, fuel economy,
// VED, and recalls, every field source-labelled per Guiding-Principles.md. No auth, no reviews
// yet (Phase 1 scope, see vault 02-Phases/Phase-1-Foundation.md).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { VariantPicker } from "@/components/cars/VariantPicker";
import { RecallList } from "@/components/cars/RecallList";
import { ReliabilityCard } from "@/components/cars/ReliabilityCard";
import { CommunityReviews } from "@/components/reviews/CommunityReviews";
import { listApprovedReviews, approvedReviewAggregate } from "@/lib/reviews/queries";

// Route params come from the URL, so they're external input — validated per the workflow's
// "Zod validation on every external input" rule, even though they end up in a Prisma `where`
// (Prisma already parameterizes queries, so this isn't an injection guard — it's a fast,
// friendly 404 for obviously-malformed slugs instead of a DB round-trip).
const paramsSchema = z.object({
  make: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  model: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
});

export async function generateMetadata({
  params,
}: {
  params: { make: string; model: string };
}): Promise<Metadata> {
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) return { title: "Car" };
  const model = await prisma.model.findFirst({
    where: { slug: parsed.data.model, make: { slug: parsed.data.make } },
    include: { make: true },
  });
  if (!model || !model.make) return { title: "Car" };
  return {
    title: `${model.make.name} ${model.name} — specs, economy and recalls`,
    description: `${model.make.name} ${model.name}: specifications, fuel economy, road tax, recalls and MOT reliability — every figure source-labelled.`,
  };
}

export default async function ModelPage({
  params,
  searchParams,
}: {
  params: { make: string; model: string };
  searchParams: { reviewed?: string };
}) {
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) notFound();

  const model = await prisma.model.findFirst({
    where: {
      slug: parsed.data.model,
      make: { slug: parsed.data.make },
    },
    include: {
      make: true,
      variants: { orderBy: { trimName: "asc" } },
      recalls: { orderBy: { recallDate: "desc" } },
      motReliability: { orderBy: { ageBand: "desc" } },
    },
  });

  if (!model || !model.make) notFound();

  const [reviews, reviewAggregate] = await Promise.all([
    listApprovedReviews(model.id),
    approvedReviewAggregate(model.id),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900">
        {model.make.name} {model.name}
      </h1>
      {model.bodyType && <p className="mt-1 text-gray-500">{model.bodyType}</p>}

      <section className="mt-8">
        <h2 className="mb-3 text-xl font-semibold text-gray-900">Specs &amp; fuel economy</h2>
        {/* Pick one trim rather than dumping every variant. Prisma Decimals -> strings so the
            presentational card stays independent of the Prisma runtime's Decimal type. */}
        <VariantPicker
          variants={model.variants.map((v) => ({
            id: v.id,
            trimName: v.trimName,
            engineSizeCc: v.engineSizeCc,
            fuelType: v.fuelType,
            transmission: v.transmission,
            horsepower: v.horsepower,
            torqueNm: v.torqueNm,
            zeroToSixty: v.zeroToSixty?.toString() ?? null,
            topSpeedMph: v.topSpeedMph,
            doors: v.doors,
            seats: v.seats,
            kerbWeightKg: v.kerbWeightKg,
            mpgUrban: v.mpgUrban?.toString() ?? null,
            mpgExtraUrban: v.mpgExtraUrban?.toString() ?? null,
            mpgCombined: v.mpgCombined?.toString() ?? null,
            co2Gkm: v.co2Gkm,
            milesPerKwh: v.milesPerKwh?.toString() ?? null,
            maxRangeMiles: v.maxRangeMiles,
            vedFirstYearGbp: v.vedFirstYearGbp,
            vedAssumptionApplied: v.vedAssumptionApplied,
            dataSource: v.dataSource,
            dataFetchedAt: v.dataFetchedAt,
          }))}
        />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-xl font-semibold text-gray-900">Recalls</h2>
        <RecallList recalls={model.recalls} />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-xl font-semibold text-gray-900">Reliability</h2>
        <ReliabilityCard
          reliability={model.motReliability.map((r) => ({
            ...r,
            // Prisma Decimal -> plain value so the presentational card stays Prisma-free.
            defectsPer100: r.defectsPer100?.toString() ?? null,
            yearAvgPer100: r.yearAvgPer100?.toString() ?? null,
          }))}
        />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-xl font-semibold text-gray-900">Community reviews</h2>
        <CommunityReviews
          reviews={reviews}
          aggregate={reviewAggregate}
          writeHref={`/cars/${parsed.data.make}/${parsed.data.model}/review`}
          justSubmitted={searchParams.reviewed === "1"}
        />
      </section>
    </main>
  );
}

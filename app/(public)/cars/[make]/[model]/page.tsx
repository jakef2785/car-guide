// Phase 1 deliverable: a single model page rendering real seeded data — specs, fuel economy,
// VED, and recalls, every field source-labelled per Guiding-Principles.md. No auth, no reviews
// yet (Phase 1 scope, see vault 02-Phases/Phase-1-Foundation.md).
import { notFound } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { VariantSpecsCard } from "@/components/cars/VariantSpecsCard";
import { RecallList } from "@/components/cars/RecallList";
import { ComplaintList } from "@/components/cars/ComplaintList";

// Route params come from the URL, so they're external input — validated per the workflow's
// "Zod validation on every external input" rule, even though they end up in a Prisma `where`
// (Prisma already parameterizes queries, so this isn't an injection guard — it's a fast,
// friendly 404 for obviously-malformed slugs instead of a DB round-trip).
const paramsSchema = z.object({
  make: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  model: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
});

export default async function ModelPage({
  params,
}: {
  params: { make: string; model: string };
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
      variants: { orderBy: { year: "desc" } },
      recalls: { orderBy: { recallDate: "desc" } },
      complaints: { orderBy: { complaintDate: "desc" } },
    },
  });

  if (!model || !model.make) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-900">
        {model.make.name} {model.name}
      </h1>
      {model.bodyType && <p className="mt-1 text-slate-500">{model.bodyType}</p>}

      <section className="mt-8">
        <h2 className="mb-3 text-xl font-semibold text-slate-900">Specs &amp; fuel economy</h2>
        {model.variants.length === 0 ? (
          <p className="text-sm text-slate-500">No variant data available for this model.</p>
        ) : (
          <div className="space-y-4">
            {model.variants.map((variant) => (
              <VariantSpecsCard
                key={variant.id}
                variant={{
                  ...variant,
                  // Prisma returns Decimal fields as Decimal objects, not plain numbers/strings —
                  // convert here so the (otherwise pure-presentational) card component can stay
                  // independent of the Prisma runtime's Decimal type.
                  zeroToSixty: variant.zeroToSixty?.toString() ?? null,
                  mpgUrban: variant.mpgUrban?.toString() ?? null,
                  mpgExtraUrban: variant.mpgExtraUrban?.toString() ?? null,
                  mpgCombined: variant.mpgCombined?.toString() ?? null,
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-xl font-semibold text-slate-900">Recalls</h2>
        <RecallList recalls={model.recalls} />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-xl font-semibold text-slate-900">Owner complaints</h2>
        <ComplaintList complaints={model.complaints} />
      </section>
    </main>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getMakeBySlug, listModelsByMake } from "@/lib/cars/queries";
import { ModelCard } from "@/components/cars/ModelCard";

const schema = z.object({ make: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/) });

export async function generateMetadata({
  params,
}: {
  params: { make: string };
}): Promise<Metadata> {
  const parsed = schema.safeParse(params);
  if (!parsed.success) return { title: "Cars" };
  const make = await getMakeBySlug(parsed.data.make);
  return make
    ? { title: `${make.name} cars`, description: `Browse ${make.name} models on CarGuide.` }
    : { title: "Cars" };
}

export default async function MakePage({ params }: { params: { make: string } }) {
  const parsed = schema.safeParse(params);
  if (!parsed.success) notFound();
  const make = await getMakeBySlug(parsed.data.make);
  if (!make) notFound();
  const models = await listModelsByMake(make.slug);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold text-gray-900">{make.name}</h1>
      {models.length === 0 ? (
        <p className="text-gray-500">No models available for this make yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {models.map((m) => (
            <ModelCard key={m.modelSlug} model={m} />
          ))}
        </div>
      )}
    </main>
  );
}

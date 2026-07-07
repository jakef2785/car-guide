// Admin area gate. Non-admins get a 404 — not a redirect — so the area's existence isn't
// advertised. This gate is convenience only: every admin server action independently re-checks
// the claim (lib/auth/user.ts getAdminUser), so bypassing this layout gains nothing.
import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/auth/user";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser();
  if (!admin) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <p className="mb-6 inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
        Admin — signed in as {admin.email}
      </p>
      {children}
    </div>
  );
}

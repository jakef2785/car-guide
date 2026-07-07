"use server";

// Moderation actions. Defence-in-depth (Phase-4-Design.md): the admin claim is re-verified
// here on EVERY call — never trust that the layout gated the page. The DB is the final
// backstop: column grants stop client roles writing is_approved at all.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth/user";

const idSchema = z.string().uuid();

export async function approveReviewAction(formData: FormData): Promise<void> {
  const admin = await getAdminUser();
  if (!admin) return;

  const id = idSchema.safeParse(formData.get("reviewId"));
  if (!id.success) return;

  await prisma.review.update({
    where: { id: id.data },
    data: {
      isApproved: true,
      approvedAt: new Date(),
      approvedBy: admin.id, // audit trail
    },
  });
  revalidatePath("/admin/reviews");
}

// Reject = delete (Phase-4-Design.md: no "rejected" state kept for MVP — the author can
// rework and resubmit).
export async function rejectReviewAction(formData: FormData): Promise<void> {
  const admin = await getAdminUser();
  if (!admin) return;

  const id = idSchema.safeParse(formData.get("reviewId"));
  if (!id.success) return;

  await prisma.review.delete({ where: { id: id.data } });
  revalidatePath("/admin/reviews");
}

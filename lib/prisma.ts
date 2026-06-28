// Prisma client singleton for the Next.js app (Server Components, Route Handlers).
// Standard Next.js pattern: reuse one client across hot-reloads in dev so we don't exhaust
// the connection pool by creating a new PrismaClient on every module reload.
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

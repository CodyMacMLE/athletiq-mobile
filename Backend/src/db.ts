import { PrismaClient } from "@prisma/client";

// Singleton pattern — reuse one PrismaClient across module reloads in all environments.
// Also cap the connection pool to avoid exhausting Railway's Postgres connection limit.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function buildDatabaseUrl() {
  const base = process.env.DATABASE_URL || "";
  if (!base || base.includes("connection_limit")) return base;
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}connection_limit=5&pool_timeout=20`;
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: { url: buildDatabaseUrl() },
    },
  });

globalForPrisma.prisma = prisma;

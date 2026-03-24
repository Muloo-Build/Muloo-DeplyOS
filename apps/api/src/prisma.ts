import Prisma from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: Prisma.PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new Prisma.PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

import prismaPkg from "@prisma/client";
const { PrismaClient, Prisma } = prismaPkg;

// Single prisma instance for the server (keep default import to avoid CJS/ESM issues)
export const prisma = new PrismaClient();
export { Prisma };

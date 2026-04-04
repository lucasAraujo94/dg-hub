import prismaPkg from "@prisma/client";

const { PrismaClient } = prismaPkg;

export const Prisma = prismaPkg.Prisma;
export const prisma = new PrismaClient();

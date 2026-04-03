import prismaPkg from "@prisma/client";
const { PrismaClient } = prismaPkg;

// Single prisma instance for the server
export const prisma = new PrismaClient();

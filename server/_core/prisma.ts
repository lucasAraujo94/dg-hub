import { PrismaClient } from "@prisma/client";

// Single prisma instance for the server
export const prisma = new PrismaClient();

export type Prisma = any;
export type User = any;

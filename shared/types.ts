/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

// Avoid named exports from @prisma/client to prevent ESM issues in some builds.
// If you need Prisma types on the frontend, import from server/_core/prisma or define DTOs manually.
export * from "./_core/errors";

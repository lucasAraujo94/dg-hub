-- Expand avatarUrl column to TEXT to allow larger data URLs
ALTER TABLE "users" ALTER COLUMN "avatarUrl" TYPE TEXT;

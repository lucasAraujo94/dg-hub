-- Rename SQL Server-era "nickname" column to Postgres-friendly "nome_no_hago"
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'nickname'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'nome_no_hago'
  ) THEN
    ALTER TABLE "users" RENAME COLUMN "nickname" TO "nome_no_hago";
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'nome_no_hago'
  ) THEN
    ALTER TABLE "users" ADD COLUMN "nome_no_hago" VARCHAR(100);
  END IF;
END;
$$;

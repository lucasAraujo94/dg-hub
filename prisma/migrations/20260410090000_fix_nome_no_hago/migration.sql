-- Ensure Postgres has the expected "nome_no_hago" column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'nickname'
  ) THEN
    EXECUTE 'ALTER TABLE "users" RENAME COLUMN "nickname" TO "nome_no_hago"';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'nome_no_hago'
  ) THEN
    EXECUTE 'ALTER TABLE "users" ADD COLUMN "nome_no_hago" VARCHAR(100)';
  END IF;
END;
$$;

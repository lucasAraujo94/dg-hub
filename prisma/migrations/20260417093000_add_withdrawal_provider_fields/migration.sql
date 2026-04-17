ALTER TABLE "solicitacoesSaque"
ADD COLUMN "paymentProvider" VARCHAR(32),
ADD COLUMN "providerTransferId" VARCHAR(120),
ADD COLUMN "providerStatus" VARCHAR(32),
ADD COLUMN "providerResponseJson" TEXT;

CREATE UNIQUE INDEX "solicitacoesSaque_providerTransferId_key" ON "solicitacoesSaque"("providerTransferId");

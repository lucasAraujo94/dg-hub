CREATE TABLE "pixPayments" (
  "id" SERIAL NOT NULL,
  "usuarioId" INTEGER NOT NULL,
  "createdByUserId" INTEGER,
  "provider" VARCHAR(32) NOT NULL DEFAULT 'mercadopago',
  "externalReference" VARCHAR(120) NOT NULL,
  "providerPaymentId" VARCHAR(120),
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "valor" DECIMAL(10,2) NOT NULL,
  "descricao" TEXT,
  "qrCode" TEXT,
  "qrCodeBase64" TEXT,
  "ticketUrl" TEXT,
  "metadataJson" TEXT,
  "rawResponseJson" TEXT,
  "approvedAt" TIMESTAMP(3),
  "creditedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pixPayments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pixPayments_externalReference_key" ON "pixPayments"("externalReference");
CREATE UNIQUE INDEX "pixPayments_providerPaymentId_key" ON "pixPayments"("providerPaymentId");
CREATE INDEX "pixPayments_usuarioId_status_idx" ON "pixPayments"("usuarioId", "status");

ALTER TABLE "pixPayments"
ADD CONSTRAINT "pixPayments_usuarioId_fkey"
FOREIGN KEY ("usuarioId") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

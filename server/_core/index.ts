import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import fs from "fs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ENV } from "./env";
import axios from "axios";
import {
  creditPixPaymentIfNeeded,
  getPixPaymentByExternalReference,
  getPixPaymentByProviderPaymentId,
  syncPixPaymentRecord,
  getPixPaymentById,
} from "../db";

process.env.NODE_ENV ??= "development";

function isPortAvailable(port: number, host: string = "0.0.0.0"): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000, host: string = "0.0.0.0"): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port, host)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

function mapMercadoPagoPix(payment: any) {
  const transactionData = payment?.point_of_interaction?.transaction_data ?? {};
  return {
    providerPaymentId: String(payment?.id ?? ""),
    externalReference: payment?.external_reference ? String(payment.external_reference) : null,
    status: String(payment?.status ?? "pending"),
    valor: Number(payment?.transaction_amount ?? 0),
    qrCode: transactionData?.qr_code ?? null,
    qrCodeBase64: transactionData?.qr_code_base64 ?? null,
    ticketUrl: transactionData?.ticket_url ?? null,
    metadataJson: payment?.metadata ? JSON.stringify(payment.metadata) : null,
    rawResponseJson: JSON.stringify(payment),
    approvedAt: payment?.date_approved ? new Date(payment.date_approved) : null,
    expiresAt: payment?.date_of_expiration ? new Date(payment.date_of_expiration) : null,
  };
}

function mapAsaasPixPayment(payment: any) {
  return {
    providerPaymentId: String(payment?.id ?? ""),
    externalReference: payment?.externalReference ? String(payment.externalReference) : null,
    status: String(payment?.status ?? "PENDING"),
    valor: Number(payment?.value ?? 0),
    qrCode: null,
    qrCodeBase64: null,
    ticketUrl: payment?.invoiceUrl ? String(payment.invoiceUrl) : null,
    metadataJson: null,
    rawResponseJson: JSON.stringify(payment),
    approvedAt: payment?.clientPaymentDate ? new Date(payment.clientPaymentDate) : null,
    expiresAt: payment?.dueDate ? new Date(`${payment.dueDate}T23:59:59Z`) : null,
  };
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const allowedCorsOrigins = new Set([
    "http://localhost",
    "https://localhost",
    "capacitor://localhost",
    "https://app.dggames.online",
  ]);
  const batchUploadLimit = "30mb";

  app.use(express.json({ limit: batchUploadLimit }));
  app.use(express.urlencoded({ limit: batchUploadLimit, extended: true }));

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedCorsOrigins.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    next();
  });

  app.use((_, res, next) => {
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });

  app.enable("trust proxy");
  app.use((req, res, next) => {
    if (req.secure || req.headers["x-forwarded-proto"] === "https") return next();
    if (process.env.NODE_ENV !== "production") return next();
    const host = req.headers.host ?? "";
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  });

  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use("/uploads", express.static(uploadsDir));

  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      ok: true,
      service: "dg-hub",
      now: new Date().toISOString(),
    });
  });

  registerOAuthRoutes(app);

  app.post("/api/mp/webhook", async (req, res) => {
    try {
      const type = String((req.body as any)?.type ?? req.query.type ?? req.query.topic ?? "");
      const paymentIdRaw =
        (req.body as any)?.data?.id ??
        (req.body as any)?.id ??
        req.query["data.id"] ??
        req.query.id;
      const paymentId = paymentIdRaw ? String(paymentIdRaw) : "";

      if (type && type !== "payment") {
        return res.status(200).send("ignored");
      }
      if (!paymentId) {
        return res.status(200).send("missing payment id");
      }
      if (!ENV.mpAccessToken) {
        return res.status(500).send("mp token missing");
      }

      const paymentResp = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${ENV.mpAccessToken}` },
      });

      const paymentData = mapMercadoPagoPix(paymentResp.data);
      const localRecord =
        (paymentData.providerPaymentId ? await getPixPaymentByProviderPaymentId(paymentData.providerPaymentId) : null) ??
        (paymentData.externalReference ? await getPixPaymentByExternalReference(paymentData.externalReference) : null);

      if (!localRecord) {
        return res.status(200).send("payment not tracked");
      }

      const synced = await syncPixPaymentRecord(paymentData);
      if (paymentData.status !== "approved") {
        return res.status(200).send(synced?.status ?? "pending");
      }

      const result = await creditPixPaymentIfNeeded({
        pixPaymentId: localRecord.id,
        usuarioId: localRecord.usuarioId,
        valor: paymentData.valor,
        providerPaymentId: paymentData.providerPaymentId,
      });

      return res.status(200).send(result.credited ? "credited" : "already");
    } catch (error) {
      console.error("[mp webhook] error", error);
      return res.status(500).send("error");
    }
  });

  app.post("/api/asaas/webhook", async (req, res) => {
    try {
      const event = String((req.body as any)?.event ?? "");
      const payment = (req.body as any)?.payment;
      const paymentId = payment?.id ? String(payment.id) : "";
      if (!paymentId) {
        return res.status(200).send("missing payment id");
      }

      const paymentData = mapAsaasPixPayment(payment);
      const localRecord =
        (paymentData.providerPaymentId ? await getPixPaymentByProviderPaymentId(paymentData.providerPaymentId) : null) ??
        (paymentData.externalReference ? await getPixPaymentByExternalReference(paymentData.externalReference) : null);

      if (!localRecord) {
        return res.status(200).send("payment not tracked");
      }

      const synced = await syncPixPaymentRecord(paymentData);
      if (event !== "PAYMENT_RECEIVED" || paymentData.status !== "RECEIVED") {
        return res.status(200).send(synced?.status ?? "pending");
      }

      const targetRecord = synced ?? (await getPixPaymentById(localRecord.id)) ?? localRecord;
      const result = await creditPixPaymentIfNeeded({
        pixPaymentId: targetRecord.id,
        usuarioId: targetRecord.usuarioId,
        valor: Number(targetRecord.valor),
        providerPaymentId: paymentData.providerPaymentId,
      });

      return res.status(200).send(result.credited ? "credited" : "already");
    } catch (error) {
      console.error("[asaas webhook] error", error);
      return res.status(500).send("error");
    }
  });

  app.get("/api/asaas/withdraw-validation", (_req, res) => {
    res.status(200).json({
      ok: true,
      service: "dg-hub",
      webhook: "asaas-withdraw-validation",
      now: new Date().toISOString(),
    });
  });

  app.post("/api/asaas/withdraw-validation", async (req, res) => {
    try {
      const authHeader = String(req.headers["asaas-access-token"] ?? "");
      if (ENV.asaasWithdrawWebhookToken && authHeader !== ENV.asaasWithdrawWebhookToken) {
        console.warn("[asaas withdraw webhook] invalid token");
        return res.status(401).json({
          status: "REFUSED",
          refuseReason: "Token de autenticacao invalido",
        });
      }

      const body = req.body as any;
      const type = String(body?.type ?? "");

      console.log("[asaas withdraw webhook] validation request", {
        type,
        transferId: body?.transfer?.id ?? body?.pixRefund?.transferId ?? null,
      });

      return res.status(200).json({ status: "APPROVED" });
    } catch (error) {
      console.error("[asaas withdraw webhook] error", error);
      return res.status(500).json({
        status: "REFUSED",
        refuseReason: "Falha interna ao validar saque",
      });
    }
  });

  app.use((error: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (error?.type === "entity.too.large") {
      return res.status(413).json({
        error: {
          code: "PAYLOAD_TOO_LARGE",
          message: "O lote de imagens excede o limite permitido pelo servidor.",
        },
      });
    }
    return next(error);
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const host = "0.0.0.0";
  const preferredPort = parseInt(process.env.PORT || "10000", 10);
  const port =
    (await isPortAvailable(preferredPort, host)) ? preferredPort : await findAvailablePort(preferredPort + 1, host);

  const startListening = (portToUse: number) => {
    if (portToUse !== preferredPort) {
      console.warn(`Port ${preferredPort} in use, switched to ${portToUse}`);
    }
    server.listen(portToUse, host, () => {
      console.log(`Server running on port ${portToUse}`);
    });
  };

  server.on("error", async err => {
    if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
      const fallbackPort = await findAvailablePort(preferredPort + 1, host);
      startListening(fallbackPort);
      return;
    }
    console.error("Server error:", err);
  });

  startListening(port);
}

startServer().catch(console.error);

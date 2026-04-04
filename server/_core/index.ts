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
import { prisma } from "./prisma";
import axios from "axios";
import { ENV } from "./env";
import crypto from "crypto";

// Default to development to enable Vite middleware when NODE_ENV is unset (Windows-friendly)
process.env.NODE_ENV ??= "development";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ limit: "5mb", extended: true }));
  // Security headers básicos (usar proxy para HSTS/CSP avançado)
  app.use((_, res, next) => {
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });
  // Força HTTPS quando atrás de proxy que define X-Forwarded-Proto
  app.enable("trust proxy");
  app.use((req, res, next) => {
    if (req.secure || req.headers["x-forwarded-proto"] === "https") return next();
    // Em dev (sem https), apenas segue
    if (process.env.NODE_ENV !== "production") return next();
    const host = req.headers.host ?? "";
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  });
  // Static uploads (local fallback for avatares)
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use("/uploads", express.static(uploadsDir));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Webhook Mercado Pago PIX
  app.post("/api/mp/webhook", async (req, res) => {
    try {
      const type = (req.body as any)?.type;
      const paymentId = (req.body as any)?.data?.id;
      if (type !== "payment" || !paymentId) {
        return res.status(200).send("ignored");
      }
      if (!ENV.mpAccessToken) {
        return res.status(500).send("mp token missing");
      }

       // Validação opcional de assinatura do webhook (Mercado Pago)
      const signatureHeader = (req.headers["x-signature"] as string | undefined) ?? "";
      const requestId = req.headers["x-request-id"] as string | undefined;
      if (ENV.mpWebhookSecret) {
        if (!signatureHeader || !requestId) {
          return res.status(401).send("missing signature");
        }
        const parts = Object.fromEntries(
          signatureHeader
            .split(",")
            .map(s => s.split("="))
            .filter(arr => arr.length === 2)
            .map(([k, v]) => [k.trim(), v.trim()])
        );
        const ts = parts["ts"];
        const v1 = parts["v1"];
        if (!ts || !v1) {
          return res.status(401).send("invalid signature format");
        }
        const expected = crypto.createHmac("sha256", ENV.mpWebhookSecret).update(`${paymentId}${ts}`).digest("hex");
        if (expected !== v1) {
          return res.status(401).send("invalid signature");
        }
      }

      const paymentResp = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${ENV.mpAccessToken}` },
      });
      const payment = paymentResp.data as any;
      if (payment?.status !== "approved") {
        return res.status(200).send("pending");
      }
      const userId = payment?.metadata?.userId;
      if (!userId) {
        return res.status(200).send("no user");
      }

      // evita credito duplicado usando notificacao como log
      const already = await prisma.notificacao.findFirst({
        where: { usuarioId: Number(userId), tipo: "deposito", mensagem: String(paymentId) },
      });
      if (already) {
        return res.status(200).send("already");
      }

      await prisma.user.update({
        where: { id: Number(userId) },
        data: { saldoPremio: { increment: Number(payment.transaction_amount) || 0 } },
      });

      await prisma.notificacao.create({
        data: {
          usuarioId: Number(userId),
          tipo: "deposito",
          mensagem: String(paymentId),
        },
      });

      return res.status(200).send("ok");
    } catch (error) {
      console.error("[mp webhook] error", error);
      return res.status(500).send("error");
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "10000", 10);
  const host = "0.0.0.0";

  server.listen(port, host, () => {
    console.log(`Server running on port ${port}`);
  });
}

startServer().catch(console.error);

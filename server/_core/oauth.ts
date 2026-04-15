import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import axios from "axios";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

type OAuthState = {
  redirectUri: string;
  returnTo?: string;
  nativeNonce?: string;
};

type NativeSessionEntry = {
  sessionToken: string;
  expiresAt: number;
};

let oauthCallbackHits = 0;
const processedCodes = new Map<string, number>(); // code -> timestamp
const nativeSessions = new Map<string, NativeSessionEntry>();

const CLEAN_REDIRECT = "/";
const NATIVE_SESSION_TTL_MS = 5 * 60 * 1000;
const sanitizeReturnTo = (value?: string) => {
  if (!value) return CLEAN_REDIRECT;
  // Remove query/fragment to avoid reentrar no callback
  const trimmed = value.split("?")[0]?.split("#")[0] ?? CLEAN_REDIRECT;
  if (!trimmed || trimmed === "/auth/google/callback") return CLEAN_REDIRECT;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed.replace(/^\/+/, "")}`;
};

function describeDbTarget() {
  const url = process.env.DATABASE_URL;
  if (!url) return "DATABASE_URL not set";
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}`;
  } catch {
    const hostMatch = url.match(/@([^;/:]+)(?::(\d+))?/);
    if (hostMatch) {
      const host = hostMatch[1];
      const port = hostMatch[2] ? `:${hostMatch[2]}` : "";
      return `db://${host}${port}`;
    }
    return "DATABASE_URL present but could not parse host";
  }
}

function decodeState(state: string): OAuthState {
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
    return {
      redirectUri: decoded.redirectUri,
      returnTo: decoded.returnTo ?? "/",
      nativeNonce: decoded.nativeNonce,
    };
  } catch {
    const redirectUri = Buffer.from(state, "base64").toString("utf-8");
    return { redirectUri, returnTo: "/" };
  }
}

function cleanupExpiredNativeSessions(now = Date.now()) {
  for (const [nonce, entry] of Array.from(nativeSessions.entries())) {
    if (entry.expiresAt <= now) {
      nativeSessions.delete(nonce);
    }
  }
}

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function buildGoogleAuthorizeUrl(req: Request) {
  if (!ENV.googleClientId) {
    throw new Error("GOOGLE_CLIENT_ID nao configurado");
  }

  const redirectUri = "https://app.dggames.online/auth/google/callback";
  const returnTo = sanitizeReturnTo(getQueryParam(req, "returnTo") ?? "/");
  const nativeNonce = getQueryParam(req, "nativeNonce");
  const source = getQueryParam(req, "source") ?? "server";
  const state = Buffer.from(
    JSON.stringify({
      redirectUri,
      returnTo,
      nativeNonce,
    }),
    "utf-8"
  ).toString("base64");

  const googleAuth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuth.searchParams.set("client_id", ENV.googleClientId);
  googleAuth.searchParams.set("redirect_uri", redirectUri);
  googleAuth.searchParams.set("response_type", "code");
  googleAuth.searchParams.set("scope", "openid email profile");
  googleAuth.searchParams.set("state", state);
  googleAuth.searchParams.set("prompt", "select_account");

  console.log("[OAuth] authorize redirect", { redirectUri, source, returnTo, native: Boolean(nativeNonce) });
  return googleAuth.toString();
}

function describeAxiosError(error: unknown) {
  if (!axios.isAxiosError(error)) return null;
  return {
    status: error.response?.status,
    data: error.response?.data,
    url: error.config?.url,
    method: error.config?.method,
  };
}

async function handleOAuthCallback(req: Request, res: Response) {
  const code = getQueryParam(req, "code");
  const state = getQueryParam(req, "state");
  oauthCallbackHits += 1;
  console.log("[OAuth] Callback received", {
    url: req.originalUrl,
    hasCode: Boolean(code),
    hasState: Boolean(state),
    hits: oauthCallbackHits,
  });

  if (code) {
    const now = Date.now();
    // expira itens com mais de 10 minutos
    for (const [storedCode, ts] of Array.from(processedCodes.entries())) {
      if (now - ts > 10 * 60 * 1000) {
        processedCodes.delete(storedCode);
      }
    }
    if (processedCodes.has(code)) {
      console.warn("[OAuth] Duplicate callback code detected, treating as already processed", {
        codeMask: `${code.slice(0, 4)}***`,
      });
      const safeTarget = sanitizeReturnTo(state ? decodeState(state).returnTo : CLEAN_REDIRECT);
      return res.redirect(302, safeTarget);
    }
    processedCodes.set(code, now);
  }

  if (!code || !state) {
    res.status(400).json({ error: "code and state are required" });
    return;
  }

  try {
    const decodedState = decodeState(state);
    const tokenResponse = await sdk.exchangeCodeForToken(code, state);
    const userInfo = await sdk.getUserInfo(tokenResponse);

    if (!userInfo.openId) {
      res.status(400).json({ error: "openId missing from user info" });
      return;
    }

    try {
      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });
    } catch (dbError) {
      console.error("[OAuth] Failed to persist user during callback", {
        error: dbError instanceof Error ? dbError.message : String(dbError),
        dbTarget: describeDbTarget(),
        hint: "Se for erro de conexao/firewall, libere os IPs de saida do Render no Azure SQL",
      });
      throw dbError;
    }

    const sessionToken = await sdk.createSessionToken(userInfo.openId, {
      name: userInfo.name || "",
      expiresInMs: 10 * 60 * 1000, // 10 minutos
    });

    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: 10 * 60 * 1000 });

    if (decodedState.nativeNonce) {
      cleanupExpiredNativeSessions();
      nativeSessions.set(decodedState.nativeNonce, {
        sessionToken,
        expiresAt: Date.now() + NATIVE_SESSION_TTL_MS,
      });
      res
        .status(200)
        .type("html")
        .send(`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Login concluido</title>
    <style>
      body { font-family: Arial, sans-serif; background: #0b1020; color: #f3f6ff; display: flex; min-height: 100vh; align-items: center; justify-content: center; margin: 0; }
      main { max-width: 26rem; padding: 2rem; border: 1px solid rgba(255,255,255,0.12); border-radius: 1rem; background: rgba(255,255,255,0.05); text-align: center; }
      h1 { margin-top: 0; font-size: 1.4rem; }
      p { color: #c8d1ea; line-height: 1.5; }
    </style>
  </head>
  <body>
    <main>
      <h1>Login concluido</h1>
      <p>Volte para o app DG Hub para continuar.</p>
    </main>
  </body>
</html>`);
      return;
    }

    const target = sanitizeReturnTo(decodedState.returnTo);
    res.redirect(302, target);
  } catch (error) {
    const axiosDetail = describeAxiosError(error);
    if (axiosDetail) {
      console.error("[OAuth] Callback failed (axios)", axiosDetail);
    } else {
      console.error("[OAuth] Callback failed", error);
    }
    const message =
      error instanceof Error ? error.message : typeof error === "string" ? error : "unknown error";
    // Return sanitized detail even em producao para facilitar diagnostico de redirect_uri_mismatch
    res.status(500).json({
      error: "OAuth callback failed",
      detail: message,
      hint: "verifique GOOGLE_CLIENT_ID/SECRET, redirect_uri autorizado, variaveis VITE_* e conectividade com o banco",
      upstream: axiosDetail ?? undefined,
    });
  }
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/google/start", (req, res) => {
    try {
      const url = buildGoogleAuthorizeUrl(req);
      res.redirect(302, url);
    } catch (error) {
      res.status(500).json({
        error: "OAuth start failed",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  });
  app.get("/api/oauth/callback", handleOAuthCallback);
  app.get("/auth/google/callback", handleOAuthCallback);
  app.get("/api/oauth/native-session", (req, res) => {
    cleanupExpiredNativeSessions();
    const nonce = getQueryParam(req, "nonce");
    if (!nonce) {
      res.status(400).json({ error: "nonce is required" });
      return;
    }

    const entry = nativeSessions.get(nonce);
    if (!entry) {
      res.status(202).json({ ready: false });
      return;
    }

    nativeSessions.delete(nonce);
    res.status(200).json({
      ready: true,
      sessionToken: entry.sessionToken,
    });
  });
}

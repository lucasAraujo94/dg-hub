import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import axios from "axios";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

type OAuthState = {
  redirectUri: string;
  returnTo?: string;
};

let oauthCallbackHits = 0;
const processedCodes = new Map<string, number>(); // code -> timestamp

const CLEAN_REDIRECT = "/";
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
    };
  } catch {
    const redirectUri = Buffer.from(state, "base64").toString("utf-8");
    return { redirectUri, returnTo: "/" };
  }
}

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
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
    for (const [storedCode, ts] of processedCodes) {
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
  app.get("/api/oauth/callback", handleOAuthCallback);
  app.get("/auth/google/callback", handleOAuthCallback);
}

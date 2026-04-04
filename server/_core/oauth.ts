import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

type OAuthState = {
  redirectUri: string;
  returnTo?: string;
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
      return `sqlserver://${host}${port}`;
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

async function handleOAuthCallback(req: Request, res: Response) {
  const code = getQueryParam(req, "code");
  const state = getQueryParam(req, "state");

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
        hint: "Se for erro de conexão/firewall, libere os IPs de saída do Render no Azure SQL",
      });
      throw dbError;
    }

    const sessionToken = await sdk.createSessionToken(userInfo.openId, {
      name: userInfo.name || "",
      expiresInMs: ONE_YEAR_MS,
    });

    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

    res.redirect(302, decodedState.returnTo || "/");
  } catch (error) {
    console.error("[OAuth] Callback failed", error);
    const message =
      error instanceof Error ? error.message : typeof error === "string" ? error : "unknown error";
    // Return sanitized detail even em produção para facilitar diagnóstico de redirect_uri_mismatch
    res.status(500).json({
      error: "OAuth callback failed",
      detail: message,
      hint: "verifique GOOGLE_CLIENT_ID/SECRET, redirect_uri autorizado, variáveis VITE_* e conectividade com o banco",
    });
  }
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", handleOAuthCallback);
  app.get("/auth/google/callback", handleOAuthCallback);
}

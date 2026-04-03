import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

type OAuthState = {
  redirectUri: string;
  returnTo?: string;
};

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

    await db.upsertUser({
      openId: userInfo.openId,
      name: userInfo.name || null,
      email: userInfo.email ?? null,
      loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
      lastSignedIn: new Date(),
    });

    const sessionToken = await sdk.createSessionToken(userInfo.openId, {
      name: userInfo.name || "",
      expiresInMs: ONE_YEAR_MS,
    });

    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

    res.redirect(302, decodedState.returnTo || "/");
  } catch (error) {
    console.error("[OAuth] Callback failed", error);
    // Surface a tiny hint in dev without leaking secrets
    const message =
      error instanceof Error ? error.message : typeof error === "string" ? error : "unknown error";
    if (process.env.NODE_ENV !== "production") {
      res.status(500).json({
        error: "OAuth callback failed",
        detail: message,
        hint: "check server logs for token exchange/userinfo details",
      });
      return;
    }
    res.status(500).json({ error: "OAuth callback failed" });
  }
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", handleOAuthCallback);
  app.get("/auth/google/callback", handleOAuthCallback);
}

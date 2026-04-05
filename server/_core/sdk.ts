import { AXIOS_TIMEOUT_MS, COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import axios, { type AxiosInstance } from "axios";
import https from "https";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import util from "util";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "./prisma";
import * as db from "../db";
import { ENV } from "./env";
import type {
  ExchangeTokenRequest,
  ExchangeTokenResponse,
  GetUserInfoResponse,
  GetUserInfoWithJwtRequest,
  GetUserInfoWithJwtResponse,
} from "./types/manusTypes";
// Utility function
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

const EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
const GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
const GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;

// Ensure Google hosts bypass proxies that can break TLS handshakes
const NO_PROXY_GOOGLE = "oauth2.googleapis.com,accounts.google.com,openidconnect.googleapis.com";
const existingNoProxy = process.env.NO_PROXY || process.env.no_proxy || "";
const mergedNoProxy = [existingNoProxy, NO_PROXY_GOOGLE].filter(Boolean).join(",");
process.env.NO_PROXY = mergedNoProxy;
process.env.no_proxy = mergedNoProxy;

const googleAgent = new https.Agent({ keepAlive: true });
// Dedicated axios instance for Google endpoints with proxy disabled
const googleAxios = axios.create({
  timeout: AXIOS_TIMEOUT_MS,
  proxy: false,
  httpAgent: googleAgent,
  httpsAgent: googleAgent,
});

type GoogleTokenResponse = {
  access_token: string;
  id_token?: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
};

type OAuthState = {
  redirectUri: string;
  returnTo?: string;
};

const formatAxiosError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    return {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url,
      method: error.config?.method,
    };
  }
  return error;
};

class OAuthService {
  constructor(private client: ReturnType<typeof axios.create>) {
    if (ENV.oAuthServerUrl) {
      console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    } else {
      console.log("[OAuth] Using Google OAuth flow");
    }
  }

  private decodeState(state: string): OAuthState {
    const decode = () =>
      JSON.parse(Buffer.from(state, "base64").toString("utf-8")) as OAuthState;

    try {
      const decoded = decode();
      return {
        redirectUri: decoded.redirectUri,
        returnTo: decoded.returnTo ?? "/",
      };
    } catch {
      // Backwards compatibility: state was just redirectUri
      const redirectUri = Buffer.from(state, "base64").toString("utf-8");
      return { redirectUri, returnTo: "/" };
    }
  }

  private resolveRedirectUri(): string {
    // Redirect fixo para evitar divergência entre authorize e token exchange
    return "https://app.dggames.online/auth/google/callback";
  }

  async getTokenByCode(
    code: string,
    state: string
  ): Promise<ExchangeTokenResponse | GoogleTokenResponse> {
    const redirectUri = this.resolveRedirectUri();
    // Prefer Google if client/secret configured
    if (ENV.googleClientId && ENV.googleClientSecret) {
      console.log("redirect_uri (token):", redirectUri, "client_id:", `${ENV.googleClientId.slice(0, 6)}***`);
      const body = new URLSearchParams({
        code,
        client_id: ENV.googleClientId,
        client_secret: ENV.googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      });

      try {
        const { data } = await googleAxios.post<GoogleTokenResponse>(
          "https://oauth2.googleapis.com/token",
          body.toString(),
          { headers: { "Content-Type": "application/x-www-form-urlencoded" }, proxy: false }
        );
        return data;
      } catch (error) {
        console.error("[OAuth] Google token exchange failed", {
          detail: util.inspect(formatAxiosError(error), { depth: null }),
          redirectUri,
          clientId: ENV.googleClientId?.slice(0, 6) + "***",
          hasSecret: Boolean(ENV.googleClientSecret),
        });
        throw error;
      }
    }

    // Custom OAuth portal
    if (ENV.oAuthServerUrl) {
      const payload: ExchangeTokenRequest = {
        clientId: ENV.appId,
        grantType: "authorization_code",
        code,
        redirectUri,
      };

      const { data } = await this.client.post<ExchangeTokenResponse>(
        EXCHANGE_TOKEN_PATH,
        payload
      );
      return data;
    }

    // Google OAuth fallback
    if (!ENV.googleClientId || !ENV.googleClientSecret) {
      throw new Error("Google OAuth not configured");
    }

    const body = new URLSearchParams({
      code,
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });

    const { data } = await axios.post<GoogleTokenResponse>(
      "https://oauth2.googleapis.com/token",
      body.toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: AXIOS_TIMEOUT_MS }
    );

    return data;
  }

  async getUserInfoByToken(
    token: ExchangeTokenResponse | GoogleTokenResponse
  ): Promise<GetUserInfoResponse> {
    // Prefer Google if configured
    if (ENV.googleClientId && ENV.googleClientSecret) {
      // If Google returned an ID token, validate it against tokeninfo (server-side verification)
      if ("id_token" in token && token.id_token) {
        try {
          const { data } = await axios.get<any>(
            "https://oauth2.googleapis.com/tokeninfo",
            {
              params: { id_token: token.id_token },
              timeout: AXIOS_TIMEOUT_MS,
            }
          );

          return {
            openId: data.sub,
            name: data.name ?? data.email ?? "",
            email: data.email ?? null,
            platform: "google",
            loginMethod: "google",
          } as GetUserInfoResponse;
        } catch (error) {
          console.error("[OAuth] Google id_token validation failed", error);
          throw error;
        }
      }

      // Fallback: fetch userinfo using the access token
      const accessToken = "accessToken" in token ? token.accessToken : token.access_token;
      try {
        const { data } = await googleAxios.get<any>(
          "https://openidconnect.googleapis.com/v1/userinfo",
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            proxy: false,
          }
        );

        return {
          openId: data.sub,
          name: data.name ?? data.email ?? "",
          email: data.email ?? null,
          platform: "google",
          loginMethod: "google",
        } as GetUserInfoResponse;
      } catch (error) {
        console.error("[OAuth] Google userinfo fetch failed", error);
        throw error;
      }
    }

    // Custom OAuth portal
    if ("accessToken" in token && ENV.oAuthServerUrl) {
      const { data } = await this.client.post<GetUserInfoResponse>(
        GET_USER_INFO_PATH,
        {
          accessToken: token.accessToken,
        }
      );

      return data;
    }

    throw new Error("No OAuth provider configured");
  }
}

const createOAuthHttpClient = (): AxiosInstance =>
  axios.create({
    baseURL: ENV.oAuthServerUrl || undefined,
    timeout: AXIOS_TIMEOUT_MS,
  });

class SDKServer {
  private readonly client: AxiosInstance;
  private readonly oauthService: OAuthService;

  constructor(client: AxiosInstance = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }

  private deriveLoginMethod(
    platforms: unknown,
    fallback: string | null | undefined
  ): string | null {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set<string>(
      platforms.filter((p): p is string => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (
      set.has("REGISTERED_PLATFORM_MICROSOFT") ||
      set.has("REGISTERED_PLATFORM_AZURE")
    )
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }

  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(
    code: string,
    state: string
  ): Promise<ExchangeTokenResponse | GoogleTokenResponse> {
    return this.oauthService.getTokenByCode(code, state);
  }

  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(token: ExchangeTokenResponse | GoogleTokenResponse): Promise<GetUserInfoResponse> {
    const data = await this.oauthService.getUserInfoByToken(token);
    const loginMethod = this.deriveLoginMethod(
      (data as any)?.platforms,
      (data as any)?.platform ?? data.platform ?? null
    );
    return {
      ...(data as any),
      platform: loginMethod,
      loginMethod,
    } as GetUserInfoResponse;
  }

  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }

    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    if (!secret || secret.length === 0) {
      throw new Error(
        "Session secret (JWT_SECRET) is not set. Define JWT_SECRET env var to sign/verify session cookies."
      );
    }
    return new TextEncoder().encode(secret);
  }

  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {}
  ): Promise<string> {
    // Fail fast if secret is missing to avoid "Zero-length key" downstream
    const secretKey = this.getSessionSecret();
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || "",
      },
      { ...options, secretKey }
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number; secretKey?: Uint8Array } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = options.secretKey ?? this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<{ openId: string; appId: string; name: string } | null> {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { openId, appId, name } = payload as Record<string, unknown>;

      if (
        !isNonEmptyString(openId) ||
        !isNonEmptyString(appId) ||
        !isNonEmptyString(name)
      ) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }

      return {
        openId,
        appId,
        name,
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  async getUserInfoWithJwt(
    jwtToken: string
  ): Promise<GetUserInfoWithJwtResponse> {
    const payload: GetUserInfoWithJwtRequest = {
      jwtToken,
      projectId: ENV.appId,
    };

    const { data } = await this.client.post<GetUserInfoWithJwtResponse>(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );

    const loginMethod = this.deriveLoginMethod(
      (data as any)?.platforms,
      (data as any)?.platform ?? data.platform ?? null
    );
    return {
      ...(data as any),
      platform: loginMethod,
      loginMethod,
    } as GetUserInfoWithJwtResponse;
  }

  async authenticateRequest(req: Request): Promise<User> {
    // Regular authentication flow
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);

    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    const sessionUserId = session.openId;
    const signedInAt = new Date();
    let user = await db.getUserByOpenId(sessionUserId);

    // If user not in DB, sync from OAuth server automatically
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await db.upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt,
        });
        user = await db.getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }

    if (!user) {
      throw ForbiddenError("User not found");
    }

    await db.upsertUser({
      openId: user.openId,
      role: user.role, // preserve role on each request (e.g., admin)
      lastSignedIn: signedInAt,
    });

    return user;
  }
}

export const sdk = new SDKServer();

import { Capacitor } from "@capacitor/core";
export {
  COOKIE_NAME,
  ONE_YEAR_MS,
  AXIOS_TIMEOUT_MS,
  UNAUTHED_ERR_MSG,
  NOT_ADMIN_ERR_MSG,
} from "@shared/const";

export const isNativeApp = Capacitor?.isNativePlatform?.() ?? false;
export const APP_ORIGIN = "https://app.dggames.online";

const normalizePath = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return `/${trimmed.replace(/^\/+/,'').replace(/\/+$/, "")}`;
};

const getRedirectUri = () => {
  return `${APP_ORIGIN}/auth/google/callback`;
};

export const getApiBaseUrl = () => {
  if (isNativeApp) return APP_ORIGIN;
  return "";
};

// OAuth now starts on the backend so frontend build vars do not gate the flow.
export const hasGoogleClientId = true;
export const hasOAuthProvider = true;

export const getLoginUrl = (
  source: string = "unspecified",
  options?: { nativeNonce?: string }
) => {
  const returnTo = (typeof window !== "undefined" ? window.location.pathname : "/") || "/";
  const url = new URL(`${APP_ORIGIN}/api/oauth/google/start`);
  url.searchParams.set("returnTo", returnTo);
  url.searchParams.set("source", source);
  if (options?.nativeNonce) {
    url.searchParams.set("nativeNonce", options.nativeNonce);
  }
  return url.toString();
};

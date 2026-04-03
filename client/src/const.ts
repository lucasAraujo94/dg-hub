export { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const";

const normalizePath = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return `/${trimmed.replace(/^\/+/, "").replace(/\/+$/, "")}`;
};

// Redirect deve apontar para o backend (não GitHub Pages)
const getRedirectUri = () => {
  // Permite definir a URL completa diretamente
  const explicitRedirect = import.meta.env.VITE_GOOGLE_REDIRECT_URL;
  if (explicitRedirect) return explicitRedirect;

  const apiOrigin =
    import.meta.env.VITE_BACKEND_ORIGIN ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const redirectPath = normalizePath(
    import.meta.env.VITE_GOOGLE_REDIRECT_PATH || "/auth/google/callback"
  );
  return `${apiOrigin}${redirectPath}`;
};

// Generate login URL at runtime so redirect URI reflects the current origin/backend.
export const hasGoogleClientId = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
export const hasOAuthProvider =
  hasGoogleClientId || Boolean(import.meta.env.VITE_OAUTH_PORTAL_URL);

export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID || "dev";
  const redirectUri = getRedirectUri();
  const statePayload = {
    redirectUri,
    returnTo: (typeof window !== "undefined" ? window.location.pathname : "/") || "/",
  };
  const state = btoa(JSON.stringify(statePayload));

  // Prefer Google when client id is provided
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (googleClientId) {
    const googleAuth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleAuth.searchParams.set("client_id", googleClientId);
    googleAuth.searchParams.set("redirect_uri", redirectUri);
    googleAuth.searchParams.set("response_type", "code");
    googleAuth.searchParams.set("scope", "openid email profile");
    googleAuth.searchParams.set("state", state);
    googleAuth.searchParams.set("prompt", "select_account");
    return googleAuth.toString();
  }

  // Otherwise, try custom OAuth portal
  if (oauthPortalUrl) {
    try {
      const url = new URL(`${oauthPortalUrl}/app-auth`);
      url.searchParams.set("appId", appId);
      url.searchParams.set("redirectUri", redirectUri);
      url.searchParams.set("state", state);
      url.searchParams.set("type", "signIn");
      return url.toString();
    } catch (error) {
      console.warn("[Auth] Invalid VITE_OAUTH_PORTAL_URL, falling back to Google login screen:", error);
    }
  }

  // Fallback: force Google login screen (no tokens without client config)
  return "https://accounts.google.com/ServiceLogin?prompt=select_account";
};

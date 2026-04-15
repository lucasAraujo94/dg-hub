const NATIVE_SESSION_TOKEN_KEY = "dg-native-session-token";
const NATIVE_OAUTH_NONCE_KEY = "dg-native-oauth-nonce";

const canUseStorage = () => typeof window !== "undefined";

export function getNativeSessionToken() {
  if (!canUseStorage()) return null;
  return localStorage.getItem(NATIVE_SESSION_TOKEN_KEY);
}

export function setNativeSessionToken(token: string) {
  if (!canUseStorage()) return;
  localStorage.setItem(NATIVE_SESSION_TOKEN_KEY, token);
}

export function clearNativeSessionToken() {
  if (!canUseStorage()) return;
  localStorage.removeItem(NATIVE_SESSION_TOKEN_KEY);
}

export function getPendingOAuthNonce() {
  if (!canUseStorage()) return null;
  return localStorage.getItem(NATIVE_OAUTH_NONCE_KEY);
}

export function setPendingOAuthNonce(nonce: string) {
  if (!canUseStorage()) return;
  localStorage.setItem(NATIVE_OAUTH_NONCE_KEY, nonce);
}

export function clearPendingOAuthNonce() {
  if (!canUseStorage()) return;
  localStorage.removeItem(NATIVE_OAUTH_NONCE_KEY);
}

export function createOAuthNonce() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

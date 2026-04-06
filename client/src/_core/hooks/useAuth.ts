import { getLoginUrl, UNAUTHED_ERR_MSG } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

const SESSION_EXPIRES_MINUTES = 10;

function normalizeRedirect(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("#")) return path;
  if (path.startsWith("/")) return `#${path}`;
  return `#/${path}`;
}

const isDataUrl = (value: unknown) => typeof value === "string" && value.startsWith("data:");
const isHuge = (value: unknown, limit: number) => typeof value === "string" && value.length > limit;

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } = options ?? {};
  const utils = trpc.useUtils();

  const cachedUser =
    typeof window !== "undefined"
      ? (() => {
          try {
            const raw = localStorage.getItem("manus-runtime-user-info");
            const avatar = localStorage.getItem("dg-avatar-url");
            if (!raw && avatar) {
              return { avatarUrl: avatar, avatar };
            }
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (avatar && !parsed?.avatarUrl) {
              parsed.avatarUrl = avatar;
              parsed.avatar = avatar;
            }
            return parsed;
          } catch {
            return null;
          }
        })()
      : null;

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    initialData: cachedUser ?? undefined,
    onError: error => {
      const isUnauthorized = error instanceof TRPCClientError && error.message === UNAUTHED_ERR_MSG;
      if (isUnauthorized && typeof window !== "undefined") {
        try {
          localStorage.removeItem("manus-runtime-user-info");
        } catch {
          /* ignore */
        }
      }
    },
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED") {
        return;
      }
      throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const isUnauthorized = meQuery.error instanceof TRPCClientError && meQuery.error.message === UNAUTHED_ERR_MSG;

  const userSafe = isUnauthorized ? null : meQuery.data ?? null;

  const state = useMemo(
    () => ({
      user: userSafe,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(userSafe),
      sessionExpiresInMinutes: SESSION_EXPIRES_MINUTES,
    }),
    [userSafe, meQuery.error, meQuery.isLoading, logoutMutation.error, logoutMutation.isPending]
  );

  useEffect(() => {
    if (!meQuery.data) return;
    try {
      const payload = { ...meQuery.data };
      const avatarUrl = (payload as any).avatarUrl as string | undefined;
      // guardar avatar curto no cache separado
      if (avatarUrl && !isDataUrl(avatarUrl) && !isHuge(avatarUrl, 1500)) {
        localStorage.setItem("dg-avatar-url", avatarUrl);
      }
      // evitar gravar data URL gigante no cache persistente
      const payloadForStorage = { ...payload };
      if (avatarUrl && (isDataUrl(avatarUrl) || isHuge(avatarUrl, 1500))) {
        delete (payloadForStorage as any).avatarUrl;
        delete (payloadForStorage as any).avatar;
      }
      localStorage.setItem("manus-runtime-user-info", JSON.stringify(payloadForStorage));
    } catch {
      /* ignore */
    }
  }, [meQuery.data]);

  // Repõe avatar do cache quando o backend não devolver (evita sumiço após logout/navegação)
  useEffect(() => {
    if (!meQuery.data || typeof window === "undefined") return;
    try {
      const cachedAvatar = localStorage.getItem("dg-avatar-url");
      const hasAvatar = Boolean((meQuery.data as any).avatarUrl || (meQuery.data as any).avatar);
      if (cachedAvatar && !hasAvatar) {
        utils.auth.me.setData(
          undefined,
          prev =>
            prev
              ? { ...prev, avatarUrl: cachedAvatar, avatar: cachedAvatar }
              : ({ ...meQuery.data, avatarUrl: cachedAvatar, avatar: cachedAvatar } as any)
        );
      }
    } catch {
      /* ignore */
    }
  }, [meQuery.data, utils]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;

    const target = normalizeRedirect(redirectPath);
    const current = window.location.hash || window.location.href;
    if (current === target) return;

    window.location.replace(target);
  }, [redirectOnUnauthenticated, redirectPath, logoutMutation.isPending, meQuery.isLoading, state.user]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}

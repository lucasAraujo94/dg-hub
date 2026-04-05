import { getLoginUrl, UNAUTHED_ERR_MSG } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

function normalizeRedirect(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("#")) return path;
  if (path.startsWith("/")) return `#${path}`;
  return `#/${path}`;
}

const isHugeDataUrl = (value: unknown) =>
  typeof value === "string" && value.startsWith("data:") && value.length > 4000;

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};
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
      const isUnauthorized =
        error instanceof TRPCClientError && error.message === UNAUTHED_ERR_MSG;
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
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const isUnauthorized =
    meQuery.error instanceof TRPCClientError &&
    meQuery.error.message === UNAUTHED_ERR_MSG;

  const userSafe = isUnauthorized ? null : meQuery.data ?? null;

  const state = useMemo(
    () => ({
      user: userSafe,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(userSafe),
    }),
    [
      userSafe,
      meQuery.error,
      meQuery.isLoading,
      logoutMutation.error,
      logoutMutation.isPending,
    ]
  );

  useEffect(() => {
    if (!meQuery.data) return;
    try {
      const payload = { ...meQuery.data };
      if (isHugeDataUrl((payload as any).avatarUrl)) {
        // Não salvar data URL gigante no objeto principal; guardar só em dg-avatar-url
        localStorage.setItem("dg-avatar-url", String((payload as any).avatarUrl));
        delete (payload as any).avatarUrl;
        delete (payload as any).avatar;
      } else if ((payload as any).avatarUrl) {
        localStorage.setItem("dg-avatar-url", String((payload as any).avatarUrl));
      }
      localStorage.setItem("manus-runtime-user-info", JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }, [meQuery.data]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;

    const target = normalizeRedirect(redirectPath);
    const current = window.location.hash || window.location.href;
    if (current === target) return;

    window.location.replace(target);
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}

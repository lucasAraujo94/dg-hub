import { getLoginUrl, UNAUTHED_ERR_MSG } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

function normalizeRedirect(path: string) {
  // URLs absolutas (http/https) ficam como estão
  if (/^https?:\/\//i.test(path)) return path;
  // Se já veio com hash, mantém
  if (path.startsWith("#")) return path;
  // Paths absolutos viram hash para funcionar no GitHub Pages
  if (path.startsWith("/")) return `#${path}`;
  // Paths relativos simples
  return `#/${path}`;
}

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};
  const utils = trpc.useUtils();

  // Usa cache local como ponto de partida para evitar "pisar" avatar recém salvo
  const cachedUser =
    typeof window !== "undefined"
      ? (() => {
          try {
            const raw = localStorage.getItem("manus-runtime-user-info");
            if (!raw) return null;
            return JSON.parse(raw);
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
      // Se a sessão expirou, limpa cache local para evitar "login fantasma"
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
      localStorage.setItem("manus-runtime-user-info", JSON.stringify(meQuery.data));
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

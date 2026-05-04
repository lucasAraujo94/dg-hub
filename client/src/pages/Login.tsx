import { useAuth } from "@/_core/hooks/useAuth";
import { APP_ORIGIN, getLoginUrl, hasOAuthProvider, isNativeApp } from "@/const";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  clearPendingOAuthNonce,
  createOAuthNonce,
  getPendingOAuthNonce,
  setNativeSessionToken,
  setPendingOAuthNonce,
} from "@/lib/nativeAuth";
import { trpc } from "@/lib/trpc";
import { getFriendlyLoginError } from "@/lib/userMessages";
import { zodResolver } from "@hookform/resolvers/zod";
import { Browser } from "@capacitor/browser";
import { ArrowLeft, Mail } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Link } from "wouter";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("E-mail invalido"),
  password: z.string().min(8, "Minimo de 8 caracteres"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [isNativeOauthPending, setIsNativeOauthPending] = useState(false);
  const pollingRef = useRef<number | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = "#/";
    }
  }, [isAuthenticated]);

  const stopNativeOauthPolling = useCallback(() => {
    if (pollingRef.current !== null) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const finalizeNativeAuth = useCallback(
    async (sessionToken: string, returnTo?: string | null) => {
      setNativeSessionToken(sessionToken);
      clearPendingOAuthNonce();
      stopNativeOauthPolling();
      setIsNativeOauthPending(false);
      await Browser.close().catch(() => undefined);
      await utils.auth.me.invalidate();
      window.location.href = returnTo && returnTo.startsWith("/") ? `#${returnTo}` : "#/";
    },
    [stopNativeOauthPolling, utils.auth.me]
  );

  const completeNativeOauth = useCallback(
    async (nonce: string) => {
      const response = await fetch(
        `${APP_ORIGIN}/api/oauth/native-session?nonce=${encodeURIComponent(nonce)}`,
        { credentials: "include" }
      );

      if (response.status === 404 || response.status === 202) {
        return false;
      }

      if (!response.ok) {
        throw new Error("Falha ao finalizar login no app.");
      }

      const payload = (await response.json()) as { sessionToken: string };
      if (!payload.sessionToken) {
        throw new Error("Sessao do app nao retornada pelo servidor.");
      }

      await finalizeNativeAuth(payload.sessionToken);
      return true;
    },
    [finalizeNativeAuth]
  );

  const startNativeOauthPolling = useCallback(
    (nonce: string) => {
      stopNativeOauthPolling();
      setIsNativeOauthPending(true);

      const poll = async () => {
        try {
          await completeNativeOauth(nonce);
        } catch (error) {
          stopNativeOauthPolling();
          clearPendingOAuthNonce();
          setIsNativeOauthPending(false);
          toast.error(getFriendlyLoginError(error instanceof Error ? error.message : undefined));
        }
      };

      void poll();
      pollingRef.current = window.setInterval(() => {
        void poll();
      }, 1500);
    },
    [completeNativeOauth, stopNativeOauthPolling]
  );

  useEffect(() => {
    if (!isNativeApp) return;

    const pendingNonce = getPendingOAuthNonce();
    if (pendingNonce) {
      startNativeOauthPolling(pendingNonce);
    }

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const nonce = getPendingOAuthNonce();
      if (nonce) {
        startNativeOauthPolling(nonce);
      }
    };

    const handleFocus = () => {
      const nonce = getPendingOAuthNonce();
      if (nonce) {
        startNativeOauthPolling(nonce);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
      stopNativeOauthPolling();
    };
  }, [startNativeOauthPolling, stopNativeOauthPolling]);

  const handleOauth = useCallback(async () => {
    if (!hasOAuthProvider) {
      toast.error("O login com Google nao esta disponivel agora.");
      return;
    }

    const nativeNonce = isNativeApp ? createOAuthNonce() : undefined;
    const oauthUrl = getLoginUrl(isNativeApp ? "native-app" : "web", { nativeNonce });

    try {
      if (nativeNonce) {
        setPendingOAuthNonce(nativeNonce);
        startNativeOauthPolling(nativeNonce);
      }
      await Browser.open({ url: oauthUrl });
    } catch (error) {
      if (isNativeApp) {
        clearPendingOAuthNonce();
        stopNativeOauthPolling();
        setIsNativeOauthPending(false);
      }
      console.warn("[OAuth] Browser.open falhou, redirecionando via window.location", error);
      window.location.href = oauthUrl;
    }
  }, [startNativeOauthPolling, stopNativeOauthPolling]);

  const loginMutation = trpc.auth.loginLocal.useMutation({
    onSuccess: () => {
      toast.success("Login realizado. Redirecionando...");
      setTimeout(() => {
        window.location.href = "#/";
      }, 400);
    },
    onError: error => {
      toast.error(getFriendlyLoginError(error.message));
    },
  });

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = useCallback(
    async (values: LoginForm) => {
      await loginMutation.mutateAsync(values);
    },
    [loginMutation]
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">DG Hub</p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild className="rounded-full text-sm text-slate-600 hover:bg-white/80 hover:text-slate-950">
              <Link href="/cadastro">Criar conta</Link>
            </Button>
            <Button variant="outline" asChild className="rounded-full border-slate-200 bg-white/70 text-sm text-slate-700">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                <span>Voltar</span>
              </Link>
            </Button>
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center py-8">
          <section className="relative w-full max-w-md overflow-hidden rounded-[32px] border border-white/10 bg-card p-5 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl sm:p-7">
            <div className="relative">
              <div className="mb-8">
                <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">Entrar</h1>
              </div>

              <div className="mb-5 rounded-[24px] border border-white/10 bg-background/40 p-3">
                <Button
                  type="button"
                  onClick={handleOauth}
                  variant="secondary"
                  className="h-12 w-full justify-center gap-2 rounded-2xl bg-primary text-primary-foreground hover:opacity-90"
                  disabled={isNativeOauthPending}
                >
                  <Mail className="h-4 w-4" />
                  {isNativeOauthPending ? "Aguardando conclusao..." : "Entrar com Google"}
                </Button>
                <div className="mt-4 flex items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  <div className="h-px flex-1 bg-border" />
                  ou
                  <div className="h-px flex-1 bg-border" />
                </div>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground">E-mail</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            autoComplete="email"
                            placeholder="voce@email.com"
                            className="h-12 rounded-2xl border-border bg-background text-foreground placeholder:text-muted-foreground"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground">Senha</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            autoComplete="current-password"
                            placeholder="Sua senha"
                            className="h-12 rounded-2xl border-border bg-background text-foreground placeholder:text-muted-foreground"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex flex-col gap-3 pt-2">
                    <Button type="submit" className="h-12 w-full rounded-2xl" disabled={loginMutation.isPending}>
                      {loginMutation.isPending ? "Entrando..." : "Entrar"}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

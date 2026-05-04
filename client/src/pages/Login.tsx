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
import { ArrowLeft, LockKeyhole, Mail } from "lucide-react";
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
    <div className="relative min-h-screen overflow-hidden bg-[#f5f7fb] text-slate-950">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.12),transparent_30%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.14),transparent_28%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)]" />
        <div className="absolute left-[-6%] top-12 h-72 w-72 rounded-full bg-emerald-300/30 blur-[120px]" />
        <div className="absolute right-[-8%] top-0 h-96 w-96 rounded-full bg-sky-300/30 blur-[140px]" />
        <div className="absolute bottom-[-12%] left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-200/30 blur-[130px]" />
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "linear-gradient(rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.04) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
      </div>

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
          <section className="grid w-full max-w-5xl overflow-hidden rounded-[36px] border border-white/70 bg-white/70 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl lg:grid-cols-[0.9fr_1.1fr]">
            <div className="relative flex min-h-[280px] flex-col justify-between bg-slate-950 px-6 py-8 text-white sm:px-8 lg:min-h-[620px] lg:px-10 lg:py-10">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.24),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.2),transparent_32%)]" />
              <div className="relative">
                <div className="mb-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
                  <LockKeyhole className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/55">Login</p>
                <h1 className="mt-4 max-w-xs text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
                  Acesse sua conta.
                </h1>
                <p className="mt-4 max-w-sm text-sm leading-6 text-white/64">
                  Entrada direta, sem ruido e com foco no acesso ao hub.
                </p>
              </div>

              <div className="relative mt-10 rounded-[24px] border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/72">Google ou e-mail e senha.</p>
              </div>
            </div>

            <div className="relative bg-white/82 p-5 sm:p-7 lg:p-10">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(34,197,94,0.08),transparent)]" />
              <div className="relative mx-auto w-full max-w-md">
                <div className="mb-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Acesso</p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">Entrar</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    Faca login para continuar no DG Hub.
                  </p>
                </div>

                <div className="mb-5 rounded-[24px] border border-slate-200 bg-slate-50 p-3">
                  <Button
                    type="button"
                    onClick={handleOauth}
                    variant="secondary"
                    className="h-12 w-full justify-center gap-2 rounded-2xl bg-slate-950 text-white hover:bg-slate-900"
                    disabled={isNativeOauthPending}
                  >
                    <Mail className="h-4 w-4" />
                    {isNativeOauthPending ? "Aguardando conclusao..." : "Entrar com Google"}
                  </Button>
                  <div className="mt-4 flex items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-slate-400">
                    <div className="h-px flex-1 bg-slate-200" />
                    ou use e-mail e senha
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>
                </div>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700">E-mail</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              autoComplete="email"
                              placeholder="voce@email.com"
                              className="h-12 rounded-2xl border-slate-200 bg-white text-slate-950 placeholder:text-slate-400"
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
                          <FormLabel className="text-slate-700">Senha</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              autoComplete="current-password"
                              placeholder="Sua senha"
                              className="h-12 rounded-2xl border-slate-200 bg-white text-slate-950 placeholder:text-slate-400"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex flex-col gap-3 pt-2">
                      <Button type="submit" className="h-12 w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-900" disabled={loginMutation.isPending}>
                        {loginMutation.isPending ? "Entrando..." : "Entrar agora"}
                      </Button>
                      <Button variant="outline" asChild className="h-12 rounded-2xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                        <Link href="/cadastro">Criar conta</Link>
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

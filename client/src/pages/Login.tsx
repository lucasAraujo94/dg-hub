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
import { zodResolver } from "@hookform/resolvers/zod";
import { Browser } from "@capacitor/browser";
import { Mail, MessageCircle, ShieldCheck, Trophy } from "lucide-react";
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

      const payload = (await response.json()) as {
        sessionToken: string;
      };
      if (!payload.sessionToken) {
        throw new Error("Sessao do app nao retornada pelo servidor.");
      }

      setNativeSessionToken(payload.sessionToken);
      clearPendingOAuthNonce();
      stopNativeOauthPolling();
      setIsNativeOauthPending(false);
      await Browser.close().catch(() => undefined);
      await utils.auth.me.invalidate();
      window.location.href = "#/";
      return true;
    },
    [stopNativeOauthPolling, utils.auth.me]
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
          toast.error(error instanceof Error ? error.message : "Falha ao concluir login com Google.");
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
      toast.error("Configure VITE_GOOGLE_CLIENT_ID ou VITE_OAUTH_PORTAL_URL para ativar o login.");
      return;
    }

    const nativeNonce = isNativeApp ? createOAuthNonce() : undefined;
    const oauthUrl = getLoginUrl(isNativeApp ? "native-app" : "web", { nativeNonce });

    try {
      if (nativeNonce) {
        setPendingOAuthNonce(nativeNonce);
        startNativeOauthPolling(nativeNonce);
      }
      await Browser.open({ url: oauthUrl }); // abre no navegador padrao (Custom Tab)
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
      toast.success("Login realizado! Redirecionando...");
      setTimeout(() => {
        window.location.href = "#/";
      }, 400);
    },
    onError: error => {
      toast.error(error.message || "Falha ao entrar");
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
    <div className="relative min-h-screen w-full bg-[#05070d] text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-16 top-10 h-64 w-64 rounded-full bg-emerald-500/12 blur-3xl" />
        <div className="absolute right-10 top-1/4 h-72 w-72 rounded-full bg-primary/18 blur-[120px]" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/30 to-transparent" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-black/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_rgba(92,123,255,0.9)]" />
            DG Hub Login
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild className="text-sm">
              <Link href="/cadastro">Criar conta</Link>
            </Button>
            <Button variant="outline" asChild className="text-sm gap-2 rounded-full">
              <Link href="/">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-xs">
                  ←
                </span>
                <span>Voltar</span>
              </Link>
            </Button>
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center">
          <div className="grid w-full max-w-4xl gap-8 rounded-3xl border border-white/5 bg-white/5 p-4 backdrop-blur-xl shadow-[0_20px_80px_-40px_rgba(0,0,0,0.65)] sm:p-6 lg:grid-cols-2">
            <div className="hidden space-y-4 lg:block">
              <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/80">Bem-vindo</p>
              <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
                Conecte-se ao{" "}
                <span className="bg-gradient-to-r from-emerald-300 via-white to-primary bg-clip-text text-transparent">
                  DG Games
                </span>
              </h1>
              <p className="text-base text-muted-foreground">
                Entre para disputar campeonatos, acompanhar chaveamentos em tempo real e conversar com a comunidade.
              </p>
              <div className="grid grid-cols-1 gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                <div className="flex items-start gap-2">
                  <Trophy className="mt-0.5 h-4 w-4 text-emerald-300" />
                  <div>
                    <p className="font-semibold text-foreground">Campeonatos ao vivo</p>
                    <p>Inscreva-se e receba lembrete 24h antes da partida.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p className="font-semibold text-foreground">Sessão protegida</p>
                    <p>Login OAuth com cookies seguros e expiração curta.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MessageCircle className="mt-0.5 h-4 w-4 text-cyan-300" />
                  <div>
                    <p className="font-semibold text-foreground">Chat integrado</p>
                    <p>Participe das conversas e mantenha seu perfil visível.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Mail className="mt-0.5 h-4 w-4 text-amber-300" />
                  <div>
                    <p className="font-semibold text-foreground">Perfil único</p>
                    <p>Foto e apelido sincronizados em todo o app.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-b from-[#0c1024]/90 via-[#090e1a]/92 to-[#0a1020]/90 p-6 shadow-[0_20px_60px_-40px_rgba(92,123,255,0.45)]">
              <div className="pointer-events-none absolute right-0 top-0 h-52 w-52 translate-x-10 -translate-y-10 rounded-full bg-primary/15 blur-3xl" />
              <div className="relative">
                <div className="mb-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Login</p>
                  <h2 className="text-xl font-semibold">Entrar no DG Hub</h2>
                </div>

                <div className="mb-4 flex flex-col gap-3">
                  <div className="grid gap-2">
                    <Button
                      type="button"
                      onClick={handleOauth}
                      variant="secondary"
                      className="w-full justify-center gap-2 bg-white text-black hover:bg-white/90"
                      disabled={isNativeOauthPending}
                    >
                      <Mail className="h-4 w-4" />
                      {isNativeOauthPending ? "Aguardando conclusão..." : "Entrar com Google"}
                    </Button>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    <div className="h-px flex-1 bg-border" />
                    ou e-mail / senha
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
                          <FormLabel>E-mail</FormLabel>
                          <FormControl>
                            <Input type="email" autoComplete="email" placeholder="voce@email.com" {...field} />
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
                          <FormLabel>Senha</FormLabel>
                          <FormControl>
                            <Input type="password" autoComplete="current-password" placeholder="Sua senha" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex flex-col gap-3 text-sm">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Não compartilhe sua senha.</span>
                        <a className="text-primary underline-offset-4 hover:underline">Precisa de ajuda?</a>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" asChild>
                          <Link href="/cadastro">Criar conta</Link>
                        </Button>
                        <Button type="submit" className="min-w-32" disabled={loginMutation.isPending}>
                          Entrar
                        </Button>
                      </div>
                    </div>
                  </form>
                </Form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

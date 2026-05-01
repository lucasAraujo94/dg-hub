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
import { ArrowLeft, Mail, MessageCircle, ShieldCheck, Sparkles, Trophy } from "lucide-react";
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

const accessPillars = [
  {
    icon: Trophy,
    title: "Torneios em destaque",
    description: "Entre no hub e acompanhe chaveamentos, vagas abertas e fases decisivas sem sair da arena.",
    accent: "text-amber-200",
  },
  {
    icon: ShieldCheck,
    title: "Sessao protegida",
    description: "OAuth e login local coexistem com sessao curta e recuperacao segura dentro do app.",
    accent: "text-cyan-200",
  },
  {
    icon: MessageCircle,
    title: "Comunidade ativa",
    description: "Converse, receba avisos e mantenha seu perfil sincronizado com o restante da plataforma.",
    accent: "text-emerald-200",
  },
];

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
    <div className="relative min-h-screen overflow-hidden bg-[#040611] text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_30%),radial-gradient(circle_at_bottom,rgba(251,191,36,0.08),transparent_26%)]" />
        <div className="absolute left-[-8%] top-16 h-72 w-72 rounded-full bg-emerald-400/10 blur-[120px]" />
        <div className="absolute right-[-4%] top-20 h-80 w-80 rounded-full bg-cyan-400/12 blur-[140px]" />
        <div className="absolute bottom-[-6%] left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-amber-300/8 blur-[140px]" />
        <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.14) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100">
              <Sparkles className="h-3.5 w-3.5" />
              DG Arena access
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/70">
              torneios, chat e ranking
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild className="rounded-full text-sm text-white/80 hover:bg-white/10 hover:text-white">
              <Link href="/cadastro">Criar conta</Link>
            </Button>
            <Button variant="outline" asChild className="rounded-full border-white/15 bg-white/5 text-sm">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                <span>Voltar</span>
              </Link>
            </Button>
          </div>
        </header>

        <div className="grid flex-1 items-stretch gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="hero-sheen flex flex-col justify-between rounded-[32px] border border-white/10 bg-[linear-gradient(145deg,rgba(5,10,21,0.92),rgba(7,16,28,0.82))] p-6 shadow-[0_30px_120px_-60px_rgba(0,0,0,0.7)] sm:p-8 lg:p-10">
            <div className="space-y-6">
              <div className="space-y-4">
                <p className="text-sm uppercase tracking-[0.3em] text-emerald-200/80">entrada oficial</p>
                <h1 className="max-w-3xl text-4xl font-semibold leading-[1.02] text-white sm:text-5xl lg:text-6xl">
                  Entre na arena e
                  <span className="block bg-gradient-to-r from-emerald-300 via-cyan-100 to-cyan-300 bg-clip-text text-transparent">
                    continue de onde parou
                  </span>
                </h1>
                <p className="max-w-2xl text-base text-white/72 sm:text-lg">
                  Um acesso para acompanhar brackets, conversar com a comunidade e entrar nos torneios sem atrito.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {accessPillars.map(item => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.title}
                      className="rounded-[24px] border border-white/10 bg-white/[0.045] p-4 shadow-[0_18px_36px_-28px_rgba(0,0,0,0.65)] backdrop-blur-sm"
                    >
                      <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 ${item.accent}`}>
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="mt-2 text-sm leading-6 text-white/65">{item.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 grid gap-3 rounded-[28px] border border-white/10 bg-black/20 p-4 sm:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">Acesso rapido</p>
                <p className="mt-2 text-lg font-semibold text-white">Google ou e-mail</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">Estado atual</p>
                <p className="mt-2 text-lg font-semibold text-white">Login web + app nativo</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">Continuacao</p>
                <p className="mt-2 text-lg font-semibold text-white">Retorno direto ao hub</p>
              </div>
            </div>
          </section>

          <section className="relative overflow-hidden rounded-[32px] border border-cyan-300/15 bg-[linear-gradient(180deg,rgba(10,14,24,0.95),rgba(7,11,19,0.92))] p-5 shadow-[0_30px_100px_-55px_rgba(34,211,238,0.28)] sm:p-6 lg:p-7">
            <div className="pointer-events-none absolute right-0 top-0 h-56 w-56 translate-x-12 -translate-y-12 rounded-full bg-cyan-400/10 blur-[120px]" />
            <div className="pointer-events-none absolute bottom-0 left-0 h-48 w-48 -translate-x-12 translate-y-10 rounded-full bg-emerald-400/10 blur-[110px]" />

            <div className="relative">
              <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">autenticacao</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Entrar no DG Hub</h2>
                  <p className="mt-2 text-sm text-white/60">Acesse seu perfil, seu historico e o painel ativo da comunidade.</p>
                </div>
                <div className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-emerald-100">
                  acesso seguro
                </div>
              </div>

              <div className="mb-5 rounded-[24px] border border-white/10 bg-white/[0.045] p-4">
                <Button
                  type="button"
                  onClick={handleOauth}
                  variant="secondary"
                  className="h-12 w-full justify-center gap-2 rounded-2xl bg-white text-black hover:bg-white/90"
                  disabled={isNativeOauthPending}
                >
                  <Mail className="h-4 w-4" />
                  {isNativeOauthPending ? "Aguardando conclusao..." : "Entrar com Google"}
                </Button>
                <div className="mt-4 flex items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-white/38">
                  <div className="h-px flex-1 bg-white/10" />
                  ou use e-mail e senha
                  <div className="h-px flex-1 bg-white/10" />
                </div>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white/82">E-mail</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            autoComplete="email"
                            placeholder="voce@email.com"
                            className="h-12 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/30"
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
                        <FormLabel className="text-white/82">Senha</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            autoComplete="current-password"
                            placeholder="Sua senha"
                            className="h-12 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/30"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-white">Use apenas dispositivos confiaveis</p>
                        <p className="text-xs text-white/55">Nao compartilhe sua senha e encerre sessoes antigas quando trocar de aparelho.</p>
                      </div>
                      <a className="text-sm text-cyan-200 underline-offset-4 hover:underline">Precisa de ajuda?</a>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                    <Button variant="outline" asChild className="rounded-2xl border-white/10 bg-white/5">
                      <Link href="/cadastro">Criar conta</Link>
                    </Button>
                    <Button type="submit" className="min-w-36 rounded-2xl" disabled={loginMutation.isPending}>
                      {loginMutation.isPending ? "Entrando..." : "Entrar agora"}
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

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
import { trpc } from "@/lib/trpc";
import { getLoginUrl, hasGoogleClientId, hasOAuthProvider } from "@/const";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Link } from "wouter";
import { Mail } from "lucide-react";
import { z } from "zod";
import { useAuth } from "@/_core/hooks/useAuth";

const loginSchema = z.object({
  email: z.string().email("E-mail invalido"),
  password: z.string().min(8, "Minimo de 8 caracteres"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const { isAuthenticated } = useAuth();
  const isWebView = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || navigator.vendor || "";
    return /Instagram|FBAN|FBAV|Line|wv/i.test(ua);
  }, []);

  // Se já estiver autenticado, redireciona para a home
  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = "#/";
    }
  }, [isAuthenticated]);

  const oauthUrl = getLoginUrl();
  const handleOauth = useCallback(() => {
    if (!hasOAuthProvider) {
      toast.error("Configure VITE_GOOGLE_CLIENT_ID ou VITE_OAUTH_PORTAL_URL para ativar o login.");
      return;
    }
    if (isWebView) {
      toast.error("Abra este link no Chrome para continuar o login com Google.");
      return;
    }
    window.location.href = oauthUrl;
  }, [oauthUrl, isWebView]);
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
            <Button variant="outline" asChild className="text-sm">
              <Link href="/">Voltar</Link>
            </Button>
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center">
          <div className="grid w-full max-w-4xl gap-8 rounded-3xl border border-white/5 bg-white/5 p-6 backdrop-blur-xl shadow-[0_20px_80px_-40px_rgba(0,0,0,0.65)] lg:grid-cols-2">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/80">Acesso seguro</p>
              <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
                Entre com{" "}
                <span className="text-transparent bg-gradient-to-r from-emerald-300 via-white to-primary bg-clip-text">
                  sua conta DG Hub
                </span>
              </h1>
              <p className="text-base text-muted-foreground">
                Autenticacao rapida para acessar campeonatos, radio e chat. SSO via Google ou credenciais locais.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Sessao protegida com token e cookie seguro.</li>
                <li>• Redirecionamento imediato para o dashboard.</li>
                <li>• Fluxo alinhado com cadastro Hago + DG Hub.</li>
              </ul>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-b from-[#0c1024]/90 via-[#090e1a]/92 to-[#0a1020]/90 p-6 shadow-[0_20px_60px_-40px_rgba(92,123,255,0.45)]">
              <div className="pointer-events-none absolute right-0 top-0 h-52 w-52 translate-x-10 -translate-y-10 rounded-full bg-primary/15 blur-3xl" />
              <div className="relative">
                <div className="mb-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Login</p>
                  <h2 className="text-xl font-semibold">Entrar no DG Hub</h2>
                </div>

                <div className="mb-4 flex flex-col gap-3">
                  {isWebView ? (
                    <div className="rounded-lg border border-amber-400/60 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
                      Abra este link no Chrome para continuar o login com Google.
                    </div>
                  ) : null}
                  <div className="grid gap-2">
                    <Button
                      type="button"
                      onClick={handleOauth}
                      variant="secondary"
                      className="w-full justify-center gap-2 bg-white text-black hover:bg-white/90"
                      disabled={isWebView}
                    >
                      <Mail className="h-4 w-4" />
                      Entrar com Google
                    </Button>
                    {isWebView ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-center"
                        onClick={() => {
                          try {
                            window.open(window.location.href, "_blank");
                          } catch {
                            window.location.href = window.location.href;
                          }
                        }}
                      >
                        Abrir no navegador
                      </Button>
                    ) : null}
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
                            <Input
                              type="email"
                              autoComplete="email"
                              placeholder="voce@email.com"
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
                          <FormLabel>Senha</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              autoComplete="current-password"
                              placeholder="Sua senha"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex flex-col gap-3 text-sm">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Nao compartilhe sua senha.</span>
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

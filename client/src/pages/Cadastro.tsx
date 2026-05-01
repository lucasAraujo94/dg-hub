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
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Link } from "wouter";
import { Mail } from "lucide-react";
import { z } from "zod";

const cadastroSchema = z
  .object({
    fullName: z.string().min(3, "Informe seu nome completo"),
    nickname: z.string().min(2, "Informe seu Nome no Hago"),
    email: z.string().email("E-mail invalido"),
    password: z.string().min(8, "Minimo de 8 caracteres"),
    confirmPassword: z.string().min(8, "Confirme a senha"),
    acceptTerms: z
      .boolean()
      .refine(val => val === true, { message: "Aceite os termos para continuar" }),
  })
  .refine(data => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas nao coincidem",
  });

type CadastroForm = z.infer<typeof cadastroSchema>;

export default function Cadastro() {
  const form = useForm<CadastroForm>({
    resolver: zodResolver(cadastroSchema),
    defaultValues: {
      fullName: "",
      nickname: "",
      email: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
  });

  const registerMutation = trpc.auth.registerLocal.useMutation({
    onSuccess: () => {
      toast.success("Cadastro criado! Redirecionando para o hub...");
      setTimeout(() => {
        window.location.href = "#/";
      }, 400);
    },
    onError: error => {
      toast.error(error.message || "Falha ao cadastrar");
    },
  });

  const onSubmit = async (values: CadastroForm) => {
    await registerMutation.mutateAsync({
      email: values.email,
      password: values.password,
      name: values.fullName,
      nickname: values.nickname,
    });
  };

  const oauthUrl = getLoginUrl();
  const handleOauth = () => {
    window.location.href = oauthUrl;
  };

  return (
    <div className="relative min-h-screen w-full max-w-screen overflow-hidden bg-[#070912] text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#00ff85]/10 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-primary/15 blur-[120px]" />
        <div className="absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-cyan-500/15 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(0,255,133,0.08),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(99,102,241,0.12),transparent_30%)]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
              <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_rgba(99,102,241,0.8)]" />
              DG Arena
            </div>
            <div className="flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
              Comunidade Hago
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild className="text-sm gap-2 rounded-full">
              <Link href="/">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-xs">←</span>
                <span>Voltar</span>
              </Link>
            </Button>
            <Button variant="outline" asChild className="text-sm">
              <Link href="/login">Ja tenho conta</Link>
            </Button>
          </div>
        </header>

        <div className="grid items-start gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Left — headline + highlights */}
          <div className="space-y-6">
            <div className="space-y-4">
              <p className="text-sm uppercase tracking-[0.24em] text-emerald-200/80">
                cadastro rapido
              </p>
              <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
                Crie sua conta e entre nas arenas{" "}
                <span className="gradient-text">DG Hub</span>
              </h1>
              <p className="max-w-2xl text-lg text-muted-foreground">
                Perfil unico para campeonatos, ranking e radio ao vivo. Sem rodeios: preencha, confirme e jogue.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {[
                {
                  title: "Matchmaking rapido",
                  desc: "Entre em chaves e brackets em poucos cliques.",
                },
                {
                  title: "Radar de premiacoes",
                  desc: "Alertas de prêmios e bonus na home e push.",
                },
                {
                  title: "Radio integrada",
                  desc: "Chamadas em tempo real com IA announcer.",
                },
                {
                  title: "Perfil estiloso",
                  desc: "Badges neon e molduras com glow Hago.",
                },
              ].map(item => (
                <div
                  key={item.title}
                  className="stat-card border-primary/25 bg-gradient-to-br from-primary/5 via-card/40 to-emerald-500/5"
                >
                  <p className="text-sm font-semibold text-primary">
                    {item.title}
                  </p>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right — form */}
          <div className="card-elegant relative border border-primary/20 bg-gradient-to-br from-[#0f1024]/90 via-[#0a0f1b]/90 to-[#0c111f]/90 shadow-[0_0_60px_rgba(99,102,241,0.2)]">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Cadastro rapido
                </p>
                <h2 className="text-2xl font-semibold">Comecar agora</h2>
              </div>
              <div className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                100% gratis
              </div>
            </div>

            <div className="mb-4 flex flex-col gap-3">
              <Button
                type="button"
                onClick={handleOauth}
                variant="secondary"
                className="w-full justify-center gap-2 bg-white text-black hover:bg-white/90"
              >
                <Mail className="h-4 w-4" />
                Continuar com Gmail
              </Button>
              <div className="flex items-center gap-3 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                ou crie com e-mail e senha
                <div className="h-px flex-1 bg-border" />
              </div>
            </div>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-5"
              >
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome completo</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Ana Souza" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nickname"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome no Hago</FormLabel>
                      <FormControl>
                        <Input placeholder="Seu nome no Hago (obrigatório)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            autoComplete="new-password"
                            placeholder="Minimo 8 caracteres"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmar senha</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            autoComplete="new-password"
                            placeholder="Repita a senha"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="acceptTerms"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={checked =>
                            field.onChange(Boolean(checked))
                          }
                        />
                      </FormControl>
                      <div className="space-y-1 leading-tight">
                        <FormLabel className="text-sm font-medium">
                          Aceito os termos e politicas do DG Hub
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Concordo em receber comunicacoes sobre campeonatos.
                        </p>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <div className="flex flex-col items-center gap-3 text-center">
                  <p className="max-w-md text-xs text-muted-foreground">
                    Seus dados sao usados para personalizar a experiencia e garantir seguranca nas competicoes.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button variant="outline" asChild>
                      <Link href="/login">Ja tenho conta</Link>
                    </Button>
                    <Button type="submit" className="min-w-36" disabled={registerMutation.isPending}>
                      {registerMutation.isPending ? "Enviando..." : "Criar conta"}
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
}

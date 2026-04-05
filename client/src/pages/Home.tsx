import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  Menu,
  TrendingUp,
  Zap,
  Home as HomeIcon,
  Trophy,
  Star,
  User,
  MessageCircle,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Link } from "wouter";
import { useMemo, useState } from "react";
import HomeBg from "../assets/dg-games-bg.png";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

export default function Home() {
  const { user, loading, error, logout } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: "#/login",
  });

  const clampDateYear = (value: string) => {
    const [datePart = "", timePart] = value.split("T");
    const parts = datePart.split("-");
    const year = (parts[0] || "").slice(0, 4);
    const month = parts[1];
    const day = parts[2];
    const safeDate = [year, month, day].filter(Boolean).join("-");
    return timePart ? `${safeDate}T${timePart}` : safeDate;
  };

  const [activeSection, setActiveSection] = useState<
    "overview" | "campeonatos" | "rankings" | "perfil" | "chat" | "enquetes" | null
  >(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuCollapsed, setMenuCollapsed] = useState(false);

  const handleMenuButton = () => {
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    if (isMobile) {
      setMenuOpen(open => !open);
      return;
    }
    setMenuCollapsed(false);
    setMenuOpen(true);
  };

  const pollResultsQuery = trpc.poll.results.useQuery(undefined, { refetchOnWindowFocus: false });
  const pollResults = pollResultsQuery.data?.polls ?? [];

  const pollVoteMutation = trpc.poll.vote.useMutation({
    onSuccess: () => pollResultsQuery.refetch(),
    onError: err => toast.error(err.message || "Falha ao registrar voto"),
  });

  const pollCreateMutation = trpc.poll.create.useMutation({
    onSuccess: () => {
      pollResultsQuery.refetch();
      toast.success("Enquete criada");
      setPollPergunta("Qual jogo voce quer no proximo campeonato?");
      setPollClosesAt("");
      setPollOptionsText("");
    },
    onError: err => toast.error(err.message || "Falha ao criar enquete"),
  });

  const pollDeleteMutation = trpc.poll.delete.useMutation({
    onSuccess: () => {
      toast.success("Enquete excluida");
      pollResultsQuery.refetch();
    },
    onError: err => toast.error(err.message || "Falha ao excluir enquete"),
  });

  const [pollPergunta, setPollPergunta] = useState("Qual jogo voce quer no proximo campeonato?");
  const [pollClosesAt, setPollClosesAt] = useState("");
  const [pollOptionsText, setPollOptionsText] = useState("Ludo\nGolpeie e Esquiva\nVermelhinha\nCondutor de Ritmo");

  const campeonatosQuery = trpc.campeonatos.list.useQuery(undefined, { refetchOnWindowFocus: false });

  const rankingTopQuery = trpc.rankings.getByTipo.useQuery(
    { tipo: "geral", limite: 3 },
    { refetchOnWindowFocus: false }
  );

  const onlinePlayers = useMemo(() => {
    if (!user) return [];
    return [
      {
        id: user.id ?? 0,
        name: user.name || user.email || "Jogador",
      },
    ];
  }, [user]);

  const dataSnapshot = {
    polls: pollResultsQuery.data,
    campeonatos: campeonatosQuery.data,
    ranking: rankingTopQuery.data,
  };
  const isLoadingSnapshot = {
    user: loading,
    polls: pollResultsQuery.isLoading,
    campeonatos: campeonatosQuery.isLoading,
    ranking: rankingTopQuery.isLoading,
  };
  const errorSnapshot = {
    auth: error ?? null,
    polls: pollResultsQuery.error ?? null,
    campeonatos: campeonatosQuery.error ?? null,
    ranking: rankingTopQuery.error ?? null,
  };

  console.log("HOME RENDER", { dataSnapshot, isLoadingSnapshot, errorSnapshot, user });

  const activeChampionship = useMemo(() => {
    const list =
      (campeonatosQuery.data ?? []).map(camp => {
        const dataInicio = camp.dataInicio ? new Date(camp.dataInicio) : null;
        const status =
          (camp as { status?: string }).status ??
          (dataInicio && dataInicio.getTime() > Date.now() ? "futuro" : "ativo");
        const fase =
          status === "futuro"
            ? "Fase de inscricoes"
            : status === "finalizado"
              ? "Finalizado"
              : "Em andamento";
        return {
          id: camp.id,
          nome: camp.nome,
          inicio: dataInicio ? dataInicio.toLocaleString("pt-BR") : "Data a definir",
          premio: (camp as { premioValor?: number }).premioValor ?? 0,
          fase,
          status,
        };
      }) ?? [];

    return (
      list.find(item => item.status === "ativo") ||
      list.find(item => item.status === "futuro") || {
        id: undefined,
        nome: "Campeonato Relampago",
        inicio: "Sabado 04/04/2026 as 18:00",
        premio: 50,
        fase: "Fase de inscricoes",
        status: "futuro",
      }
    );
  }, [campeonatosQuery.data]);

  const registrarInscricao = (campeonatoId?: number) => {
    if (!campeonatoId) return;
    if (!user) {
      window.location.href = getLoginUrl();
      return;
    }
    toast.info("Inscricao em breve (use a pagina de campeonatos para concluir).");
  };

  const lastWinners = useMemo(() => {
    if (rankingTopQuery.data?.length) {
      return rankingTopQuery.data.map((r, idx) => {
        const usuario = (r as { usuario?: { name?: string | null; nickname?: string | null; email?: string | null } }).usuario;
        const baseName = usuario?.name || usuario?.email || `Jogador ${r.usuarioId}`;
        const name = usuario?.nickname ? `${baseName} (${usuario.nickname})` : baseName;
        return {
          position: idx + 1,
          name,
          points: `${r.pontuacao} pontos`,
          badge: "🏅",
        };
      });
    }
    return [
      { position: 1, name: "Anna", points: "Campeã - Ludo", badge: "🏅" },
      { position: 2, name: "Lucas", points: "Campeão - Golpeie e Esquiva", badge: "🏅" },
      { position: 3, name: "Reeh", points: "Campeão - Vermelhinha", badge: "🏅" },
    ];
  }, [rankingTopQuery.data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary w-12 h-12" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-foreground flex flex-col"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(5,7,13,0.8), rgba(5,7,13,0.95)), url(${HomeBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Top bar */}
      <header className="border-b border-border bg-card/70 backdrop-blur-sm">
        <div className="w-full flex items-center h-14 px-4 md:px-6 relative">
          <div className="flex items-center gap-3">
            <button
              className="h-12 w-12 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors border border-white/10 cursor-pointer select-none"
              onClick={handleMenuButton}
              aria-label="Abrir/fechar menu"
            >
              <Menu className="w-5 h-5 text-muted-foreground" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-600 flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold gradient-text">DG Hub</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm ms-auto justify-end text-right">
            <span className="text-muted-foreground">
              Olá, {user?.nickname ? `${user.name ?? user.email ?? "jogador"} (${user.nickname})` : user?.name ?? "jogador"}
            </span>
            <Button onClick={logout} variant="outline" size="sm">
              Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside
          className={`border-r border-white/10 bg-black/30 backdrop-blur-xl transition-all duration-50 ease-out
            ${menuOpen ? "fixed inset-y-0 left-0 z-50 w-64 shadow-2xl" : "hidden"}
            md:static md:flex md:flex-col md:z-auto md:shadow-none
            ${menuCollapsed ? "md:w-16" : "md:w-64"} md:block md:translate-x-0`}
        >
          <div className="flex items-center justify-between px-3 py-3">
            <div
              className={`flex items-center gap-2 ${menuCollapsed ? "opacity-0 md:opacity-0" : "md:opacity-100"} transition-opacity cursor-pointer select-none`}
              onClick={() => {
                setMenuCollapsed(false);
                setMenuOpen(true);
              }}
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-cyan-500 flex items-center justify-center text-white text-xs font-bold shadow-lg">
                DG
              </div>
              <span className="text-sm font-semibold text-white/80">Navegação</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-white shadow-lg cursor-pointer select-none"
              onClick={() => {
                setMenuCollapsed(c => !c);
                setMenuOpen(true);
              }}
              title={menuCollapsed ? "Expandir menu" : "Recolher menu"}
            >
              {menuCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </Button>
          </div>
          <nav className="p-2 space-y-1">
            {[
              { key: "overview", label: "Home", icon: HomeIcon },
              { key: "campeonatos", label: "Campeonatos", href: "/campeonatos", icon: Trophy },
              { key: "rankings", label: "Rankings", icon: Star },
              { key: "perfil", label: "Perfil", href: "/perfil", icon: User },
              { key: "chat", label: "Chat", href: "/chat", icon: MessageCircle },
              ...(user?.role === "admin" ? [{ key: "admin", label: "Admin", href: "/admin", icon: ShieldCheck }] : []),
              ...(user?.role === "admin" ? [{ key: "enquetes", label: "Enquetes (Admin)", icon: ShieldCheck }] : []),
            ].map(item => {
              const Icon = item.icon;
              const isActive = activeSection === item.key || (!item.href && item.key === "overview" && !activeSection);
              const baseClasses =
                "w-full justify-start rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all";
              const activeClasses = isActive
                ? "bg-gradient-to-r from-purple-600/30 to-cyan-500/25 border-white/20 shadow-md"
                : "";
              const content = (
                <div className="flex items-center gap-3 w-full">
                  <Icon className={`w-4 h-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`${menuCollapsed ? "hidden md:hidden" : "md:inline"} text-sm font-medium`}>
                    {item.label}
                  </span>
                </div>
              );
              return item.href ? (
                <Button
                  key={item.key}
                  asChild
                  variant="ghost"
                  title={menuCollapsed ? item.label : undefined}
                  className={`${baseClasses} ${activeClasses} ${menuCollapsed ? "md:justify-center" : ""}`}
                >
                  <Link
                    href={item.href}
                    onClick={() => {
                      setMenuOpen(false);
                    }}
                  >
                    {content}
                  </Link>
                </Button>
              ) : (
                <Button
                  key={item.key}
                  variant={isActive ? "default" : "ghost"}
                  title={menuCollapsed ? item.label : undefined}
                  className={`${baseClasses} ${activeClasses} ${menuCollapsed ? "md:justify-center" : ""}`}
                  onClick={() => {
                    setActiveSection(item.key === "overview" ? null : (item.key as any));
                    setMenuOpen(false);
                  }}
                >
                  {content}
                </Button>
              );
            })}
          </nav>
        </aside>

        {menuOpen ? (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMenuOpen(false)}
            aria-hidden
          />
        ) : null}

        {/* Main content */}
        <main className="flex-1 p-6 space-y-6">
          {!activeSection && (
            <div className="h-full flex items-start justify-center px-4">
              <div className="w-full max-w-5xl space-y-4">
                <div className="rounded-3xl border border-emerald-500/30 bg-emerald-950/20 backdrop-blur-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-emerald-200/80 mb-1">Campeonato</p>
                      {campeonatosQuery.isLoading ? (
                        <p className="text-sm text-muted-foreground">Carregando campeonatos...</p>
                      ) : activeChampionship?.id ? (
                        <>
                          <h2 className="text-2xl font-bold text-white mb-1">{activeChampionship.nome}</h2>
                          <p className="text-sm text-emerald-100/80">
                            {activeChampionship.fase} • Início: {activeChampionship.inicio}
                          </p>
                          <p className="text-sm text-emerald-100/80">Prêmio: R$ {Number(activeChampionship.premio).toFixed(2)}</p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nenhum campeonato cadastrado ainda.</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setActiveSection("campeonatos");
                          setMenuOpen(false);
                        }}
                        disabled={campeonatosQuery.isLoading}
                      >
                        {campeonatosQuery.isLoading ? "Carregando..." : "Ver campeonatos"}
                      </Button>
                      <Button
                        size="sm"
                        className="btn-primary"
                        onClick={() => registrarInscricao(activeChampionship?.id)}
                        disabled={campeonatosQuery.isLoading || !activeChampionship?.id}
                      >
                        Inscreva-se
                      </Button>
                    </div>
                  </div>
                </div>
                {pollResults.length ? (
                  pollResults.map(poll => (
                    <div
                      key={poll.pollId}
                      className="relative rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/15 via-transparent to-cyan-500/20" />
                      <div className="relative grid md:grid-cols-2">
                        <div className="p-6 md:p-8 flex flex-col gap-4 border-b md:border-b-0 md:border-r border-white/10">
                          <div className="text-[11px] uppercase tracking-[0.28em] text-emerald-200/80 flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
                            Enquete
                          </div>
                          <h2 className="text-3xl md:text-4xl font-semibold leading-tight text-white">
                            {poll.question || "Proximo campeonato: escolha o modo"}
                          </h2>
                          <p className="text-sm text-emerald-100/80">
                            Vote no jogo que quer ver no próximo torneio. 1 voto por jogador logado.
                          </p>
                          <div className="grid grid-cols-1 gap-2">
                            {poll.options?.map(opt => {
                              const count = poll.counts?.[opt] ?? 0;
                              return (
                                <Button
                                  key={opt}
                                  variant="outline"
                                  className="justify-between border-emerald-400/40 text-white hover:border-emerald-400 hover:text-white/90"
                                  onClick={() => pollVoteMutation.mutate({ pollId: poll.pollId, escolha: opt })}
                                  disabled={pollVoteMutation.isPending}
                                >
                                  <span className="font-semibold">{opt}</span>
                                  <span className="text-xs text-emerald-100/80">{count} votos</span>
                                </Button>
                              );
                            })}
                          </div>
                          {pollVoteMutation.isPending ? (
                            <p className="text-xs text-emerald-100/80">Enviando voto...</p>
                          ) : null}
                        </div>
                        <div className="relative p-6 md:p-8 flex flex-col justify-center gap-4 bg-gradient-to-br from-black/50 via-black/40 to-black/60">
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,197,94,0.12),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(59,130,246,0.12),transparent_35%)]" />
                          <div className="relative space-y-3 text-white">
                            <p className="text-sm uppercase tracking-[0.2em] text-emerald-100/70">Parcial</p>
                            <div className="space-y-2 text-sm text-emerald-50/80">
                              {poll.options?.map(opt => (
                                <p key={opt}>
                                  {opt}: {poll.counts?.[opt] ?? 0} votos
                                </p>
                              ))}
                            </div>
                            {poll.closesAt ? (
                              <div className="text-xs text-emerald-100/70">
                                Fecha em: {new Date(poll.closesAt).toLocaleString("pt-BR")}
                              </div>
                            ) : null}
                            <div className="mt-2 text-xs text-emerald-100/70">
                              A enquete é atualizada em tempo real após cada voto.
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="relative p-8 text-center text-emerald-50 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">
                    Nenhuma enquete ativa. Crie uma enquete no painel admin.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSection === "enquetes" && (
            <div className="card-elegant bg-black/40 border border-emerald-400/30 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/80">Admin</p>
                  <h2 className="text-2xl font-bold text-white">Criar enquete</h2>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Pergunta</p>
                  <input
                    className="w-full rounded-md bg-black/30 border border-emerald-400/40 px-3 py-2 text-sm text-white"
                    value={pollPergunta}
                    onChange={e => setPollPergunta(e.target.value)}
                  />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Fecha em (opcional)</p>
                  <input
                    type="datetime-local"
                    max="9999-12-31T23:59"
                    className="w-full rounded-md bg-black/30 border border-emerald-400/40 px-3 py-2 text-sm text-white"
                    value={pollClosesAt}
                    onChange={e => setPollClosesAt(clampDateYear(e.target.value))}
                  />
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Opções (1 por linha, mínimo 2 e máximo 6)</p>
                <textarea
                  className="w-full rounded-md bg-black/30 border border-emerald-400/40 px-3 py-2 text-sm text-white min-h-[120px]"
                  value={pollOptionsText}
                  onChange={e => setPollOptionsText(e.target.value)}
                />
              </div>
              <Button
                className="btn-primary w-full"
                disabled={pollCreateMutation.isPending}
                onClick={() => {
                  const options = pollOptionsText
                    .split("\n")
                    .map(opt => opt.trim())
                    .filter(Boolean);
                  if (options.length < 2 || options.length > 6) {
                    toast.error("Informe entre 2 e 6 opções");
                    return;
                  }
                  const year = (pollClosesAt.split("T")[0] || "").split("-")[0];
                  if (year && year.length > 4) {
                    toast.error("O ano deve ter no máximo 4 dígitos");
                    return;
                  }
                  pollCreateMutation.mutate({
                    pergunta: pollPergunta.trim() || null,
                    closesAt: pollClosesAt ? new Date(pollClosesAt) : null,
                    options,
                  });
                }}
              >
                {pollCreateMutation.isPending ? "Criando..." : "Criar Enquete"}
              </Button>
            </div>
          )}

          {activeSection === "enquetes" && pollResults.length ? (
            <section className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Enquetes abertas</h3>
              <div className="space-y-3">
                {pollResults.map(poll => (
                  <Card key={poll.pollId} className="p-4 bg-black/30 border border-emerald-500/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-semibold">{poll.question || "Enquete"}</p>
                        {poll.closesAt ? (
                          <p className="text-xs text-muted-foreground">
                            Fecha em: {new Date(poll.closesAt).toLocaleString("pt-BR")}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => pollDeleteMutation.mutate({ pollId: poll.pollId })}
                        disabled={pollDeleteMutation.isPending}
                      >
                        {pollDeleteMutation.isPending ? "Excluindo..." : "Excluir"}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}

          {activeSection === "campeonatos" && (
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">Campeonatos</h2>
                <Button asChild size="sm">
                  <Link href="/campeonatos">Abrir página</Link>
                </Button>
              </div>
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-3">
                <p className="text-sm text-emerald-100 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  Jogadores online
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-sm text-emerald-100">
                  {onlinePlayers.map(p => (
                    <span key={p.id} className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                      <span className="w-2 h-2 rounded-full bg-green-400" />
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
              {user?.role === "admin" ? (
                <div className="rounded-lg border border-border/60 bg-card/60 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Criar novo campeonato</p>
                    <p className="text-xs text-muted-foreground">Admins podem cadastrar e gerenciar campeonatos.</p>
                  </div>
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/admin">Criar campeonato</Link>
                  </Button>
                </div>
              ) : null}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(campeonatosQuery.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum campeonato cadastrado ainda.</p>
                ) : null}
                {(campeonatosQuery.data ?? []).map(c => {
                  const dataInicio = c.dataInicio ? new Date(c.dataInicio) : null;
                  const status = (c as any).status ?? (dataInicio && dataInicio.getTime() > Date.now() ? "futuro" : "ativo");
                  const faseLabel =
                    status === "futuro" ? "Fase de inscricoes" : status === "finalizado" ? "Finalizado" : "Em andamento";
                  return (
                    <Card key={c.id} className="p-4 border-border/70 bg-card/60 space-y-2">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="font-semibold">{c.nome}</h3>
                          <p className="text-xs text-muted-foreground">{faseLabel}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {dataInicio ? dataInicio.toLocaleDateString("pt-BR") : "Data a definir"}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {(c as { descricao?: string | null }).descricao ?? "Campeonato ativo"}
                      </p>
                      <div className="flex items-center justify-between mt-1 text-sm">
                        <span>Prêmio</span>
                        <span className="font-medium text-yellow-400">R$ {(c as any).premioValor}</span>
                      </div>
                      <Button className="mt-2" size="sm" variant="outline" onClick={() => registrarInscricao(c.id)}>
                        Inscreva-se
                      </Button>
                    </Card>
                  );
                }) ?? <p className="text-sm text-muted-foreground">Nenhum campeonato cadastrado.</p>}
              </div>
            </section>
          )}

          {activeSection === "rankings" && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Últimos campeões</h2>
                <Button asChild size="sm">
                  <Link href="/ranking">Ver ranking completo</Link>
                </Button>
              </div>
              <div className="space-y-3">
                {lastWinners.map(player => (
                  <Card key={player.name} className="p-4 border-border/70 bg-card/60 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-cyan-500 flex items-center justify-center text-white font-semibold">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div className="flex-1 text-center">
                      <p className="font-semibold">{player.name}</p>
                      <p className="text-xs text-muted-foreground">{player.points}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {activeSection === "perfil" && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Perfil</h2>
                <Button asChild size="sm">
                  <Link href="/perfil">Abrir perfil</Link>
                </Button>
              </div>
              <Card className="p-5 border-border/70 bg-card/60">
                <p className="text-sm text-muted-foreground">Veja e edite seus dados, conquistas e histórico de campeonatos.</p>
              </Card>
            </section>
          )}

          {activeSection === "chat" && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Chat</h2>
                <Button asChild size="sm">
                  <Link href="/chat">Ir para o chat</Link>
                </Button>
              </div>
              <Card className="p-5 border-border/70 bg-card/60">
                <p className="text-sm text-muted-foreground">
                  Converse com a comunidade e acompanhe transmissões em tempo real.
                </p>
              </Card>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

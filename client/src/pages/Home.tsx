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
  Cake,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Link } from "wouter";
import { useEffect, useMemo, useRef, useState } from "react";
import HomeBg from "../assets/dg-games-bg.png";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { readLastSeenChatAt, writeLastSeenChatAt } from "@/lib/chatNotifications";

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
  const [lastSeenChatAt, setLastSeenChatAt] = useState(() => readLastSeenChatAt());
  const [hasNewChatMessages, setHasNewChatMessages] = useState(false);
  const [remainingSessionMs, setRemainingSessionMs] = useState(10 * 60 * 1000);
  const [isSessionPaused, setIsSessionPaused] = useState(false);
  const activityTimeoutRef = useRef<number>();
  const sessionPausedRef = useRef(false);

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

  const [votedPolls, setVotedPolls] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem("dg-poll-voted") || "[]";
      const arr = JSON.parse(raw) as number[];
      return new Set(arr);
    } catch {
      return new Set();
    }
  });

  const markVoted = (pollId: number) => {
    setVotedPolls(prev => {
      const next = new Set(prev);
      next.add(pollId);
      if (typeof window !== "undefined") {
        localStorage.setItem("dg-poll-voted", JSON.stringify(Array.from(next)));
      }
      return next;
    });
  };

  const pollVoteMutation = trpc.poll.vote.useMutation({
    onSuccess: (_, variables) => {
      if (variables?.pollId) markVoted(variables.pollId);
      pollResultsQuery.refetch();
      toast.success("Voto registrado");
    },
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
  const chatHeadQuery = trpc.chat.getMensagens.useQuery(
    { tipo: "geral", limite: 1 },
    { refetchOnWindowFocus: true, refetchInterval: 15000 }
  );

  const rankingTopQuery = trpc.rankings.getByTipo.useQuery(
    { tipo: "geral", limite: 3 },
    { refetchOnWindowFocus: false }
  );

  const latestChatTimestamp = useMemo(() => {
    const latest = chatHeadQuery.data?.[0];
    if (!latest?.dataEnvio) return null;
    const ts = new Date(latest.dataEnvio).getTime();
    return Number.isNaN(ts) ? null : ts;
  }, [chatHeadQuery.data]);

  useEffect(() => {
    if (!latestChatTimestamp) {
      setHasNewChatMessages(false);
      return;
    }
    setHasNewChatMessages(latestChatTimestamp > lastSeenChatAt);
  }, [latestChatTimestamp, lastSeenChatAt]);

  const markChatAsRead = () => {
    const seenAt = latestChatTimestamp ?? Date.now();
    setLastSeenChatAt(seenAt);
    setHasNewChatMessages(false);
    writeLastSeenChatAt(seenAt);
  };

  useEffect(() => {
    const handleActivity = () => {
      sessionPausedRef.current = true;
      setIsSessionPaused(true);
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
      activityTimeoutRef.current = window.setTimeout(() => {
        sessionPausedRef.current = false;
        setIsSessionPaused(false);
      }, 3000);
    };

    const intervalId = window.setInterval(() => {
      if (sessionPausedRef.current) return;
      setRemainingSessionMs(prev => Math.max(0, prev - 1000));
    }, 1000);

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach(evt => window.addEventListener(evt, handleActivity));

    return () => {
      clearInterval(intervalId);
      if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current);
      events.forEach(evt => window.removeEventListener(evt, handleActivity));
    };
  }, []);

  const formatSessionTime = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  const onlinePlayers = useMemo(() => {
    if (!user) return [];
    return [
      {
        id: user.id ?? 0,
        name: user.name || user.email || "Jogador",
      },
    ];
  }, [user]);

  const displayName = useMemo(() => {
    let pref: "real" | "hago" = "real";
    let storedNick = "";
    if (typeof window !== "undefined") {
      const p = localStorage.getItem("dg-display-pref");
      if (p === "real" || p === "hago") pref = p;
      storedNick = localStorage.getItem("dg-hago-nickname") || "";
    }
    const hago = (storedNick || user?.nickname || "").trim();
    const real = user?.name || user?.email || "jogador";
    if (pref === "hago" && hago) return hago;
    return real;
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

  const inscreverMutation = trpc.campeonatos.inscrever.useMutation({
    onSuccess: () => {
      toast.success("Inscricao confirmada!");
      campeonatosQuery.refetch();
    },
    onError: err => toast.error(err.message || "Falha ao inscrever"),
  });

  const registrarInscricao = async (campeonatoId?: number) => {
    if (!campeonatoId) return;
    if (!user) {
      window.location.href = getLoginUrl();
      return;
    }
    await inscreverMutation.mutateAsync({ campeonatoId });
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
          badge: "ðŸ…",
        };
      });
    }
    return [
      { position: 1, name: "Anna", points: "CampeÃ£ - Ludo", badge: "ðŸ…" },
      { position: 2, name: "Lucas", points: "CampeÃ£o - Golpeie e Esquiva", badge: "ðŸ…" },
      { position: 3, name: "Reeh", points: "CampeÃ£o - Vermelhinha", badge: "ðŸ…" },
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
        <div className="w-full flex flex-wrap items-start md:items-center gap-3 px-4 md:px-6 py-3 md:h-16 relative">
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
          <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-3 text-sm w-full md:w-auto ms-auto justify-end text-left md:text-right">
            <div className="flex flex-col items-start md:items-end max-w-[240px]">
              <span className="text-muted-foreground break-words">Olá, {displayName}</span>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1 flex-wrap">
                Sessão expira em {formatSessionTime(remainingSessionMs)}
                {isSessionPaused ? (
                  <span className="inline-flex items-center gap-1 text-amber-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                    pausada
                  </span>
                ) : null}
              </span>
            </div>
            <Button onClick={logout} variant="outline" size="sm" className="w-full md:w-auto">
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
              { key: "rankings", label: "Rankings", href: "/ranking", icon: Star },
              {
                key: "aniversariantes",
                label: "Aniversariantes",
                href: "/aniversariantes",
                icon: Cake,
                showDot:
                  !user ||
                  !("birthDate" in (user as any)) ||
                  !(user as any).birthDate,
              },
              { key: "perfil", label: "Perfil", href: "/perfil", icon: User },
              { key: "chat", label: "Chat", href: "/chat", icon: MessageCircle },
              ...(user?.role === "admin" ? [{ key: "admin", label: "Admin", href: "/admin", icon: ShieldCheck }] : []),
              ...(user?.role === "admin" ? [{ key: "enquetes", label: "Enquetes (Admin)", icon: ShieldCheck }] : []),
            ].map(item => {
              const Icon = item.icon;
              const isActive = activeSection === item.key || (!item.href && item.key === "overview" && !activeSection);
              const showChatIndicator = item.key === "chat" && hasNewChatMessages;
              const baseClasses =
                "w-full justify-start rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all";
              const activeClasses = isActive
                ? "bg-gradient-to-r from-purple-600/30 to-cyan-500/25 border-white/20 shadow-md"
                : "";
              const content = (
                <div className="flex items-center gap-3 w-full">
                  <div className="relative">
                    <Icon className={`w-4 h-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                    {showChatIndicator ? (
                      <span
                        className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_0_2px_rgba(0,0,0,0.6)] animate-pulse"
                        aria-label="Novas mensagens no chat"
                      />
                    ) : null}
                    {item.showDot ? (
                      <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-orange-400 shadow-[0_0_0_2px_rgba(0,0,0,0.6)]" />
                    ) : null}
                  </div>
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
                      if (item.key === "chat") {
                        markChatAsRead();
                      }
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
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Campeonatos</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setActiveSection("campeonatos");
                        setMenuOpen(false);
                      }}
                    >
                      Abrir aba
                    </Button>
                  </div>
                  {campeonatosQuery.isLoading ? (
                    <p className="text-sm text-muted-foreground">Carregando campeonatos...</p>
                  ) : (campeonatosQuery.data?.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum campeonato cadastrado.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {campeonatosQuery.data?.map(c => {
        const dataInicio = c.dataInicio ? new Date(c.dataInicio) : null;
        const rawStatus = (c as any).status ?? "ativo";
        const started = dataInicio ? dataInicio.getTime() <= Date.now() : false;
        const status =
          rawStatus === "finalizado" || rawStatus === "cancelado"
            ? rawStatus
            : started
              ? "finalizado"
              : "ativo";
        const faseLabel =
          status === "futuro" ? "Fase de inscricoes" : status === "finalizado" ? "Finalizado" : "Em andamento";
                        return (
                          <div key={c.id} className="p-3 rounded-xl border border-white/10 bg-white/5">
                            <div className="flex items-center justify-between mb-1">
                              <div className="min-w-0">
                                <h4 className="font-semibold text-white break-words">{c.nome}</h4>
                                <p className="text-xs text-muted-foreground break-words">{faseLabel}</p>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {dataInicio ? dataInicio.toLocaleDateString("pt-BR") : "Data a definir"}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2 break-words mb-1">
                              {(c as { descricao?: string | null }).descricao ?? "Campeonato ativo"}
                            </p>
                            <div className="flex items-center justify-between text-xs text-white/80">
                              <span>Prêmio</span>
                              <span className="font-semibold text-yellow-400">R$ {(c as any).premioValor}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {pollResults.length ? (
                  pollResults.map(poll => (
                    <div
                      key={poll.pollId}
                      className="relative rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/15 via-transparent to-cyan-500/20" />
                      <div className="relative p-6 md:p-8 flex flex-col gap-4 border border-white/10 rounded-3xl bg-black/40">
                        <div className="text-[11px] uppercase tracking-[0.28em] text-emerald-200/80 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
                          Enquete
                        </div>
                        <h2 className="text-3xl md:text-4xl font-semibold leading-tight text-white">
                          {poll.question || "Próximo campeonato: escolha o modo"}
                        </h2>
                        <p className="text-sm text-emerald-100/80">
                          Vote no jogo que quer ver no próximo torneio. 1 voto por jogador logado.
                        </p>
                        <div className="space-y-3">
                          {(() => {
                            const cleanLabel = (opt: string) => {
                              const t = (opt || "").trim();
                              const m = t.match(/^(.+?)\s*\(([^)]+)\)$/);
                              if (m) {
                                const before = m[1].trim();
                                const inside = m[2].trim();
                                if (inside && inside !== before) return inside;
                                return before;
                              }
                              return t;
                            };
                            const aggregated = (poll.options ?? []).reduce<
                              { label: string; count: number; primary: string }[]
                            >((acc, opt) => {
                              const label = cleanLabel(opt);
                              const count = poll.counts?.[opt] ?? 0;
                              const existing = acc.find(o => o.label === label);
                              if (existing) {
                                existing.count += count;
                              } else {
                                acc.push({ label, count, primary: opt });
                              }
                              return acc;
                            }, []);
                            const total = aggregated.reduce((sum, item) => sum + item.count, 0);
                            return aggregated.map(item => {
                              const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                              return (
                                <div key={item.label} className="space-y-1">
                                  <div className="flex justify-between text-xs text-emerald-100/80">
                                    <span>{item.label}</span>
                                    <span>
                                      {pct}% ({item.count} votos)
                                    </span>
                                  </div>
                                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                                    <div
                                      className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <Button
                                    key={`${item.primary}-btn`}
                                    variant="outline"
                                    className="w-full justify-between border-emerald-400/40 text-white hover:border-emerald-400 hover:text-white/90"
                                    onClick={() => {
                                      if (votedPolls.has(poll.pollId)) {
                                        toast.info("Voce ja votou nesta enquete. Apenas 1 voto por jogador.");
                                        return;
                                      }
                                      pollVoteMutation.mutate({ pollId: poll.pollId, escolha: item.primary });
                                    }}
                                    disabled={pollVoteMutation.isPending || votedPolls.has(poll.pollId)}
                                  >
                                    <span className="font-semibold">{item.label}</span>
                                    <span className="text-xs text-emerald-100/80">{item.count} votos</span>
                                  </Button>
                                </div>
                              );
                            });
                          })()}
                        </div>
                        {poll.closesAt ? (
                          <div className="text-xs text-emerald-100/70">
                            Fecha em: {new Date(poll.closesAt).toLocaleString("pt-BR")}
                          </div>
                        ) : null}
                        {pollVoteMutation.isPending ? (
                          <p className="text-xs text-emerald-100/80">Enviando voto...</p>
                        ) : null}
                        <div className="text-xs text-emerald-100/70">
                          A enquete é atualizada em tempo real após cada voto.
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
                <p className="text-sm text-muted-foreground mb-1">OpÃ§Ãµes (1 por linha, mÃ­nimo 2 e mÃ¡ximo 6)</p>
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
                    toast.error("Informe entre 2 e 6 opÃ§Ãµes");
                    return;
                  }
                  const year = (pollClosesAt.split("T")[0] || "").split("-")[0];
                  if (year && year.length > 4) {
                    toast.error("O ano deve ter no mÃ¡ximo 4 dÃ­gitos");
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
                <h2 className="text-xl font-semibold">Ranking de campeoes</h2>
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
                {(campeonatosQuery.data ?? []).map(camp => {
                  const dataInicio = camp.dataInicio ? new Date(camp.dataInicio) : null;
                  const status = (() => { const rawStatus = (camp as any).status ?? "ativo"; const started = dataInicio ? dataInicio.getTime() <= Date.now() : false; return rawStatus === "cancelado" || rawStatus === "finalizado" ? rawStatus : started ? "finalizado" : "ativo"; })();
                  const inscricoesEncerradas = (() => {
                    if (status === "cancelado" || status === "finalizado") return true;
                    if (!dataInicio) return false;
                    const diff = dataInicio.getTime() - Date.now();
                    if (diff <= 0) return true; // jÃ¡ comeÃ§ou
                    return diff < 24 * 60 * 60 * 1000; // menos de 24h
                  })();
                  const faseLabel =
                    status === "cancelado"
                      ? "Cancelado"
                      : status === "finalizado"
                        ? "Finalizado"
                        : inscricoesEncerradas
                          ? "Inscricoes encerradas"
                          : "Fase de inscricoes";
                  return (
                    <Card key={camp.id} className="p-4 border-border/70 bg-card/60 space-y-2">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="font-semibold break-words">{camp.nome}</h3>
                          <p className="text-xs text-muted-foreground break-words">{faseLabel}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {dataInicio ? dataInicio.toLocaleDateString("pt-BR") : "Data a definir"}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 break-words">
                        {(camp as { descricao?: string | null }).descricao ?? "Campeonato ativo"}
                      </p>
                      <div className="flex items-center justify-between mt-1 text-sm">
                        <span>PrÃªmio</span>
                        <span className="font-medium text-yellow-400">R$ {(camp as any).premioValor}</span>
                      </div>
                      <Button
                        className="mt-2"
                        size="sm"
                        variant="outline"
                        onClick={() => registrarInscricao(camp.id)}
                        disabled={inscricoesEncerradas}
                      >
                        {inscricoesEncerradas ? "Inscricoes encerradas" : "Inscreva-se"}
                      </Button>
                    </Card>
                  );
                }) ?? <p className="text-sm text-muted-foreground">Nenhum campeonato cadastrado.</p>}
              </div>
            </section>
          )}

          {activeSection === "perfil" && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Ranking de campeoes</h2>
                <Button asChild size="sm">
                  <Link href="/perfil">Abrir perfil</Link>
                </Button>
              </div>
              <Card className="p-5 border-border/70 bg-card/60">
                <p className="text-sm text-muted-foreground">Veja e edite seus dados, conquistas e histÃ³rico de campeonatos.</p>
              </Card>
            </section>
          )}

          {activeSection === "chat" && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Ranking de campeoes</h2>
                <Button asChild size="sm">
                  <Link href="/chat" onClick={markChatAsRead}>
                    Ir para o chat
                  </Link>
                </Button>
              </div>
              <Card className="p-5 border-border/70 bg-card/60">
                <p className="text-sm text-muted-foreground">
                  Converse com a comunidade e acompanhe transmissÃµes em tempo real.
                </p>
              </Card>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}


















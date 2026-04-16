import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  Menu,
  Download,
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
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import HomeBg from "../assets/dg-games-bg.png";
import { toast } from "sonner";
import { getLoginUrl, isNativeApp } from "@/const";
import { readLastSeenChatAt, writeLastSeenChatAt } from "@/lib/chatNotifications";

const LazyHomeActivePanels = lazy(() => import("@/components/HomeActivePanels"));
const LazyHomeAdminPollsPanel = lazy(() => import("@/components/HomeAdminPollsPanel"));
const LazyHomeOverviewPanel = lazy(() => import("@/components/HomeOverviewPanel"));

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
        const premioRaw = (camp as { premioValor?: unknown }).premioValor;
        const premio =
          typeof premioRaw === "number"
            ? premioRaw
            : premioRaw && typeof (premioRaw as any).toNumber === "function"
              ? (premioRaw as any).toNumber()
              : Number(premioRaw ?? 0);
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
          premio,
          fase,
          status,
        };
      }) ?? [];

    return list.find(item => item.status === "ativo") || list.find(item => item.status === "futuro") || null;
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
      let pref: "real" | "hago" = "real";
      if (typeof window !== "undefined") {
        const storedPref = localStorage.getItem("dg-display-pref");
        if (storedPref === "real" || storedPref === "hago") {
          pref = storedPref;
        }
      }
      return rankingTopQuery.data.map((r, idx) => {
        const usuario = (r as { usuario?: { name?: string | null; nickname?: string | null; email?: string | null } }).usuario;
        const baseName = usuario?.name || usuario?.email || `Jogador ${r.usuarioId}`;
        const nickname = (usuario?.nickname || "").trim();
        const name = pref === "hago" && nickname ? nickname : baseName;
        return {
          position: idx + 1,
          name,
          points: `${r.pontuacao} pontos`,
          badge: "TOP",
        };
      });
    }
    return [
      { position: 1, name: "Anna", points: "Campea - Ludo", badge: "TOP" },
      { position: 2, name: "Lucas", points: "Campeao - Golpeie e Esquiva", badge: "TOP" },
      { position: 3, name: "Reeh", points: "Campeao - Vermelhinha", badge: "TOP" },
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
      className="safe-shell min-h-screen text-foreground flex flex-col"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(5,7,13,0.8), rgba(5,7,13,0.95)), url(${HomeBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Top bar */}
      <header className="border-b border-border bg-card/70 backdrop-blur-sm">
        <div className="w-full flex flex-wrap items-start md:items-center gap-3 px-4 md:px-6 py-3 md:h-16 relative">
          <div className="flex items-center gap-3 md:w-64 md:px-3">
            <button
              className="h-12 w-12 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors border border-white/10 cursor-pointer select-none"
              onClick={handleMenuButton}
              aria-label="Abrir/fechar menu"
            >
              <Menu className="w-5 h-5 text-muted-foreground" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-600 flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold leading-none gradient-text">DG Hub</span>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-3 text-sm w-full md:w-auto ms-auto justify-end text-left md:text-right">
            <div className="flex flex-col items-start md:items-end max-w-[240px]">
              <span className="text-muted-foreground break-words">Ola, {displayName}</span>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1 flex-wrap">
                Sessao expira em {formatSessionTime(remainingSessionMs)}
                {isSessionPaused ? (
                  <span className="inline-flex items-center gap-1 text-amber-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                    pausada
                  </span>
                ) : null}
              </span>
            </div>
            {!isNativeApp ? (
              <Button asChild variant="secondary" size="sm" className="w-full md:w-auto">
                <a href="/apk/dg-hub.apk" download className="inline-flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Baixar APK
                </a>
              </Button>
            ) : null}
            <Button onClick={logout} variant="outline" size="sm" className="w-full md:w-auto">
              Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="safe-stack flex flex-1">
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
              <span className="text-sm font-semibold text-white/80">Navegacao</span>
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
        <main className="safe-stack flex-1 space-y-5 px-4 py-5 md:p-6 md:space-y-6">
          {!activeSection ? (
            <Suspense
              fallback={
                <Card className="border-border/70 bg-card/60 p-5">
                  <p className="text-sm text-muted-foreground">Carregando painel...</p>
                </Card>
              }
            >
              <LazyHomeOverviewPanel
                user={user}
                hasNewChatMessages={hasNewChatMessages}
                activeChampionship={activeChampionship}
                championshipCount={(campeonatosQuery.data ?? []).length}
                lastWinners={lastWinners}
                pollResults={pollResults as any}
                votedPolls={votedPolls}
                isVoting={pollVoteMutation.isPending}
                onOpenChat={() => {
                  setActiveSection("chat");
                  setMenuOpen(false);
                  markChatAsRead();
                }}
                onRegister={registrarInscricao}
                onVote={(pollId, escolha) => {
                  if (votedPolls.has(pollId)) {
                    toast.info("Voce ja votou nesta enquete. Apenas 1 voto por jogador.");
                    return;
                  }
                  pollVoteMutation.mutate({ pollId, escolha });
                }}
              />
            </Suspense>
          ) : null}


          {activeSection === "enquetes" ? (
            <Suspense
              fallback={
                <Card className="border-border/70 bg-card/60 p-5">
                  <p className="text-sm text-muted-foreground">Carregando painel...</p>
                </Card>
              }
            >
              <LazyHomeAdminPollsPanel
                pollResults={pollResults as any}
                pollPergunta={pollPergunta}
                pollClosesAt={pollClosesAt}
                pollOptionsText={pollOptionsText}
                setPollPergunta={setPollPergunta}
                setPollClosesAt={setPollClosesAt}
                setPollOptionsText={setPollOptionsText}
                clampDateYear={clampDateYear}
                isCreating={pollCreateMutation.isPending}
                isDeleting={pollDeleteMutation.isPending}
                onCreate={input => pollCreateMutation.mutate(input)}
                onDelete={pollId => pollDeleteMutation.mutate({ pollId })}
              />
            </Suspense>
          ) : null}


          {activeSection === "campeonatos" || activeSection === "perfil" || activeSection === "chat" ? (
            <Suspense
              fallback={
                <Card className="border-border/70 bg-card/60 p-5">
                  <p className="text-sm text-muted-foreground">Carregando painel...</p>
                </Card>
              }
            >
              <LazyHomeActivePanels
                activeSection={activeSection}
                campeonatos={(campeonatosQuery.data ?? []) as any}
                onlinePlayers={onlinePlayers}
                userRole={user?.role}
                onRegister={registrarInscricao}
                onMarkChatAsRead={markChatAsRead}
              />
            </Suspense>
          ) : null}

        </main>
      </div>
    </div>
  );
}








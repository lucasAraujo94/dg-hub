import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trophy, Users, Clock, DollarSign, Filter, Volume2 } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

const BYE = "W.O";
type Match = { jogador1: string; jogador2: string; vencedor?: string };
type MatchActivity = { winner: string; updatedAt: string; score: string; note?: string };
const BRACKET_MATCH_HEIGHT = 132;
const BRACKET_BASE_GAP = 14;
const EXEMPLO_CHAVEAMENTO_16: Match[][] = [
  [
    { jogador1: "Jogador 01", jogador2: "Jogador 02" },
    { jogador1: "Jogador 03", jogador2: "Jogador 04" },
    { jogador1: "Jogador 05", jogador2: "Jogador 06" },
    { jogador1: "Jogador 07", jogador2: "Jogador 08" },
    { jogador1: "Jogador 09", jogador2: "Jogador 10" },
    { jogador1: "Jogador 11", jogador2: "Jogador 12" },
    { jogador1: "Jogador 13", jogador2: "Jogador 14" },
    { jogador1: "Jogador 15", jogador2: "Jogador 16" },
  ],
  [
    { jogador1: "Vencedor 1", jogador2: "Vencedor 2" },
    { jogador1: "Vencedor 3", jogador2: "Vencedor 4" },
    { jogador1: "Vencedor 5", jogador2: "Vencedor 6" },
    { jogador1: "Vencedor 7", jogador2: "Vencedor 8" },
  ],
  [
    { jogador1: "Vencedor Q1", jogador2: "Vencedor Q2" },
    { jogador1: "Vencedor Q3", jogador2: "Vencedor Q4" },
  ],
  [{ jogador1: "Vencedor S1", jogador2: "Vencedor S2" }],
];

export default function Campeonatos() {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = user?.role === "admin";
  const usuarioId = (user as { id?: number } | null | undefined)?.id;

  const [displayPref, setDisplayPref] = useState<"real" | "hago">(() => {
    if (typeof window === "undefined") return "real";
    const stored = localStorage.getItem("dg-display-pref");
    return stored === "hago" ? "hago" : "real";
  });
  const [hagoNickLocal, setHagoNickLocal] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("dg-hago-nickname") || "";
  });

  const nomeUsuarioBase = user?.name || user?.email || "Convidado";
  const nomeUsuarioNick = (user as any)?.nickname || hagoNickLocal || "";
  const nomeUsuario = displayPref === "hago" && nomeUsuarioNick ? nomeUsuarioNick : nomeUsuarioBase;

  const [rounds, setRounds] = useState<Match[][]>([]);
  const [sorteando, setSorteando] = useState(false);
  const [celebrationWinner, setCelebrationWinner] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [ultimaPrimeiraRodada, setUltimaPrimeiraRodada] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "ativo" | "futuro" | "finalizado">("todos");
  const [selectedCampId, setSelectedCampId] = useState<number | null>(null);
  const [manualUserId, setManualUserId] = useState<number | null>(null);
  const [bracketSearch, setBracketSearch] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("dg-bracket-search") || "";
  });
  const [compactBracket, setCompactBracket] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("dg-bracket-compact") === "1";
  });
  const [bracketDensity, setBracketDensity] = useState<"detalhado" | "compacto" | "ultracompacto">(() => {
    if (typeof window === "undefined") return "detalhado";
    const stored = localStorage.getItem("dg-bracket-density");
    return stored === "compacto" || stored === "ultracompacto" ? stored : "detalhado";
  });
  const [roundFilter, setRoundFilter] = useState(() => {
    if (typeof window === "undefined") return "todas";
    return localStorage.getItem("dg-bracket-round-filter") || "todas";
  });
  const [presentationMode, setPresentationMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("dg-bracket-presentation") === "1";
  });
  const [presentationAutoplay, setPresentationAutoplay] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("dg-bracket-presentation-autoplay") === "1";
  });
  const [collapsedResolvedRounds, setCollapsedResolvedRounds] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("dg-bracket-collapse-resolved") === "1";
  });
  const [matchActivity, setMatchActivity] = useState<Record<string, MatchActivity>>({});
  const [loadedBracketCampId, setLoadedBracketCampId] = useState<number | null>(null);
  const [spectatorMode, setSpectatorMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("dg-bracket-spectator") === "1";
  });
  const [editingMatchKey, setEditingMatchKey] = useState<string | null>(null);
  const [manualScoreInput, setManualScoreInput] = useState("1 x 0");
  const [manualNoteInput, setManualNoteInput] = useState("");
  const bracketViewportRef = useRef<HTMLDivElement | null>(null);
  const bracketContentRef = useRef<HTMLDivElement | null>(null);
  const roundRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const utils = trpc.useUtils();
  const campeonatosQuery = trpc.campeonatos.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const inscritosQuery = trpc.campeonatos.getParticipantes.useQuery(
    { campeonatoId: selectedCampId ?? 0 },
    { enabled: Boolean(selectedCampId), refetchOnWindowFocus: false }
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncPrefs = () => {
      const pref = localStorage.getItem("dg-display-pref");
      const nick = localStorage.getItem("dg-hago-nickname") || "";
      if (pref === "hago" || pref === "real") setDisplayPref(pref);
      setHagoNickLocal(nick);
    };
    syncPrefs();
    window.addEventListener("storage", syncPrefs);
    return () => window.removeEventListener("storage", syncPrefs);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("dg-bracket-search", bracketSearch);
  }, [bracketSearch]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("dg-bracket-compact", compactBracket ? "1" : "0");
  }, [compactBracket]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("dg-bracket-density", bracketDensity);
  }, [bracketDensity]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("dg-bracket-presentation", presentationMode ? "1" : "0");
  }, [presentationMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("dg-bracket-presentation-autoplay", presentationAutoplay ? "1" : "0");
  }, [presentationAutoplay]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("dg-bracket-collapse-resolved", collapsedResolvedRounds ? "1" : "0");
  }, [collapsedResolvedRounds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("dg-bracket-spectator", spectatorMode ? "1" : "0");
  }, [spectatorMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const roundsAtuais = rounds.length > 0 ? rounds : EXEMPLO_CHAVEAMENTO_16;
    const validFilters = new Set(["todas", ...roundsAtuais.map((_, index) => String(index))]);
    if (!validFilters.has(roundFilter)) {
      setRoundFilter("todas");
      return;
    }
    localStorage.setItem("dg-bracket-round-filter", roundFilter);
  }, [roundFilter, rounds]);

  useEffect(() => {
    if (typeof window === "undefined" || !selectedCampId) {
      setLoadedBracketCampId(null);
      return;
    }
    const savedRounds = localStorage.getItem(`dg-bracket-rounds-${selectedCampId}`);
    const savedActivity = localStorage.getItem(`dg-bracket-activity-${selectedCampId}`);
    if (savedRounds) {
      try {
        const parsed = JSON.parse(savedRounds) as Match[][];
        if (Array.isArray(parsed)) setRounds(parsed);
      } catch {
        localStorage.removeItem(`dg-bracket-rounds-${selectedCampId}`);
      }
    } else {
      setRounds([]);
    }
    if (savedActivity) {
      try {
        const parsed = JSON.parse(savedActivity) as Record<string, MatchActivity>;
        setMatchActivity(parsed && typeof parsed === "object" ? parsed : {});
      } catch {
        setMatchActivity({});
        localStorage.removeItem(`dg-bracket-activity-${selectedCampId}`);
      }
    } else {
      setMatchActivity({});
    }
    setLoadedBracketCampId(selectedCampId);
  }, [selectedCampId]);

  useEffect(() => {
    if (typeof window === "undefined" || !selectedCampId || loadedBracketCampId !== selectedCampId) return;
    if (rounds.length > 0) {
      localStorage.setItem(`dg-bracket-rounds-${selectedCampId}`, JSON.stringify(rounds));
    } else {
      localStorage.removeItem(`dg-bracket-rounds-${selectedCampId}`);
    }
  }, [loadedBracketCampId, rounds, selectedCampId]);

  useEffect(() => {
    if (typeof window === "undefined" || !selectedCampId || loadedBracketCampId !== selectedCampId) return;
    if (Object.keys(matchActivity).length > 0) {
      localStorage.setItem(`dg-bracket-activity-${selectedCampId}`, JSON.stringify(matchActivity));
    } else {
      localStorage.removeItem(`dg-bracket-activity-${selectedCampId}`);
    }
  }, [loadedBracketCampId, matchActivity, selectedCampId]);

  const resolveDisplayName = (usuario?: { name?: string | null; email?: string | null; nickname?: string | null }) => {
    const baseName = usuario?.name || usuario?.email || "Jogador";
    const nick = (usuario?.nickname || "").trim();
    if (displayPref === "hago" && nick) return nick;
    return baseName;
  };

  const exibirApelido = (valor: string, display: "real" | "hago") => {
    const raw = (valor || "").trim();
    const parts = raw.match(/^(.+?)\s*\(([^)]+)\)$/);
    let t = raw;
    if (parts) {
      const before = parts[1].trim();
      const inside = parts[2].trim();
      t = display === "hago" && inside ? inside : before;
    }
    const tokens = t.split(/\s+/);
    if (tokens.length > 1 && tokens.length % 2 === 0) {
      const half = tokens.length / 2;
      const first = tokens.slice(0, half).join(" ").toLowerCase();
      const second = tokens.slice(half).join(" ").toLowerCase();
      if (first === second) return tokens.slice(0, half).join(" ");
    }
    return t;
  };

  const inscricaoMutation = trpc.campeonatos.inscrever.useMutation({
    onSuccess: async () => {
      toast.success("Inscricao confirmada!");
      await Promise.all([
        utils.campeonatos.list.invalidate(),
        selectedCampId ? utils.campeonatos.getParticipantes.invalidate({ campeonatoId: selectedCampId }) : Promise.resolve(),
      ]);
    },
    onError: error => toast.error(error.message || "Falha ao inscrever"),
  });

  const updateCampMutation = trpc.campeonatos.update.useMutation({
    onSuccess: () => {
      toast.success("Campeonato atualizado");
      utils.campeonatos.list.invalidate();
    },
    onError: err => toast.error(err.message || "Falha ao atualizar campeonato"),
  });

  const cancelCampMutation = trpc.campeonatos.cancel.useMutation({
    onSuccess: () => {
      toast.success("Campeonato cancelado");
      utils.campeonatos.list.invalidate();
    },
    onError: err => toast.error(err.message || "Falha ao cancelar campeonato"),
  });

  const deleteCampMutation = trpc.campeonatos.delete.useMutation({
    onSuccess: () => {
      toast.success("Campeonato excluido");
      utils.campeonatos.list.invalidate();
    },
    onError: err => toast.error(err.message || "Falha ao excluir campeonato"),
  });

  const listUsersQuery = trpc.admin.listUsers.useQuery(undefined, { enabled: isAdmin, refetchOnWindowFocus: false });
  const adminInscreverMutation = trpc.admin.inscreverUsuarioCampeonato.useMutation({
    onSuccess: async () => {
      toast.success("Inscricao adicionada");
      await Promise.all([
        utils.campeonatos.list.invalidate(),
        selectedCampId ? utils.campeonatos.getParticipantes.invalidate({ campeonatoId: selectedCampId }) : Promise.resolve(),
      ]);
    },
    onError: err => toast.error(err.message || "Falha ao inscrever"),
  });

  useEffect(() => {
    if (selectedCampId || !campeonatosQuery.data?.length) return;
    setSelectedCampId(campeonatosQuery.data[0]?.id ?? null);
  }, [campeonatosQuery.data, selectedCampId]);

  const participantes = useMemo(() => {
    if (!inscritosQuery.data) return [];
    return inscritosQuery.data.map(item => {
      const usuario = (item as { usuario?: { id?: number | null; name?: string | null; email?: string | null; nickname?: string | null } }).usuario;
      const name = resolveDisplayName(usuario) || `Jogador ${item.usuarioId}`;
      return { name, email: usuario?.email ?? undefined, id: usuario?.id ?? null };
    });
  }, [inscritosQuery.data, displayPref]);

  const inscritosNomes = useMemo(() => {
    const cleaned = participantes.map(i => exibirApelido(i.name, displayPref));
    return Array.from(new Set(cleaned));
  }, [participantes, displayPref]);
  const inscritosIds = useMemo(() => participantes.map(i => i.id).filter(Boolean) as number[], [participantes]);

  const campeonatos = useMemo(() => {
    const mapped =
      campeonatosQuery.data?.map(camp => {
        const dataInicio = camp.dataInicio ? new Date(camp.dataInicio) : null;
        const agora = Date.now();
        const statusOriginal = (camp as { status?: string }).status;
        const status = statusOriginal
          ? statusOriginal
          : dataInicio && dataInicio.getTime() > agora
          ? "futuro"
          : "ativo";
        const participantesCount =
          (camp as { participantes?: number }).participantes ??
          (camp as { totalInscritos?: number }).totalInscritos ??
          (camp as { _count?: { inscricoes?: number } })._count?.inscricoes ??
          0;
        const inscricoesEncerradas = (() => {
          if (status === "cancelado" || status === "finalizado") return true;
          if (!dataInicio) return false;
          const diff = dataInicio.getTime() - agora;
          if (diff <= 0) return true;
          return diff < 24 * 60 * 60 * 1000;
        })();
        const fase = (() => {
          if (status === "cancelado") return "Cancelado";
          if (status === "finalizado") return "Finalizado";
          if (!dataInicio || dataInicio.getTime() > agora) {
            return inscricoesEncerradas ? "Inscricoes encerradas" : "Fase de inscricoes";
          }
          return "Eliminacao";
        })();

        return {
          id: camp.id,
          nome: camp.nome,
          jogo: (camp as { jogo?: string }).jogo ?? "Jogo",
          status,
          participantes: participantesCount,
          premio: Number(camp.premioValor ?? 0),
          inicio: dataInicio ? dataInicio.toLocaleString("pt-BR") : "Data a definir",
          fase,
          inscricoesEncerradas,
        };
      }) ?? [];

    if (filtroStatus === "todos") return mapped;
    return mapped.filter(camp => camp.status === filtroStatus);
  }, [campeonatosQuery.data, filtroStatus]);
  const campeonatoSelecionado = useMemo(
    () => campeonatos.find(camp => camp.id === selectedCampId) ?? null,
    [campeonatos, selectedCampId]
  );

  useEffect(() => {
    if (!campeonatos.length) {
      setSelectedCampId(null);
      return;
    }
    const exists = campeonatos.some(c => c.id === selectedCampId);
    if (!exists) {
      setSelectedCampId(campeonatos[0]?.id ?? null);
    }
  }, [campeonatos, selectedCampId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ativo":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "futuro":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "cancelado":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "finalizado":
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
      default:
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "ativo":
        return "Ativo";
      case "futuro":
        return "Futuro";
      case "cancelado":
        return "Cancelado";
      case "finalizado":
        return "Finalizado";
      default:
        return status;
    }
  };

  const hashString = (value: string | number) => {
    const str = String(value);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash >>> 0;
  };

  const seededShuffle = (arr: string[], seedValue: number) => {
    const clone = [...arr];
    let seed = seedValue || 1;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let i = clone.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [clone[i], clone[j]] = [clone[j], clone[i]];
    }
    return clone;
  };

  const proximaPotenciaDeDois = (n: number) => {
    if (n < 1) return 1;
    return 1 << Math.ceil(Math.log2(n));
  };

  const assinaturaPrimeiraRodada = (matches: Match[]) =>
    matches
      .map(m => [m.jogador1, m.jogador2].sort().join("_vs_"))
      .sort()
      .join("|");

  const propagarVencedores = (baseRounds: Match[][]) => {
    const clone = baseRounds.map(r => r.map(m => ({ ...m })));
    for (let r = 0; r < clone.length - 1; r++) {
      clone[r].forEach((match, idx) => {
        if (!match.vencedor) return;
        const alvoMatchIdx = Math.floor(idx / 2);
        const alvo = clone[r + 1][alvoMatchIdx];
        if (idx % 2 === 0) {
          alvo.jogador1 = match.vencedor;
        } else {
          alvo.jogador2 = match.vencedor;
        }
      });
    }
    return clone;
  };

  const gerarRounds = (participantesNomes: string[], seed?: number, tentativa = 0) => {
    const totalAlvo = Math.max(2, proximaPotenciaDeDois(participantesNomes.length || 1));
    const baseSeed = seed ?? hashString(participantesNomes.join("|"));
    const embaralhados = seededShuffle(participantesNomes, baseSeed + (tentativa || 0));
    while (embaralhados.length < totalAlvo) {
      embaralhados.push(BYE);
    }

    const totalRounds = Math.max(1, Math.log2(totalAlvo));
    const novoRounds: Match[][] = Array.from({ length: totalRounds }, () => []);

    for (let i = 0; i < totalAlvo; i += 2) {
      const jogador1 = embaralhados[i];
      const jogador2 = embaralhados[i + 1];
      const match: Match = { jogador1, jogador2 };
      if (jogador1 === BYE && jogador2 !== BYE) match.vencedor = jogador2;
      if (jogador2 === BYE && jogador1 !== BYE) match.vencedor = jogador1;
      novoRounds[0]?.push(match);
    }

    for (let r = 1; r < totalRounds; r++) {
      const matchesCount = totalAlvo / Math.pow(2, r + 1);
      for (let m = 0; m < matchesCount; m++) {
        novoRounds[r]?.push({ jogador1: "Aguardando", jogador2: "Aguardando" });
      }
    }

    if (!novoRounds[0] || novoRounds[0].length === 0) {
      return;
    }

    const assinaturaAtual = assinaturaPrimeiraRodada(novoRounds[0]);
    if (assinaturaAtual === ultimaPrimeiraRodada && tentativa < 8) {
      return gerarRounds(participantesNomes, seed, tentativa + 1);
    }

    setUltimaPrimeiraRodada(assinaturaAtual);
    const propagado = propagarVencedores(novoRounds);
    setRounds(propagado);
  };

  const handleRegistrarVencedor = (roundIndex: number, matchIndex: number, vencedor: string) => {
    const activityKey = `${roundIndex}-${matchIndex}`;
    const updatedAt = new Date().toLocaleString("pt-BR");
    setRounds(prev => {
      const clone = prev.map(r => r.map(m => ({ ...m })));
      const partida = clone[roundIndex][matchIndex];
      partida.vencedor = vencedor;
      const propagado = propagarVencedores(clone);
      const ultimaRodada = propagado[propagado.length - 1];
      const finalMatch = ultimaRodada?.[0];
      if (finalMatch?.vencedor) {
        setCelebrationWinner(finalMatch.vencedor);
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 3000);
      }
      return propagado;
    });
    setMatchActivity(prev => ({
      ...prev,
      [activityKey]: {
        winner: vencedor,
        updatedAt,
        score: "1 x 0",
        note: "Resultado definido manualmente",
      },
    }));
  };

  const registrarInscricao = async (campeonatoId?: number) => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    if (!campeonatoId) {
      toast.error("Selecione um campeonato");
      return;
    }

    const jaInscrito = (usuarioId && inscritosIds.includes(usuarioId)) || inscritosNomes.some(n => n === nomeUsuario);
    if (jaInscrito) {
      toast.info("Voce ja esta inscrito neste campeonato.");
      return;
    }

    try {
      await inscricaoMutation.mutateAsync({ campeonatoId });
    } catch (error: any) {
      toast.error(error?.message || "Falha ao inscrever");
    }
  };

  const handleSortearConfrontos = () => {
    if (!isAdmin) {
      toast.error("Apenas admins podem sortear o chaveamento.");
      return;
    }
    if (rounds.length > 0) {
      toast.error("Chaveamento já gerado. Não é possível sortear novamente.");
      return;
    }
    if (!inscritosNomes.length) {
      toast.error("Nenhum inscrito para sortear.");
      return;
    }
    setSorteando(true);
    try {
      gerarRounds(inscritosNomes, selectedCampId ?? 0);
      toast.success("Chaveamento gerado.");
    } finally {
      setSorteando(false);
    }
  };

  useEffect(() => {
    if (!selectedCampId) return;
    if (!inscritosNomes.length) return;
    if (rounds.length > 0) return;
    gerarRounds(inscritosNomes, selectedCampId);
  }, [inscritosNomes, selectedCampId, rounds.length]);

  const narrarCampeonatos = () => {
    const lista = campeonatos.map(
      c => `${c.nome}, premio R$ ${c.premio}, ${c.participantes} participantes, inicio ${c.inicio}`
    );
    const texto = lista.length > 0 ? `Campeonatos ativos. ${lista.join(". ")}` : "Nenhum campeonato ativo no momento.";

    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Navegador nao suporta leitura em voz.");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = "pt-BR";
    utterance.pitch = 1;
    utterance.rate = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };
  const imprimirBracket = () => {
    if (typeof window === "undefined") return;
    window.print();
  };
  const resetBracketView = () => {
    setBracketSearch("");
    setCompactBracket(false);
    setBracketDensity("detalhado");
    setRoundFilter("todas");
    setPresentationMode(false);
    setPresentationAutoplay(false);
    setCollapsedResolvedRounds(false);
    setSpectatorMode(false);
  };
  const copiarResumoBusca = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard || !normalizedBracketSearch) return;
    const resumo =
      searchedPlayerLastRoundIndex >= 0
        ? `Jogador: ${bracketSearch.trim()}\nMelhor fase: ${searchedPlayerRoundLabel}\nCampeonato: ${campeonatoSelecionado?.nome ?? "Bracket atual"}`
        : `Jogador: ${bracketSearch.trim()}\nResultado: nao encontrado no bracket atual\nCampeonato: ${campeonatoSelecionado?.nome ?? "Bracket atual"}`;
    try {
      await navigator.clipboard.writeText(resumo);
      toast.success("Resumo copiado.");
    } catch {
      toast.error("Nao foi possivel copiar o resumo.");
    }
  };

  const roundsExibidos = rounds.length > 0 ? rounds : EXEMPLO_CHAVEAMENTO_16;
  const totalRoundsExibidos = roundsExibidos.length;
  const getRoundLabel = (roundIndex: number, totalRounds: number, matchesCount: number) => {
    const roundsRestantes = totalRounds - roundIndex - 1;
    if (roundsRestantes === 0) return "Final";
    if (roundsRestantes === 1) return "Semifinal";
    if (roundsRestantes === 2) return "Quartas";
    if (roundsRestantes === 3) return "Oitavas";
    return `${matchesCount * 2} jogadores`;
  };
  const getRoundStackStyle = (roundIndex: number) => {
    if (roundIndex === 0) {
      return { paddingTop: "0px", gap: `${BRACKET_BASE_GAP}px` };
    }
    const unit = BRACKET_MATCH_HEIGHT + BRACKET_BASE_GAP;
    const paddingTop = (unit * (Math.pow(2, roundIndex) - 1)) / 2;
    const gap = unit * (Math.pow(2, roundIndex) - 1) + BRACKET_BASE_GAP;
    return { paddingTop: `${paddingTop}px`, gap: `${gap}px` };
  };
  const isBracketPlaceholder = (name: string) => name === BYE || name === "Aguardando";
  const getMatchAdvanceState = (roundIndex: number, matchIndex: number) => {
    if (roundIndex >= roundsExibidos.length - 1) return false;
    const match = roundsExibidos[roundIndex]?.[matchIndex];
    if (!match?.vencedor || isBracketPlaceholder(match.vencedor)) return false;
    const nextMatch = roundsExibidos[roundIndex + 1]?.[Math.floor(matchIndex / 2)];
    return nextMatch?.jogador1 === match.vencedor || nextMatch?.jogador2 === match.vencedor;
  };
  const getPlayerBadge = (name: string) => {
    if (name === BYE) return "W.O";
    if (name === "Aguardando") return "...";
    return exibirApelido(name, displayPref)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2);
  };
  const getMatchStatusLabel = (match: Match) => {
    if (match.vencedor && !isBracketPlaceholder(match.vencedor)) return "Definida";
    if (match.jogador1 === BYE || match.jogador2 === BYE) return "W.O";
    if (isBracketPlaceholder(match.jogador1) || isBracketPlaceholder(match.jogador2)) return "Aguardando";
    return "Aberta";
  };
  const getMatchStatusClassName = (match: Match) => {
    if (match.vencedor && !isBracketPlaceholder(match.vencedor)) {
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    }
    if (match.jogador1 === BYE || match.jogador2 === BYE) {
      return "border-amber-400/30 bg-amber-400/10 text-amber-100";
    }
    if (isBracketPlaceholder(match.jogador1) || isBracketPlaceholder(match.jogador2)) {
      return "border-white/10 bg-white/5 text-muted-foreground";
    }
    return "border-cyan-400/20 bg-cyan-400/10 text-cyan-100";
  };
  const getMatchAriaLabel = (match: Match, roundIndex: number, matchIndex: number) => {
    const base = `Round ${roundIndex + 1}, partida ${matchIndex + 1}. ${exibirApelido(match.jogador1, displayPref)} versus ${exibirApelido(match.jogador2, displayPref)}.`;
    const status = match.vencedor && !isBracketPlaceholder(match.vencedor)
      ? ` Vencedor atual: ${exibirApelido(match.vencedor, displayPref)}.`
      : ` Status: ${getMatchStatusLabel(match)}.`;
    return `${base}${status}`;
  };
  const formatRoundStory = (roundIndexes: number[]) => roundIndexes.map(index => getRoundLabel(index, totalRoundsExibidos, roundsExibidos[index]?.length ?? 0)).join(" > ");
  const getSeedLabel = (roundIndex: number, slotIndex: number) => {
    if (roundIndex !== 0) return null;
    return `#${slotIndex + 1}`;
  };
  const totalParticipantesExibidos = roundsExibidos[0]?.length ? roundsExibidos[0].length * 2 : 0;
  const partidasDefinidas = roundsExibidos.reduce(
    (acc, round) => acc + round.filter(match => match.vencedor && !isBracketPlaceholder(match.vencedor)).length,
    0
  );
  const partidasTotais = roundsExibidos.reduce((acc, round) => acc + round.length, 0);
  const woCount = roundsExibidos.reduce(
    (acc, round) => acc + round.filter(match => match.jogador1 === BYE || match.jogador2 === BYE).length,
    0
  );
  const pendingMatches = roundsExibidos.reduce(
    (acc, round) =>
      acc +
      round.filter(match => !match.vencedor && !isBracketPlaceholder(match.jogador1) && !isBracketPlaceholder(match.jogador2)).length,
    0
  );
  const alivePlayers = roundsExibidos.reduce((names, round) => {
    round.forEach(match => {
      [match.jogador1, match.jogador2].forEach(player => {
        if (!isBracketPlaceholder(player) && !match.vencedor) names.add(player);
      });
    });
    return names;
  }, new Set<string>()).size;
  const faseAtualIndex = roundsExibidos.findIndex(round =>
    round.some(match => !match.vencedor && !isBracketPlaceholder(match.jogador1) && !isBracketPlaceholder(match.jogador2))
  );
  const faseAtualLabel =
    faseAtualIndex >= 0
      ? getRoundLabel(faseAtualIndex, totalRoundsExibidos, roundsExibidos[faseAtualIndex]?.length ?? 0)
      : totalRoundsExibidos > 0
      ? "Concluido"
      : "Aguardando";
  const progressoPercentual = partidasTotais > 0 ? Math.round((partidasDefinidas / partidasTotais) * 100) : 0;
  const normalizedBracketSearch = bracketSearch.trim().toLowerCase();
  const matchContainsSearchedPlayer = (match: Match) => {
    if (!normalizedBracketSearch) return false;
    return [match.jogador1, match.jogador2, match.vencedor]
      .filter(Boolean)
      .some(name => exibirApelido(String(name), displayPref).toLowerCase().includes(normalizedBracketSearch));
  };
  const roundContainsSearchedPlayer = (round: Match[]) => round.some(match => matchContainsSearchedPlayer(match));
  const isRoundResolved = (round: Match[]) =>
    round.every(
      match =>
        Boolean(match.vencedor && !isBracketPlaceholder(match.vencedor)) ||
        match.jogador1 === BYE ||
        match.jogador2 === BYE ||
        isBracketPlaceholder(match.jogador1) ||
        isBracketPlaceholder(match.jogador2)
    );
  const searchedPlayerLastRoundIndex = normalizedBracketSearch
    ? roundsExibidos.reduce((lastIndex, round, index) => (roundContainsSearchedPlayer(round) ? index : lastIndex), -1)
    : -1;
  const searchedPlayerRoundLabel =
    searchedPlayerLastRoundIndex >= 0
      ? getRoundLabel(
          searchedPlayerLastRoundIndex,
          totalRoundsExibidos,
          roundsExibidos[searchedPlayerLastRoundIndex]?.length ?? 0
        )
      : null;
  const searchedPlayerRoundTrail = normalizedBracketSearch
    ? roundsExibidos.reduce<number[]>((acc, round, index) => {
        if (roundContainsSearchedPlayer(round)) acc.push(index);
        return acc;
      }, [])
    : [];
  const campeaoAtual = roundsExibidos[roundsExibidos.length - 1]?.[0]?.vencedor;
  const bracketMatchHeight =
    bracketDensity === "ultracompacto" ? 74 : bracketDensity === "compacto" || compactBracket ? 96 : BRACKET_MATCH_HEIGHT;
  const getResponsiveRoundStackStyle = (roundIndex: number) => {
    if (roundIndex === 0) {
      return { paddingTop: "0px", gap: `${BRACKET_BASE_GAP}px` };
    }
    const unit = bracketMatchHeight + BRACKET_BASE_GAP;
    const paddingTop = (unit * (Math.pow(2, roundIndex) - 1)) / 2;
    const gap = unit * (Math.pow(2, roundIndex) - 1) + BRACKET_BASE_GAP;
    return { paddingTop: `${paddingTop}px`, gap: `${gap}px` };
  };
  const roundFilterOptions = roundsExibidos.map((round, roundIndex) => ({
    value: String(roundIndex),
    label: getRoundLabel(roundIndex, totalRoundsExibidos, round.length),
  }));
  const roundsFiltrados =
    roundFilter === "todas" ? roundsExibidos : roundsExibidos.filter((_, roundIndex) => String(roundIndex) === roundFilter);
  const roundFilterLabel =
    roundFilter === "todas"
      ? "Todas as fases"
      : roundFilterOptions.find(option => option.value === roundFilter)?.label ?? "Fase filtrada";
  const usarBracketDuplo = roundFilter === "todas" && (roundsExibidos[0]?.length ?? 0) >= 16;
  const roundsLadoEsquerdo = usarBracketDuplo
    ? roundsExibidos.slice(0, -1).map(round => round.slice(0, Math.ceil(round.length / 2)))
    : [];
  const roundsLadoDireito = usarBracketDuplo
    ? roundsExibidos.slice(0, -1).map(round => round.slice(Math.ceil(round.length / 2)))
    : [];
  const finalRound = usarBracketDuplo ? roundsExibidos[roundsExibidos.length - 1] ?? [] : [];
  const bracketEhExemplo = rounds.length === 0;
  const selectedRoundIndex = roundFilter === "todas" ? -1 : Number(roundFilter);
  const effectiveRoundIndex = selectedRoundIndex >= 0 ? selectedRoundIndex : (searchedPlayerLastRoundIndex >= 0 ? searchedPlayerLastRoundIndex : Math.max(faseAtualIndex, 0));
  const goToPreviousRound = () => {
    if (selectedRoundIndex <= 0) return;
    setRoundFilter(String(selectedRoundIndex - 1));
  };
  const goToNextRound = () => {
    if (selectedRoundIndex < 0 || selectedRoundIndex >= roundsExibidos.length - 1) return;
    setRoundFilter(String(selectedRoundIndex + 1));
  };
  const goToRound = (roundIndex: number) => setRoundFilter(String(roundIndex));
  const roundViewLabel =
    selectedRoundIndex >= 0
      ? `Fase isolada: ${roundFilterLabel}`
      : searchedPlayerLastRoundIndex >= 0
      ? `Busca focada ate ${searchedPlayerRoundLabel}`
      : faseAtualIndex >= 0
      ? `Acompanhe a fase atual: ${faseAtualLabel}`
      : "Visualizacao completa";
  const phaseSizeSummary = roundsExibidos.map(round => round.length * 2).join(" > ");
  const currentPhaseCounter = `${Math.max(effectiveRoundIndex + 1, 1)} de ${Math.max(totalRoundsExibidos, 1)}`;
  const orderedActivities = Object.entries(matchActivity)
    .map(([key, value]) => {
      const [roundIndex, matchIndex] = key.split("-").map(Number);
      return { key, roundIndex, matchIndex, ...value };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const copyRoundSummary = async (roundIndex: number) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    const round = roundsExibidos[roundIndex];
    if (!round) return;
    const summary = [
      `${campeonatoSelecionado?.nome ?? "Bracket atual"} - ${getRoundLabel(roundIndex, totalRoundsExibidos, round.length)}`,
      ...round.map(
        (match, index) =>
          `Partida ${index + 1}: ${exibirApelido(match.jogador1, displayPref)} x ${exibirApelido(match.jogador2, displayPref)}${
            match.vencedor ? ` | vencedor: ${exibirApelido(match.vencedor, displayPref)}` : ""
          }`
      ),
    ].join("\n");
    await navigator.clipboard.writeText(summary);
    toast.success("Resumo da fase copiado.");
  };
  const openMatchEditor = (roundIndex: number, matchIndex: number, winner: string) => {
    const key = `${roundIndex}-${matchIndex}`;
    setEditingMatchKey(key);
    setManualScoreInput(matchActivity[key]?.score || "1 x 0");
    setManualNoteInput(matchActivity[key]?.note || `Resultado confirmado para ${exibirApelido(winner, displayPref)}`);
  };
  const saveMatchEditor = () => {
    if (!editingMatchKey) return;
    setMatchActivity(prev => ({
      ...prev,
      [editingMatchKey]: {
        ...(prev[editingMatchKey] ?? { winner: "", updatedAt: new Date().toLocaleString("pt-BR"), score: "1 x 0" }),
        updatedAt: new Date().toLocaleString("pt-BR"),
        score: manualScoreInput.trim() || "1 x 0",
        note: manualNoteInput.trim() || "Atualizacao manual de placar",
      },
    }));
    setEditingMatchKey(null);
    toast.success("Placar local atualizado.");
  };
  const renderRoundColumn = (round: Match[], roundIndex: number, side: "full" | "left" | "right" = "full") => {
    const roundResolved = isRoundResolved(round);
    const collapseRound = collapsedResolvedRounds && roundResolved && roundIndex !== faseAtualIndex && roundIndex !== effectiveRoundIndex;
    return (
      <div
        key={`${side}-${roundIndex}`}
        ref={node => {
          roundRefs.current[roundIndex] = node;
        }}
        className={`relative flex shrink-0 snap-center items-stretch sm:snap-start ${
          presentationMode ? "w-[92vw] max-w-[380px] min-w-[300px] sm:w-[380px]" : "w-[85vw] max-w-[320px] min-w-[260px] sm:w-[320px]"
        } ${side === "right" ? "xl:self-end" : ""}`}
      >
        <div
          className={`relative w-full rounded-[28px] border p-4 space-y-4 backdrop-blur-md transition-all ${
            roundIndex === roundsExibidos.length - 1 && campeaoAtual && !isBracketPlaceholder(campeaoAtual) ? "ring-1 ring-emerald-300/35" : ""
          } ${
            normalizedBracketSearch && roundContainsSearchedPlayer(round) ? "ring-1 ring-cyan-300/35" : ""
          } ${
            roundIndex === 0
              ? "border-white/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] shadow-[0_12px_30px_-24px_rgba(0,0,0,0.28)]"
              : faseAtualIndex === roundIndex
              ? "border-cyan-300/35 bg-[linear-gradient(180deg,rgba(34,211,238,0.14),rgba(255,255,255,0.05))] shadow-[0_20px_60px_-30px_rgba(0,0,0,0.55)]"
              : "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.04))] shadow-[0_20px_60px_-30px_rgba(0,0,0,0.55)]"
          }`}
        >
          <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.26em] text-cyan-200/70">Round {roundIndex + 1}</p>
              <h3 className="text-base font-semibold">{getRoundLabel(roundIndex, totalRoundsExibidos, round.length)}</h3>
              <p className="text-[11px] text-muted-foreground">{round.length} partida{round.length === 1 ? "" : "s"}</p>
            </div>
            <div className="flex items-center gap-2">
              {!spectatorMode ? (
                <Button variant="outline" size="sm" className="h-8 px-2 text-[11px]" onClick={() => copyRoundSummary(roundIndex)}>
                  Copiar
                </Button>
              ) : null}
              <span
                className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] ${
                  faseAtualIndex === roundIndex ? "border-cyan-300/35 bg-cyan-400/15 text-cyan-100" : "border-white/10 bg-white/5 text-muted-foreground"
                }`}
              >
                {collapseRound ? "Compacta" : faseAtualIndex === roundIndex ? "Em foco" : rounds.length > 0 ? "Eliminacao" : "Exemplo"}
              </span>
            </div>
          </div>
          <div className="flex flex-col" style={getResponsiveRoundStackStyle(roundIndex)}>
            {round.map((match, matchIndex) => (
              <div
                key={`${side}-${roundIndex}-${matchIndex}`}
                role="group"
                aria-label={getMatchAriaLabel(match, roundIndex, matchIndex)}
                className={`relative rounded-2xl border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${
                  normalizedBracketSearch && matchContainsSearchedPlayer(match)
                    ? "ring-1 ring-cyan-300/40 shadow-[0_0_0_1px_rgba(103,232,249,0.18),inset_0_1px_0_rgba(255,255,255,0.06)]"
                    : ""
                } ${
                  getMatchAdvanceState(roundIndex, matchIndex)
                    ? "border-emerald-400/45 bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(34,197,94,0.06),rgba(59,130,246,0.10))] shadow-[0_0_0_1px_rgba(52,211,153,0.12),inset_0_1px_0_rgba(255,255,255,0.06)]"
                    : roundIndex === 0
                    ? "border-white/12 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(59,130,246,0.04))]"
                    : "border-white/10 bg-[linear-gradient(135deg,rgba(34,197,94,0.08),rgba(59,130,246,0.08))]"
                } ${collapseRound ? "space-y-1.5" : "space-y-2"} ${presentationMode ? "p-4" : ""}`}
                style={{ minHeight: `${collapseRound ? Math.max(80, bracketMatchHeight - 28) : presentationMode ? bracketMatchHeight + 20 : bracketMatchHeight}px` }}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Partida {matchIndex + 1}</h4>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-muted-foreground">
                      {getSeedLabel(roundIndex, matchIndex * 2) ?? `M${matchIndex + 1}`}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getMatchStatusClassName(match)}`}>{getMatchStatusLabel(match)}</span>
                  </div>
                </div>
                {!compactBracket && !collapseRound ? (
                  <p className={`text-[11px] ${roundIndex === 0 ? "text-foreground/80" : "text-muted-foreground"}`}>
                    {rounds.length > 0 ? "Toque no nome para marcar o vencedor." : "Modelo ilustrativo de eliminacao."}
                  </p>
                ) : null}
                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    variant={rounds.length > 0 && match.vencedor === match.jogador1 ? "default" : "outline"}
                    className={`justify-between ${compactBracket ? "h-9 px-2" : ""} ${isBracketPlaceholder(match.jogador1) ? "border-dashed text-muted-foreground" : ""}`}
                    disabled={spectatorMode || isBracketPlaceholder(match.jogador1)}
                    onClick={() => {
                      if (rounds.length === 0) return;
                      handleRegistrarVencedor(roundIndex, matchIndex, match.jogador1);
                    }}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-[10px] font-semibold text-foreground/80">
                        {getPlayerBadge(match.jogador1)}
                      </span>
                      <span className="truncate text-left">{exibirApelido(match.jogador1, displayPref)}</span>
                    </span>
                    {rounds.length > 0 && match.vencedor === match.jogador1 ? <span className="text-[10px] text-emerald-300">Vencedor</span> : null}
                  </Button>
                  <Button
                    size="sm"
                    variant={rounds.length > 0 && match.vencedor === match.jogador2 ? "default" : "outline"}
                    className={`justify-between ${compactBracket ? "h-9 px-2" : ""} ${isBracketPlaceholder(match.jogador2) ? "border-dashed text-muted-foreground" : ""}`}
                    disabled={spectatorMode || isBracketPlaceholder(match.jogador2)}
                    onClick={() => {
                      if (rounds.length === 0) return;
                      handleRegistrarVencedor(roundIndex, matchIndex, match.jogador2);
                    }}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-[10px] font-semibold text-foreground/80">
                        {getPlayerBadge(match.jogador2)}
                      </span>
                      <span className="truncate text-left">{exibirApelido(match.jogador2, displayPref)}</span>
                    </span>
                    {rounds.length > 0 && match.vencedor === match.jogador2 ? <span className="text-[10px] text-emerald-300">Vencedor</span> : null}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };
  const toggleBracketFullscreen = async () => {
    if (typeof document === "undefined") return;
    try {
      if (!document.fullscreenElement) {
        await bracketContentRef.current?.requestFullscreen?.();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      toast.error("Nao foi possivel alternar a tela cheia do bracket.");
    }
  };
  const exportBracketAsImage = async () => {
    if (typeof window === "undefined" || !bracketContentRef.current) return;
    try {
      const sourceNode = bracketContentRef.current;
      const clone = sourceNode.cloneNode(true) as HTMLElement;
      clone.style.width = `${sourceNode.scrollWidth}px`;
      clone.style.background = "#07111f";
      clone.style.padding = "16px";
      clone.style.fontFamily = "system-ui, sans-serif";
      clone.querySelectorAll("[data-export-hidden='true']").forEach(node => node.remove());
      const wrapper = document.createElement("div");
      wrapper.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
      wrapper.style.width = `${sourceNode.scrollWidth + 32}px`;
      wrapper.style.height = `${sourceNode.scrollHeight + 32}px`;
      wrapper.style.background = "#07111f";
      wrapper.style.padding = "16px";
      wrapper.style.boxSizing = "border-box";
      wrapper.appendChild(clone);
      const foreignObject = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
      foreignObject.setAttribute("width", "100%");
      foreignObject.setAttribute("height", "100%");
      foreignObject.appendChild(wrapper);
      const svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svgElement.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      svgElement.setAttribute("width", String(sourceNode.scrollWidth + 32));
      svgElement.setAttribute("height", String(sourceNode.scrollHeight + 32));
      svgElement.appendChild(foreignObject);
      const svg = new XMLSerializer().serializeToString(svgElement);
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        const ratio = Math.max(2, Math.ceil(window.devicePixelRatio || 1));
        canvas.width = (sourceNode.scrollWidth + 32) * ratio;
        canvas.height = (sourceNode.scrollHeight + 32) * ratio;
        canvas.style.width = `${sourceNode.scrollWidth + 32}px`;
        canvas.style.height = `${sourceNode.scrollHeight + 32}px`;
        const context = canvas.getContext("2d");
        if (!context) {
          URL.revokeObjectURL(url);
          toast.error("Nao foi possivel exportar o bracket.");
          return;
        }
        context.scale(ratio, ratio);
        context.fillStyle = "#07111f";
        context.fillRect(0, 0, sourceNode.scrollWidth + 32, sourceNode.scrollHeight + 32);
        context.drawImage(image, 0, 0);
        URL.revokeObjectURL(url);
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = `bracket-${campeonatoSelecionado?.nome?.replace(/\s+/g, "-").toLowerCase() || "campeonato"}.png`;
        link.click();
        toast.success("Imagem do bracket exportada.");
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        toast.error("Nao foi possivel gerar a imagem do bracket.");
      };
      image.src = url;
    } catch {
      toast.error("Nao foi possivel exportar o bracket.");
    }
  };

  useEffect(() => {
    if (roundFilter !== "todas") return;
    if (searchedPlayerLastRoundIndex >= 0) {
      setRoundFilter(String(searchedPlayerLastRoundIndex));
    }
  }, [normalizedBracketSearch, roundFilter, searchedPlayerLastRoundIndex]);

  useEffect(() => {
    if (!bracketViewportRef.current) return;
    const target = roundRefs.current[effectiveRoundIndex];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [effectiveRoundIndex, compactBracket, presentationMode]);

  useEffect(() => {
    if (!presentationMode || !presentationAutoplay || roundsExibidos.length <= 1) return;
    const interval = window.setInterval(() => {
      setRoundFilter(current => {
        if (current === "todas") return "0";
        const next = Number(current) + 1;
        return String(next >= roundsExibidos.length ? 0 : next);
      });
    }, 4500);
    return () => window.clearInterval(interval);
  }, [presentationMode, presentationAutoplay, roundsExibidos.length]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container py-6">
          <div className="flex items-center justify-between mb-6">
            <Button asChild variant="outline" className="gap-2 rounded-full">
              <Link href="/">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-xs">←</span>
                <span>Voltar</span>
              </Link>
            </Button>
            <h1 className="text-3xl font-bold gradient-text">Campeonatos</h1>
            <div className="w-20" />
          </div>
          <p className="text-muted-foreground">Explore todos os campeonatos disponiveis e se inscreva para competir.</p>
        </div>
      </div>

      {showCelebration && celebrationWinner ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-black/60 backdrop-blur-sm absolute inset-0" />
          <div className="relative z-10 text-center space-y-3 px-6 py-4 rounded-2xl border border-purple-500/40 bg-gradient-to-r from-purple-900/70 to-cyan-900/70 shadow-2xl">
            <div className="text-4xl">*</div>
            <p className="text-lg font-semibold">Campeao definido!</p>
            <p className="text-2xl font-bold text-purple-200">{celebrationWinner}</p>
          </div>
        </div>
      ) : null}

      <section className="py-6 border-b border-border print:hidden">
        <div className="container space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="outline" size="sm" className="gap-2" disabled>
              <Filter className="w-4 h-4" />
              Filtros
            </Button>
            <Button
              variant={filtroStatus === "todos" ? "default" : "outline"}
              size="sm"
              onClick={() => setFiltroStatus("todos")}
            >
              Todos
            </Button>
            <Button
              variant={filtroStatus === "ativo" ? "default" : "outline"}
              size="sm"
              onClick={() => setFiltroStatus("ativo")}
            >
              Ativos
            </Button>
            <Button
              variant={filtroStatus === "futuro" ? "default" : "outline"}
              size="sm"
              onClick={() => setFiltroStatus("futuro")}
            >
              Futuros
            </Button>
            <Button
              variant={filtroStatus === "finalizado" ? "default" : "outline"}
              size="sm"
              onClick={() => setFiltroStatus("finalizado")}
            >
              Finalizados
            </Button>
            <Button variant="secondary" size="sm" className="gap-2" onClick={narrarCampeonatos}>
              <Volume2 className="w-4 h-4" />
              Ouvir campeonatos
            </Button>
            {isAdmin ? (
              <Button
                size="sm"
                variant="outline"
                onClick={handleSortearConfrontos}
                disabled={sorteando || !selectedCampId || rounds.length > 0}
              >
                {sorteando ? "Sorteando..." : "Sortear chaveamento"}
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="py-8 border-t border-border bg-card/40 print:hidden">
        <div className="container space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Campeonatos disponiveis</p>
              <h2 className="text-xl font-semibold">Visualização em tempo real</h2>
            </div>
          </div>
          {campeonatos.length === 0 ? (
            <div className="card-elegant p-4 text-sm text-muted-foreground">Nenhum campeonato encontrado para este filtro.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {campeonatos.map(c => {
                const selecionado = selectedCampId === c.id;
                return (
                  <div
                    key={c.id}
                    className={`rounded-2xl border p-4 space-y-3 bg-white/5 backdrop-blur ${
                      selecionado ? "border-emerald-400/60 shadow-[0_0_25px_rgba(16,185,129,0.25)]" : "border-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-white truncate">{c.nome}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(c.status)}`}>{getStatusLabel(c.status)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Jogo: {c.jogo}</p>
                    <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <span>Inicio: {c.inicio}</span>
                      <span>Premio: R$ {c.premio}</span>
                      <span>Participantes: {c.participantes}</span>
                      <span>Fase: {c.fase}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        className="flex-1"
                        onClick={() => setSelectedCampId(c.id)}
                        disabled={selecionado}
                      >
                        {selecionado ? "Selecionado" : "Ver chaveamento"}
                      </Button>
                      <Button
                        variant="default"
                        className="flex-1"
                        disabled={c.inscricoesEncerradas}
                        onClick={() => registrarInscricao(c.id)}
                      >
                        {c.inscricoesEncerradas ? "Inscricoes fechadas" : "Inscrever-se"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="py-8 border-t border-border bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.12),_transparent_35%),radial-gradient(circle_at_bottom,_rgba(6,182,212,0.12),_transparent_40%)] print:border-0 print:bg-none print:py-4">
        <div className="container space-y-4">
          <div className="flex items-center justify-between print:block">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Chaveamento</p>
              <h2 className="text-xl font-semibold">Visualização em tempo real</h2>
            </div>
            {bracketEhExemplo ? (
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-amber-100">
                Exemplo visual
              </span>
            ) : null}
            {roundsExibidos.length > 0 ? (
              <span className="text-sm text-muted-foreground">
                {roundsExibidos[0].length} partida{roundsExibidos[0].length === 1 ? "" : "s"} inicial{roundsExibidos[0].length === 1 ? "" : "is"}
                {rounds.length > 0 ? " • bracket responsivo para qualquer quantidade" : " • exemplo com 16 participantes"}
              </span>
            ) : null}
          </div>
          {rounds.length === 0 ? (
            <div className="card-elegant p-4 text-sm text-muted-foreground">
              <p>Exibindo um chaveamento de exemplo com 16 participantes. Quando o sorteio real acontecer, este modelo sera substituido automaticamente.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {isAdmin ? (
                  <Button size="sm" variant="outline" onClick={handleSortearConfrontos} disabled={sorteando || !selectedCampId || !inscritosNomes.length}>
                    {sorteando ? "Sorteando..." : "Gerar sorteio real"}
                  </Button>
                ) : null}
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
                  {isAdmin ? "Aguardando definicao do admin" : "Aguardando sorteio do admin"}
                </span>
              </div>
            </div>
          ) : null}
          {campeaoAtual && !isBracketPlaceholder(campeaoAtual) ? (
            <div className="rounded-2xl border border-emerald-400/35 bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(250,204,21,0.12))] px-4 py-3 shadow-[0_18px_45px_-35px_rgba(16,185,129,0.55)]">
              <p className="text-[10px] uppercase tracking-[0.24em] text-emerald-100/80">Campeao atual</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-50">{exibirApelido(campeaoAtual, displayPref)}</p>
              <p className="text-sm text-emerald-100/80">A chave ja tem um vencedor definido no confronto final.</p>
            </div>
          ) : null}
          {campeonatoSelecionado ? (
            <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(16,185,129,0.10),rgba(59,130,246,0.10))] px-4 py-4 shadow-[0_18px_50px_-35px_rgba(0,0,0,0.6)] print:rounded-none print:border-black/20 print:bg-none print:shadow-none">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] ${getStatusColor(campeonatoSelecionado.status)}`}>
                      {getStatusLabel(campeonatoSelecionado.status)}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                      {campeonatoSelecionado.fase}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-200/70">Campeonato em foco</p>
                    <h3 className="text-2xl font-semibold text-white">{campeonatoSelecionado.nome}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {campeonatoSelecionado.jogo} • Inicio {campeonatoSelecionado.inicio}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-3">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Premio</p>
                    <p className="mt-2 text-lg font-semibold text-amber-300">R$ {campeonatoSelecionado.premio}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-3">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Inscritos</p>
                    <p className="mt-2 text-lg font-semibold">{campeonatoSelecionado.participantes}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-3 col-span-2 sm:col-span-1">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Chave</p>
                    <p className="mt-2 text-lg font-semibold">{totalParticipantesExibidos} vagas visuais</p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 print:hidden" data-export-hidden="true">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Busca no bracket</p>
                <p className="text-sm text-muted-foreground">{roundViewLabel}. Digite um jogador para destacar o caminho dele nas fases.</p>
              </div>
              <div className="flex w-full flex-col gap-2 xl:max-w-5xl xl:flex-row">
                <input
                  value={bracketSearch}
                  onChange={event => setBracketSearch(event.target.value)}
                  placeholder="Buscar jogador"
                  aria-label="Buscar jogador no bracket"
                  className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-foreground outline-none transition focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
                />
                <div className="flex flex-wrap gap-2">
                  <select
                    value={roundFilter}
                    onChange={event => setRoundFilter(event.target.value)}
                    aria-label="Filtrar fase do bracket"
                    className="h-10 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-foreground outline-none transition focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
                  >
                    <option value="todas">Todas as fases</option>
                    {roundFilterOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {roundFilter !== "todas" ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        aria-label="Ir para a fase anterior do bracket"
                        onClick={goToPreviousRound}
                        disabled={selectedRoundIndex <= 0}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        aria-label="Ir para a proxima fase do bracket"
                        onClick={goToNextRound}
                        disabled={selectedRoundIndex < 0 || selectedRoundIndex >= roundsExibidos.length - 1}
                      >
                        Proxima
                      </Button>
                    </>
                  ) : null}
                  <Button variant="outline" size="sm" className="shrink-0" onClick={() => setPresentationMode(prev => !prev)}>
                    {presentationMode ? "Modo normal" : "Modo apresentacao"}
                  </Button>
                  {presentationMode ? (
                    <>
                      <Button variant="outline" size="sm" className="shrink-0" onClick={() => setPresentationAutoplay(prev => !prev)}>
                        {presentationAutoplay ? "Pausar rotacao" : "Rotacao automatica"}
                      </Button>
                      <Button variant="outline" size="sm" className="shrink-0" onClick={toggleBracketFullscreen}>
                        Tela cheia
                      </Button>
                    </>
                  ) : null}
                  <Button variant="outline" size="sm" className="shrink-0" onClick={() => setCollapsedResolvedRounds(prev => !prev)}>
                    {collapsedResolvedRounds ? "Expandir resolvidas" : "Compactar resolvidas"}
                  </Button>
                  <Button variant="outline" size="sm" className="shrink-0" onClick={() => setSpectatorMode(prev => !prev)}>
                    {spectatorMode ? "Modo operador" : "Modo espectador"}
                  </Button>
                  <Button
                    variant={compactBracket ? "default" : "outline"}
                    size="sm"
                    className="shrink-0"
                    onClick={() => setCompactBracket(prev => !prev)}
                  >
                    {compactBracket ? "Modo compacto" : "Modo detalhado"}
                  </Button>
                  <select
                    value={bracketDensity}
                    onChange={event => setBracketDensity(event.target.value as "detalhado" | "compacto" | "ultracompacto")}
                    aria-label="Escolher densidade visual do bracket"
                    className="h-10 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-foreground outline-none transition focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
                  >
                    <option value="detalhado">Detalhado</option>
                    <option value="compacto">Compacto</option>
                    <option value="ultracompacto">Ultracompacto</option>
                  </select>
                  <Button variant="outline" size="sm" className="shrink-0" onClick={exportBracketAsImage}>
                    Exportar imagem
                  </Button>
                  <Button variant="outline" size="sm" className="shrink-0" onClick={imprimirBracket}>
                    Imprimir
                  </Button>
                  {(bracketSearch || compactBracket || roundFilter !== "todas" || presentationMode || collapsedResolvedRounds) ? (
                    <Button variant="outline" size="sm" className="shrink-0" onClick={resetBracketView}>
                      Resetar
                    </Button>
                  ) : null}
                  {bracketSearch ? (
                    <Button variant="outline" size="sm" className="shrink-0" onClick={copiarResumoBusca}>
                      Copiar resumo
                    </Button>
                  ) : null}
                  {bracketSearch ? (
                    <Button variant="outline" size="sm" className="shrink-0" onClick={() => setBracketSearch("")}>
                      Limpar
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
            {normalizedBracketSearch ? (
              <div className="mt-3 rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-sm">
                {searchedPlayerLastRoundIndex >= 0 ? (
                  <div className="space-y-1">
                    <span className="text-cyan-100">
                      Jogador encontrado. Melhor fase destacada: <span className="font-semibold">{searchedPlayerRoundLabel}</span>.
                    </span>
                    <p className="text-xs text-cyan-100/80">Caminho: {formatRoundStory(searchedPlayerRoundTrail)}</p>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Nenhum jogador encontrado com esse nome no bracket atual.</span>
                )}
              </div>
            ) : null}
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Resumo da chave</p>
                  <p className="text-sm text-foreground">Fluxo de participantes: {phaseSizeSummary}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="shrink-0" onClick={() => copyRoundSummary(effectiveRoundIndex)}>
                    Copiar fase atual
                  </Button>
                  <Button variant="outline" size="sm" className="shrink-0" onClick={() => goToRound(effectiveRoundIndex)}>
                    Focar fase atual
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-3 py-1">Fase atual: {faseAtualLabel}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Contador mobile: {currentPhaseCounter}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Densidade: {bracketDensity}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Legenda</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-cyan-100">Em aberto</span>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-emerald-200">Definida</span>
                <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-amber-100">W.O</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-muted-foreground">Aguardando</span>
                <span className="rounded-full border border-cyan-300/35 bg-cyan-400/15 px-3 py-1 text-cyan-100">Fase em foco</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-foreground">Jogador buscado</span>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Participantes</p>
              <p className="mt-2 text-2xl font-semibold">{totalParticipantesExibidos}</p>
              <p className="text-xs text-muted-foreground">Capacidade visual adaptada ao total da chave</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Fases</p>
              <p className="mt-2 text-2xl font-semibold">{totalRoundsExibidos}</p>
              <p className="text-xs text-muted-foreground">Eliminacao simples com rounds progressivos</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Fase atual</p>
              <p className="mt-2 text-2xl font-semibold text-cyan-100">{faseAtualLabel}</p>
              <p className="text-xs text-muted-foreground">Primeira etapa ainda com confrontos em aberto</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Progresso</p>
              <p className="mt-2 text-2xl font-semibold">
                {partidasDefinidas}/{partidasTotais}
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-cyan-200 transition-[width] duration-300"
                  style={{ width: `${progressoPercentual}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">Partidas com vencedor definido</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">W.O</p>
              <p className="mt-2 text-2xl font-semibold text-amber-200">{woCount}</p>
              <p className="text-xs text-muted-foreground">Confrontos com vaga automatica</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Pendentes</p>
              <p className="mt-2 text-2xl font-semibold text-cyan-100">{pendingMatches}</p>
              <p className="text-xs text-muted-foreground">Partidas ainda abertas na chave</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Jogadores vivos</p>
              <p className="mt-2 text-2xl font-semibold">{alivePlayers}</p>
              <p className="text-xs text-muted-foreground">Participantes ainda sem eliminacao definida</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Modo</p>
              <p className="mt-2 text-2xl font-semibold">{presentationMode ? "TV" : compactBracket ? "Compacto" : "Detalhado"}</p>
              <p className="text-xs text-muted-foreground">Layout ativo para leitura e exibicao</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              Origem: {bracketEhExemplo ? "Exemplo" : "Campeonato real"}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Visualizacao: {compactBracket ? "Compacta" : "Detalhada"}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Fase: {roundFilterLabel}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Modo TV: {presentationMode ? "ativo" : "desligado"}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Rotacao: {presentationAutoplay ? "automatica" : "manual"}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Resolvidas: {collapsedResolvedRounds ? "compactadas" : "expandidas"}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Espectador: {spectatorMode ? "ativo" : "desligado"}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              Busca: {normalizedBracketSearch ? bracketSearch.trim() : "nenhuma"}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              Colunas visiveis: {roundsFiltrados.length}
            </span>
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div
            ref={bracketContentRef}
            className={`rounded-3xl border border-white/10 bg-black/10 p-3 sm:p-4 print:rounded-none print:border-black/20 print:bg-transparent print:p-0 ${
              presentationMode ? "shadow-[0_30px_80px_-40px_rgba(34,211,238,0.45)]" : ""
            }`}
          >
            <div className="mb-3 space-y-3 print:hidden" data-export-hidden="true">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2 sm:hidden">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Fase atual</p>
                  <p className="text-sm font-semibold text-cyan-100">{roundFilterLabel}</p>
                </div>
                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-cyan-100">
                  {currentPhaseCounter}
                </span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 text-[11px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {roundsExibidos.map((round, roundIndex) => (
                  <button
                    key={`round-jump-${roundIndex}`}
                    type="button"
                    onClick={() => goToRound(roundIndex)}
                    className={`shrink-0 rounded-full border px-3 py-1 tracking-wide transition ${
                      effectiveRoundIndex === roundIndex
                        ? "border-cyan-300/45 bg-cyan-400/15 text-cyan-100"
                        : faseAtualIndex === roundIndex
                        ? "border-emerald-300/35 bg-emerald-400/10 text-emerald-100"
                        : "border-white/10 bg-white/5 text-muted-foreground"
                    }`}
                  >
                    {getRoundLabel(roundIndex, totalRoundsExibidos, round.length)}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between gap-3">
              <div className="flex gap-2 overflow-x-auto pb-1 text-[11px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:hidden">
                {roundsFiltrados.map((round, filteredIndex) => {
                  const roundIndex = roundFilter === "todas" ? filteredIndex : Number(roundFilter);
                  return (
                  <span
                    key={`round-pill-${roundIndex}`}
                    className={`shrink-0 rounded-full border px-3 py-1 tracking-wide ${
                      faseAtualIndex === roundIndex
                        ? "border-cyan-300/40 bg-cyan-400/15 text-cyan-100"
                        : "border-white/10 bg-white/5 text-muted-foreground"
                    }`}
                  >
                    {getRoundLabel(roundIndex, totalRoundsExibidos, round.length)}
                  </span>
                  );
                })}
              </div>
              <p className="hidden text-[11px] text-muted-foreground sm:block">
                Deslize horizontalmente para acompanhar o fluxo completo do bracket. A fase em foco recebe scroll automatico.
              </p>
              <span className="shrink-0 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-cyan-100 sm:hidden">
                {totalRoundsExibidos} fases
              </span>
            </div>
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-background via-background/75 to-transparent sm:w-12 print:hidden" />
              <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-background via-background/75 to-transparent sm:w-12 print:hidden" />
              <div
                ref={bracketViewportRef}
                className="overflow-x-auto overscroll-x-contain scroll-smooth pb-4 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden print:overflow-visible print:pb-0"
                style={{ touchAction: "pan-x" }}
              >
                {usarBracketDuplo ? (
                  <div className="flex min-w-max items-start gap-4 px-1 sm:gap-6 print:min-w-0 print:gap-3 print:px-0 xl:gap-10">
                    <div className="flex min-w-max items-start gap-4 sm:gap-6">
                      {roundsLadoEsquerdo.map((round, roundIndex) => renderRoundColumn(round, roundIndex, "left"))}
                    </div>
                    <div className="flex min-w-[260px] items-center justify-center self-stretch sm:min-w-[320px]">
                      {finalRound.length ? renderRoundColumn(finalRound, roundsExibidos.length - 1, "full") : null}
                    </div>
                    <div className="flex min-w-max items-start gap-4 sm:gap-6">
                      {[...roundsLadoDireito].reverse().map((round, reverseIndex) => {
                        const roundIndex = roundsLadoDireito.length - 1 - reverseIndex;
                        return renderRoundColumn(round, roundIndex, "right");
                      })}
                    </div>
                  </div>
                ) : (
                  <div className={`flex min-w-max items-start gap-4 px-1 sm:gap-6 print:min-w-0 print:gap-3 print:px-0 ${presentationMode ? "sm:gap-8" : ""}`}>
                    {roundsFiltrados.map((round, filteredIndex) => {
                      const roundIndex = roundFilter === "todas" ? filteredIndex : Number(roundFilter);
                      return renderRoundColumn(round, roundIndex);
                    })}
                  </div>
                )}
                </div>
              </div>
            </div>
          <aside className="space-y-4 print:hidden" data-export-hidden="true">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Timeline da chave</p>
              <div className="mt-3 space-y-3">
                {orderedActivities.length > 0 ? orderedActivities.slice(0, 8).map(activity => (
                  <div key={activity.key} className="rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-sm">
                    <p className="font-medium text-foreground">{getRoundLabel(activity.roundIndex, totalRoundsExibidos, roundsExibidos[activity.roundIndex]?.length ?? 0)} • Partida {activity.matchIndex + 1}</p>
                    <p className="text-cyan-100">{exibirApelido(activity.winner, displayPref)} • {activity.score}</p>
                    <p className="text-xs text-muted-foreground">{activity.updatedAt}</p>
                    {activity.note ? <p className="mt-1 text-xs text-muted-foreground">{activity.note}</p> : null}
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground">Nenhuma atividade recente registrada no bracket.</p>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Visao do espectador</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {spectatorMode
                  ? "Controles operacionais ocultos e leitura priorizada para publico."
                  : "Ative o modo espectador para esconder a maioria das acoes e deixar a transmissao mais limpa."}
              </p>
            </div>
          </aside>
          </div>
        </div>
      </section>

      <section className="py-12 border-t border-border">
        <div className="container">
          <div className="card-elegant text-center neon-border">
            <Trophy className="w-12 h-12 text-purple-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-4">Nao encontrou o que procura?</h3>
            <p className="text-muted-foreground mb-6">Novos campeonatos sao adicionados diariamente. Fique atento!</p>
            <Button className="btn-secondary" onClick={() => toast.success("Aviso ativado! Voce recebera notificacoes in-app.")}>
              Notifique-me sobre novos campeonatos
            </Button>
          </div>
        </div>
      </section>

      <AlertDialog open={Boolean(editingMatchKey)} onOpenChange={open => !open && setEditingMatchKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Editar placar local</AlertDialogTitle>
            <AlertDialogDescription>
              Atualize o placar e uma observacao desta partida. Esse dado fica salvo localmente no dispositivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">Placar</span>
              <input
                value={manualScoreInput}
                onChange={event => setManualScoreInput(event.target.value)}
                className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-foreground outline-none transition focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
                placeholder="Ex.: 2 x 1"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">Observacao</span>
              <textarea
                value={manualNoteInput}
                onChange={event => setManualNoteInput(event.target.value)}
                className="min-h-[96px] w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-foreground outline-none transition focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
                placeholder="Resumo da partida, horario, observacoes..."
              />
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setEditingMatchKey(null)}>Cancelar</AlertDialogCancel>
            <Button onClick={saveMatchEditor}>Salvar placar</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

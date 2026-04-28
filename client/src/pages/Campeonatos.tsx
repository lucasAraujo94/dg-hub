import { useEffect, useMemo, useState } from "react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trophy, Users, Clock, DollarSign, Filter, Volume2 } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

const BYE = "W.O";
type Match = { jogador1: string; jogador2: string; vencedor?: string };
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
  const [bracketSearch, setBracketSearch] = useState("");
  const [compactBracket, setCompactBracket] = useState(false);
  const [roundFilter, setRoundFilter] = useState("todas");

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
  const totalParticipantesExibidos = roundsExibidos[0]?.length ? roundsExibidos[0].length * 2 : 0;
  const partidasDefinidas = roundsExibidos.reduce(
    (acc, round) => acc + round.filter(match => match.vencedor && !isBracketPlaceholder(match.vencedor)).length,
    0
  );
  const partidasTotais = roundsExibidos.reduce((acc, round) => acc + round.length, 0);
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
  const bracketMatchHeight = compactBracket ? 96 : BRACKET_MATCH_HEIGHT;
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

      <section className="py-6 border-b border-border">
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

      <section className="py-8 border-t border-border bg-card/40">
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

      <section className="py-8 border-t border-border bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.12),_transparent_35%),radial-gradient(circle_at_bottom,_rgba(6,182,212,0.12),_transparent_40%)]">
        <div className="container space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Chaveamento</p>
              <h2 className="text-xl font-semibold">Visualização em tempo real</h2>
            </div>
            {roundsExibidos.length > 0 ? (
              <span className="text-sm text-muted-foreground">
                {roundsExibidos[0].length} partida{roundsExibidos[0].length === 1 ? "" : "s"} inicial{roundsExibidos[0].length === 1 ? "" : "is"}
                {rounds.length > 0 ? " • bracket responsivo para qualquer quantidade" : " • exemplo com 16 participantes"}
              </span>
            ) : null}
          </div>
          {rounds.length === 0 ? (
            <div className="card-elegant p-4 text-sm text-muted-foreground">
              Exibindo um chaveamento de exemplo com 16 participantes. Quando o sorteio real acontecer, este modelo sera substituido automaticamente.
            </div>
          ) : null}
          {campeonatoSelecionado ? (
            <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(16,185,129,0.10),rgba(59,130,246,0.10))] px-4 py-4 shadow-[0_18px_50px_-35px_rgba(0,0,0,0.6)]">
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
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Busca no bracket</p>
                <p className="text-sm text-muted-foreground">Digite um jogador para destacar o caminho dele nas fases.</p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:max-w-xl sm:flex-row">
                <input
                  value={bracketSearch}
                  onChange={event => setBracketSearch(event.target.value)}
                  placeholder="Buscar jogador"
                  className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-foreground outline-none transition focus:border-cyan-300/40"
                />
                <div className="flex gap-2">
                  <select
                    value={roundFilter}
                    onChange={event => setRoundFilter(event.target.value)}
                    className="h-10 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-foreground outline-none transition focus:border-cyan-300/40"
                  >
                    <option value="todas">Todas as fases</option>
                    {roundFilterOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant={compactBracket ? "default" : "outline"}
                    size="sm"
                    className="shrink-0"
                    onClick={() => setCompactBracket(prev => !prev)}
                  >
                    {compactBracket ? "Modo compacto" : "Modo detalhado"}
                  </Button>
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
                  <span className="text-cyan-100">
                    Jogador encontrado. Melhor fase destacada: <span className="font-semibold">{searchedPlayerRoundLabel}</span>.
                  </span>
                ) : (
                  <span className="text-muted-foreground">Nenhum jogador encontrado com esse nome no bracket atual.</span>
                )}
              </div>
            ) : null}
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
          <div className="rounded-3xl border border-white/10 bg-black/10 p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
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
                Deslize horizontalmente para acompanhar o fluxo completo do bracket.
              </p>
              <span className="shrink-0 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-cyan-100 sm:hidden">
                {totalRoundsExibidos} fases
              </span>
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-background via-background/75 to-transparent sm:w-12" />
              <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-background via-background/75 to-transparent sm:w-12" />
              <div className="overflow-x-auto pb-4 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex min-w-max items-start gap-4 px-1 sm:gap-6">
              {roundsFiltrados.map((round, filteredIndex) => {
                const roundIndex = roundFilter === "todas" ? filteredIndex : Number(roundFilter);
                return (
                  <div key={roundIndex} className="relative flex w-[85vw] max-w-[320px] min-w-[260px] shrink-0 snap-center items-stretch sm:w-[320px] sm:snap-start">
                  <div
                    className={`relative w-full rounded-[28px] border p-4 space-y-4 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.55)] backdrop-blur-md ${
                      normalizedBracketSearch && roundContainsSearchedPlayer(round)
                        ? "ring-1 ring-cyan-300/35"
                        : ""
                    } ${
                      faseAtualIndex === roundIndex
                        ? "border-cyan-300/35 bg-[linear-gradient(180deg,rgba(34,211,238,0.14),rgba(255,255,255,0.05))]"
                        : "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.04))]"
                    }`}
                  >
                    <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.26em] text-cyan-200/70">Round {roundIndex + 1}</p>
                        <h3 className="text-base font-semibold">{getRoundLabel(roundIndex, totalRoundsExibidos, round.length)}</h3>
                      </div>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] ${
                          faseAtualIndex === roundIndex
                            ? "border-cyan-300/35 bg-cyan-400/15 text-cyan-100"
                            : "border-white/10 bg-white/5 text-muted-foreground"
                        }`}
                      >
                        {faseAtualIndex === roundIndex ? "Em foco" : rounds.length > 0 ? "Eliminacao" : "Exemplo"}
                      </span>
                    </div>
                    <div className="flex flex-col" style={getResponsiveRoundStackStyle(roundIndex)}>
                      {round.map((match, matchIndex) => (
                        <div
                          key={`${roundIndex}-${matchIndex}`}
                          className={`relative rounded-2xl border p-3 space-y-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${
                            normalizedBracketSearch && matchContainsSearchedPlayer(match)
                              ? "ring-1 ring-cyan-300/40 shadow-[0_0_0_1px_rgba(103,232,249,0.18),inset_0_1px_0_rgba(255,255,255,0.06)]"
                              : ""
                          } ${
                            getMatchAdvanceState(roundIndex, matchIndex)
                              ? "border-emerald-400/45 bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(34,197,94,0.08),rgba(59,130,246,0.12))] shadow-[0_0_0_1px_rgba(52,211,153,0.12),inset_0_1px_0_rgba(255,255,255,0.06)]"
                              : "border-white/10 bg-[linear-gradient(135deg,rgba(34,197,94,0.08),rgba(59,130,246,0.08))]"
                          }`}
                          style={{ minHeight: `${bracketMatchHeight}px` }}
                        >
                          <div className="absolute -left-2 top-1/2 hidden h-px w-2 -translate-y-1/2 bg-gradient-to-r from-cyan-400/0 to-cyan-400/60 sm:block" />
                          {roundIndex < roundsExibidos.length - 1 && roundFilter === "todas" ? (
                            <>
                              <div
                                className={`absolute -right-4 top-1/2 hidden h-px w-4 -translate-y-1/2 sm:block ${
                                  getMatchAdvanceState(roundIndex, matchIndex)
                                    ? "bg-gradient-to-r from-emerald-300/90 to-emerald-300/35"
                                    : "bg-gradient-to-r from-cyan-300/70 to-cyan-300/20"
                                }`}
                              />
                              <div
                                className={`absolute -right-4 hidden w-px sm:block ${
                                  getMatchAdvanceState(roundIndex, matchIndex) ? "bg-emerald-300/55" : "bg-cyan-300/35"
                                } ${
                                  matchIndex % 2 === 0 ? "top-1/2 h-[calc(50%+0.75rem)]" : "bottom-1/2 h-[calc(50%+0.75rem)]"
                                }`}
                              />
                            </>
                          ) : null}
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Partida {matchIndex + 1}
                            </h4>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full border ${getMatchStatusClassName(match)}`}
                            >
                              {getMatchStatusLabel(match)}
                            </span>
                          </div>
                          {!compactBracket ? (
                            <p className="text-[11px] text-muted-foreground">
                              {rounds.length > 0 ? "Toque no nome para marcar o vencedor." : "Modelo ilustrativo de eliminacao."}
                            </p>
                          ) : null}
                          <div className="flex flex-col gap-2">
                            <Button
                              size="sm"
                              variant={rounds.length > 0 && match.vencedor === match.jogador1 ? "default" : "outline"}
                              className={`justify-between ${compactBracket ? "h-9 px-2" : ""} ${isBracketPlaceholder(match.jogador1) ? "border-dashed text-muted-foreground" : ""}`}
                              disabled={isBracketPlaceholder(match.jogador1)}
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
                              disabled={isBracketPlaceholder(match.jogador2)}
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
                          {!isAdmin && rounds.length > 0 && match.vencedor ? (
                            <p className="text-xs text-muted-foreground">Vencedor: {exibirApelido(match.vencedor, displayPref)}</p>
                          ) : null}
                          {!isAdmin && rounds.length > 0 && !match.vencedor ? (
                            <p className="text-[11px] text-muted-foreground">Aguardando resultado</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                  {roundIndex < roundsExibidos.length - 1 && roundFilter === "todas" ? (
                    <div className="pointer-events-none absolute -right-5 top-1/2 hidden h-px w-5 -translate-y-1/2 sm:block">
                      <div className="h-px w-full bg-gradient-to-r from-cyan-300/55 to-cyan-300/10" />
                      <div className="absolute right-0 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 border-r border-t border-cyan-300/60 bg-transparent" />
                    </div>
                  ) : null}
                </div>
                );
              })}
                </div>
              </div>
            </div>
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
    </div>
  );
}

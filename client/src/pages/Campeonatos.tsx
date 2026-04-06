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

const BYE = "BYE";
type Match = { jogador1: string; jogador2: string; vencedor?: string };
type Aba = "lista" | "chaveamento";

export default function Campeonatos() {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = user?.role === "admin";
  const nomeUsuario = user?.name ? `${user.name}${(user as any).nickname ? ` (${(user as any).nickname})` : ""}` : "Convidado";
  const emailUsuario = (user as { email?: string } | null | undefined)?.email;

  const [rounds, setRounds] = useState<Match[][]>([]);
  const [sorteando, setSorteando] = useState(false);
  const [aba, setAba] = useState<Aba>("lista");
  const [ultimaPrimeiraRodada, setUltimaPrimeiraRodada] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "ativo" | "futuro" | "finalizado">("todos");
  const [selectedCampId, setSelectedCampId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const campeonatosQuery = trpc.campeonatos.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const inscritosQuery = trpc.campeonatos.getParticipantes.useQuery(
    { campeonatoId: selectedCampId ?? 0 },
    { enabled: Boolean(selectedCampId), refetchOnWindowFocus: false }
  );
  const inscricaoMutation = trpc.campeonatos.inscrever.useMutation({
    onSuccess: async () => {
      toast.success("Inscrição confirmada!");
      await Promise.all([
        utils.campeonatos.list.invalidate(),
        selectedCampId ? utils.campeonatos.getParticipantes.invalidate({ campeonatoId: selectedCampId }) : Promise.resolve(),
      ]);
    },
    onError: error => {
      toast.error(error.message || "Falha ao inscrever");
    },
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
      toast.success("Campeonato excluído");
      utils.campeonatos.list.invalidate();
    },
    onError: err => toast.error(err.message || "Falha ao excluir campeonato"),
  });

  useEffect(() => {
    if (selectedCampId || !campeonatosQuery.data?.length) return;
    setSelectedCampId(campeonatosQuery.data[0]?.id ?? null);
  }, [campeonatosQuery.data, selectedCampId]);

  const participantes = useMemo(() => {
    if (!inscritosQuery.data) return [];
    return inscritosQuery.data.map(item => {
      const usuario = (item as { usuario?: { name?: string | null; email?: string | null } }).usuario;
      const baseName = usuario?.name || usuario?.email || `Jogador ${item.usuarioId}`;
      const nick = usuario?.nickname;
      const name = nick ? `${baseName} (${nick})` : baseName;
      return { name, email: usuario?.email ?? undefined };
    });
  }, [inscritosQuery.data]);

  const inscritosNomes = useMemo(() => participantes.map(i => i.name), [participantes]);

  const campeonatos = useMemo(() => {
    const mapped =
      campeonatosQuery.data?.map(camp => {
        const dataInicio = camp.dataInicio ? new Date(camp.dataInicio) : null;
        const status =
          (camp as { status?: string }).status ?? (dataInicio && dataInicio.getTime() > Date.now() ? "futuro" : "ativo");
        const participantesCount =
          (camp as { participantes?: number }).participantes ??
          (camp as { totalInscritos?: number }).totalInscritos ??
          (camp as { _count?: { inscricoes?: number } })._count?.inscricoes ??
          0;
        const inscricoesEncerradas = (() => {
          if (status === "cancelado" || status === "finalizado") return true;
          if (!dataInicio) return false;
          const diff = dataInicio.getTime() - Date.now();
          if (diff <= 0) return true; // já começou
          return diff < 24 * 60 * 60 * 1000; // menos de 24h
        })();

        return {
          id: camp.id,
          nome: camp.nome,
          status,
          participantes: participantesCount,
          premio: (camp as { premioValor?: number }).premioValor ?? 0,
          inicio: dataInicio ? dataInicio.toLocaleString("pt-BR") : "Data a definir",
          fase: inscricoesEncerradas ? "Inscrições encerradas" : "Fase de inscrições",
          inscricoesEncerradas,
        };
      }) ?? [];

    if (filtroStatus === "todos") return mapped;
    return mapped.filter(camp => camp.status === filtroStatus);
  }, [campeonatosQuery.data, filtroStatus]);

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
    const totalAlvo = proximaPotenciaDeDois(participantesNomes.length || 1);
    const baseSeed = seed ?? hashString(participantesNomes.join("|"));
    const embaralhados = seededShuffle(participantesNomes, baseSeed + (tentativa || 0));
    while (embaralhados.length < totalAlvo) {
      embaralhados.push(BYE);
    }

    const totalRounds = Math.log2(totalAlvo);
    const novoRounds: Match[][] = Array.from({ length: totalRounds }, () => []);

    for (let i = 0; i < totalAlvo; i += 2) {
      const jogador1 = embaralhados[i];
      const jogador2 = embaralhados[i + 1];
      const match: Match = { jogador1, jogador2 };
      if (jogador1 === BYE && jogador2 !== BYE) match.vencedor = jogador2;
      if (jogador2 === BYE && jogador1 !== BYE) match.vencedor = jogador1;
      novoRounds[0].push(match);
    }

    for (let r = 1; r < totalRounds; r++) {
      const matchesCount = totalAlvo / Math.pow(2, r + 1);
      for (let m = 0; m < matchesCount; m++) {
        novoRounds[r].push({ jogador1: "Aguardando", jogador2: "Aguardando" });
      }
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
      return propagarVencedores(clone);
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

    const jaInscrito = inscritosNomes.some(n => n === nomeUsuario);
    if (jaInscrito) {
      toast.info("Você já está inscrito neste campeonato.");
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
    if (!inscritosNomes.length) {
      toast.error("Nenhum inscrito para sortear.");
      return;
    }
    setSorteando(true);
    try {
      gerarRounds(inscritosNomes, selectedCampId ?? 0);
      setAba("chaveamento");
      toast.success("Chaveamento gerado.");
    } finally {
      setSorteando(false);
    }
  };

  // Gera chaveamento determinístico para todos verem assim que houver inscritos
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

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container py-6">
          <div className="flex items-center justify-between mb-6">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {"<- Voltar"}
            </Link>
            <h1 className="text-3xl font-bold gradient-text">Campeonatos</h1>
            <div className="w-20" />
          </div>
          <p className="text-muted-foreground">Explore todos os campeonatos disponíveis e se inscreva para competir.</p>
        </div>
      </div>

      <section className="py-6 border-b border-border">
        <div className="container space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="outline" size="sm" className="gap-2" disabled>
              <Filter className="w-4 h-4" />
              Filtrar
            </Button>
            <Button variant={aba === "lista" ? "default" : "outline"} size="sm" onClick={() => setAba("lista")}>
              Lista
            </Button>
            <Button
              variant={aba === "chaveamento" ? "default" : "outline"}
              size="sm"
              onClick={() => setAba("chaveamento")}
            >
              Chaveamento
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
              <Button size="sm" variant="outline" onClick={handleSortearConfrontos} disabled={sorteando || !selectedCampId}>
                {sorteando ? "Sorteando..." : "Sortear chaveamento"}
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="container grid grid-cols-1 lg:grid-cols-[260px,1fr] gap-6">
          <aside className="card-elegant h-fit p-4 space-y-4 border border-border/70">
            <div>
              <p className="text-sm font-semibold mb-2">Funcionalidades</p>
              <div className="space-y-2">
                <Button variant="default" size="sm" className="w-full justify-start">
                  Lista de campeonatos
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Inscritos: {inscritosNomes.length}</p>
              <p className="text-xs text-muted-foreground">
                Ao sortear, os confrontos usam os participantes inscritos no campeonato selecionado.
              </p>
            </div>
          </aside>

          <div>
            <div className="flex items-center gap-3 mb-6">
              <span className="text-sm text-muted-foreground">{inscritosNomes.length} inscritos no campeonato selecionado</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {campeonatosQuery.isLoading ? (
                <div className="card-elegant p-4 text-sm text-muted-foreground">Carregando campeonatos...</div>
              ) : null}
              {campeonatosQuery.error ? (
                <div className="card-elegant p-4 text-sm text-red-400">
                  Erro ao carregar campeonatos: {campeonatosQuery.error.message}
                </div>
              ) : null}
              {!campeonatosQuery.isLoading && campeonatos.length === 0 ? (
                <div className="card-elegant p-4 text-sm text-muted-foreground">Nenhum campeonato encontrado.</div>
              ) : null}
              {campeonatos.map(camp => {
                const isSelected = selectedCampId === camp.id;
                const jaInscrito = isSelected && inscritosNomes.includes(nomeUsuario);
                const inscricoesDisponiveis =
                  !camp.inscricoesEncerradas && camp.status !== "finalizado" && camp.status !== "cancelado";
                return (
                  <div key={camp.id} className="card-elegant group hover:border-purple-500/50 transition-all">
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex-1">
                        <h2 className="text-xl font-bold mb-2">{camp.nome}</h2>
                        <div
                          className={`inline-flex items-center px-3 py-1 rounded-full border text-sm font-medium ${getStatusColor(camp.status)}`}
                        >
                          {getStatusLabel(camp.status)}
                        </div>
                      </div>
                      <Trophy className="w-8 h-8 text-purple-400/30 group-hover:text-purple-400/60 transition-colors" />
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-6 py-4 border-t border-b border-border/50">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Participantes</p>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-cyan-400" />
                          <span className="font-semibold">{camp.participantes}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Prêmio</p>
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-yellow-400" />
                          <span className="font-semibold">R$ {camp.premio}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Fase</p>
                        <p className="font-semibold text-sm">{camp.fase}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                      <Clock className="w-4 h-4" />
                      {camp.inicio}
                    </div>

                    {isSelected ? (
                      <div className="mb-4 rounded-lg border border-border/60 bg-card/50 p-3">
                        <p className="text-sm font-semibold mb-1">Participantes ({inscritosNomes.length})</p>
                        {inscritosQuery.isLoading ? (
                          <p className="text-xs text-muted-foreground">Carregando inscritos...</p>
                        ) : participantes.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Nenhuma inscrição ainda.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {participantes.map((p, idx) => (
                              <span
                                key={`${p.name}-${idx}`}
                                className="text-xs px-2 py-1 rounded-full bg-white/5 border border-white/10"
                              >
                                {p.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-3">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            className="flex-1 min-w-[140px] btn-primary text-sm sm:text-base py-3"
                            onClick={() => setSelectedCampId(camp.id)}
                          >
                            Ver detalhes
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Inscritos no {camp.nome}</AlertDialogTitle>
                            <AlertDialogDescription>Total de inscritos: {inscritosNomes.length}</AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-3 bg-muted/30">
                            {inscritosQuery.isLoading ? (
                              <p className="text-sm text-muted-foreground">Carregando inscritos...</p>
                            ) : null}
                            {!inscritosQuery.isLoading && participantes.length === 0 ? (
                              <p className="text-sm text-muted-foreground">Nenhuma inscrição ainda.</p>
                            ) : null}
                            {participantes.map((pessoa, idx) => (
                              <div key={`${pessoa.name}-${idx}`} className="flex items-center justify-between text-sm">
                                <span className="font-medium">{pessoa.name}</span>
                                {pessoa.email ? <span className="text-muted-foreground">{pessoa.email}</span> : null}
                              </div>
                            ))}
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Fechar</AlertDialogCancel>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            className="flex-1 min-w-[140px] btn-secondary text-sm sm:text-base py-3"
                            disabled={!inscricoesDisponiveis || jaInscrito}
                            onClick={() => setSelectedCampId(camp.id)}
                          >
                            {!inscricoesDisponiveis
                              ? "Inscrições encerradas"
                              : jaInscrito
                                ? "Já inscrito"
                                : "Se inscrever"}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar inscrição</AlertDialogTitle>
                            <AlertDialogDescription>
                              Confirme sua participação no {camp.nome} marcado para {camp.inicio}.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <Button
                              onClick={() => registrarInscricao(camp.id)}
                              disabled={inscricaoMutation.isPending || !inscricoesDisponiveis || jaInscrito}
                            >
                              {inscricaoMutation.isPending ? "Inscrevendo..." : "Confirmar"}
                            </Button>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      {isAdmin ? (
                        <div className="flex flex-col gap-2 w-full">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const input = window.prompt("Nova data de início (yyyy-mm-dd hh:mm)", camp.inicio);
                              if (!input) return;
                              const parsed = new Date(input);
                              if (Number.isNaN(parsed.getTime())) {
                                toast.error("Data inválida");
                                return;
                              }
                              updateCampMutation.mutate({ id: camp.id, dataInicio: parsed });
                            }}
                            disabled={updateCampMutation.isPending}
                          >
                            {updateCampMutation.isPending ? "Salvando..." : "Editar data de início"}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              if (window.confirm("Cancelar campeonato?")) {
                                cancelCampMutation.mutate({ id: camp.id });
                              }
                            }}
                            disabled={cancelCampMutation.isPending}
                          >
                            {cancelCampMutation.isPending ? "Cancelando..." : "Cancelar campeonato"}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              if (window.confirm("Excluir campeonato definitivamente?")) {
                                deleteCampMutation.mutate({ id: camp.id });
                              }
                            }}
                            disabled={deleteCampMutation.isPending}
                          >
                            {deleteCampMutation.isPending ? "Excluindo..." : "Excluir campeonato"}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {aba === "chaveamento" ? (
        <section className="py-8 border-t border-border bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.12),_transparent_35%),radial-gradient(circle_at_bottom,_rgba(6,182,212,0.12),_transparent_40%)]">
          <div className="container space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Chaveamento</p>
                <h2 className="text-xl font-semibold">Visualização em tempo real</h2>
              </div>
              {rounds.length > 0 ? (
                <span className="text-sm text-muted-foreground">
                  {rounds[0].length} partidas iniciais • Seed fixo para todos
                </span>
              ) : null}
            </div>
            {rounds.length === 0 ? (
              <div className="card-elegant p-4 text-sm text-muted-foreground">
                Nenhum chaveamento gerado. Admin pode usar “Sortear chaveamento” com o campeonato selecionado; após isso,
                todos visualizam aqui automaticamente.
              </div>
            ) : (
              <div className="overflow-x-auto pb-2">
                <div className="min-w-full grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
                  {rounds.map((round, roundIndex) => (
                    <div
                      key={roundIndex}
                      className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4 space-y-3 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.45)]"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Round {roundIndex + 1}</h3>
                        <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Eliminação</span>
                      </div>
                      <div className="space-y-3">
                        {round.map((match, matchIndex) => (
                          <div
                            key={`${roundIndex}-${matchIndex}`}
                            className="rounded-xl border border-white/10 bg-gradient-to-r from-purple-600/10 to-cyan-500/10 p-3 space-y-2 shadow-inner"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium truncate">{match.jogador1}</span>
                              <span className="text-[10px] text-muted-foreground px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                                vs
                              </span>
                              <span className="text-sm font-medium truncate text-right">{match.jogador2}</span>
                            </div>
                            {isAdmin ? (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant={match.vencedor === match.jogador1 ? "default" : "outline"}
                                  className="flex-1"
                                  onClick={() => handleRegistrarVencedor(roundIndex, matchIndex, match.jogador1)}
                                >
                                  Vitória {match.jogador1}
                                </Button>
                                <Button
                                  size="sm"
                                  variant={match.vencedor === match.jogador2 ? "default" : "outline"}
                                  className="flex-1"
                                  onClick={() => handleRegistrarVencedor(roundIndex, matchIndex, match.jogador2)}
                                >
                                  Vitória {match.jogador2}
                                </Button>
                              </div>
                            ) : match.vencedor ? (
                              <p className="text-xs text-muted-foreground">Vencedor: {match.vencedor}</p>
                            ) : (
                              <p className="text-[11px] text-muted-foreground">Aguardando resultado</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      ) : null}

      <section className="py-12 border-t border-border">
        <div className="container">
          <div className="card-elegant text-center neon-border">
            <Trophy className="w-12 h-12 text-purple-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-4">Não encontrou o que procura?</h3>
            <p className="text-muted-foreground mb-6">Novos campeonatos são adicionados diariamente. Fique atento!</p>
            <Button className="btn-secondary" onClick={() => toast.success("Aviso ativado! Você receberá notificações in-app.")}>
              Notifique-me sobre novos campeonatos
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

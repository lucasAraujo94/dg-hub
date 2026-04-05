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
      toast.success("Inscricao confirmada!");
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
      toast.success("Campeonato excluido");
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
      const name = usuario?.name || usuario?.email || `Jogador ${item.usuarioId}`;
      return { name, email: usuario?.email ?? undefined };
    });
  }, [inscritosQuery.data]);

  const inscritosNomes = useMemo(() => participantes.map(i => i.name), [participantes]);

  const campeonatos = useMemo(() => {
    const mapped =
      campeonatosQuery.data?.map(camp => {
        const dataInicio = camp.dataInicio ? new Date(camp.dataInicio) : null;
        const status =
          (camp as { status?: string }).status ??
          (dataInicio && dataInicio.getTime() > Date.now() ? "futuro" : "ativo");
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
          fase: inscricoesEncerradas ? "Inscricoes encerradas" : "Fase de inscricoes",
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

  const shuffle = (arr: string[]) => {
    const clone = [...arr];
    for (let i = clone.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
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

  const gerarRounds = (participantesNomes: string[], tentativa = 0) => {
    const totalAlvo = proximaPotenciaDeDois(participantesNomes.length || 1);
    const embaralhados = shuffle(participantesNomes);
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
      return gerarRounds(participantesNomes, tentativa + 1);
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

  const registrarInscricao = (campeonatoId?: number) => {
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

    inscricaoMutation.mutate({ campeonatoId });
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
      gerarRounds(inscritosNomes);
      setAba("chaveamento");
      toast.success("Chaveamento gerado.");
    } finally {
      setSorteando(false);
    }
  };

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
          <p className="text-muted-foreground">Explore todos os campeonatos disponiveis e se inscreva para competir.</p>
        </div>
      </div>

      <section className="py-6 border-b border-border">
        <div className="container space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="outline" size="sm" className="gap-2" disabled>
              <Filter className="w-4 h-4" />
              Filtrar
            </Button>
            <Button
              variant={aba === "lista" ? "default" : "outline"}
              size="sm"
              onClick={() => setAba("lista")}
            >
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
              <span className="text-sm text-muted-foreground">
                {inscritosNomes.length} inscritos no campeonato selecionado
              </span>
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
              {campeonatos.map((camp) => (
                <div key={camp.id} className="card-elegant group hover:border-purple-500/50 transition-all">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex-1">
                      <h2 className="text-xl font-bold mb-2">{camp.nome}</h2>
                      <div className={`inline-flex items-center px-3 py-1 rounded-full border text-sm font-medium ${getStatusColor(camp.status)}`}>
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
                      <p className="text-xs text-muted-foreground mb-1">Premio</p>
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

                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
                    <Clock className="w-4 h-4" />
                    {camp.inicio}
                  </div>

                  <div className="flex gap-3">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            className="flex-1 btn-primary"
                            onClick={() => setSelectedCampId(camp.id)}
                          >
                            Ver Detalhes
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Inscritos no {camp.nome}</AlertDialogTitle>
                            <AlertDialogDescription>
                              Total de inscritos: {inscritosNomes.length}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-3 bg-muted/30">
                            {inscritosQuery.isLoading ? (
                              <p className="text-sm text-muted-foreground">Carregando inscritos...</p>
                            ) : null}
                            {!inscritosQuery.isLoading && participantes.length === 0 ? (
                              <p className="text-sm text-muted-foreground">Nenhuma inscricao ainda.</p>
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
                            className="flex-1 btn-secondary"
                            disabled={camp.status === "finalizado" || camp.status === "cancelado" || camp.inscricoesEncerradas}
                            onClick={() => setSelectedCampId(camp.id)}
                          >
                            {camp.inscricoesEncerradas ? "Inscricoes encerradas" : "Se inscrever"}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar inscricao</AlertDialogTitle>
                            <AlertDialogDescription>
                              Confirme sua participacao no {camp.nome} marcado para {camp.inicio}.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <Button
                              onClick={() => registrarInscricao(camp.id)}
                              disabled={inscricaoMutation.isPending || camp.inscricoesEncerradas}
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
                          const input = window.prompt("Nova data de inicio (yyyy-mm-dd hh:mm)", camp.inicio);
                          if (!input) return;
                          const parsed = new Date(input);
                          if (Number.isNaN(parsed.getTime())) {
                            toast.error("Data invalida");
                            return;
                          }
                          updateCampMutation.mutate({ id: camp.id, dataInicio: parsed });
                        }}
                        disabled={updateCampMutation.isPending}
                      >
                        {updateCampMutation.isPending ? "Salvando..." : "Editar data de inicio"}
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
              ))}
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
            <Button
              className="btn-secondary"
              onClick={() => toast.success("Aviso ativado! Você receberá notificações in-app.")}
            >
              Notifique-me sobre novos campeonatos
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}





import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, ShieldCheck, Trophy, Users } from "lucide-react";
import { Suspense, lazy, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const LazyAdminSupportPanels = lazy(() => import("@/components/AdminSupportPanels"));

const getPixStatusLabel = (status?: string) => {
  switch (status) {
    case "RECEIVED":
      return "Recebido";
    case "CONFIRMED":
    case "approved":
      return "Aprovado";
    case "PENDING":
    case "pending":
      return "Aguardando pagamento";
    case "OVERDUE":
      return "Vencido";
    case "REFUNDED":
      return "Estornado";
    case "CANCELLED":
    case "cancelled":
      return "Cancelado";
    case "canceled":
      return "Cancelado";
    case "rejected":
      return "Recusado";
    case "in_process":
      return "Em processamento";
    default:
      return status || "Nao iniciado";
  }
};

export default function Admin() {
  const { user } = useAuth();
  const clampDateYear = (value: string) => {
    const [datePart = "", timePart] = value.split("T");
    const parts = datePart.split("-");
    const year = (parts[0] || "").slice(0, 4);
    const month = parts[1];
    const day = parts[2];
    const safeDate = [year, month, day].filter(Boolean).join("-");
    return timePart ? `${safeDate}T${timePart}` : safeDate;
  };

  const [nomeCampeonato, setNomeCampeonato] = useState("");
  const [descricaoCampeonato, setDescricaoCampeonato] = useState("");
  const [jogoCampeonato, setJogoCampeonato] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [premioValor, setPremioValor] = useState("");
  const [inscricaoUsuarioId, setInscricaoUsuarioId] = useState("");
  const [inscricaoCampeonatoId, setInscricaoCampeonatoId] = useState("");
  const [sorteioCampeonatoId, setSorteioCampeonatoId] = useState("");
  const [depositoUsuarioId, setDepositoUsuarioId] = useState("");
  const [depositoValor, setDepositoValor] = useState("");
  const [depositoDescricao, setDepositoDescricao] = useState("");
  const [ultimaPremiacao, setUltimaPremiacao] = useState<any | null>(null);
  const [depositosBusca, setDepositosBusca] = useState("");
  const [depositosStatus, setDepositosStatus] = useState("todos");
  const [activeTab, setActiveTab] = useState("campeonatos");
  const depositoRef = useRef<HTMLDivElement | null>(null);
  const pixPaymentsQuery = trpc.admin.listPixPayments.useQuery(undefined, {
    refetchOnWindowFocus: false,
    enabled: user?.role === "admin",
  });

  const campeonatosQuery = trpc.campeonatos.list.useQuery(undefined, {
    enabled: user?.role === "admin",
    refetchOnWindowFocus: false,
  });

  const criarCampeonatoMutation = trpc.campeonatos.create.useMutation({
    onSuccess: () => toast.success("Campeonato criado"),
    onError: error => toast.error(error.message || "Falha ao criar campeonato"),
  });
  const inscreverUsuarioMutation = trpc.admin.inscreverUsuarioCampeonato.useMutation({
    onSuccess: () => toast.success("Jogador inscrito no campeonato"),
    onError: error => toast.error(error.message || "Falha ao inscrever jogador"),
  });
  const sortearPartidasMutation = trpc.admin.sortearPartidas.useMutation({
    onSuccess: data => toast.success(`Sorteio realizado (${data.partidasCriadas} partidas)`),
    onError: error => toast.error(error.message || "Falha ao sortear partidas"),
  });
  const usuariosQuery = trpc.admin.listUsers.useQuery(undefined, {
    refetchOnWindowFocus: false,
    enabled: user?.role === "admin",
  });
  const atualizarCampMutation = trpc.campeonatos.update.useMutation({
    onSuccess: () => {
      toast.success("Campeonato atualizado");
      campeonatosQuery.refetch();
    },
    onError: error => toast.error(error.message || "Falha ao atualizar campeonato"),
  });
  const cancelarCampMutation = trpc.campeonatos.cancel.useMutation({
    onSuccess: () => {
      toast.success("Campeonato cancelado");
      campeonatosQuery.refetch();
    },
    onError: error => toast.error(error.message || "Falha ao cancelar campeonato"),
  });
  const definirCampeaoMutation = trpc.campeonatos.definirCampeao.useMutation({
    onSuccess: () => {
      toast.success("Campeao definido e ranking atualizado (+100 pontos)");
      campeonatosQuery.refetch();
    },
    onError: error => toast.error(error.message || "Falha ao definir campeao"),
  });
  const excluirCampMutation = trpc.campeonatos.delete.useMutation({
    onSuccess: () => {
      toast.success("Campeonato excluido");
      campeonatosQuery.refetch();
    },
    onError: error => toast.error(error.message || "Falha ao excluir campeonato"),
  });
  const usuariosSelect = useMemo(() => usuariosQuery.data ?? [], [usuariosQuery.data]);
  const setRoleMutation = trpc.admin.setRole.useMutation({
    onSuccess: () => usuariosQuery.refetch(),
    onError: error => toast.error(error.message || "Falha ao atualizar permissoes"),
  });
  const premiarSaldoMutation = trpc.admin.premiarSaldo.useMutation({
    onSuccess: data => {
      setUltimaPremiacao(data);
      usuariosQuery.refetch();
      pixPaymentsQuery.refetch();
      toast.success("Saldo premiado com sucesso.");
    },
    onError: error => toast.error(error.message || "Falha ao premiar saldo"),
  });
  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="card-elegant max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Acesso negado</h2>
          <p className="text-muted-foreground mb-6">Apenas administradores podem acessar este painel.</p>
          <p className="text-sm text-muted-foreground">Sessao expira em ~10 min</p>
          <Link href="/">
            <Button className="btn-primary w-full">Voltar para Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleCriarCampeonato = async () => {
    if (!nomeCampeonato || !dataInicio || !premioValor || !jogoCampeonato) {
      toast.error("Informe nome, jogo, data e premio");
      return;
    }
    const parsedDate = new Date(dataInicio);
    if (Number.isNaN(parsedDate.getTime())) {
      toast.error("Data invalida");
      return;
    }
    await criarCampeonatoMutation.mutateAsync({
      nome: nomeCampeonato,
      descricao: descricaoCampeonato || undefined,
      dataInicio: parsedDate,
      premioValor: Number(premioValor),
      jogo: jogoCampeonato,
    });
    setNomeCampeonato("");
    setDescricaoCampeonato("");
    setJogoCampeonato("");
    setDataInicio("");
    setPremioValor("");
  };

  const handleInscreverUsuario = async () => {
    if (!inscricaoUsuarioId || !inscricaoCampeonatoId) {
      toast.error("Informe usuario e campeonato");
      return;
    }
    await inscreverUsuarioMutation.mutateAsync({
      usuarioId: Number(inscricaoUsuarioId),
      campeonatoId: Number(inscricaoCampeonatoId),
    });
    setInscricaoUsuarioId("");
    setInscricaoCampeonatoId("");
  };

  const handleSortear = async () => {
    if (!sorteioCampeonatoId) {
      toast.error("Informe o campeonato para sortear");
      return;
    }
    await sortearPartidasMutation.mutateAsync({ campeonatoId: Number(sorteioCampeonatoId) });
    setSorteioCampeonatoId("");
  };

  const handleToggleRole = (openId?: string, email?: string | null, currentRole?: string) => {
    const role = currentRole === "admin" ? "user" : "admin";
    setRoleMutation.mutate({ openId, email: email ?? undefined, role });
  };

  const handleGerarPix = async () => {
    if (!depositoUsuarioId || !depositoValor) {
      toast.error("Informe jogador e valor");
      return;
    }
    const valor = Number(depositoValor);
    if (Number.isNaN(valor) || valor <= 0) {
      toast.error("Informe um valor valido");
      return;
    }
    await premiarSaldoMutation.mutateAsync({
      usuarioId: Number(depositoUsuarioId),
      valor,
      descricao: depositoDescricao || undefined,
    });
    setDepositoValor("");
    setDepositoDescricao("");
  };

  const pixStatusLabel = (() => {
    const status = ultimaPremiacao?.status ?? "";
    return getPixStatusLabel(status);
  })();

  const filteredPixPayments = useMemo(() => {
    const term = depositosBusca.trim().toLowerCase();
    return (pixPaymentsQuery.data ?? []).filter(item => {
      const statusMatch = depositosStatus === "todos" || item.status === depositosStatus;
      if (!statusMatch) return false;
      if (!term) return true;
      const nome = item.usuario?.name?.toLowerCase() ?? "";
      const nickname = item.usuario?.nickname?.toLowerCase() ?? "";
      const email = item.usuario?.email?.toLowerCase() ?? "";
      const referencia = item.externalReference?.toLowerCase() ?? "";
      const descricao = item.descricao?.toLowerCase() ?? "";
      return [nome, nickname, email, referencia, descricao].some(value => value.includes(term));
    });
  }, [depositosBusca, depositosStatus, pixPaymentsQuery.data]);

  return (
    <div className="safe-shell min-h-screen bg-background text-foreground pb-20">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container py-4 md:py-6">
          <div className="mb-4 flex flex-col gap-3 md:mb-6 md:flex-row md:items-center md:justify-between">
            <Button asChild variant="outline" className="gap-2 rounded-full">
              <Link href="/">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-xs">&larr;</span>
                <span>Voltar</span>
              </Link>
            </Button>
            <h1 className="text-2xl font-bold gradient-text md:text-3xl">Painel Administrativo</h1>
            <div className="w-20" />
          </div>
          <p className="text-muted-foreground">Gerencie campeonatos, usuarios e operacoes financeiras.</p>
        </div>
      </div>

      <section className="py-12 border-b border-border">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="stat-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Campeonatos Ativos</p>
                  <p className="text-3xl font-bold">
                    {campeonatosQuery.isLoading ? "..." : campeonatosQuery.data?.filter(c => (c as any).status !== "finalizado").length ?? 0}
                  </p>
                </div>
                <Trophy className="w-12 h-12 text-purple-500/30" />
              </div>
            </div>
            <div className="stat-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Usuarios</p>
                  <p className="text-3xl font-bold">
                    {usuariosQuery.isLoading ? "..." : usuariosQuery.data?.length ?? 0}
                  </p>
                </div>
                <Users className="w-12 h-12 text-yellow-500/30" />
              </div>
            </div>
            <div className="stat-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Premiacao PIX</p>
                  <p className="text-xs text-muted-foreground">Credite saldo interno para saque posterior via Asaas</p>
                </div>
                <Button
                  size="sm"
                  className="btn-secondary"
                  onClick={() => {
                    const tab = document.querySelector<HTMLButtonElement>('[data-value="premiacoes"]');
                    tab?.click();
                    setTimeout(() => depositoRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
                  }}
                >
                  Premiar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="container">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6 grid h-auto w-full grid-cols-2 gap-2 rounded-2xl bg-card/60 p-1 md:mb-8 md:grid-cols-3">
              <TabsTrigger value="campeonatos">Campeonatos</TabsTrigger>
              <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
              <TabsTrigger value="premiacoes">Premiacoes</TabsTrigger>
            </TabsList>

            {/* Campeonatos */}
            <TabsContent value="campeonatos" className="space-y-6">
              <div className="card-elegant p-4 md:p-6">
                <h2 className="text-2xl font-bold mb-6">Criar Novo Campeonato</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold mb-2 block">Nome do Campeonato</label>
                    <Input value={nomeCampeonato} onChange={e => setNomeCampeonato(e.target.value)} placeholder="Ex: Grand Tournament #43" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold mb-2 block">Descricao</label>
                    <Input value={descricaoCampeonato} onChange={e => setDescricaoCampeonato(e.target.value)} placeholder="Descricao do campeonato" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold mb-2 block">Jogo</label>
                    <Input value={jogoCampeonato} onChange={e => setJogoCampeonato(e.target.value)} placeholder="Ex: Free Fire" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-semibold mb-2 block">Data de Inicio</label>
                      <Input type="datetime-local" value={dataInicio} onChange={e => setDataInicio(clampDateYear(e.target.value))} />
                    </div>
                    <div>
                      <label className="text-sm font-semibold mb-2 block">Valor do premio (R$)</label>
                      <Input value={premioValor} onChange={e => setPremioValor(e.target.value)} placeholder="Ex: 500" />
                    </div>
                  </div>
                  <Button className="btn-primary w-full" onClick={handleCriarCampeonato} disabled={criarCampeonatoMutation.isPending}>
                    {criarCampeonatoMutation.isPending ? "Criando..." : "Criar Campeonato"}
                  </Button>
                </div>
              </div>

              <div className="card-elegant p-4 md:p-6">
                <h2 className="text-xl font-bold mb-4">Inscrever Jogador em Campeonato</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-semibold mb-2 block">Jogador</label>
                    <select
                      className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                      value={inscricaoUsuarioId}
                      onChange={e => setInscricaoUsuarioId(e.target.value)}
                    >
                      <option value="">Selecione um jogador</option>
                      {usuariosQuery.data?.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name || u.email || u.openId}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold mb-2 block">Campeonato</label>
                    <select
                      className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                      value={inscricaoCampeonatoId}
                      onChange={e => setInscricaoCampeonatoId(e.target.value)}
                    >
                      <option value="">Selecione um campeonato</option>
                      {campeonatosQuery.data?.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <Button className="btn-secondary w-full mt-4" onClick={handleInscreverUsuario} disabled={inscreverUsuarioMutation.isPending}>
                  {inscreverUsuarioMutation.isPending ? "Inscrevendo..." : "Inscrever Jogador"}
                </Button>
              </div>

              <div className="card-elegant p-4 md:p-6">
                <h2 className="text-xl font-bold mb-4">Sorteio de Partidas</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-semibold mb-2 block">Campeonato</label>
                    <select
                      className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                      value={sorteioCampeonatoId}
                      onChange={e => setSorteioCampeonatoId(e.target.value)}
                    >
                      <option value="">Selecione um campeonato</option>
                      {campeonatosQuery.data?.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <Button className="btn-primary w-full mt-4" onClick={handleSortear} disabled={sortearPartidasMutation.isPending}>
                  {sortearPartidasMutation.isPending ? "Sorteando..." : "Sortear Partidas"}
                </Button>
              </div>

              <div className="card-elegant p-4 md:p-6">
                <h2 className="text-xl font-bold mb-4">Gerenciar Campeonatos</h2>
                {campeonatosQuery.isLoading ? <p className="text-sm text-muted-foreground">Carregando campeonatos...</p> : null}
                {campeonatosQuery.error ? (
                  <p className="text-sm text-red-400">Erro: {campeonatosQuery.error.message}</p>
                ) : null}
                {(campeonatosQuery.data?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum campeonato cadastrado.</p>
                ) : (
                  <div className="space-y-3">
                    {campeonatosQuery.data?.map(c => {
                      const dataInicio = c.dataInicio ? new Date(c.dataInicio) : null;
                      return (
                        <div key={c.id} className="p-3 rounded-lg border border-border/60 bg-card/60 flex flex-col gap-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold break-words">{c.nome}</p>
                              <p className="text-xs text-muted-foreground">
                                {dataInicio ? dataInicio.toLocaleString("pt-BR") : "Sem data definida"} - status: {(c as any).status ?? "ativo"}
                              </p>
                              <p className="text-xs text-muted-foreground">Jogo: {(c as any).jogo ?? "n/d"} {c.campeaoId ? "- Campeao ID " + c.campeaoId : ""}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const input = window.prompt("Nova data/hora (AAAA-MM-DD HH:mm)", dataInicio ? dataInicio.toISOString().slice(0, 16).replace("T", " ") : "");
                                if (!input) return;
                                const parsed = new Date(input.replace(" ", "T"));
                                if (Number.isNaN(parsed.getTime())) {
                                  toast.error("Data invalida");
                                  return;
                                }
                                atualizarCampMutation.mutate({ id: c.id, dataInicio: parsed });
                              }}
                              disabled={atualizarCampMutation.isPending}
                            >
                              {atualizarCampMutation.isPending ? "Salvando..." : "Editar data"}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => cancelarCampMutation.mutate({ id: c.id })}
                              disabled={cancelarCampMutation.isPending}
                            >
                              {cancelarCampMutation.isPending ? "Cancelando..." : "Cancelar"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const campeaoId = window.prompt("ID do campeao deste campeonato?");
                                if (!campeaoId) return;
                                const num = Number(campeaoId);
                                if (Number.isNaN(num)) {
                                  toast.error("Informe um ID numerico");
                                  return;
                                }
                                definirCampeaoMutation.mutate({ campeonatoId: c.id, campeaoId: num });
                              }}
                              disabled={definirCampeaoMutation.isPending}
                            >
                              {definirCampeaoMutation.isPending ? "Salvando..." : "Definir campeao (+100 pts)"}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (window.confirm("Excluir campeonato definitivamente?")) {
                                  excluirCampMutation.mutate({ id: c.id });
                                }
                              }}
                              disabled={excluirCampMutation.isPending}
                            >
                              {excluirCampMutation.isPending ? "Excluindo..." : "Excluir"}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="premiacoes" className="space-y-6">
              <Suspense
                fallback={
                  <Card className="border-border/70 bg-card/60 p-5">
                    <p className="text-sm text-muted-foreground">Carregando painel...</p>
                  </Card>
                }
              >
                <LazyAdminSupportPanels
                  activeTab="premiacoes"
                  depositoRef={depositoRef}
                  usuariosSelect={usuariosSelect}
                  depositoUsuarioId={depositoUsuarioId}
                  setDepositoUsuarioId={setDepositoUsuarioId}
                  depositoValor={depositoValor}
                  setDepositoValor={setDepositoValor}
                  depositoDescricao={depositoDescricao}
                  setDepositoDescricao={setDepositoDescricao}
                  handleGerarPix={handleGerarPix}
                  criarPixPending={premiarSaldoMutation.isPending}
                  pixStatusData={ultimaPremiacao}
                  pixStatusLabel={pixStatusLabel}
                  depositosBusca={depositosBusca}
                  setDepositosBusca={setDepositosBusca}
                  depositosStatus={depositosStatus}
                  setDepositosStatus={setDepositosStatus}
                  pixPaymentsLoading={pixPaymentsQuery.isLoading}
                  pixPaymentsError={pixPaymentsQuery.error?.message ?? null}
                  filteredPixPayments={filteredPixPayments}
                  getPixStatusLabel={getPixStatusLabel}
                  usuariosLoading={usuariosQuery.isLoading}
                  usuariosError={usuariosQuery.error?.message ?? null}
                  usuariosData={usuariosQuery.data ?? []}
                  setRolePending={setRoleMutation.isPending}
                  onToggleRole={handleToggleRole}
                />
              </Suspense>
            </TabsContent>

            <TabsContent value="usuarios" className="space-y-6">
              <Suspense
                fallback={
                  <Card className="border-border/70 bg-card/60 p-5">
                    <p className="text-sm text-muted-foreground">Carregando painel...</p>
                  </Card>
                }
              >
                <LazyAdminSupportPanels
                  activeTab="usuarios"
                  depositoRef={depositoRef}
                  usuariosSelect={usuariosSelect}
                  depositoUsuarioId={depositoUsuarioId}
                  setDepositoUsuarioId={setDepositoUsuarioId}
                  depositoValor={depositoValor}
                  setDepositoValor={setDepositoValor}
                  depositoDescricao={depositoDescricao}
                  setDepositoDescricao={setDepositoDescricao}
                  handleGerarPix={handleGerarPix}
                  criarPixPending={premiarSaldoMutation.isPending}
                  pixStatusData={ultimaPremiacao}
                  pixStatusLabel={pixStatusLabel}
                  depositosBusca={depositosBusca}
                  setDepositosBusca={setDepositosBusca}
                  depositosStatus={depositosStatus}
                  setDepositosStatus={setDepositosStatus}
                  pixPaymentsLoading={pixPaymentsQuery.isLoading}
                  pixPaymentsError={pixPaymentsQuery.error?.message ?? null}
                  filteredPixPayments={filteredPixPayments}
                  getPixStatusLabel={getPixStatusLabel}
                  usuariosLoading={usuariosQuery.isLoading}
                  usuariosError={usuariosQuery.error?.message ?? null}
                  usuariosData={usuariosQuery.data ?? []}
                  setRolePending={setRoleMutation.isPending}
                  onToggleRole={handleToggleRole}
                />
              </Suspense>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  );
}


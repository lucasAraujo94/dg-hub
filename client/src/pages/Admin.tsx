import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, ShieldCheck, Trophy, Users } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

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
  const [dataInicio, setDataInicio] = useState("");
  const [premioValor, setPremioValor] = useState("");
  const [inscricaoUsuarioId, setInscricaoUsuarioId] = useState("");
  const [inscricaoCampeonatoId, setInscricaoCampeonatoId] = useState("");
  const [sorteioCampeonatoId, setSorteioCampeonatoId] = useState("");
  const depositoRef = useRef<HTMLDivElement | null>(null);

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
  const usuariosSelect = useMemo(() => usuariosQuery.data ?? [], [usuariosQuery.data]);
  const setRoleMutation = trpc.admin.setRole.useMutation({
    onSuccess: () => usuariosQuery.refetch(),
    onError: error => toast.error(error.message || "Falha ao atualizar permissoes"),
  });

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="card-elegant max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Acesso negado</h2>
          <p className="text-muted-foreground mb-6">Apenas administradores podem acessar este painel.</p>
          <Link href="/">
            <Button className="btn-primary w-full">Voltar para Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleCriarCampeonato = async () => {
    if (!nomeCampeonato || !dataInicio || !premioValor) {
      toast.error("Informe nome, data e premio");
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
    });
    setNomeCampeonato("");
    setDescricaoCampeonato("");
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

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container py-6">
          <div className="flex items-center justify-between mb-6">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {"<- Voltar"}
            </Link>
            <h1 className="text-3xl font-bold gradient-text">Painel Administrativo</h1>
            <div className="w-20" />
          </div>
          <p className="text-muted-foreground">Gerencie campeonatos e usuarios.</p>
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
                  <p className="text-sm text-muted-foreground mb-2">Deposito PIX</p>
                  <p className="text-xs text-muted-foreground">Gere QR para premiar jogadores</p>
                </div>
                <Button
                  size="sm"
                  className="btn-secondary"
                  onClick={() => {
                    const tab = document.querySelector<HTMLButtonElement>('[data-value="depositos"]');
                    tab?.click();
                    setTimeout(() => depositoRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
                  }}
                >
                  Gerar QR
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="container">
          <Tabs defaultValue="campeonatos" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="campeonatos">Campeonatos</TabsTrigger>
              <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
              <TabsTrigger value="depositos">Depositos</TabsTrigger>
            </TabsList>

            {/* Campeonatos */}
            <TabsContent value="campeonatos" className="space-y-6">
              <div className="card-elegant">
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-semibold mb-2 block">Data de Inicio</label>
                      <Input type="datetime-local" value={dataInicio} onChange={e => setDataInicio(clampDateYear(e.target.value))} />
                    </div>
                    <div>
                      <label className="text-sm font-semibold mb-2 block">Valor do Premio (R$)</label>
                      <Input value={premioValor} onChange={e => setPremioValor(e.target.value)} placeholder="Ex: 500" />
                    </div>
                  </div>
                  <Button className="btn-primary w-full" onClick={handleCriarCampeonato} disabled={criarCampeonatoMutation.isPending}>
                    {criarCampeonatoMutation.isPending ? "Criando..." : "Criar Campeonato"}
                  </Button>
                </div>
              </div>

              <div className="card-elegant">
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

              <div className="card-elegant">
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
            </TabsContent>

            {/* Depositos */}
            <TabsContent value="depositos" className="space-y-6">
              <div className="card-elegant" ref={depositoRef}>
                <h2 className="text-xl font-bold mb-2">Depositar via PIX para Jogador</h2>
                <p className="text-sm text-muted-foreground mb-4">Em breve. Funcionalidade em finalizacao.</p>
                <div className="opacity-60 pointer-events-none select-none">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-semibold mb-2 block">Jogador</label>
                      <select className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" disabled>
                        <option>Em breve</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-semibold mb-2 block">Valor (R$)</label>
                      <Input placeholder="Em breve" disabled />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button className="btn-secondary" disabled>
                      Em breve
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Usuarios */}
            <TabsContent value="usuarios" className="space-y-6">
              <div className="card-elegant">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck className="w-5 h-5 text-green-400" />
                  <h2 className="text-2xl font-bold">Usuarios</h2>
                </div>
                {usuariosQuery.isLoading ? <p className="text-sm text-muted-foreground">Carregando usuarios...</p> : null}
                {usuariosQuery.error ? <p className="text-sm text-red-400">Erro: {usuariosQuery.error.message}</p> : null}
                {!usuariosQuery.isLoading && (usuariosQuery.data?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum usuario cadastrado.</p>
                ) : null}
                <div className="space-y-3">
                  {usuariosQuery.data?.map(u => {
                    const lastSeen = u.lastSignedIn ? new Date(u.lastSignedIn as any).getTime() : 0;
                    const isOnline = lastSeen > 0 && Date.now() - lastSeen < 10 * 60 * 1000;
                    return (
                      <div key={u.id} className="flex items-center justify-between p-4 bg-card/50 rounded-lg border border-border/50">
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                            <span className={`w-2 h-2 rounded-full inline-block ${isOnline ? "bg-green-500" : "bg-zinc-500"}`} />
                            {isOnline ? "online" : "offline"}
                          </span>
                          <p className="font-semibold">
                            {u.nickname ? `${u.name || u.email || u.openId} (${u.nickname})` : u.name || u.email || u.openId}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(u as any)?.hideEmail ? "email oculto" : u.email || "sem email"} - role: <span className="font-semibold">{u.role}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Ultimo acesso: {u.lastSignedIn ? new Date(u.lastSignedIn as any).toLocaleString("pt-BR") : "n/d"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleRole(u.openId, u.email, u.role)}
                            disabled={setRoleMutation.isPending}
                          >
                            {u.role === "admin" ? "Tornar usuario" : "Tornar admin"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  );
}

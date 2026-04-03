import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Zap, Crown } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useEffect, useMemo, useRef, useState } from "react";

type Achievement = { nome: string; icon?: string; data?: string };
type Historico = { nome: string; posicao: string; premio: number; data: string };

export default function Perfil() {
  const { user, refresh } = useAuth();
  const estatisticasQuery = trpc.estatisticas.get.useQuery(undefined, {
    enabled: Boolean(user),
    refetchOnWindowFocus: false,
  });
  const emblemasQuery = trpc.emblemas.getUsuario.useQuery(undefined, {
    enabled: Boolean(user),
    refetchOnWindowFocus: false,
  });
  const solicitarSaqueMutation = trpc.saques.criar.useMutation({
    onSuccess: () => toast.success("Solicitação de saque enviada"),
    onError: error => toast.error(error.message || "Falha ao solicitar saque"),
  });

  const jogador = {
    nome: (user?.name || user?.email || "Meu perfil") + ((user as any)?.nickname ? ` (${(user as any).nickname})` : ""),
    ranking: (user as { ranking?: number } | null | undefined)?.ranking ?? "-",
    pontos: (user as { points?: number } | null | undefined)?.points ?? 0,
    avatar: (user as { avatarUrl?: string; avatar?: string } | null | undefined)?.avatarUrl || (user as any)?.avatar || "",
    saldoPremio:
      Number(
        (user as { saldoPremio?: number } | null | undefined)?.saldoPremio ??
          (user as { prizeBalance?: number } | null | undefined)?.prizeBalance ??
          0
      ),
    membroDesde: (user as { createdAt?: string } | null | undefined)?.createdAt || "",
  };

  const emblemas: Achievement[] = useMemo(() => {
    if (emblemasQuery.data?.length) {
      return emblemasQuery.data.map(item => ({
        nome: (item as { emblema?: { nome?: string | null } }).emblema?.nome ?? `Emblema #${item.emblemaId}`,
        icon: (item as { emblema?: { iconeUrl?: string | null } }).emblema?.iconeUrl || "🏅",
        data: item.dataConquista ? new Date(item.dataConquista).toLocaleDateString("pt-BR") : "",
      }));
    }
    return (user as { achievements?: Achievement[] } | null | undefined)?.achievements ?? [];
  }, [emblemasQuery.data, user]);

  const historicoCampeonatos: Historico[] =
    (user as { tournaments?: Historico[] } | null | undefined)?.tournaments ?? [];

  const [walletProvider, setWalletProvider] = useState("PIX");
  const [walletAddress, setWalletAddress] = useState("");
  const [valorSaque, setValorSaque] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(jogador.avatar);
  const [localPhotoPreview, setLocalPhotoPreview] = useState<string | null>(null);
  const [photoFileName, setPhotoFileName] = useState<string>("");
  const [photoPosX, setPhotoPosX] = useState(50);
  const [photoPosY, setPhotoPosY] = useState(50);
  const [savedAvatarUrl, setSavedAvatarUrl] = useState<string | null>(null);
  const [showValorModal, setShowValorModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  const solicitacoesQuery = trpc.saques.getSolicitacoes.useQuery(undefined, {
    enabled: Boolean(user),
    refetchOnWindowFocus: false,
  });
  const utils = trpc.useUtils();
  const setAvatarMutation = trpc.profile.setAvatar.useMutation({
    onSuccess: async data => {
      setProfilePhotoUrl(data.url);
      setSavedAvatarUrl(data.url);
      setLocalPhotoPreview(null);
      setPhotoFileName("");
      // Atualiza o cache de auth/localStorage para manter a foto ao navegar
      utils.auth.me.setData(undefined, prev => (prev ? { ...prev, avatarUrl: data.url, avatar: data.url } : prev));
      const cached = utils.auth.me.getData(undefined);
      if (typeof window !== "undefined") {
        if (cached) {
          localStorage.setItem("manus-runtime-user-info", JSON.stringify({ ...cached, avatarUrl: data.url, avatar: data.url }));
        }
        localStorage.setItem("dg-avatar-url", data.url);
      }
      // Evita sobrescrever com dados antigos imediatamente
      setTimeout(() => {
        utils.auth.me.invalidate().catch(() => undefined);
      }, 0);
      await refresh?.();
      toast.success("Foto salva!");
    },
    onError: error => toast.error(error.message || "Falha ao salvar foto"),
  });

  // Sincroniza avatar inicial
  useEffect(() => {
    if (localPhotoPreview) return; // não sobrescrever preview
    const target = savedAvatarUrl ?? jogador.avatar;
    if (target) {
      setProfilePhotoUrl(target);
      return;
    }
    if (typeof window !== "undefined") {
      try {
        const cachedAvatar = localStorage.getItem("dg-avatar-url");
        if (cachedAvatar) {
          setProfilePhotoUrl(cachedAvatar);
          setSavedAvatarUrl(cachedAvatar);
          return;
        }
        const cachedUser = localStorage.getItem("manus-runtime-user-info");
        if (cachedUser) {
          const parsed = JSON.parse(cachedUser);
          const url = parsed?.avatarUrl || parsed?.avatar;
          if (url) {
            setProfilePhotoUrl(url);
            setSavedAvatarUrl(url);
          }
        }
      } catch {
        /* ignore */
      }
    }
  }, [jogador.avatar, savedAvatarUrl, localPhotoPreview]);

  // Garante dados frescos ao entrar no perfil
  useEffect(() => {
    refresh?.();
  }, [refresh]);

  // Preview local na hora
  useEffect(() => {
    if (localPhotoPreview) {
      setProfilePhotoUrl(localPhotoPreview);
    }
  }, [localPhotoPreview]);

  const handleSolicitarSaque = () => {
    if (!user) {
      toast.error("Entre para solicitar saque");
      return;
    }
    const valor = Number(valorSaque);
    if (Number.isNaN(valor) || valor <= 0) {
      setShowValorModal(true);
      return;
    }
    if (valor > jogador.saldoPremio) {
      toast.error("Saldo insuficiente para o valor solicitado");
      return;
    }
    if (!walletAddress.trim()) {
      toast.error("Informe a chave PIX para saque");
      return;
    }
    solicitarSaqueMutation.mutate({
      valor,
      walletProvider,
      walletAddress: walletAddress.trim(),
    });
  };

  const handleEditarPerfil = () => {
    toast.info("Edição de perfil em breve");
  };

  const handleSalvarPerfil = async () => {
    await refresh?.();
    toast.success("Perfil salvo/atualizado");
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoFileName(file.name);
    const url = URL.createObjectURL(file);
    setLocalPhotoPreview(url);
  };

  const handleConfirmPhoto = () => {
    if (!photoFileName || !localPhotoPreview) {
      toast.error("Selecione uma imagem primeiro");
      return;
    }
    if (!fileInputRef.current?.files?.[0]) {
      toast.error("Arquivo não encontrado. Selecione novamente.");
      return;
    }
    const file = fileInputRef.current.files[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === "string") {
        const base64 = result.split(",")[1];
        setAvatarMutation.mutate({
          fileName: file.name,
          mimeType: file.type || "image/png",
          dataBase64: base64,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // Persist/recover posição da foto por usuário
  const savePhotoPosition = (x: number, y: number) => {
    if (!user?.id) return;
    try {
      localStorage.setItem(`dg-avatar-pos-${user.id}`, JSON.stringify({ x, y }));
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    try {
      const raw = localStorage.getItem(`dg-avatar-pos-${user.id}`);
      if (raw) {
        const { x, y } = JSON.parse(raw);
        if (typeof x === "number" && typeof y === "number") {
          setPhotoPosX(x);
          setPhotoPosY(y);
        }
      } else {
        setPhotoPosX(50);
        setPhotoPosY(50);
      }
    } catch {
      setPhotoPosX(50);
      setPhotoPosY(50);
    }
  }, [user?.id]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container py-6">
          <div className="flex items-center justify-between mb-6">
            <Link href="/" className="group inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-border bg-card mr-2 group-hover:border-primary group-hover:text-primary">
                ←
              </span>
              <span className="underline-offset-4 group-hover:underline">Voltar</span>
            </Link>
            <h1 className="text-3xl font-bold gradient-text">Meu Perfil</h1>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleEditarPerfil}>
                Editar
              </Button>
              <Button className="btn-primary" size="sm" onClick={handleSalvarPerfil}>
                Salvar perfil
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Header */}
      <section className="py-12 border-b border-border">
        <div className="container">
          <div className="card-elegant neon-border p-8">
            <div className="flex items-center gap-8 mb-8">
              <div
                ref={avatarRef}
                className="w-28 h-28 rounded-2xl bg-card border border-border flex items-center justify-center shadow-lg overflow-hidden relative select-none"
                style={{ cursor: profilePhotoUrl ? (dragging ? "grabbing" : "grab") : "default" }}
                onMouseDown={e => {
                  if (!profilePhotoUrl) return;
                  dragState.current = {
                    startX: e.clientX,
                    startY: e.clientY,
                    startPosX: photoPosX,
                    startPosY: photoPosY,
                  };
                  setDragging(true);
                }}
                onMouseMove={e => {
                  if (!dragState.current || !avatarRef.current) return;
                  const rect = avatarRef.current.getBoundingClientRect();
                  const dx = e.clientX - dragState.current.startX;
                  const dy = e.clientY - dragState.current.startY;
                  const nextX = Math.min(100, Math.max(0, dragState.current.startPosX + (dx / rect.width) * 100));
                  const nextY = Math.min(100, Math.max(0, dragState.current.startPosY + (dy / rect.height) * 100));
                  setPhotoPosX(nextX);
                  setPhotoPosY(nextY);
                }}
                onMouseUp={() => {
                  dragState.current = null;
                  setDragging(false);
                  savePhotoPosition(photoPosX, photoPosY);
                }}
                onMouseLeave={() => {
                  dragState.current = null;
                  setDragging(false);
                  savePhotoPosition(photoPosX, photoPosY);
                }}
                onTouchStart={e => {
                  if (!profilePhotoUrl) return;
                  const touch = e.touches[0];
                  dragState.current = {
                    startX: touch.clientX,
                    startY: touch.clientY,
                    startPosX: photoPosX,
                    startPosY: photoPosY,
                  };
                  setDragging(true);
                }}
                onTouchMove={e => {
                  if (!dragState.current || !avatarRef.current) return;
                  const touch = e.touches[0];
                  const rect = avatarRef.current.getBoundingClientRect();
                  const dx = touch.clientX - dragState.current.startX;
                  const dy = touch.clientY - dragState.current.startY;
                  const nextX = Math.min(100, Math.max(0, dragState.current.startPosX + (dx / rect.width) * 100));
                  const nextY = Math.min(100, Math.max(0, dragState.current.startPosY + (dy / rect.height) * 100));
                  setPhotoPosX(nextX);
                  setPhotoPosY(nextY);
                }}
                onTouchEnd={() => {
                  dragState.current = null;
                  setDragging(false);
                  savePhotoPosition(photoPosX, photoPosY);
                }}
              >
                {profilePhotoUrl ? (
                  <img
                    src={profilePhotoUrl}
                    alt="Foto de perfil"
                    className="w-full h-full object-cover"
                    style={{ objectPosition: `${photoPosX}% ${photoPosY}%` }}
                  />
                ) : (
                  <span className="text-4xl">🙂</span>
                )}
                {profilePhotoUrl ? (
                  <div className="absolute bottom-1 right-1 px-2 py-1 rounded-full bg-black/60 text-[10px] text-white border border-white/10">
                    Arraste para ajustar
                  </div>
                ) : null}
              </div>
              <div className="flex-1">
                <h2 className="text-4xl font-bold mb-2">{jogador.nome}</h2>
                <div className="flex items-center gap-4 mb-4">
                  <div className="badge-elegant">
                    <Crown className="w-4 h-4" />
                    Ranking #{jogador.ranking}
                  </div>
                  <div className="badge-elegant">
                    <Zap className="w-4 h-4" />
                    {jogador.pontos} pontos
                  </div>
                </div>
                <p className="text-muted-foreground mb-4">
                  {jogador.membroDesde
                    ? `Membro desde ${new Date(jogador.membroDesde).toLocaleDateString("pt-BR")}`
                    : "Perfil sem data de cadastro"}
                </p>
                <div className="flex flex-wrap gap-3 items-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={triggerFileSelect}>
                    Escolher foto de perfil
                  </Button>
                  {photoFileName ? <span className="text-xs text-muted-foreground">Selecionado: {photoFileName}</span> : null}
                  {localPhotoPreview ? (
                    <Button
                      className="bg-indigo-600 hover:bg-indigo-700 text-white"
                      size="sm"
                      onClick={handleConfirmPhoto}
                      disabled={setAvatarMutation.isPending}
                    >
                      {setAvatarMutation.isPending ? "Salvando..." : "Confirmar foto"}
                    </Button>
                  ) : null}
                </div>
                {profilePhotoUrl ? (
                  <div className="mt-3 text-xs text-muted-foreground">
                    Dica: clique e arraste a foto para reposicionar. Solte para salvar a posição preferida.
                  </div>
                ) : null}
              </div>
            </div>

            {/* Saldo de Premios + saque */}
            <div className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-500/30 rounded-lg p-6 space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Saldo Disponível para Saque</p>
                <p className="text-3xl font-bold text-yellow-400">R$ {jogador.saldoPremio.toFixed(2)}</p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="Valor (R$)"
                  value={valorSaque}
                  onChange={e => setValorSaque(e.target.value)}
                  type="number"
                  min="0"
                  className="bg-black/20 border-yellow-500/30"
                />
                <Input
                  placeholder="Em breve"
                  value="Em breve"
                  disabled
                  className="bg-black/20 border-yellow-500/30 cursor-not-allowed text-muted-foreground"
                  readOnly
                />
              </div>

              <Button className="btn-secondary w-full" disabled>
                Em breve
              </Button>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Solicitações recentes</p>
                {solicitacoesQuery.isLoading ? <p className="text-xs text-muted-foreground">Carregando...</p> : null}
                {!solicitacoesQuery.isLoading && (solicitacoesQuery.data?.length ?? 0) === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma solicitação registrada.</p>
                ) : null}
                {solicitacoesQuery.data?.slice(0, 3).map(item => (
                  <div key={item.id} className="flex items-center justify-between rounded border border-yellow-500/30 bg-black/30 px-3 py-2 text-xs">
                    <div>
                      <p className="font-semibold">R$ {Number(item.valor).toFixed(2)}</p>
                      <p className="text-muted-foreground">{new Date(item.dataSolicitacao).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <span className="text-yellow-300">{(item as { status?: string }).status ?? "pendente"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Emblemas */}
      <section className="py-12 border-b border-border">
        <div className="container">
          <h2 className="text-2xl font-bold mb-8">Emblemas Conquistados</h2>
          {emblemas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum emblema cadastrado na sua conta.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {emblemas.map((emblema, idx) => (
                <div key={idx} className="card-elegant text-center hover:border-purple-500/50 transition-all group cursor-pointer">
                  <p className="text-4xl mb-3 group-hover:scale-110 transition-transform">{emblema.icon || "*"}</p>
                  <p className="font-semibold text-sm mb-2">{emblema.nome}</p>
                  <p className="text-xs text-muted-foreground">{emblema.data || ""}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Historico de Campeonatos */}
      <section className="py-12">
        <div className="container">
          <h2 className="text-2xl font-bold mb-8">Historico de Campeonatos</h2>
          {historicoCampeonatos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum campeonato registrado na sua conta.</p>
          ) : (
            <div className="space-y-4">
              {historicoCampeonatos.map((camp, idx) => (
                <div key={idx} className="card-elegant flex items-center justify-between p-6 hover:border-purple-500/50 transition-all">
                  <div className="flex-1">
                    <p className="font-semibold text-lg">{camp.nome}</p>
                    <p className="text-sm text-muted-foreground">{camp.data}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg mb-1">{camp.posicao} Lugar</p>
                    <p className="text-yellow-400 font-semibold">R$ {camp.premio}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {showValorModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-xl font-bold">Informe um valor</h3>
            <p className="text-sm text-muted-foreground">
              Para solicitar o saque, digite um valor maior que zero ou use seu saldo disponível.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowValorModal(false)}>
                Fechar
              </Button>
              <Button className="btn-primary" onClick={() => setShowValorModal(false)}>
                Entendi
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}











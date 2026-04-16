import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Zap, Crown, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useEffect, useMemo, useRef, useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { getFriendlyWithdrawalError } from "@/lib/userMessages";

type Achievement = { nome: string; icon?: string; data?: string };
type Historico = { nome: string; posicao: string; premio: number; data: string };

const getFinancialStatusLabel = (status?: string) => {
  switch (status) {
    case "solicitado":
      return "Solicitado";
    case "aprovado":
      return "Aprovado";
    case "pago":
      return "Pago";
    case "rejeitado":
      return "Rejeitado";
    case "approved":
      return "Aprovado";
    case "pending":
      return "Aguardando pagamento";
    case "cancelled":
    case "canceled":
      return "Cancelado";
    case "rejected":
      return "Recusado";
    case "in_process":
      return "Em processamento";
    default:
      return status || "Pendente";
  }
};

const getWithdrawalStatusLabel = (status?: string) => {
  return getFinancialStatusLabel(status);
};

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
    onSuccess: () => toast.success("Solicitacao enviada. Agora ela segue para analise da equipe."),
    onError: error => toast.error(getFriendlyWithdrawalError(error.message)),
  });

  const baseName = user?.name || user?.email || "Meu perfil";
  const jogador = {
    nome: baseName,
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
        icon: (item as { emblema?: { iconeUrl?: string | null } }).emblema?.iconeUrl || "OK",
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
  const [hagoNickname, setHagoNickname] = useState<string>("");
  const [birthDate, setBirthDate] = useState<string>("");
  const [displayPreference, setDisplayPreference] = useState<"real" | "hago">("real");
  const [hideEmail, setHideEmail] = useState(false);
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
  const extratoQuery = trpc.financeiro.extrato.useQuery(undefined, {
    enabled: Boolean(user),
    refetchOnWindowFocus: false,
  });
  const rankingPerfilQuery = trpc.rankings.getByTipo.useQuery(
    { tipo: "geral", limite: 1000 },
    { enabled: Boolean(user?.id), refetchOnWindowFocus: false }
  );
  const rankingDerived = useMemo(() => {
    if (!rankingPerfilQuery.data || !user?.id) return null;
    const idx = rankingPerfilQuery.data.findIndex(item => item.usuarioId === user.id);
    if (idx === -1) return null;
    const entry = rankingPerfilQuery.data[idx];
    return {
      pos: idx + 1,
      points: entry.pontuacao,
      wins: (entry as { wins?: number } | null | undefined)?.wins ?? 0,
    };
  }, [rankingPerfilQuery.data, user?.id]);
  const utils = trpc.useUtils();
  useEffect(() => {
    if (!solicitarSaqueMutation.isSuccess) return;
    setValorSaque("");
    setWalletAddress("");
    solicitacoesQuery.refetch().catch(() => undefined);
    utils.auth.me.invalidate().catch(() => undefined);
    refresh?.();
  }, [refresh, solicitarSaqueMutation.isSuccess, solicitacoesQuery, utils.auth.me]);

  const setAvatarMutation = trpc.profile.setAvatar.useMutation({
    onSuccess: async data => {
      const nextUrl = (data as any).avatarUrl || data.url;
      setProfilePhotoUrl(nextUrl);
      setSavedAvatarUrl(nextUrl);
      setLocalPhotoPreview(null);
      setPhotoFileName("");
      // Atualiza o cache de auth/localStorage para manter a foto ao navegar
      utils.auth.me.setData(undefined, prev => (prev ? { ...prev, avatarUrl: nextUrl, avatar: nextUrl } : prev));
      const cached = utils.auth.me.getData(undefined);
      if (typeof window !== "undefined") {
        try {
          const isData = nextUrl.startsWith("data:");
          const isHuge = nextUrl.length > 1500;
          if (!isData && !isHuge) {
            if (cached) {
              localStorage.setItem("manus-runtime-user-info", JSON.stringify({ ...cached, avatarUrl: nextUrl, avatar: nextUrl }));
            }
            localStorage.setItem("dg-avatar-url", nextUrl);
          } else {
            // Não persiste data URL grande no storage para evitar quota exceeded
            localStorage.removeItem("dg-avatar-url");
          }
        } catch {
          /* ignore quota errors */
        }
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
  const setPreferencesMutation = trpc.profile.setPreferences.useMutation({
    onSuccess: data => {
      utils.auth.me.setData(undefined, prev => (prev ? { ...prev, ...data } : prev));
      try {
        const cached = utils.auth.me.getData(undefined);
        if (cached && typeof window !== "undefined") {
          localStorage.setItem("manus-runtime-user-info", JSON.stringify({ ...cached, ...data }));
        }
      } catch {
        /* ignore */
      }
    },
    onError: error => toast.error(error.message || "Falha ao salvar preferências"),
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

  // Carrega preferências de nome/apelido
  useEffect(() => {
    try {
      const savedNick = localStorage.getItem("dg-hago-nickname");
      const savedPref = localStorage.getItem("dg-display-pref");
      const savedHideEmail = localStorage.getItem("dg-hide-email");
      if (savedNick) setHagoNickname(savedNick);
      if (savedPref === "real" || savedPref === "hago") {
        setDisplayPreference(savedPref);
      }
      if (savedHideEmail === "true") {
        setHideEmail(true);
      }
      const birth = (user as any)?.birthDate;
      if (birth) {
        const iso = new Date(birth as string).toISOString().split("T")[0];
        setBirthDate(iso);
      }
    } catch {
      /* ignore */
    }
  }, [user]);

  useEffect(() => {
    if (typeof (user as any)?.hideEmail === "boolean") {
      setHideEmail(Boolean((user as any).hideEmail));
    }
    if (typeof (user as any)?.nickname === "string") {
      setHagoNickname((user as any).nickname || "");
    }
  }, [user]);

  // Preview local na hora
  useEffect(() => {
    if (localPhotoPreview) {
      setProfilePhotoUrl(localPhotoPreview);
    }
  }, [localPhotoPreview]);

  const handleSolicitarSaque = () => {
    if (!user) {
      toast.error("Entre na sua conta para solicitar o saque.");
      return;
    }
    const valor = Number(valorSaque);
    if (Number.isNaN(valor) || valor <= 0) {
      setShowValorModal(true);
      return;
    }
    if (valor > jogador.saldoPremio) {
      toast.error("Seu saldo disponivel nao cobre este saque.");
      return;
    }
    if (!walletAddress.trim()) {
      toast.error("Informe a chave Pix que recebera o pagamento.");
      return;
    }
    solicitarSaqueMutation.mutate({
      valor,
      walletProvider,
      walletAddress: walletAddress.trim(),
    });
  };

  const handleEditarPerfil = () => {
    toast.info("Edicao de perfil em breve");
  };

  const handleSalvarPerfil = async () => {
    const normalizedNick = hagoNickname.trim();
    if (!birthDate) {
      toast.error("Informe a data de nascimento para salvar o perfil");
      return;
    }
    try {
      localStorage.setItem("dg-hago-nickname", normalizedNick);
      localStorage.setItem("dg-display-pref", displayPreference);
      localStorage.setItem("dg-hide-email", hideEmail ? "true" : "false");
      localStorage.setItem("dg-birth-date", birthDate);
    } catch {
      /* ignore */
    }
    try {
      const updated = await setPreferencesMutation.mutateAsync({
        nickname: normalizedNick || null,
        hideEmail,
        birthDate,
      });
      utils.auth.me.setData(undefined, prev =>
        prev
          ? {
              ...prev,
              nickname: updated.nickname ?? normalizedNick,
              hideEmail: updated.hideEmail,
              birthDate: updated.birthDate ?? prev.birthDate,
            }
          : prev
      );
      setHagoNickname(updated.nickname ?? normalizedNick);
      setBirthDate(updated.birthDate ? new Date(updated.birthDate).toISOString().split("T")[0] : birthDate);
      await refresh?.();
      toast.success("Perfil salvo/atualizado");
    } catch (error: any) {
      toast.error(error?.message || "Falha ao salvar perfil");
    }
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

  const displayName = (() => {
    const nick = hagoNickname.trim();
    if (displayPreference === "hago" && nick) return nick;
    return baseName;
  })();

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container py-4 md:py-6">
          <div className="mb-4 flex flex-col gap-3 md:mb-6 md:flex-row md:items-center md:justify-between">
            <Button asChild variant="outline" className="gap-2 rounded-full">
              <Link href="/">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card"><ArrowLeft className="w-4 h-4" /></span>
                <span>Voltar</span>
              </Link>
            </Button>
            
            <h1 className="text-2xl font-bold gradient-text md:text-3xl">Meu Perfil</h1>
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 md:flex md:w-auto md:items-center">
              <Button variant="outline" size="sm" onClick={handleEditarPerfil} className="w-full md:w-auto">
                Editar
              </Button>
              <Button className="btn-primary w-full md:w-auto" size="sm" onClick={handleSalvarPerfil}>
                Salvar perfil
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Aviso para completar perfil */}
      <div className="container mt-6">
        <div className="rounded-xl border border-amber-400/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100 shadow-lg">
          Complete seu perfil para personalizar como seu nome aparece no chat e nas paginas da comunidade.
        </div>
      </div>

      {/* Profile Header */}
      <section className="py-12 border-b border-border">
        <div className="container">
          <div className="card-elegant neon-border p-8">
            <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:gap-8">
              <div
                ref={avatarRef}
                className="w-40 h-40 sm:w-44 sm:h-44 md:w-48 md:h-48 rounded-2xl bg-card border border-border flex items-center justify-center shadow-lg overflow-hidden relative select-none flex-shrink-0 min-w-[9rem] min-h-[9rem]"
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
                  <span className="text-4xl">OK</span>
                )}
                {profilePhotoUrl ? (
                  <div className="absolute bottom-1 right-1 px-2 py-1 rounded-full bg-black/60 text-[10px] text-white border border-white/10">
                    Arraste para ajustar
                  </div>
                ) : null}
              </div>
              <div className="flex-1">
                <h2 className="mb-2 text-3xl font-bold md:text-4xl">{displayName}</h2>
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                  <div className="badge-elegant">
                    <Crown className="w-4 h-4" />
                    Ranking #{rankingDerived?.pos ?? jogador.ranking}
                  </div>
                  <div className="badge-elegant">
                    <Zap className="w-4 h-4" />
                    {(rankingDerived?.points ?? jogador.pontos) as number} pontos
                  </div>
                </div>
                <p className="text-muted-foreground mb-4">
                  {jogador.membroDesde
                    ? `Membro desde ${new Date(jogador.membroDesde).toLocaleDateString("pt-BR")}`
                    : "Perfil sem data de cadastro"}
                </p>
                <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
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

            <div className="mb-6 grid gap-4 md:grid-cols-2 md:gap-6">
              <div className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-3">
                <h3 className="text-lg font-semibold">Apelido no Hago</h3>
                <Input
                  placeholder="Seu apelido no Hago"
                  value={hagoNickname}
                  onChange={e => setHagoNickname(e.target.value)}
                />
                <div className="space-y-1">
                  <Label className="text-sm">Data de nascimento (obrigatoria)</Label>
                  <Input
                    type="date"
                    value={birthDate}
                    onChange={e => setBirthDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Como exibir seu nome:</p>
                  <RadioGroup value={displayPreference} onValueChange={val => setDisplayPreference(val as any)}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="real" id="pref-real" />
                      <Label htmlFor="pref-real">Nome de cadastro</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="hago" id="pref-hago" />
                      <Label htmlFor="pref-hago">Apelido do Hago</Label>
                    </div>
                  </RadioGroup>
                </div>
                <p className="text-xs text-muted-foreground">
                  Essa preferencia sera usada no chat e em telas que mostram seu nome. Use o botao "Salvar perfil" para guardar.
                </p>
                <div className="flex items-center gap-2 rounded-md border border-border/60 bg-card/60 p-2">
                  <Checkbox id="hide-email" checked={hideEmail} onCheckedChange={val => setHideEmail(Boolean(val))} />
                  <Label htmlFor="hide-email" className="text-sm">Ocultar meu email nas listagens (admin)</Label>
                </div>
              </div>
            </div>

            {/* Saldo de Premios + saque */}
            <div className="space-y-4 rounded-lg border border-yellow-500/30 bg-gradient-to-r from-yellow-900/30 to-orange-900/30 p-4 md:p-6">
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
                  placeholder="Sua chave PIX"
                  value={walletAddress}
                  onChange={e => setWalletAddress(e.target.value)}
                  className="bg-black/20 border-yellow-500/30"
                />
              </div>

              <Button
                className="btn-secondary w-full"
                onClick={handleSolicitarSaque}
                disabled={solicitarSaqueMutation.isPending}
              >
                {solicitarSaqueMutation.isPending ? "Enviando..." : "Solicitar saque para análise"}
              </Button>

              <p className="text-xs text-muted-foreground">
                O saque não é automático. Sua chave Pix será usada pela equipe quando a solicitação for aprovada e paga manualmente.
              </p>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Solicitações recentes</p>
                {solicitacoesQuery.isLoading ? <p className="text-xs text-muted-foreground">Carregando...</p> : null}
                {!solicitacoesQuery.isLoading && (solicitacoesQuery.data?.length ?? 0) === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma solicitação registrada.</p>
                ) : null}
                {solicitacoesQuery.data?.slice(0, 3).map(item => (
                  <div key={item.id} className="flex flex-col gap-2 rounded border border-yellow-500/30 bg-black/30 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold">R$ {Number(item.valor).toFixed(2)}</p>
                      <p className="text-muted-foreground">{new Date(item.dataSolicitacao).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <span className="text-yellow-300">{getWithdrawalStatusLabel((item as { status?: string }).status)}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-border/60 bg-card/40 p-4 md:p-5">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold">Extrato financeiro</h3>
                  <p className="text-sm text-muted-foreground">
                    Acompanhe os depósitos PIX e saques da sua conta.
                  </p>
                </div>

                {extratoQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando extrato...</p>
                ) : null}

                {!extratoQuery.isLoading && (extratoQuery.data?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma movimentação financeira registrada até agora.</p>
                ) : null}

                <div className="space-y-3">
                  {extratoQuery.data?.slice(0, 8).map(item => {
                    const isDeposit = item.tipo === "deposito_pix";
                    return (
                      <div
                        key={item.id}
                        className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/50 p-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="space-y-1">
                          <p className="font-semibold">{isDeposit ? "Depósito PIX" : "Saque"}</p>
                          <p className="text-sm text-muted-foreground">{item.descricao || "Movimentação financeira"}</p>
                          <p className="text-xs text-muted-foreground">{new Date(item.data).toLocaleString("pt-BR")}</p>
                          {item.referencia ? (
                            <p className="text-xs text-muted-foreground">Ref: {item.referencia}</p>
                          ) : null}
                        </div>

                        <div className="text-left md:text-right">
                          <p className={`text-lg font-bold ${isDeposit ? "text-emerald-400" : "text-yellow-400"}`}>
                            {isDeposit ? "+" : "-"} R$ {Number(item.valor).toFixed(2)}
                          </p>
                          <p className="text-sm text-muted-foreground">{getFinancialStatusLabel(item.status)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
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

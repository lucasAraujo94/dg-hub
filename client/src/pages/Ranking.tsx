import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { SitePage, SiteSection } from "@/components/SitePage";
import { TrendingUp, Medal, Flame, Award, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useEffect, useMemo, useState } from "react";
import { RankingPodium } from "@/components/RankingPodium";

type RankingTipo = "geral" | "semanal" | "mensal";

type RankingItem = {
  usuarioId: number;
  pontuacao: number;
  wins?: number;
  tipoRanking?: string;
  usuario?: { name?: string | null; email?: string | null; nickname?: string | null; role?: string | null };
  campeonatosCampeao?: Array<{ id: number; nome: string; jogo: string }>;
};

export default function Ranking() {
  const { user } = useAuth();
  const [tipo, setTipo] = useState<RankingTipo>("geral");
  const [displayPref, setDisplayPref] = useState<"real" | "hago">(() => {
    if (typeof window === "undefined") return "real";
    const stored = localStorage.getItem("dg-display-pref");
    return stored === "real" || stored === "hago" ? stored : "real";
  });
  const [hagoNickLocal, setHagoNickLocal] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("dg-hago-nickname") || "";
  });

  const rankingQuery = trpc.rankings.getByTipo.useQuery({ tipo, limite: 500 }, { refetchOnWindowFocus: false });
  const podiumQuery = trpc.rankings.getByTipo.useQuery(
    { tipo: "geral", limite: 3 },
    { refetchOnWindowFocus: false, enabled: tipo !== "geral" }
  );

  const rankingData = (rankingQuery.data ?? []) as RankingItem[];
  const podiumData = ((tipo === "geral" ? rankingData.slice(0, 3) : podiumQuery.data ?? []) as RankingItem[]);
  const currentUserId = (user as { id?: number } | null | undefined)?.id;

  useEffect(() => {
    const sync = () => {
      if (typeof window === "undefined") return;
      const pref = localStorage.getItem("dg-display-pref");
      const nick = localStorage.getItem("dg-hago-nickname") || "";
      if (pref === "real" || pref === "hago") setDisplayPref(pref);
      setHagoNickLocal(nick);
    };
    sync();
    if (typeof window !== "undefined") {
      window.addEventListener("storage", sync);
      window.addEventListener("focus", sync);
      return () => {
        window.removeEventListener("storage", sync);
        window.removeEventListener("focus", sync);
      };
    }
    return;
  }, []);

  const currentUserInfo = useMemo(() => {
    if (!currentUserId) return null;
    const idx = rankingData.findIndex(item => item.usuarioId === currentUserId);
    if (idx === -1) return null;
    return {
      pos: idx + 1,
      wins: rankingData[idx].wins ?? 0,
      points: rankingData[idx].pontuacao,
    };
  }, [currentUserId, rankingData]);

  const RankingTable = ({ data }: { data: RankingItem[] }) => (
    <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card/80 shadow-xl shadow-black/20">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-white/5 text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            <th className="w-12 px-4 py-3">Pos</th>
            <th className="px-4 py-3">Jogador</th>
            <th className="px-4 py-3 text-center">Pontos</th>
            <th className="px-4 py-3 text-center">Vitorias</th>
            <th className="px-4 py-3">Ultimo titulo</th>
          </tr>
        </thead>
        <tbody>
          {data.map((player, index) => {
            const usuario = player.usuario;
            const baseName = usuario?.name || usuario?.email || `Jogador ${player.usuarioId}`;
            const nick = (usuario?.nickname || hagoNickLocal || "").trim();
            const displayName = displayPref === "hago" && nick ? nick : baseName;
            const isAdmin = usuario?.role === "admin";
            const campeonatosCampeao = player.campeonatosCampeao ?? [];
            const lastTitle =
              campeonatosCampeao.length === 0
                ? null
                : campeonatosCampeao.reduce<{ id: number; nome: string; jogo: string } | null>((acc, curr) => {
                    if (!acc) return curr;
                    return curr.id > acc.id ? curr : acc;
                  }, null);
            const pos = index + 1;
            const wins = player.wins ?? campeonatosCampeao.length ?? 0;
            const avatarUrl =
              (usuario as { avatarUrl?: string | null; avatar?: string | null } | null | undefined)?.avatarUrl ||
              (usuario as { avatar?: string | null } | null | undefined)?.avatar ||
              "";
            const tone =
              pos === 1
                ? "bg-gradient-to-r from-amber-500/25 via-amber-400/10 to-yellow-300/15 border-amber-200/30 shadow-inner shadow-amber-900/30"
                : pos === 2
                  ? "bg-gradient-to-r from-slate-300/15 to-slate-200/10"
                  : pos === 3
                    ? "bg-gradient-to-r from-orange-300/15 to-orange-200/10"
                    : "bg-black/10";
            const badgeColor =
              pos === 1 ? "text-amber-300" : pos === 2 ? "text-slate-200" : pos === 3 ? "text-orange-200" : "text-muted-foreground";
            return (
              <tr key={`${player.usuarioId}-${pos}`} className={`${tone} border-b border-border/30 last:border-0 transition-colors hover:bg-white/8`}>
                <td className="px-4 py-3 font-semibold">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/10">
                      {pos}
                    </span>
                    {pos <= 3 ? <Award className={`h-4 w-4 ${badgeColor}`} /> : null}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={displayName} className="h-10 w-10 rounded-full border border-white/15 bg-white/10 object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-sm font-bold">
                        {displayName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-2 break-words font-semibold text-foreground">
                        {displayName}
                        {isAdmin ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-[2px] text-[10px] uppercase tracking-wide text-emerald-200">
                            <ShieldCheck className="h-3 w-3" />
                            Admin
                          </span>
                        ) : null}
                      </span>
                      <span className="truncate text-[11px] text-muted-foreground">Campeonatos: {wins}</span>
                      <Link href={`/perfil/${player.usuarioId}`} className="text-[11px] text-emerald-300 hover:underline">
                        Ver perfil publico
                      </Link>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center justify-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[12px] font-semibold text-primary">
                    {player.pontuacao} pts
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[12px] font-medium text-emerald-200">
                    {wins}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {lastTitle ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px]">
                      {lastTitle.nome} - {lastTitle.jogo}
                    </span>
                  ) : (
                    <span className="text-[12px] text-muted-foreground">Nenhum titulo ainda</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <SitePage
      title="Ranking de campeoes"
      description="Acompanhe a classificacao em um layout mais claro, com foco em pontuacao, podio e historico de titulos."
      badge="Arena ranking"
      icon={TrendingUp}
    >
      <div className="space-y-6">
        <SiteSection>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
            <div className="stat-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="mb-2 text-sm text-muted-foreground">Sua posicao ({tipo})</p>
                  <p className="text-3xl font-bold">#{currentUserInfo?.pos ?? "-"}</p>
                </div>
                <TrendingUp className="h-12 w-12 text-cyan-500/30" />
              </div>
            </div>
            <div className="stat-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="mb-2 text-sm text-muted-foreground">Seus pontos</p>
                  <p className="text-3xl font-bold">{currentUserInfo?.points ?? "-"}</p>
                </div>
                <Medal className="h-12 w-12 text-amber-500/30" />
              </div>
            </div>
            <div className="stat-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="mb-2 text-sm text-muted-foreground">Suas vitorias</p>
                  <p className="text-3xl font-bold">{currentUserInfo?.wins ?? "-"}</p>
                </div>
                <Flame className="h-12 w-12 text-orange-500/30" />
              </div>
            </div>
          </div>
        </SiteSection>

        <SiteSection
          title="Tabela completa"
          description="Cada campeonato conquistado vale 100 pontos e a ordem reage ao filtro selecionado."
          actions={
            <div className="flex items-center gap-2">
              {["geral", "semanal", "mensal"].map(key => (
                <Button
                  key={key}
                  variant={tipo === key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTipo(key as RankingTipo)}
                >
                  {key === "geral" ? "Geral" : key === "semanal" ? "Semanal" : "Mensal"}
                </Button>
              ))}
            </div>
          }
        >
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
                Cada campeonato conquistado vale 100 pontos
              </div>
              {rankingQuery.isLoading ? <span className="text-sm text-muted-foreground">Carregando...</span> : null}
            </div>

            {rankingQuery.error ? (
              <div className="card-elegant p-4 text-sm text-red-400">
                Erro ao carregar ranking: {rankingQuery.error.message}
              </div>
            ) : null}

            {!rankingQuery.isLoading && rankingData.length === 0 ? (
              <div className="card-elegant p-4 text-sm text-muted-foreground">Nenhum jogador no ranking ainda.</div>
            ) : null}

            {podiumData.length > 0 ? <RankingPodium data={podiumData} displayPref={displayPref} hagoNickLocal={hagoNickLocal} /> : null}
            {rankingData.length > 0 ? <RankingTable data={rankingData} /> : null}
          </div>
        </SiteSection>
      </div>
    </SitePage>
  );
}

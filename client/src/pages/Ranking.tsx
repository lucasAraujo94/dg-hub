import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { TrendingUp, Medal, Flame } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";

type RankingTipo = "geral" | "semanal" | "mensal";

export default function Ranking() {
  const { user } = useAuth();
  const [tipo, setTipo] = useState<RankingTipo>("geral");
  const rankingQuery = trpc.rankings.getByTipo.useQuery(
    { tipo, limite: 500 },
    { refetchOnWindowFocus: false }
  );

  const rankingData = rankingQuery.data ?? [];

  const currentUserId = (user as { id?: number } | null | undefined)?.id;

  const currentUserInfo = useMemo(() => {
    if (!currentUserId) return null;
    const idx = rankingData.findIndex(item => item.usuarioId === currentUserId);
    if (idx === -1) return null;
    return {
      pos: idx + 1,
      wins: (rankingData[idx] as { wins?: number }).wins ?? "-",
      points: rankingData[idx].pontuacao,
    };
  }, [currentUserId, rankingData]);

  const RankingTable = ({ data }: { data: typeof rankingData }) => (
    <div className="space-y-4">
      {data.map((player, index) => {
        const usuario = (player as { usuario?: { name?: string | null; email?: string | null; nickname?: string | null } }).usuario;
        const displayName = usuario?.name || usuario?.email || `Jogador ${player.usuarioId}`;
        const campeonatosCampeao =
          (player as { campeonatosCampeao?: Array<{ id: number; nome: string; jogo: string }> }).campeonatosCampeao ??
          [];
        return (
          <div
            key={`${player.usuarioId}-${player.tipoRanking}-${index}`}
            className="card-elegant flex items-center justify-between p-5 md:p-6 hover:border-purple-500/50 transition-all group"
          >
            <div className="flex items-center gap-5 flex-1">
              <span className="w-10 h-10 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                <Medal className="w-6 h-6 text-amber-400 fill-amber-300/40" />
                <span className="sr-only">Posicao {index + 1}</span>
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-lg">{displayName}</p>
                  <span className="text-xs text-muted-foreground">#{index + 1}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {player.pontuacao} pontos
                </p>
                {campeonatosCampeao.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-[11px] text-muted-foreground">Campeao em:</p>
                    <div className="flex flex-wrap gap-2">
                      {campeonatosCampeao.map(c => (
                        <span key={c.id} className="text-[11px] px-2 py-1 rounded-full bg-white/5 border border-white/10">
                          {c.nome} â€” {c.jogo}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-transparent bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text">
                {player.pontuacao}
              </p>
              <p className="text-xs text-muted-foreground">pontos</p>
            </div>
          </div>
        );
      })}
    </div>
  );

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
            <h1 className="text-3xl font-bold gradient-text">Ranking de Campeoes</h1>
            <div className="w-20" />
          </div>
          <p className="text-muted-foreground">Acompanhe os melhores jogadores.</p>
        </div>
      </div>

      <section className="py-12 border-b border-border">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="stat-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Sua posicao ({tipo})</p>
                  <p className="text-3xl font-bold">#{currentUserInfo?.pos ?? "-"}</p>
                </div>
                <TrendingUp className="w-12 h-12 text-purple-500/30" />
              </div>
            </div>
            <div className="stat-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Seus pontos</p>
                  <p className="text-3xl font-bold">{currentUserInfo?.points ?? "-"}</p>
                </div>
                <Medal className="w-12 h-12 text-cyan-500/30" />
              </div>
            </div>
            <div className="stat-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Suas vitorias em campeonatos</p>
                  <p className="text-3xl font-bold">{currentUserInfo?.wins ?? "-"}</p>
                </div>
                <Flame className="w-12 h-12 text-orange-500/30" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="container space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground">Campeoes e pontuacao acumulada.</p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={tipo === "geral" ? "default" : "outline"}
                onClick={() => setTipo("geral")}
              >
                Geral
              </Button>
              <Button
                size="sm"
                variant={tipo === "semanal" ? "default" : "outline"}
                onClick={() => setTipo("semanal")}
              >
                Semanal
              </Button>
              <Button
                size="sm"
                variant={tipo === "mensal" ? "default" : "outline"}
                onClick={() => setTipo("mensal")}
              >
                Mensal
              </Button>
            </div>
          </div>

          {rankingQuery.isLoading ? (
            <div className="card-elegant p-4 text-sm text-muted-foreground">Carregando ranking...</div>
          ) : null}

          {rankingQuery.error ? (
            <div className="card-elegant p-4 text-sm text-red-400">
              Erro ao carregar ranking: {rankingQuery.error.message}
            </div>
          ) : null}

          {!rankingQuery.isLoading && rankingData.length === 0 ? (
            <div className="card-elegant p-4 text-sm text-muted-foreground">Nenhum dado de ranking encontrado.</div>
          ) : null}

          {rankingData.length > 0 ? <RankingTable data={rankingData} /> : null}
        </div>
      </section>
    </div>
  );
}

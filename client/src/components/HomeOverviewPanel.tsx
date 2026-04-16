import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";

type PollResult = {
  pollId: number;
  question: string | null;
  closesAt: string | Date | null;
  options: string[];
  counts?: Record<string, number>;
};

type Winner = {
  position: number;
  name: string;
  points: string;
  badge: string;
};

type Championship = {
  id?: number;
  nome: string;
  inicio: string;
  premio: number;
  fase: string;
};

type HomeOverviewPanelProps = {
  user: any;
  hasNewChatMessages: boolean;
  activeChampionship: Championship | null;
  championshipCount: number;
  lastWinners: Winner[];
  pollResults: PollResult[];
  votedPolls: Set<number>;
  isVoting: boolean;
  onOpenChat: () => void;
  onRegister: (campeonatoId?: number) => void;
  onVote: (pollId: number, escolha: string) => void;
};

export default function HomeOverviewPanel({
  user,
  hasNewChatMessages,
  activeChampionship,
  championshipCount,
  lastWinners,
  pollResults,
  votedPolls,
  isVoting,
  onOpenChat,
  onRegister,
  onVote,
}: HomeOverviewPanelProps) {
  const championshipStatus = activeChampionship
    ? {
        title: activeChampionship.nome,
        subtitle: activeChampionship.fase,
      }
    : {
        title: championshipCount > 0 ? "Sem campeonato aberto" : "Nenhum campeonato cadastrado",
        subtitle:
          championshipCount > 0
            ? "Nao ha inscricoes ou partidas em destaque agora."
            : "Assim que um campeonato for criado, ele aparece aqui.",
      };

  return (
    <div className="h-full flex items-start justify-center px-0 md:px-4">
      <div className="w-full max-w-5xl space-y-4">
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black/35 backdrop-blur-2xl">
          <div className="grid gap-4 p-4 md:grid-cols-[1.35fr,0.95fr] md:p-6">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-cyan-100">
                <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.85)]" />
                Painel do jogador
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold leading-tight text-white sm:text-3xl md:text-4xl">
                  Tudo que importa para jogar, acompanhar premios e agir rapido.
                </h1>
                <p className="max-w-2xl text-sm text-white/75 md:text-base">
                  Veja seu saldo, o campeonato em destaque e os atalhos principais sem precisar procurar pelo app.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/50">Saldo atual</p>
                  <p className="mt-2 text-2xl font-bold text-yellow-400">
                    R$ {Number((user as any)?.saldoPremio ?? (user as any)?.prizeBalance ?? 0).toFixed(2)}
                  </p>
                  <p className="mt-1 text-xs text-white/60">Acompanhe no perfil e no extrato.</p>
                </Card>
                <Card className="border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/50">Campeonato atual</p>
                  <p className="mt-2 text-lg font-semibold text-white">{championshipStatus.title}</p>
                  <p className="mt-1 text-xs text-white/60">{championshipStatus.subtitle}</p>
                </Card>
                <Card className="border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/50">Status rapido</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {hasNewChatMessages ? "Chat com novidades" : "Tudo em dia"}
                  </p>
                  <p className="mt-1 text-xs text-white/60">
                    {hasNewChatMessages ? "Leia as mensagens novas da comunidade." : "Sem pendencias ou alertas importantes agora."}
                  </p>
                </Card>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Button asChild className="h-auto min-h-24 justify-start whitespace-normal rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-4 text-left text-white hover:bg-emerald-500/20">
                  <Link href="/campeonatos">
                    <div className="flex min-w-0 flex-col items-start gap-1 text-left">
                      <span className="text-sm font-semibold">Entrar em campeonato</span>
                      <span className="text-xs text-white/70">Veja torneios e inscricoes abertas.</span>
                    </div>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-auto min-h-24 justify-start whitespace-normal rounded-2xl border-white/15 bg-white/5 px-4 py-4 text-left text-white hover:bg-white/10">
                  <Link href="/perfil">
                    <div className="flex min-w-0 flex-col items-start gap-1 text-left">
                      <span className="text-sm font-semibold">Abrir perfil</span>
                      <span className="text-xs text-white/70">Saldo, saques e extrato financeiro.</span>
                    </div>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-auto min-h-24 justify-start whitespace-normal rounded-2xl border-white/15 bg-white/5 px-4 py-4 text-left text-white hover:bg-white/10">
                  <Link href="/ranking">
                    <div className="flex min-w-0 flex-col items-start gap-1 text-left">
                      <span className="text-sm font-semibold">Ver ranking</span>
                      <span className="text-xs text-white/70">Confira lideres e sua colocacao.</span>
                    </div>
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto min-h-24 justify-start whitespace-normal rounded-2xl border-white/15 bg-white/5 px-4 py-4 text-left text-white hover:bg-white/10"
                  onClick={onOpenChat}
                >
                  <div className="flex min-w-0 flex-col items-start gap-1 text-left">
                    <span className="text-sm font-semibold">Abrir chat</span>
                    <span className="text-xs text-white/70">Converse e acompanhe avisos da comunidade.</span>
                  </div>
                </Button>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 md:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/50">Em destaque</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    {activeChampionship?.nome ?? "Nenhum campeonato em destaque"}
                  </h2>
                </div>
                {activeChampionship ? (
                  <span className="rounded-full border border-purple-400/30 bg-purple-500/10 px-3 py-1 text-xs text-purple-100">
                    {activeChampionship.fase}
                  </span>
                ) : null}
              </div>
              {activeChampionship ? (
                <div className="mt-4 space-y-3 text-sm text-white/70">
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <span>Inicio</span>
                    <span className="font-medium text-white">{activeChampionship.inicio}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <span>Premiacao</span>
                    <span className="font-medium text-yellow-400">R$ {Number(activeChampionship.premio ?? 0).toFixed(2)}</span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-5 text-sm text-white/65">
                  Nenhum campeonato disponivel para destaque neste momento.
                </div>
              )}
              <Button
                className="mt-5 h-11 w-full rounded-2xl bg-gradient-to-r from-purple-600 to-cyan-500 text-white"
                onClick={() => onRegister(activeChampionship?.id)}
                disabled={!activeChampionship?.id}
              >
                {activeChampionship?.id ? "Participar agora" : "Aguardando proximo campeonato"}
              </Button>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">Top 3 do momento</p>
                <div className="mt-3 space-y-2">
                  {lastWinners.slice(0, 3).map(item => (
                    <div key={`${item.position}-${item.name}`} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">#{item.position} {item.name}</p>
                        <p className="text-xs text-white/55">{item.points}</p>
                      </div>
                      <span className="shrink-0 whitespace-nowrap rounded-full border border-yellow-400/30 bg-yellow-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-yellow-200">
                        {item.badge}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {pollResults.length ? (
          pollResults.map(poll => (
            <div
              key={poll.pollId}
              className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/15 via-transparent to-cyan-500/20" />
              <div className="relative flex flex-col gap-4 rounded-3xl border border-white/10 bg-black/40 p-6 md:p-8">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-emerald-200/80">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
                  Enquete
                </div>
                <h2 className="text-3xl font-semibold leading-tight text-white md:text-4xl">
                  {poll.question || "Próximo campeonato: escolha o modo"}
                </h2>
                <p className="text-sm text-emerald-100/80">
                  Vote no jogo que quer ver no próximo torneio. 1 voto por jogador logado.
                </p>
                <div className="space-y-3">
                  {(() => {
                    const cleanLabel = (opt: string) => {
                      const t = (opt || "").trim();
                      const m = t.match(/^(.+?)\s*\(([^)]+)\)$/);
                      if (m) {
                        const before = m[1].trim();
                        const inside = m[2].trim();
                        if (inside && inside !== before) return inside;
                        return before;
                      }
                      return t;
                    };
                    const aggregated = (poll.options ?? []).reduce<{ label: string; count: number; primary: string }[]>((acc, opt) => {
                      const label = cleanLabel(opt);
                      const count = poll.counts?.[opt] ?? 0;
                      const existing = acc.find(o => o.label === label);
                      if (existing) existing.count += count;
                      else acc.push({ label, count, primary: opt });
                      return acc;
                    }, []);
                    const total = aggregated.reduce((sum, item) => sum + item.count, 0);
                    return aggregated.map(item => {
                      const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                      return (
                        <div key={item.label} className="space-y-1">
                          <div className="flex justify-between text-xs text-emerald-100/80">
                            <span>{item.label}</span>
                            <span>{pct}% ({item.count} votos)</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                            <div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400" style={{ width: `${pct}%` }} />
                          </div>
                          <Button
                            variant="outline"
                            className="w-full justify-between border-emerald-400/40 text-white hover:border-emerald-400 hover:text-white/90"
                            onClick={() => {
                              if (votedPolls.has(poll.pollId)) {
                                return;
                              }
                              onVote(poll.pollId, item.primary);
                            }}
                            disabled={isVoting || votedPolls.has(poll.pollId)}
                          >
                            <span className="font-semibold">{item.label}</span>
                            <span className="text-xs text-emerald-100/80">{item.count} votos</span>
                          </Button>
                        </div>
                      );
                    });
                  })()}
                </div>
                {poll.closesAt ? (
                  <div className="text-xs text-emerald-100/70">
                    Fecha em: {new Date(poll.closesAt).toLocaleString("pt-BR")}
                  </div>
                ) : null}
                {isVoting ? <p className="text-xs text-emerald-100/80">Enviando voto...</p> : null}
                <div className="text-xs text-emerald-100/70">A enquete é atualizada em tempo real após cada voto.</div>
              </div>
            </div>
          ))
        ) : (
          <div className="relative rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-emerald-50 backdrop-blur-xl">
            Nenhuma enquete ativa. Crie uma enquete no painel admin.
          </div>
        )}
      </div>
    </div>
  );
}

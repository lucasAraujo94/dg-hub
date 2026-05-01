type ActivityItem = {
  key: string;
  roundIndex: number;
  matchIndex: number;
  winner: string;
  score: string;
  updatedAt: string;
  note?: string;
};

type ChampionshipBracketSidebarProps = {
  orderedActivities: ActivityItem[];
  getRoundLabel: (roundIndex: number, totalRounds: number, roundLength: number) => string;
  totalRoundsExibidos: number;
  roundLengths: number[];
  exibirApelido: (valor: string, display: "real" | "hago") => string;
  displayPref: "real" | "hago";
  spectatorMode: boolean;
};

export function ChampionshipBracketSidebar({
  orderedActivities,
  getRoundLabel,
  totalRoundsExibidos,
  roundLengths,
  exibirApelido,
  displayPref,
  spectatorMode,
}: ChampionshipBracketSidebarProps) {
  return (
    <aside className="space-y-4 print:hidden" data-export-hidden="true">
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
        <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Timeline da chave</p>
        <div className="mt-3 space-y-3">
          {orderedActivities.length > 0 ? (
            orderedActivities.slice(0, 8).map(activity => (
              <div key={activity.key} className="rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-sm">
                <p className="font-medium text-foreground">
                  {getRoundLabel(activity.roundIndex, totalRoundsExibidos, roundLengths[activity.roundIndex] ?? 0)} - Partida{" "}
                  {activity.matchIndex + 1}
                </p>
                <p className="text-cyan-100">
                  {exibirApelido(activity.winner, displayPref)} - {activity.score}
                </p>
                <p className="text-xs text-muted-foreground">{activity.updatedAt}</p>
                {activity.note ? <p className="mt-1 text-xs text-muted-foreground">{activity.note}</p> : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma atividade recente registrada no bracket.</p>
          )}
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
        <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Visao do espectador</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {spectatorMode
            ? "Controles operacionais ocultos e leitura priorizada para publico."
            : "Ative o modo espectador para esconder a maioria das acoes e deixar a transmissao mais limpa."}
        </p>
      </div>
    </aside>
  );
}

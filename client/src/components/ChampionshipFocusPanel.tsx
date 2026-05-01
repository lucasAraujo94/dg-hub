type ChampionshipFocusPanelProps = {
  campeonato: {
    nome: string;
    jogo: string;
    status: string;
    fase: string;
    inicio: string;
    premio: number;
    participantes: number;
  };
  totalParticipantesExibidos: number;
  getStatusColor: (status: string) => string;
  getStatusLabel: (status: string) => string;
};

export function ChampionshipFocusPanel({
  campeonato,
  totalParticipantesExibidos,
  getStatusColor,
  getStatusLabel,
}: ChampionshipFocusPanelProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(16,185,129,0.10),rgba(59,130,246,0.10))] px-4 py-4 shadow-[0_18px_50px_-35px_rgba(0,0,0,0.6)] print:rounded-none print:border-black/20 print:bg-none print:shadow-none">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] ${getStatusColor(campeonato.status)}`}>
              {getStatusLabel(campeonato.status)}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {campeonato.fase}
            </span>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-200/70">Campeonato em foco</p>
            <h3 className="text-2xl font-semibold text-white">{campeonato.nome}</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {campeonato.jogo} - Início {campeonato.inicio}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-3">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Prêmio</p>
            <p className="mt-2 text-lg font-semibold text-amber-300">R$ {campeonato.premio}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-3">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Inscritos</p>
            <p className="mt-2 text-lg font-semibold">{campeonato.participantes}</p>
          </div>
          <div className="col-span-2 rounded-2xl border border-white/10 bg-black/10 px-3 py-3 sm:col-span-1">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Chave</p>
            <p className="mt-2 text-lg font-semibold">{totalParticipantesExibidos} vagas visuais</p>
          </div>
        </div>
      </div>
    </div>
  );
}

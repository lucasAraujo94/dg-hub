import { Button } from "@/components/ui/button";

type ChampionshipCard = {
  id: number;
  nome: string;
  jogo: string;
  status: string;
  participantes: number;
  premio: number;
  inicio: string;
  fase: string;
  inscricoesEncerradas: boolean;
};

type ChampionshipCardsPanelProps = {
  campeonatos: ChampionshipCard[];
  selectedCampId: number | null;
  onSelect: (id: number) => void;
  onRegister: (id: number) => void;
  getStatusColor: (status: string) => string;
  getStatusLabel: (status: string) => string;
};

export function ChampionshipCardsPanel({
  campeonatos,
  selectedCampId,
  onSelect,
  onRegister,
  getStatusColor,
  getStatusLabel,
}: ChampionshipCardsPanelProps) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-card/30 p-4 print:hidden md:p-5">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Campeonatos disponiveis</p>
            <h2 className="text-xl font-semibold">Visualização em tempo real</h2>
          </div>
        </div>
        {campeonatos.length === 0 ? (
          <div className="card-elegant p-4 text-sm text-muted-foreground">Nenhum campeonato encontrado para este filtro.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {campeonatos.map(campeonato => {
              const selecionado = selectedCampId === campeonato.id;
              return (
                <div
                  key={campeonato.id}
                  className={`space-y-3 rounded-2xl border bg-white/5 p-4 backdrop-blur ${
                    selecionado ? "border-emerald-400/60 shadow-[0_0_25px_rgba(16,185,129,0.25)]" : "border-white/10"
                  }`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="truncate text-lg font-semibold text-white">{campeonato.nome}</h3>
                    <span className={`rounded-full border px-2 py-1 text-xs ${getStatusColor(campeonato.status)}`}>
                      {getStatusLabel(campeonato.status)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">Jogo: {campeonato.jogo}</p>
                  <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                    <span>Início: {campeonato.inicio}</span>
                    <span>Prêmio: R$ {campeonato.premio}</span>
                    <span>Participantes: {campeonato.participantes}</span>
                    <span>Fase: {campeonato.fase}</span>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={() => onSelect(campeonato.id)}
                      disabled={selecionado}
                    >
                      {selecionado ? "Selecionado" : "Ver chaveamento"}
                    </Button>
                    <Button
                      variant="default"
                      className="flex-1"
                      disabled={campeonato.inscricoesEncerradas}
                      onClick={() => onRegister(campeonato.id)}
                    >
                      {campeonato.inscricoesEncerradas ? "Inscrições fechadas" : "Inscrever-se"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

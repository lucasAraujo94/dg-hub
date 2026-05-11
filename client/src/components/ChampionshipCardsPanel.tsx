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
    <section className="rounded-[28px] border border-white/6 bg-card/20 p-4 print:hidden md:p-5">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Campeonatos disponiveis</p>
            <h2 className="text-xl font-semibold">Visualizacao em tempo real</h2>
          </div>
        </div>
        {campeonatos.length === 0 ? (
          <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-4 text-sm text-muted-foreground">
            Nenhum campeonato encontrado para este filtro.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {campeonatos.map(campeonato => {
              const selecionado = selectedCampId === campeonato.id;

              return (
                <div
                  key={campeonato.id}
                  className={`relative overflow-hidden rounded-[24px] border p-4 transition-colors ${
                    selecionado
                      ? "border-emerald-400/30 bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(255,255,255,0.03))]"
                      : "border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))]"
                  }`}
                >
                  <div className={`absolute inset-x-0 top-0 h-px ${selecionado ? "bg-emerald-300/60" : "bg-white/12"}`} />

                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/65">
                            {campeonato.jogo}
                          </span>
                          {selecionado ? (
                            <span className="rounded-full border border-emerald-300/25 bg-emerald-400/[0.08] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-100">
                              Em foco
                            </span>
                          ) : null}
                        </div>
                        <h3 className="truncate text-lg font-semibold leading-tight text-white">{campeonato.nome}</h3>
                        <p className="text-sm text-white/58">{campeonato.fase}</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${getStatusColor(campeonato.status)}`}>
                        {getStatusLabel(campeonato.status)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="rounded-2xl border border-white/6 bg-black/10 px-3 py-2.5">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">Inicio</p>
                        <p className="mt-1 text-sm font-medium text-white/82">{campeonato.inicio}</p>
                      </div>
                      <div className="rounded-2xl border border-white/6 bg-black/10 px-3 py-2.5">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">Premio</p>
                        <p className="mt-1 text-sm font-medium text-white/82">R$ {campeonato.premio}</p>
                      </div>
                      <div className="rounded-2xl border border-white/6 bg-black/10 px-3 py-2.5">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">Participantes</p>
                        <p className="mt-1 text-sm font-medium text-white/82">{campeonato.participantes}</p>
                      </div>
                      <div className="rounded-2xl border border-white/6 bg-black/10 px-3 py-2.5">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">Status</p>
                        <p className="mt-1 text-sm font-medium text-white/82">{getStatusLabel(campeonato.status)}</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        variant="secondary"
                        className="h-11 flex-1 border-white/8 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                        onClick={() => onSelect(campeonato.id)}
                        disabled={selecionado}
                      >
                        {selecionado ? "Selecionado" : "Ver chaveamento"}
                      </Button>
                      <Button
                        variant="default"
                        className="h-11 flex-1"
                        disabled={campeonato.inscricoesEncerradas}
                        onClick={() => onRegister(campeonato.id)}
                      >
                        {campeonato.inscricoesEncerradas ? "Inscricoes fechadas" : "Inscrever-se"}
                      </Button>
                    </div>
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

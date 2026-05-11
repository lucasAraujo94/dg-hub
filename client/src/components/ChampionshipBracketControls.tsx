import { Button } from "@/components/ui/button";

type ChampionshipBracketControlsProps = {
  roundViewLabel: string;
  bracketSearch: string;
  onBracketSearchChange: (value: string) => void;
  roundFilter: string;
  onRoundFilterChange: (value: string) => void;
  roundFilterOptions: Array<{ value: string; label: string }>;
  bracketSelectClassName: string;
  getToolbarButtonClassName: (active: boolean, accent: "cyan" | "violet" | "amber" | "emerald") => string;
  selectedRoundIndex: number;
  roundsExibidosLength: number;
  goToPreviousRound: () => void;
  goToNextRound: () => void;
  normalizedBracketSearch: string;
  searchedPlayerLastRoundIndex: number;
  searchedPlayerRoundLabel: string | null;
  searchedPlayerRoundTrail: number[];
  formatRoundStory: (rounds: number[]) => string;
  compactBracket: boolean;
  setCompactBracket: (updater: (prev: boolean) => boolean) => void;
  exportBracketAsImage: () => void;
  resetBracketView: () => void;
};

export function ChampionshipBracketControls({
  roundViewLabel,
  bracketSearch,
  onBracketSearchChange,
  roundFilter,
  onRoundFilterChange,
  roundFilterOptions,
  bracketSelectClassName,
  getToolbarButtonClassName,
  selectedRoundIndex,
  roundsExibidosLength,
  goToPreviousRound,
  goToNextRound,
  normalizedBracketSearch,
  searchedPlayerLastRoundIndex,
  searchedPlayerRoundLabel,
  searchedPlayerRoundTrail,
  formatRoundStory,
  compactBracket,
  setCompactBracket,
  exportBracketAsImage,
  resetBracketView,
}: ChampionshipBracketControlsProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 print:hidden" data-export-hidden="true">
      <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Controles da chave</p>
      <p className="mt-2 text-sm text-muted-foreground">{roundViewLabel}</p>
      <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center">
        <input
          value={bracketSearch}
          onChange={event => onBracketSearchChange(event.target.value)}
          placeholder="Buscar jogador"
          aria-label="Buscar jogador no bracket"
          className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-foreground outline-none transition focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
        />
        <div className="flex flex-wrap gap-2">
          <select
            value={roundFilter}
            onChange={event => onRoundFilterChange(event.target.value)}
            aria-label="Filtrar fase do bracket"
            className={bracketSelectClassName}
          >
            <option value="todas">Todas as fases</option>
            {roundFilterOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {roundFilter !== "todas" ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className={getToolbarButtonClassName(true, "cyan")}
                aria-label="Ir para a fase anterior do bracket"
                onClick={goToPreviousRound}
                disabled={selectedRoundIndex <= 0}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={getToolbarButtonClassName(true, "cyan")}
                aria-label="Ir para a proxima fase do bracket"
                onClick={goToNextRound}
                disabled={selectedRoundIndex < 0 || selectedRoundIndex >= roundsExibidosLength - 1}
              >
                Proxima
              </Button>
            </>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className={getToolbarButtonClassName(compactBracket, "cyan")}
            onClick={() => setCompactBracket(prev => !prev)}
          >
            {compactBracket ? "Expandir" : "Compactar"}
          </Button>
          <Button variant="outline" size="sm" className="shrink-0" onClick={exportBracketAsImage}>
            Exportar
          </Button>
          {(bracketSearch || compactBracket || roundFilter !== "todas") ? (
            <Button variant="outline" size="sm" className="shrink-0" onClick={resetBracketView}>
              Limpar
            </Button>
          ) : null}
        </div>
      </div>
      {normalizedBracketSearch ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-sm">
          {searchedPlayerLastRoundIndex >= 0 ? (
            <div className="space-y-1">
              <span className="text-cyan-100">
                Jogador encontrado em <span className="font-semibold">{searchedPlayerRoundLabel}</span>.
              </span>
              <p className="text-xs text-cyan-100/80">Caminho: {formatRoundStory(searchedPlayerRoundTrail)}</p>
            </div>
          ) : (
            <span className="text-muted-foreground">Nenhum jogador encontrado no bracket atual.</span>
          )}
        </div>
      ) : null}
    </div>
  );
}

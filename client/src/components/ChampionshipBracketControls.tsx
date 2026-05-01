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
  copiarResumoBusca: () => void;
  normalizedBracketSearch: string;
  searchedPlayerLastRoundIndex: number;
  searchedPlayerRoundLabel: string | null;
  searchedPlayerRoundTrail: number[];
  formatRoundStory: (rounds: number[]) => string;
  presentationMode: boolean;
  setPresentationMode: (updater: (prev: boolean) => boolean) => void;
  presentationAutoplay: boolean;
  setPresentationAutoplay: (updater: (prev: boolean) => boolean) => void;
  toggleBracketFullscreen: () => void;
  collapsedResolvedRounds: boolean;
  setCollapsedResolvedRounds: (updater: (prev: boolean) => boolean) => void;
  spectatorMode: boolean;
  setSpectatorMode: (updater: (prev: boolean) => boolean) => void;
  compactBracket: boolean;
  setCompactBracket: (updater: (prev: boolean) => boolean) => void;
  bracketDensity: "detalhado" | "compacto" | "ultracompacto";
  setBracketDensity: (value: "detalhado" | "compacto" | "ultracompacto") => void;
  exportBracketAsImage: () => void;
  imprimirBracket: () => void;
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
  copiarResumoBusca,
  normalizedBracketSearch,
  searchedPlayerLastRoundIndex,
  searchedPlayerRoundLabel,
  searchedPlayerRoundTrail,
  formatRoundStory,
  presentationMode,
  setPresentationMode,
  presentationAutoplay,
  setPresentationAutoplay,
  toggleBracketFullscreen,
  collapsedResolvedRounds,
  setCollapsedResolvedRounds,
  spectatorMode,
  setSpectatorMode,
  compactBracket,
  setCompactBracket,
  bracketDensity,
  setBracketDensity,
  exportBracketAsImage,
  imprimirBracket,
  resetBracketView,
}: ChampionshipBracketControlsProps) {
  return (
    <div className="grid gap-3 print:hidden xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]" data-export-hidden="true">
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
        <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Busca no bracket</p>
        <p className="mt-2 text-sm text-muted-foreground">{roundViewLabel}. Digite um jogador para destacar o caminho dele nas fases.</p>
        <div className="mt-3 flex w-full flex-col gap-2 lg:flex-row lg:items-start">
          <input
            value={bracketSearch}
            onChange={event => onBracketSearchChange(event.target.value)}
            placeholder="Buscar jogador"
            aria-label="Buscar jogador no bracket"
            className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-foreground outline-none transition focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
          />
          <div className="flex flex-wrap gap-2 lg:max-w-[360px]">
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
            {bracketSearch ? (
              <Button variant="outline" size="sm" className="shrink-0" onClick={copiarResumoBusca}>
                Copiar resumo
              </Button>
            ) : null}
            {bracketSearch ? (
              <Button variant="outline" size="sm" className="shrink-0" onClick={() => onBracketSearchChange("")}>
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
                  Jogador encontrado. Melhor fase destacada: <span className="font-semibold">{searchedPlayerRoundLabel}</span>.
                </span>
                <p className="text-xs text-cyan-100/80">Caminho: {formatRoundStory(searchedPlayerRoundTrail)}</p>
              </div>
            ) : (
              <span className="text-muted-foreground">Nenhum jogador encontrado com esse nome no bracket atual.</span>
            )}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
        <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Modos de leitura</p>
        <p className="mt-2 text-sm text-muted-foreground">Ajuste como a chave aparece sem misturar isso com busca ou navegação de fase.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className={getToolbarButtonClassName(presentationMode, "violet")}
            onClick={() => setPresentationMode(prev => !prev)}
          >
            {presentationMode ? "Modo normal" : "Modo apresentação"}
          </Button>
          {presentationMode ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className={getToolbarButtonClassName(presentationAutoplay, "violet")}
                onClick={() => setPresentationAutoplay(prev => !prev)}
              >
                {presentationAutoplay ? "Pausar rotação" : "Rotação automática"}
              </Button>
              <Button variant="outline" size="sm" className={getToolbarButtonClassName(true, "violet")} onClick={toggleBracketFullscreen}>
                Tela cheia
              </Button>
            </>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className={getToolbarButtonClassName(collapsedResolvedRounds, "amber")}
            onClick={() => setCollapsedResolvedRounds(prev => !prev)}
          >
            {collapsedResolvedRounds ? "Expandir resolvidas" : "Compactar resolvidas"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={getToolbarButtonClassName(spectatorMode, "emerald")}
            onClick={() => setSpectatorMode(prev => !prev)}
          >
            {spectatorMode ? "Modo operador" : "Modo espectador"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={getToolbarButtonClassName(compactBracket, "cyan")}
            onClick={() => setCompactBracket(prev => !prev)}
          >
            {compactBracket ? "Modo compacto" : "Modo detalhado"}
          </Button>
          <select
            value={bracketDensity}
            onChange={event => setBracketDensity(event.target.value as "detalhado" | "compacto" | "ultracompacto")}
            aria-label="Escolher densidade visual do bracket"
            className={bracketSelectClassName}
          >
            <option value="detalhado">Detalhado</option>
            <option value="compacto">Compacto</option>
            <option value="ultracompacto">Ultracompacto</option>
          </select>
          <Button variant="outline" size="sm" className="shrink-0" onClick={exportBracketAsImage}>
            Exportar imagem
          </Button>
          <Button variant="outline" size="sm" className="shrink-0" onClick={imprimirBracket}>
            Imprimir
          </Button>
          {(bracketSearch || compactBracket || roundFilter !== "todas" || presentationMode || collapsedResolvedRounds) ? (
            <Button variant="outline" size="sm" className="shrink-0" onClick={resetBracketView}>
              Resetar
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

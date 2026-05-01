import type { MutableRefObject, ReactNode } from "react";

type Match = { jogador1: string; jogador2: string; vencedor?: string };

type ChampionshipBracketCanvasProps = {
  bracketContentRef: MutableRefObject<HTMLDivElement | null>;
  bracketViewportRef: MutableRefObject<HTMLDivElement | null>;
  presentationMode: boolean;
  roundFilterLabel: string;
  currentPhaseCounter: string;
  roundsExibidos: Match[][];
  effectiveRoundIndex: number;
  faseAtualIndex: number;
  roundsFiltrados: Match[][];
  roundFilter: string;
  totalRoundsExibidos: number;
  goToRound: (roundIndex: number) => void;
  getRoundLabel: (roundIndex: number, totalRounds: number, roundLength: number) => string;
  usarBracketDuplo: boolean;
  roundsLadoEsquerdo: Match[][];
  roundsLadoDireito: Match[][];
  finalRound: Match[];
  renderRoundColumn: (round: Match[], roundIndex: number, side?: "left" | "right" | "full") => ReactNode;
};

export function ChampionshipBracketCanvas({
  bracketContentRef,
  bracketViewportRef,
  presentationMode,
  roundFilterLabel,
  currentPhaseCounter,
  roundsExibidos,
  effectiveRoundIndex,
  faseAtualIndex,
  roundsFiltrados,
  roundFilter,
  totalRoundsExibidos,
  goToRound,
  getRoundLabel,
  usarBracketDuplo,
  roundsLadoEsquerdo,
  roundsLadoDireito,
  finalRound,
  renderRoundColumn,
}: ChampionshipBracketCanvasProps) {
  return (
    <div
      ref={bracketContentRef}
      className={`rounded-3xl border border-white/10 bg-black/10 p-3 print:rounded-none print:border-black/20 print:bg-transparent print:p-0 sm:p-4 ${
        presentationMode ? "shadow-[0_30px_80px_-40px_rgba(34,211,238,0.45)]" : ""
      }`}
    >
      <div className="mb-3 space-y-3 print:hidden" data-export-hidden="true">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 sm:hidden">
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Como ler</p>
          <p className="mt-2 text-sm text-white/80">Deslize para navegar pelas fases e toque em uma fase para colocar o foco nela.</p>
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2 sm:hidden">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Fase atual</p>
            <p className="text-sm font-semibold text-cyan-100">{roundFilterLabel}</p>
          </div>
          <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-cyan-100">
            {currentPhaseCounter}
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 text-[11px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {roundsExibidos.map((round, roundIndex) => (
            <button
              key={`round-jump-${roundIndex}`}
              type="button"
              onClick={() => goToRound(roundIndex)}
              className={`shrink-0 rounded-full border px-3 py-1 tracking-wide transition ${
                effectiveRoundIndex === roundIndex
                  ? "border-cyan-300/45 bg-cyan-400/15 text-cyan-100"
                  : faseAtualIndex === roundIndex
                  ? "border-emerald-300/35 bg-emerald-400/10 text-emerald-100"
                  : "border-white/10 bg-white/5 text-muted-foreground"
              }`}
            >
              {getRoundLabel(roundIndex, totalRoundsExibidos, round.length)}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-2 overflow-x-auto pb-1 text-[11px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:hidden">
            {roundsFiltrados.map((round, filteredIndex) => {
              const roundIndex = roundFilter === "todas" ? filteredIndex : Number(roundFilter);
              return (
                <span
                  key={`round-pill-${roundIndex}`}
                  className={`shrink-0 rounded-full border px-3 py-1 tracking-wide ${
                    faseAtualIndex === roundIndex ? "border-cyan-300/40 bg-cyan-400/15 text-cyan-100" : "border-white/10 bg-white/5 text-muted-foreground"
                  }`}
                >
                  {getRoundLabel(roundIndex, totalRoundsExibidos, round.length)}
                </span>
              );
            })}
          </div>
          <p className="hidden text-[11px] text-muted-foreground sm:block">
            Deslize horizontalmente para acompanhar o fluxo completo do bracket. A fase em foco recebe scroll automatico.
          </p>
          <span className="shrink-0 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-cyan-100 sm:hidden">
            {totalRoundsExibidos} fases
          </span>
        </div>
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-background via-background/75 to-transparent print:hidden sm:w-12" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-background via-background/75 to-transparent print:hidden sm:w-12" />
        <div
          ref={bracketViewportRef}
          className="overflow-x-auto overscroll-x-contain scroll-smooth snap-x snap-mandatory pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden print:overflow-visible print:pb-0"
          style={{ touchAction: "pan-x" }}
        >
          {usarBracketDuplo ? (
            <div className="flex min-w-max items-start gap-4 px-1 print:min-w-0 print:gap-3 print:px-0 sm:gap-6 xl:gap-10">
              <div className="flex min-w-max items-start gap-4 sm:gap-6">
                {roundsLadoEsquerdo.map((round, roundIndex) => renderRoundColumn(round, roundIndex, "left"))}
              </div>
              <div className="flex min-w-[260px] items-center justify-center self-stretch sm:min-w-[320px]">
                {finalRound.length ? renderRoundColumn(finalRound, roundsExibidos.length - 1, "full") : null}
              </div>
              <div className="flex min-w-max items-start gap-4 sm:gap-6">
                {[...roundsLadoDireito].reverse().map((round, reverseIndex) => {
                  const roundIndex = roundsLadoDireito.length - 1 - reverseIndex;
                  return renderRoundColumn(round, roundIndex, "right");
                })}
              </div>
            </div>
          ) : (
            <div className={`flex min-w-max items-start gap-4 px-1 print:min-w-0 print:gap-3 print:px-0 sm:gap-6 ${presentationMode ? "sm:gap-8" : ""}`}>
              {roundsFiltrados.map((round, filteredIndex) => {
                const roundIndex = roundFilter === "todas" ? filteredIndex : Number(roundFilter);
                return renderRoundColumn(round, roundIndex);
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

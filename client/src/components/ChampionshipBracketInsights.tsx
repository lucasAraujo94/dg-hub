import { Button } from "@/components/ui/button";

type ChampionshipBracketInsightsProps = {
  phaseSizeSummary: string;
  effectiveRoundIndex: number;
  onCopyRoundSummary: (roundIndex: number) => void;
  onFocusCurrentRound: (roundIndex: number) => void;
  faseAtualLabel: string;
  currentPhaseCounter: string;
  bracketDensity: "detalhado" | "compacto" | "ultracompacto";
  totalParticipantesExibidos: number;
  totalRoundsExibidos: number;
  partidasDefinidas: number;
  partidasTotais: number;
  progressoPercentual: number;
  woCount: number;
  pendingMatches: number;
  alivePlayers: number;
  presentationMode: boolean;
  compactBracket: boolean;
  bracketEhExemplo: boolean;
  roundFilterLabel: string;
  presentationAutoplay: boolean;
  collapsedResolvedRounds: boolean;
  spectatorMode: boolean;
  normalizedBracketSearch: string;
  bracketSearch: string;
  visibleColumnsCount: number;
};

export function ChampionshipBracketInsights({
  phaseSizeSummary,
  effectiveRoundIndex,
  onCopyRoundSummary,
  onFocusCurrentRound,
  faseAtualLabel,
  currentPhaseCounter,
  bracketDensity,
  totalParticipantesExibidos,
  totalRoundsExibidos,
  partidasDefinidas,
  partidasTotais,
  progressoPercentual,
  woCount,
  pendingMatches,
  alivePlayers,
  presentationMode,
  compactBracket,
  bracketEhExemplo,
  roundFilterLabel,
  presentationAutoplay,
  collapsedResolvedRounds,
  spectatorMode,
  normalizedBracketSearch,
  bracketSearch,
  visibleColumnsCount,
}: ChampionshipBracketInsightsProps) {
  return (
    <>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Resumo da chave</p>
              <p className="text-sm text-foreground">Fluxo de participantes: {phaseSizeSummary}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="shrink-0" onClick={() => onCopyRoundSummary(effectiveRoundIndex)}>
                Copiar fase atual
              </Button>
              <Button variant="outline" size="sm" className="shrink-0" onClick={() => onFocusCurrentRound(effectiveRoundIndex)}>
                Focar fase atual
              </Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-3 py-1">Fase atual: {faseAtualLabel}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Contador mobile: {currentPhaseCounter}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Densidade: {bracketDensity}</span>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Legenda</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta legenda resume rapidamente o estado de cada confronto e da fase em foco.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-cyan-100">Em aberto</span>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-emerald-200">Definida</span>
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-amber-100">W.O</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-muted-foreground">Aguardando</span>
            <span className="rounded-full border border-cyan-300/35 bg-cyan-400/15 px-3 py-1 text-cyan-100">Fase em foco</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-foreground">Jogador buscado</span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Participantes</p>
          <p className="mt-2 text-2xl font-semibold">{totalParticipantesExibidos}</p>
          <p className="text-xs text-muted-foreground">Capacidade visual adaptada ao total da chave</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Fases</p>
          <p className="mt-2 text-2xl font-semibold">{totalRoundsExibidos}</p>
          <p className="text-xs text-muted-foreground">Eliminacao simples com rounds progressivos</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Fase atual</p>
          <p className="mt-2 text-2xl font-semibold text-cyan-100">{faseAtualLabel}</p>
          <p className="text-xs text-muted-foreground">Primeira etapa ainda com confrontos em aberto</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Progresso</p>
          <p className="mt-2 text-2xl font-semibold">
            {partidasDefinidas}/{partidasTotais}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-cyan-200 transition-[width] duration-300"
              style={{ width: `${progressoPercentual}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">Partidas com vencedor definido</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">W.O</p>
          <p className="mt-2 text-2xl font-semibold text-amber-200">{woCount}</p>
          <p className="text-xs text-muted-foreground">Confrontos com vaga automatica</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Pendentes</p>
          <p className="mt-2 text-2xl font-semibold text-cyan-100">{pendingMatches}</p>
          <p className="text-xs text-muted-foreground">Partidas ainda abertas na chave</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Jogadores vivos</p>
          <p className="mt-2 text-2xl font-semibold">{alivePlayers}</p>
          <p className="text-xs text-muted-foreground">Participantes ainda sem eliminacao definida</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Modo</p>
          <p className="mt-2 text-2xl font-semibold">{presentationMode ? "TV" : compactBracket ? "Compacto" : "Detalhado"}</p>
          <p className="text-xs text-muted-foreground">Layout ativo para leitura e exibicao</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Origem: {bracketEhExemplo ? "Exemplo" : "Campeonato real"}</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Visualizacao: {compactBracket ? "Compacta" : "Detalhada"}</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Fase: {roundFilterLabel}</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Modo TV: {presentationMode ? "ativo" : "desligado"}</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Rotacao: {presentationAutoplay ? "automatica" : "manual"}</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Resolvidas: {collapsedResolvedRounds ? "compactadas" : "expandidas"}</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Espectador: {spectatorMode ? "ativo" : "desligado"}</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
          Busca: {normalizedBracketSearch ? bracketSearch.trim() : "nenhuma"}
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Colunas visiveis: {visibleColumnsCount}</span>
      </div>
    </>
  );
}

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMemo, useState } from "react";
import { Link } from "wouter";

type OnlinePlayer = {
  id: number;
  name: string;
};

type Campeonato = {
  id: number;
  nome: string;
  descricao?: string | null;
  dataInicio?: string | Date | null;
  premioValor?: number | string | null;
  status?: string;
};

type HomeActivePanelsProps = {
  activeSection: "campeonatos" | "perfil" | "chat" | "textos" | null;
  campeonatos: Campeonato[];
  onlinePlayers: OnlinePlayer[];
  userRole?: string | null;
  onRegister: (campeonatoId?: number) => void;
  onMarkChatAsRead: () => void;
};

type GeneratedStyle = {
  id: string;
  name: string;
  value: string;
};

const SUPERSCRIPT_MAP: Record<string, string> = {
  a: "ᵃ",
  b: "ᵇ",
  c: "ᶜ",
  d: "ᵈ",
  e: "ᵉ",
  f: "ᶠ",
  g: "ᵍ",
  h: "ʰ",
  i: "ⁱ",
  j: "ʲ",
  k: "ᵏ",
  l: "ˡ",
  m: "ᵐ",
  n: "ⁿ",
  o: "ᵒ",
  p: "ᵖ",
  q: "ᵠ",
  r: "ʳ",
  s: "ˢ",
  t: "ᵗ",
  u: "ᵘ",
  v: "ᵛ",
  w: "ʷ",
  x: "ˣ",
  y: "ʸ",
  z: "ᶻ",
  A: "ᴬ",
  B: "ᴮ",
  D: "ᴰ",
  E: "ᴱ",
  G: "ᴳ",
  H: "ᴴ",
  I: "ᴵ",
  J: "ᴶ",
  K: "ᴷ",
  L: "ᴸ",
  M: "ᴹ",
  N: "ᴺ",
  O: "ᴼ",
  P: "ᴾ",
  R: "ᴿ",
  T: "ᵀ",
  U: "ᵁ",
  V: "ⱽ",
  W: "ᵂ",
};

const toSuperscript = (value: string) =>
  value
    .split("")
    .map(char => SUPERSCRIPT_MAP[char] ?? SUPERSCRIPT_MAP[char.toLowerCase()] ?? char)
    .join("");

const joinNonEmpty = (...parts: string[]) => parts.filter(Boolean).join("");
const stackNonEmpty = (...parts: string[]) => parts.filter(Boolean).join("\n");

const SYMBOLS = {
  coroas: ["♕", "♛", "♔"],
  estrelas: ["✦", "✧", "⋆", "✶"],
  luxo: ["◇", "◆", "❖", "◈"],
  floral: ["❀", "✿", "❁", "⚘"],
  minimal: ["•", "¦", "·", "˖"],
  gamer: ["⚔", "⚡", "✘", "▣"],
  cute: ["♡", "♥", "ღ", "୨୧"],
} as const;

export default function HomeActivePanels({
  activeSection,
  campeonatos,
  onlinePlayers,
  userRole,
  onRegister,
  onMarkChatAsRead,
}: HomeActivePanelsProps) {
  const [topText, setTopText] = useState("");
  const [bottomText, setBottomText] = useState("");

  const generatedStyles = useMemo<GeneratedStyle[]>(() => {
    const top = topText.trim();
    const bottom = bottomText.trim();
    const topSuper = toSuperscript(top);
    const topSpaced = topSuper.split("").join(" ");
    const topWide = topSuper.split("").join("  ");
    const topDotted = topSuper.split("").join(" · ");
    const topStarred = topSuper.split("").join(" ✦ ");
    const bottomLower = bottom.toLowerCase();
    const bottomUpper = bottom.toUpperCase();
    const bottomTitle = bottom
      ? `${bottom.charAt(0).toUpperCase()}${bottom.slice(1).toLowerCase()}`
      : "";
    const bottomSpaced = bottomLower.split("").join(" ");
    const [crownA, crownB, crownC] = SYMBOLS.coroas;
    const [starA, starB, starC, starD] = SYMBOLS.estrelas;
    const [luxA, luxB, luxC, luxD] = SYMBOLS.luxo;
    const [floralA, floralB, floralC, floralD] = SYMBOLS.floral;
    const [minimalA, minimalB, minimalC, minimalD] = SYMBOLS.minimal;
    const [gamerA, gamerB, gamerC, gamerD] = SYMBOLS.gamer;
    const [cuteA, cuteB, cuteC, cuteD] = SYMBOLS.cute;

    return [
      { id: "normal-stacked", name: "Normal stacked", value: joinNonEmpty(topSuper, bottomLower) },
      { id: "spaced-stacked", name: "Spaced stacked", value: stackNonEmpty(topSpaced, bottomLower) },
      { id: "tiny-top", name: "Tiny top", value: joinNonEmpty(topSuper, bottomLower) },
      { id: "luxury", name: "Luxury", value: joinNonEmpty(topWide, bottomUpper) },
      { id: "minimal", name: "Minimal", value: joinNonEmpty(topSuper, bottomTitle) },
      { id: "crown-left", name: "Coroa a esquerda", value: joinNonEmpty(`${crownA} `, topSuper, bottomLower) },
      { id: "crown-right", name: "Coroa a direita", value: joinNonEmpty(topSuper, bottomLower, ` ${crownB}`) },
      { id: "double-crown", name: "Coroas dos dois lados", value: joinNonEmpty(`${crownA} `, topSuper, bottomUpper, ` ${crownB}`) },
      { id: "stars", name: "Estrelas", value: joinNonEmpty(`${starA} `, topSuper, bottomLower, ` ${starA}`) },
      { id: "ornaments", name: "Simbolos decorativos", value: joinNonEmpty(`${luxC} `, topSuper, bottomTitle, ` ${luxC}`) },
      { id: "stacked-classic", name: "Empilhado classico", value: stackNonEmpty(topSuper, bottomLower) },
      { id: "stacked-spaced", name: "Empilhado espacado", value: stackNonEmpty(topSpaced, bottomLower) },
      { id: "stacked-luxury", name: "Empilhado luxury", value: stackNonEmpty(`${starA} ${topWide}`, bottomUpper) },
      { id: "stacked-minimal", name: "Empilhado minimal", value: stackNonEmpty(topSuper, bottomTitle) },
      { id: "stacked-wide", name: "Empilhado wide", value: stackNonEmpty(topWide, bottomLower) },
      { id: "stacked-dotted", name: "Empilhado dotted", value: stackNonEmpty(topDotted, bottomLower) },
      { id: "stacked-stars", name: "Empilhado stars", value: stackNonEmpty(topStarred, bottomUpper) },
      { id: "stacked-crown-left", name: "Empilhado coroa esquerda", value: stackNonEmpty(`${crownA} ${topSuper}`, bottomLower) },
      { id: "stacked-crown-right", name: "Empilhado coroa direita", value: stackNonEmpty(topSpaced, `${bottomLower} ${crownB}`) },
      { id: "stacked-double-crown", name: "Empilhado coroas", value: stackNonEmpty(`${crownA} ${topWide}`, `${bottomUpper} ${crownB}`) },
      { id: "inline-star-left", name: "Star left", value: joinNonEmpty(`${starA} `, topSuper, bottomTitle) },
      { id: "inline-star-right", name: "Star right", value: joinNonEmpty(topSuper, bottomTitle, ` ${starB}`) },
      { id: "inline-double-star", name: "Double star", value: joinNonEmpty(`${starA} `, topSuper, bottomTitle, ` ${starC}`) },
      { id: "inline-diamond-left", name: "Diamond left", value: joinNonEmpty(`${luxA} `, topSuper, bottomLower) },
      { id: "inline-diamond-right", name: "Diamond right", value: joinNonEmpty(topSuper, bottomLower, ` ${luxA}`) },
      { id: "inline-diamonds", name: "Diamonds", value: joinNonEmpty(`${luxA} `, topSuper, bottomLower, ` ${luxB}`) },
      { id: "inline-bullet", name: "Minimal bullet", value: joinNonEmpty(`${minimalA} `, topSuper, bottomTitle) },
      { id: "inline-wave", name: "Wave", value: joinNonEmpty("~ ", topSuper, bottomLower, " ~") },
      { id: "inline-hearts", name: "Hearts", value: joinNonEmpty(`${cuteA} `, topSuper, bottomTitle, ` ${cuteB}`) },
      { id: "inline-sparkles", name: "Sparkles", value: joinNonEmpty(`${starC} `, topWide, bottomUpper, ` ${starD}`) },
      { id: "inline-bars", name: "Bars", value: joinNonEmpty(`${minimalB} `, topSuper, bottomLower, ` ${minimalB}`) },
      { id: "stacked-bars", name: "Empilhado bars", value: stackNonEmpty(`${minimalB} ${topSuper} ${minimalB}`, bottomLower) },
      { id: "stacked-diamonds", name: "Empilhado diamonds", value: stackNonEmpty(`${luxA} ${topSpaced}`, `${bottomLower} ${luxB}`) },
      { id: "stacked-hearts", name: "Empilhado hearts", value: stackNonEmpty(`${cuteA} ${topSuper}`, `${bottomTitle} ${cuteB}`) },
      { id: "stacked-sparkles", name: "Empilhado sparkles", value: stackNonEmpty(`${starC} ${topWide}`, `${bottomUpper} ${starD}`) },
      { id: "stacked-mini", name: "Empilhado mini", value: stackNonEmpty(topSuper, bottomSpaced) },
      { id: "stacked-clean-upper", name: "Empilhado upper", value: stackNonEmpty(topSpaced, bottomUpper) },
      { id: "stacked-clean-title", name: "Empilhado title", value: stackNonEmpty(topSuper, bottomTitle) },
      { id: "inline-upper", name: "Inline upper", value: joinNonEmpty(topSuper, bottomUpper) },
      { id: "inline-title", name: "Inline title", value: joinNonEmpty(topWide, bottomTitle) },
      { id: "inline-spaced-base", name: "Inline base spaced", value: joinNonEmpty(topSuper, bottomSpaced) },
      { id: "stacked-ornament-left", name: "Empilhado ornament left", value: stackNonEmpty(`${luxC} ${topSuper}`, bottomLower) },
      { id: "stacked-ornament-right", name: "Empilhado ornament right", value: stackNonEmpty(topSpaced, `${bottomTitle} ${luxD}`) },
      { id: "ornament-frame", name: "Ornament frame", value: joinNonEmpty(`${luxC} `, topWide, bottomUpper, ` ${luxD}`) },
      { id: "floral-left", name: "Floral left", value: joinNonEmpty(`${floralA} `, topSuper, bottomTitle) },
      { id: "floral-right", name: "Floral right", value: joinNonEmpty(topSuper, bottomTitle, ` ${floralB}`) },
      { id: "floral-frame", name: "Floral frame", value: joinNonEmpty(`${floralA} `, topWide, bottomLower, ` ${floralB}`) },
      { id: "stacked-floral", name: "Empilhado floral", value: stackNonEmpty(`${floralC} ${topSpaced}`, `${bottomTitle} ${floralD}`) },
      { id: "cute-double", name: "Cute dupla", value: joinNonEmpty(`${cuteC} `, topSuper, bottomTitle, ` ${cuteD}`) },
      { id: "stacked-cute", name: "Empilhado cute", value: stackNonEmpty(`${cuteA} ${topSuper}`, `${bottomTitle} ${cuteD}`) },
      { id: "gamer-left", name: "Gamer left", value: joinNonEmpty(`${gamerA} `, topSuper, bottomUpper) },
      { id: "gamer-right", name: "Gamer right", value: joinNonEmpty(topSuper, bottomUpper, ` ${gamerB}`) },
      { id: "gamer-frame", name: "Gamer frame", value: joinNonEmpty(`${gamerA} `, topWide, bottomUpper, ` ${gamerB}`) },
      { id: "stacked-gamer", name: "Empilhado gamer", value: stackNonEmpty(`${gamerC} ${topSpaced}`, `${bottomUpper} ${gamerD}`) },
      { id: "minimal-dots", name: "Minimal dots", value: joinNonEmpty(`${minimalC} `, topSuper, bottomTitle, ` ${minimalC}`) },
      { id: "minimal-soft", name: "Minimal soft", value: joinNonEmpty(`${minimalD} `, topWide, bottomLower) },
    ].filter(item => item.value.trim().length > 0);
  }, [bottomText, topText]);

  if (activeSection === "campeonatos") {
    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Ranking de campeoes</h2>
          <Button asChild size="sm">
            <Link href="/campeonatos">Abrir pagina</Link>
          </Button>
        </div>
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-3">
          <p className="flex items-center gap-2 text-sm text-emerald-100">
            <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            Jogadores online
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-sm text-emerald-100">
            {onlinePlayers.map(p => (
              <span
                key={p.id}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1"
              >
                <span className="h-2 w-2 rounded-full bg-green-400" />
                {p.name}
              </span>
            ))}
          </div>
        </div>
        {userRole === "admin" ? (
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/60 p-3">
            <div>
              <p className="text-sm font-semibold">Criar novo campeonato</p>
              <p className="text-xs text-muted-foreground">
                Admins podem cadastrar e gerenciar campeonatos.
              </p>
            </div>
            <Button asChild size="sm" variant="secondary">
              <Link href="/admin">Criar campeonato</Link>
            </Button>
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {campeonatos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum campeonato cadastrado ainda.
            </p>
          ) : null}
          {campeonatos.map(camp => {
            const dataInicio = camp.dataInicio ? new Date(camp.dataInicio) : null;
            const status = (() => {
              const rawStatus = camp.status ?? "ativo";
              const started = dataInicio ? dataInicio.getTime() <= Date.now() : false;
              return rawStatus === "cancelado" || rawStatus === "finalizado"
                ? rawStatus
                : started
                  ? "finalizado"
                  : "ativo";
            })();
            const inscricoesEncerradas = (() => {
              if (status === "cancelado" || status === "finalizado") return true;
              if (!dataInicio) return false;
              const diff = dataInicio.getTime() - Date.now();
              if (diff <= 0) return true;
              return diff < 24 * 60 * 60 * 1000;
            })();
            const faseLabel =
              status === "cancelado"
                ? "Cancelado"
                : status === "finalizado"
                  ? "Finalizado"
                  : inscricoesEncerradas
                    ? "Inscricoes encerradas"
                    : "Fase de inscricoes";
            return (
              <Card key={camp.id} className="space-y-2 border-border/70 bg-card/60 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <h3 className="break-words font-semibold">{camp.nome}</h3>
                    <p className="text-xs text-muted-foreground break-words">{faseLabel}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {dataInicio
                      ? dataInicio.toLocaleDateString("pt-BR")
                      : "Data a definir"}
                  </span>
                </div>
                <p className="line-clamp-2 break-words text-sm text-muted-foreground">
                  {camp.descricao ?? "Campeonato ativo"}
                </p>
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span>Premio</span>
                  <span className="font-medium text-yellow-400">
                    R$ {camp.premioValor as any}
                  </span>
                </div>
                <Button
                  className="mt-2"
                  size="sm"
                  variant="outline"
                  onClick={() => onRegister(camp.id)}
                  disabled={inscricoesEncerradas}
                >
                  {inscricoesEncerradas ? "Inscricoes encerradas" : "Inscreva-se"}
                </Button>
              </Card>
            );
          })}
        </div>
      </section>
    );
  }

  if (activeSection === "perfil") {
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Ranking de campeoes</h2>
          <Button asChild size="sm">
            <Link href="/perfil">Abrir perfil</Link>
          </Button>
        </div>
        <Card className="border-border/70 bg-card/60 p-5">
          <p className="text-sm text-muted-foreground">
            Veja e edite seus dados, conquistas e historico de campeonatos.
          </p>
        </Card>
      </section>
    );
  }

  if (activeSection === "chat") {
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Ranking de campeoes</h2>
          <Button asChild size="sm">
            <Link href="/chat" onClick={onMarkChatAsRead}>
              Ir para o chat
            </Link>
          </Button>
        </div>
        <Card className="border-border/70 bg-card/60 p-5">
          <p className="text-sm text-muted-foreground">
            Converse com a comunidade e acompanhe transmissoes em tempo real.
          </p>
        </Card>
      </section>
    );
  }

  if (activeSection === "textos") {
    return (
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Galeria de stacked text</h2>
          <p className="text-sm text-muted-foreground">
            Digite uma vez e receba varias opcoes prontas, cada uma com copia individual.
          </p>
        </div>

        <Card className="space-y-4 border-white/10 bg-white/5 p-5 backdrop-blur-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="top-text">Texto de cima</Label>
              <Input
                id="top-text"
                value={topText}
                onChange={event => setTopText(event.target.value)}
                placeholder="Ex: familia"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bottom-text">Texto de baixo</Label>
              <Input
                id="bottom-text"
                value={bottomText}
                onChange={event => setBottomText(event.target.value)}
                placeholder="Ex: supreme"
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            A galeria abaixo gera automaticamente estilos com icones embutidos e variacoes realmente empilhadas.
          </p>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {generatedStyles.map(style => (
            <Card key={style.id} className="border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.04))] p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">{style.name}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (typeof navigator !== "undefined" && navigator.clipboard) {
                      navigator.clipboard.writeText(style.value);
                    }
                  }}
                >
                  Copiar
                </Button>
              </div>
              <pre className="min-h-32 whitespace-pre-wrap break-words rounded-2xl border border-black/10 bg-[#f7f7f5] px-5 py-6 text-center text-lg font-semibold text-black shadow-[0_18px_55px_rgba(0,0,0,0.12)]">
                {style.value || "Digite os textos para gerar os modelos."}
              </pre>
            </Card>
          ))}
        </div>
      </section>
    );
  }

  return null;
}

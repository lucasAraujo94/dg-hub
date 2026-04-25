import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Crown } from "lucide-react";
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

type TextPreset = {
  id: string;
  name: string;
};

const TEXT_PRESETS: TextPreset[] = [
  { id: "normal-stacked", name: "Normal stacked" },
  { id: "spaced-stacked", name: "Spaced stacked" },
  { id: "tiny-top", name: "Tiny top" },
  { id: "luxury", name: "Luxury" },
  { id: "minimal", name: "Minimal" },
];

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

export default function HomeActivePanels({
  activeSection,
  campeonatos,
  onlinePlayers,
  userRole,
  onRegister,
  onMarkChatAsRead,
}: HomeActivePanelsProps) {
  const [selectedPresetId, setSelectedPresetId] = useState(TEXT_PRESETS[0].id);
  const [topText, setTopText] = useState("");
  const [bottomText, setBottomText] = useState("");
  const [canvasBg, setCanvasBg] = useState("#f7f7f5");
  const [showIcons, setShowIcons] = useState(true);
  const [leftIcon, setLeftIcon] = useState("crown");
  const [rightIcon, setRightIcon] = useState("queen");

  const selectedPreset = useMemo(
    () => TEXT_PRESETS.find(preset => preset.id === selectedPresetId) ?? TEXT_PRESETS[0],
    [selectedPresetId]
  );

  const exportText = useMemo(() => {
    const top = topText.trim();
    const bottom = bottomText.trim();
    if (!top && !bottom) return "";

    const topSuper = toSuperscript(top);
    const spacedTop = topSuper.split("").join(" ");

    switch (selectedPreset.id) {
      case "spaced-stacked":
        return [spacedTop, bottom.toLowerCase()].filter(Boolean).join("\n");
      case "tiny-top":
        return `${topSuper}${bottom.toLowerCase()}`;
      case "luxury":
        return `${spacedTop}${bottom.toUpperCase()}`;
      case "minimal":
        return `${topSuper}${bottom ? `${bottom.charAt(0).toUpperCase()}${bottom.slice(1).toLowerCase()}` : ""}`;
      case "normal-stacked":
      default:
        return `${topSuper}${bottom.toLowerCase()}`;
    }
  }, [bottomText, selectedPreset.id, topText]);

  const renderIcon = (variant: string) => {
    if (variant === "none") return null;
    if (variant === "queen") return <span className="text-[2rem] leading-none">♛</span>;
    if (variant === "king") return <span className="text-[2rem] leading-none">♔</span>;
    return <Crown className="h-8 w-8" strokeWidth={1.8} />;
  };

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
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Criador de textos empilhados</h2>
            <p className="text-sm text-muted-foreground">
              Escolha um modelo pronto inspirado na imagem 00 e troque apenas os textos.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              if (typeof navigator !== "undefined" && navigator.clipboard) {
                navigator.clipboard.writeText(exportText);
              }
            }}
          >
            Copiar texto
          </Button>
        </div>

        <div className="grid gap-4 2xl:grid-cols-[380px_minmax(0,1fr)]">
          <Card className="space-y-4 border-white/10 bg-white/5 p-5 backdrop-blur-sm">
            <div className="space-y-2">
              <Label htmlFor="preset-select">Modelo</Label>
              <select
                id="preset-select"
                value={selectedPresetId}
                onChange={event => setSelectedPresetId(event.target.value)}
                className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
              >
                {TEXT_PRESETS.map(preset => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="space-y-2">
                <Label htmlFor="top-text">Texto de cima</Label>
                <Input
                  id="top-text"
                  value={topText}
                  onChange={event => setTopText(event.target.value)}
                  placeholder="Ex: familia"
                />
                <p className="text-xs text-muted-foreground">
                  Esse texto sera convertido para Unicode pequeno.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bottom-text">Texto de baixo</Label>
                <Input
                  id="bottom-text"
                  value={bottomText}
                  onChange={event => setBottomText(event.target.value)}
                  placeholder="Ex: supreme"
                />
                <p className="text-xs text-muted-foreground">
                  Esse texto sera mantido como base principal do stacked text.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-muted-foreground">
                O resultado final e uma unica string Unicode copiavel, sem duas divs e sem quebra por br.
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="canvas-bg">Fundo</Label>
                <Input
                  id="canvas-bg"
                  type="color"
                  value={canvasBg}
                  onChange={event => setCanvasBg(event.target.value)}
                  className="h-10 p-1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="left-icon">Icone esquerdo</Label>
                <select
                  id="left-icon"
                  value={leftIcon}
                  onChange={event => setLeftIcon(event.target.value)}
                  className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                >
                  <option value="crown">Coroa</option>
                  <option value="king">Rei</option>
                  <option value="queen">Rainha</option>
                  <option value="none">Sem icone</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="right-icon">Icone direito</Label>
                <select
                  id="right-icon"
                  value={rightIcon}
                  onChange={event => setRightIcon(event.target.value)}
                  className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                >
                  <option value="queen">Rainha</option>
                  <option value="king">Rei</option>
                  <option value="crown">Coroa</option>
                  <option value="none">Sem icone</option>
                </select>
              </div>
              <label className="flex items-center gap-2 self-end text-sm">
                <input
                  type="checkbox"
                  checked={showIcons}
                  onChange={event => setShowIcons(event.target.checked)}
                />
                Mostrar icones laterais
              </label>
            </div>
          </Card>

          <Card className="border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.04))] p-5">
            <div
              className={cn(
                "relative min-h-[420px] overflow-hidden rounded-[2.6rem] border border-black/10 shadow-[0_18px_55px_rgba(0,0,0,0.2)]"
              )}
              style={{ backgroundColor: canvasBg }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.8),transparent_52%)]" />
              <div className="absolute inset-[14%_6%] rounded-[2.4rem] border border-black/8" />

              {showIcons ? (
                <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-8 text-black">
                  <div>{renderIcon(leftIcon)}</div>
                  <div>{renderIcon(rightIcon)}</div>
                </div>
              ) : null}

              <pre className="absolute inset-0 z-10 flex items-center justify-center px-16 text-center text-black whitespace-pre-wrap break-words font-semibold">
                {exportText || "Preview do stacked text"}
              </pre>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <p>O preview mostra a string Unicode unica do estilo escolhido.</p>
              <p>{selectedPreset.name}</p>
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">Resultado final em texto</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (typeof navigator !== "undefined" && navigator.clipboard) {
                      navigator.clipboard.writeText(exportText);
                    }
                  }}
                >
                  Copiar resultado
                </Button>
              </div>
              <pre className="min-h-24 whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-background/60 p-3 text-sm text-foreground">
                {exportText || "O resultado em texto vai aparecer aqui quando voce preencher as linhas."}
              </pre>
            </div>
          </Card>
        </div>
      </section>
    );
  }

  return null;
}

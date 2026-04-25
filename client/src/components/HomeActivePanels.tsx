import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Minus, Plus, Crown } from "lucide-react";
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

type StackedTextLine = {
  id: string;
  text: string;
  x: number;
  y: number;
  size: number;
  spacing: number;
  weight: number;
  color: string;
  uppercase: boolean;
};

const createLine = (id: string, overrides?: Partial<StackedTextLine>): StackedTextLine => ({
  id,
  text: "NOVO TEXTO",
  x: 50,
  y: 50,
  size: 28,
  spacing: 0.12,
  weight: 700,
  color: "#111111",
  uppercase: true,
  ...overrides,
});

const STARTER_LINES: StackedTextLine[] = [
  createLine("line-1", { text: "", y: 38, size: 18, spacing: 0.52, weight: 700 }),
  createLine("line-2", { text: "", y: 54, size: 46, spacing: 0.05, weight: 900 }),
];

export default function HomeActivePanels({
  activeSection,
  campeonatos,
  onlinePlayers,
  userRole,
  onRegister,
  onMarkChatAsRead,
}: HomeActivePanelsProps) {
  const [lines, setLines] = useState<StackedTextLine[]>(STARTER_LINES);
  const [selectedLineId, setSelectedLineId] = useState<string>(STARTER_LINES[0].id);
  const [canvasBg, setCanvasBg] = useState("#f7f7f5");
  const [showIcons, setShowIcons] = useState(true);
  const [leftIcon, setLeftIcon] = useState("crown");
  const [rightIcon, setRightIcon] = useState("queen");

  const selectedLine = useMemo(
    () => lines.find(line => line.id === selectedLineId) ?? lines[0] ?? null,
    [lines, selectedLineId]
  );

  const exportText = useMemo(() => {
    const builtLines = lines
      .map((line, index) => {
        const raw = line.text.trim();
        if (!raw) return null;

        const content = line.uppercase ? raw.toUpperCase() : raw;
        const spacingUnits =
          index === 0
            ? Math.max(1, Math.round(line.spacing * 5))
            : Math.max(0, Math.round(line.spacing * 2));
        const gap = " ".repeat(spacingUnits);
        const rendered = content
          .split("\n")
          .map(part => part.split("").join(gap))
          .join("\n");

        const visualWidth = Math.max(
          1,
          Math.round(
            rendered.length +
              line.size * (index === 0 ? 0.18 : 0.34) +
              line.weight / 300
          )
        );

        return {
          rendered,
          visualWidth,
          index,
        };
      })
      .filter(
        (item): item is { rendered: string; visualWidth: number; index: number } =>
          Boolean(item)
      );

    if (builtLines.length === 0) return "";

    if (builtLines.length === 2) {
      const [topLine, bottomLine] = builtLines;
      const baseWidth = Math.max(bottomLine.visualWidth, topLine.visualWidth + 6);
      const topPad = Math.max(0, Math.floor((baseWidth - topLine.visualWidth) / 2));
      const bottomPad = Math.max(0, Math.floor((baseWidth - bottomLine.visualWidth) / 2));
      return `${" ".repeat(topPad)}${topLine.rendered}\n${" ".repeat(bottomPad)}${bottomLine.rendered}`;
    }

    const maxWidth = Math.max(...builtLines.map(item => item.visualWidth));

    return builtLines
      .map(item => {
        const leftPad = Math.max(0, Math.floor((maxWidth - item.visualWidth) / 2));
        return `${" ".repeat(leftPad)}${item.rendered}`;
      })
      .join("\n");
  }, [lines]);

  const updateLine = (lineId: string, updates: Partial<StackedTextLine>) => {
    setLines(current =>
      current.map(line => (line.id === lineId ? { ...line, ...updates } : line))
    );
  };

  const addLine = () => {
    const nextId = `line-${Date.now()}`;
    const nextLine = createLine(nextId, {
      text: `LINHA ${lines.length + 1}`,
      y: Math.min(70, 34 + lines.length * 12),
      size: 24,
      spacing: 0.18,
      weight: 700,
    });
    setLines(current => [...current, nextLine]);
    setSelectedLineId(nextId);
  };

  const removeLine = (lineId: string) => {
    if (lines.length === 1) return;
    const filtered = lines.filter(line => line.id !== lineId);
    setLines(filtered);
    if (selectedLineId === lineId) {
      setSelectedLineId(filtered[0]?.id ?? "");
    }
  };

  const getLinePreviewClassName = (index: number) => {
    if (index === 0) return "max-w-[78%]";
    if (index === 1) return "-mt-2 max-w-full";
    return "-mt-1 max-w-[90%]";
  };

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
              Modelo vazio para voce montar um texto empilhado parecido com a referencia,
              mas com o conteudo que quiser.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={addLine}>
              <Plus className="h-4 w-4" />
              Nova linha
            </Button>
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
        </div>

        <div className="grid gap-4 2xl:grid-cols-[380px_minmax(0,1fr)]">
          <Card className="space-y-4 border-white/10 bg-white/5 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Linhas do layout</p>
              <span className="text-xs text-muted-foreground">
                {lines.length} item(ns)
              </span>
            </div>

            <div className="space-y-2">
              {lines.map((line, index) => (
                <button
                  key={line.id}
                  type="button"
                  onClick={() => setSelectedLineId(line.id)}
                  className={cn(
                    "w-full rounded-xl border px-3 py-3 text-left transition-colors",
                    selectedLineId === line.id
                      ? "border-primary/60 bg-primary/10"
                      : "border-white/10 bg-black/20 hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {line.text || `Linha ${index + 1} vazia`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Bloco alinhado | {line.size}px
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      disabled={lines.length === 1}
                      onClick={event => {
                        event.stopPropagation();
                        removeLine(line.id);
                      }}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  </div>
                </button>
              ))}
            </div>

            {selectedLine ? (
              <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="space-y-2">
                  <Label htmlFor="stacked-text">Texto da linha</Label>
                  <Textarea
                    id="stacked-text"
                    value={selectedLine.text}
                    onChange={event =>
                      updateLine(selectedLine.id, { text: event.target.value })
                    }
                    className="min-h-20 resize-none"
                    placeholder="Digite o texto que voce quiser"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="line-size">Tamanho</Label>
                    <Input
                      id="line-size"
                      type="number"
                      min="10"
                      max="120"
                      value={selectedLine.size}
                      onChange={event =>
                        updateLine(selectedLine.id, {
                          size: Number(event.target.value) || 10,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="line-spacing">Espacamento</Label>
                    <Input
                      id="line-spacing"
                      type="number"
                      min="0"
                      max="1.5"
                      step="0.01"
                      value={selectedLine.spacing}
                      onChange={event =>
                        updateLine(selectedLine.id, {
                          spacing: Number(event.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="line-weight">Peso da fonte</Label>
                    <Input
                      id="line-weight"
                      type="number"
                      min="300"
                      max="900"
                      step="100"
                      value={selectedLine.weight}
                      onChange={event =>
                        updateLine(selectedLine.id, {
                          weight: Number(event.target.value) || 700,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="line-color">Cor</Label>
                    <Input
                      id="line-color"
                      type="color"
                      value={selectedLine.color}
                      onChange={event =>
                        updateLine(selectedLine.id, { color: event.target.value })
                      }
                      className="h-10 p-1"
                    />
                  </div>
                  <div className="sm:col-span-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-muted-foreground">
                    As linhas do preview ficam alinhadas no mesmo bloco para formar uma unica marca, como no modelo da imagem.
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedLine.uppercase}
                    onChange={event =>
                      updateLine(selectedLine.id, {
                        uppercase: event.target.checked,
                      })
                    }
                  />
                  Forcar maiusculas
                </label>
              </div>
            ) : null}

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
              className="relative flex min-h-[420px] items-center justify-center overflow-hidden rounded-[2.6rem] border border-black/10 shadow-[0_18px_55px_rgba(0,0,0,0.2)]"
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

              <div className="relative z-10 flex w-full max-w-[74%] flex-col items-center justify-center text-center leading-none">
                {lines.map((line, index) => (
                  <button
                    key={line.id}
                    type="button"
                    className={cn(
                      "w-full select-none whitespace-pre-wrap bg-transparent text-center outline-none",
                      getLinePreviewClassName(index),
                      selectedLineId === line.id && "rounded-lg ring-2 ring-primary/50 ring-offset-2 ring-offset-transparent"
                    )}
                    style={{
                      color: line.color,
                      fontSize: `${line.size}px`,
                      letterSpacing: `${line.spacing}em`,
                      fontWeight: line.weight,
                      textTransform: line.uppercase ? "uppercase" : "none",
                    }}
                    onClick={() => setSelectedLineId(line.id)}
                  >
                    {line.text || " "}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <p>O preview usa proporcao de logo para deixar as linhas mais unidas.</p>
              <p>{selectedLine ? `Selecionado: ${selectedLine.text || "sem texto"}` : "Sem selecao"}</p>
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

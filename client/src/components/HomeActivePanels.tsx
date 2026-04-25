import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Minus, Plus, Crown } from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useMemo, useRef, useState } from "react";
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
  createLine("top", { text: "TaMiLiA", y: 34, size: 22, spacing: 0.55, weight: 700 }),
  createLine("main", { text: "SUPREME", y: 52, size: 54, spacing: 0.12, weight: 900 }),
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
  const previewRef = useRef<HTMLDivElement | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);

  const selectedLine = useMemo(
    () => lines.find(line => line.id === selectedLineId) ?? lines[0] ?? null,
    [lines, selectedLineId]
  );

  const exportText = useMemo(
    () => lines.map(line => line.text.trim()).filter(Boolean).join("\n"),
    [lines]
  );

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

  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

  const getPointerPosition = (event: PointerEvent | ReactPointerEvent) => {
    const canvas = previewRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    return {
      x: clamp(x, 4, 96),
      y: clamp(y, 8, 92),
    };
  };

  const startDrag = (event: ReactPointerEvent, lineId: string) => {
    const position = getPointerPosition(event);
    const line = lines.find(item => item.id === lineId);
    if (!position || !line) return;

    setSelectedLineId(lineId);
    dragOffsetRef.current = {
      x: position.x - line.x,
      y: position.y - line.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleDrag = (event: ReactPointerEvent, lineId: string) => {
    if (!dragOffsetRef.current) return;
    const position = getPointerPosition(event);
    if (!position) return;
    updateLine(lineId, {
      x: clamp(position.x - dragOffsetRef.current.x, 4, 96),
      y: clamp(position.y - dragOffsetRef.current.y, 8, 92),
    });
  };

  const endDrag = (event: ReactPointerEvent) => {
    dragOffsetRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
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
              Agora voce pode criar do seu jeito: varias linhas, tamanhos diferentes,
              espacamento, cor e posicao livre no preview.
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
                        {line.text || `Linha ${index + 1}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        X {Math.round(line.x)}% • Y {Math.round(line.y)}% • {line.size}px
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
                  <div className="space-y-2">
                    <Label htmlFor="line-x">Posicao X (%)</Label>
                    <Input
                      id="line-x"
                      type="number"
                      min="0"
                      max="100"
                      value={Math.round(selectedLine.x)}
                      onChange={event =>
                        updateLine(selectedLine.id, {
                          x: Number(event.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="line-y">Posicao Y (%)</Label>
                    <Input
                      id="line-y"
                      type="number"
                      min="0"
                      max="100"
                      value={Math.round(selectedLine.y)}
                      onChange={event =>
                        updateLine(selectedLine.id, {
                          y: Number(event.target.value) || 0,
                        })
                      }
                    />
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
              ref={previewRef}
              className="relative min-h-[420px] overflow-hidden rounded-[2.2rem] border border-black/10 shadow-[0_18px_55px_rgba(0,0,0,0.2)]"
              style={{ backgroundColor: canvasBg }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.7),transparent_55%)]" />

              {showIcons ? (
                <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-7 text-black">
                  <div>{renderIcon(leftIcon)}</div>
                  <div>{renderIcon(rightIcon)}</div>
                </div>
              ) : null}

              {lines.map(line => (
                <button
                  key={line.id}
                  type="button"
                  className={cn(
                    "absolute -translate-x-1/2 -translate-y-1/2 cursor-move select-none whitespace-pre-wrap bg-transparent text-center leading-none outline-none",
                    selectedLineId === line.id &&
                      "rounded-lg ring-2 ring-primary/50 ring-offset-2 ring-offset-transparent"
                  )}
                  style={{
                    left: `${line.x}%`,
                    top: `${line.y}%`,
                    color: line.color,
                    fontSize: `${line.size}px`,
                    letterSpacing: `${line.spacing}em`,
                    fontWeight: line.weight,
                    textTransform: line.uppercase ? "uppercase" : "none",
                  }}
                  onClick={() => setSelectedLineId(line.id)}
                  onPointerDown={event => startDrag(event, line.id)}
                  onPointerMove={event => handleDrag(event, line.id)}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                >
                  {line.text}
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <p>Arraste os textos no preview para posicionar livremente.</p>
              <p>{selectedLine ? `Selecionado: ${selectedLine.text || "sem texto"}` : "Sem selecao"}</p>
            </div>
          </Card>
        </div>
      </section>
    );
  }

  return null;
}

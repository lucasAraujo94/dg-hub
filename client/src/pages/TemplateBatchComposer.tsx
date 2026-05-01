import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Download,
  ImagePlus,
  Images,
  Loader2,
  Minus,
  Plus,
  Package,
  Scissors,
  Sparkles,
} from "lucide-react";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

type SourceImage = {
  id: string;
  file: File;
  previewUrl: string;
};

type ProcessedImage = {
  id: string;
  fileName: string;
  cutoutDataUrl: string;
  finalDataUrl: string;
  placement: Placement;
  canvasWidth: number;
  canvasHeight: number;
  renderedWidth: number;
  renderedHeight: number;
};

type Placement = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const DEFAULT_PLACEMENT: Placement = {
  x: 50,
  y: 50,
  width: 40,
  height: 70,
};

const COMPOSER_STEPS = [
  {
    title: "Envie o lote",
    description: "Selecione varias fotos e um unico template base.",
  },
  {
    title: "Remova o fundo",
    description: "O sistema processa tudo em lote antes da edicao.",
  },
  {
    title: "Refine e exporte",
    description: "Reposicione, ajuste a escala e baixe tudo em ZIP.",
  },
];

const EDITOR_SCALE_MIN = 10;
const EDITOR_SCALE_MAX = 100;

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao carregar imagem"));
    img.src = src;
  });

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const fitContain = (
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
) => {
  const ratio = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  return {
    width: sourceWidth * ratio,
    height: sourceHeight * ratio,
  };
};

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

const crc32 = (data: Uint8Array) => {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const createZipBlob = async (files: Array<{ name: string; blob: Blob }>) => {
  const encoder = new TextEncoder();
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = new Uint8Array(await file.blob.arrayBuffer());
    const crc = crc32(data);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);
    localChunks.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralChunks.push(centralHeader);

    offset += localHeader.length + data.length;
  }

  const centralSize = centralChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const endHeader = new Uint8Array(22);
  const endView = new DataView(endHeader.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  const blobParts = [...localChunks, ...centralChunks, endHeader].map(
    chunk => new Uint8Array(chunk)
  );

  return new Blob(blobParts, {
    type: "application/zip",
  });
};

export default function TemplateBatchComposer() {
  const [photos, setPhotos] = useState<SourceImage[]>([]);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templatePreview, setTemplatePreview] = useState<string | null>(null);
  const [placement, setPlacement] = useState<Placement>(DEFAULT_PLACEMENT);
  const [processed, setProcessed] = useState<ProcessedImage[]>([]);
  const [isRendering, setIsRendering] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const processedRef = useRef<ProcessedImage[]>([]);
  const dragStateRef = useRef<{
    action: "move" | "resize";
    itemId: string;
    startClientX: number;
    startClientY: number;
    startPlacementX: number;
    startPlacementY: number;
    startPlacementWidth: number;
    startPlacementHeight: number;
    previewWidth: number;
    previewHeight: number;
    renderedWidth: number;
    renderedHeight: number;
  } | null>(null);
  const removeBackgroundMutation = trpc.imaging.removeBackgroundBatch.useMutation();

  useEffect(() => {
    processedRef.current = processed;
  }, [processed]);

  useEffect(() => {
    return () => {
      photos.forEach(photo => URL.revokeObjectURL(photo.previewUrl));
      if (templatePreview) URL.revokeObjectURL(templatePreview);
    };
  }, [photos, templatePreview]);

  const templateName = useMemo(
    () => (templateFile ? templateFile.name.replace(/\.[^.]+$/, "") : "template"),
    [templateFile]
  );
  const activeItem = useMemo(
    () => processed.find(item => item.id === activeItemId) ?? null,
    [processed, activeItemId]
  );

  const updatePlacement = (key: keyof Placement, value: number) => {
    setPlacement(current => ({ ...current, [key]: value }));
  };

  const updateProcessedPlacement = async (
    itemId: string,
    updater: (placement: Placement) => Placement
  ) => {
    if (!templateFile) return;

    const latestProcessed = processedRef.current;
    const target = latestProcessed.find(item => item.id === itemId);
    if (!target) return;

    const nextPlacement = updater(target.placement);
    const templateSrc = await readFileAsDataUrl(templateFile);
    const rendered = await renderComposite(
      templateSrc,
      target.cutoutDataUrl,
      nextPlacement
    );

    setProcessed(current =>
      current.map(item =>
        item.id === itemId
          ? {
              ...item,
              placement: nextPlacement,
              finalDataUrl: rendered.dataUrl,
              canvasWidth: rendered.canvasWidth,
              canvasHeight: rendered.canvasHeight,
              renderedWidth: rendered.renderedWidth,
              renderedHeight: rendered.renderedHeight,
            }
          : item
      )
    );
  };

  const resetProcessedPlacement = async (itemId: string) => {
    await updateProcessedPlacement(itemId, () => ({ ...DEFAULT_PLACEMENT }));
  };

  const handlePhotosChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    photos.forEach(photo => URL.revokeObjectURL(photo.previewUrl));
    setProcessed([]);
    setPhotos(
      files.map(file => ({
        id: `${file.name}-${file.lastModified}-${file.size}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }))
    );
  };

  const handleTemplateChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (templatePreview) URL.revokeObjectURL(templatePreview);
    setProcessed([]);
    setTemplateFile(file);
    setTemplatePreview(file ? URL.createObjectURL(file) : null);
  };

  const renderComposite = async (
    templateSrc: string,
    cutoutSrc: string,
    currentPlacement: Placement
  ) => {
    const [templateImg, cutoutImg] = await Promise.all([
      loadImage(templateSrc),
      loadImage(cutoutSrc),
    ]);

    const canvas = document.createElement("canvas");
    canvas.width = templateImg.naturalWidth || templateImg.width;
    canvas.height = templateImg.naturalHeight || templateImg.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponivel");

    ctx.drawImage(templateImg, 0, 0, canvas.width, canvas.height);

    const targetWidth = canvas.width * (currentPlacement.width / 100);
    const targetHeight = canvas.height * (currentPlacement.height / 100);
    const fitted = fitContain(
      cutoutImg.naturalWidth || cutoutImg.width,
      cutoutImg.naturalHeight || cutoutImg.height,
      targetWidth,
      targetHeight
    );
    const posX = (canvas.width - fitted.width) * (currentPlacement.x / 100);
    const posY = (canvas.height - fitted.height) * (currentPlacement.y / 100);

    ctx.drawImage(
      cutoutImg,
      clamp(posX, 0, canvas.width - fitted.width),
      clamp(posY, 0, canvas.height - fitted.height),
      fitted.width,
      fitted.height
    );

    return {
      dataUrl: canvas.toDataURL("image/png"),
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      renderedWidth: fitted.width,
      renderedHeight: fitted.height,
    };
  };

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      event.preventDefault();

      const deltaX = event.clientX - dragState.startClientX;
      const deltaY = event.clientY - dragState.startClientY;
      setProcessed(current => {
        return current.map(item => {
          if (item.id !== dragState.itemId) return item;

          if (dragState.action === "move") {
            const availableX = Math.max(1, dragState.previewWidth - dragState.renderedWidth);
            const availableY = Math.max(1, dragState.previewHeight - dragState.renderedHeight);

            return {
              ...item,
              placement: {
                ...item.placement,
                x: clamp(dragState.startPlacementX + (deltaX / availableX) * 100, 0, 100),
                y: clamp(dragState.startPlacementY + (deltaY / availableY) * 100, 0, 100),
              },
            };
          }

          const scaleDelta = Math.max(deltaX / dragState.previewWidth, deltaY / dragState.previewHeight);
          const scale = clamp(1 + scaleDelta, 0.2, 3);
          const nextWidth = clamp(dragState.startPlacementWidth * scale, 5, 100);
          const nextHeight = clamp(dragState.startPlacementHeight * scale, 5, 100);

          return {
            ...item,
            placement: {
              ...item.placement,
              width: nextWidth,
              height: nextHeight,
            },
            renderedWidth: dragState.renderedWidth * (nextWidth / dragState.startPlacementWidth),
            renderedHeight: dragState.renderedHeight * (nextHeight / dragState.startPlacementHeight),
          };
        });
      });
    };

    const handlePointerUp = async () => {
      const dragState = dragStateRef.current;
      if (!dragState || !templateFile) return;

      dragStateRef.current = null;
      setDraggingId(null);
      if (typeof document !== "undefined") {
        document.body.style.overflow = "";
        document.body.style.touchAction = "";
      }

      try {
        const templateSrc = await readFileAsDataUrl(templateFile);
        const target = processedRef.current.find(item => item.id === dragState.itemId);
        if (!target) return;
        const rendered = await renderComposite(
          templateSrc,
          target.cutoutDataUrl,
          target.placement
        );

        setProcessed(current =>
          current.map(item =>
            item.id === dragState.itemId
              ? {
                  ...item,
                  finalDataUrl: rendered.dataUrl,
                  canvasWidth: rendered.canvasWidth,
                  canvasHeight: rendered.canvasHeight,
                  renderedWidth: rendered.renderedWidth,
                  renderedHeight: rendered.renderedHeight,
                }
              : item
          )
        );
      } catch {
        toast.error("Falha ao atualizar a posicao da foto");
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      if (typeof document !== "undefined") {
        document.body.style.overflow = "";
        document.body.style.touchAction = "";
      }
    };
  }, [processed, templateFile]);

  const handleProcess = async () => {
    if (!photos.length) {
      toast.error("Selecione pelo menos uma foto");
      return;
    }
    if (!templateFile) {
      toast.error("Envie um template base");
      return;
    }

    setIsRendering(true);
    setProcessed([]);

    try {
      const payload = await Promise.all(
        photos.map(async photo => {
          const dataUrl = await readFileAsDataUrl(photo.file);
          const [, dataBase64 = ""] = dataUrl.split(",");
          return {
            fileName: photo.file.name,
            mimeType: photo.file.type || "image/png",
            dataBase64,
          };
        })
      );

      const backgroundless = await removeBackgroundMutation.mutateAsync({
        images: payload,
      });

      const templateSrc = await readFileAsDataUrl(templateFile);
      const nextProcessed = await Promise.all(
        backgroundless.map(async item => {
          const initialPlacement = { ...placement };
          const rendered = await renderComposite(templateSrc, item.dataUrl, initialPlacement);

          return {
            id: item.fileName,
            fileName: item.fileName,
            cutoutDataUrl: item.dataUrl,
            finalDataUrl: rendered.dataUrl,
            placement: initialPlacement,
            canvasWidth: rendered.canvasWidth,
            canvasHeight: rendered.canvasHeight,
            renderedWidth: rendered.renderedWidth,
            renderedHeight: rendered.renderedHeight,
          };
        })
      );

      setProcessed(nextProcessed);
      setActiveItemId(nextProcessed[0]?.id ?? null);
      toast.success(`${nextProcessed.length} imagens geradas`);
    } catch (error: any) {
      toast.error(error?.message || "Falha ao processar imagens");
    } finally {
      setIsRendering(false);
    }
  };

  const handleDownloadZip = async () => {
    if (!processed.length) {
      toast.error("Nenhum resultado disponivel");
      return;
    }

    try {
      const files = await Promise.all(
        processed.map(async item => {
          const response = await fetch(item.finalDataUrl);
          const blob = await response.blob();
          const baseName = slugify(item.fileName.replace(/\.[^.]+$/, "")) || "imagem";
          return {
            name: `${templateName}/${baseName}.png`,
            blob,
          };
        })
      );

      const zipBlob = await createZipBlob(files);
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${slugify(templateName) || "resultados"}-lote.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Falha ao gerar ZIP");
    }
  };

  const handleScaleChange = async (itemId: string, nextWidth: number) => {
    await updateProcessedPlacement(itemId, currentPlacement => {
      const boundedWidth = clamp(nextWidth, EDITOR_SCALE_MIN, EDITOR_SCALE_MAX);
      const scaleRatio = boundedWidth / Math.max(currentPlacement.width, 1);
      return {
        ...currentPlacement,
        width: boundedWidth,
        height: clamp(currentPlacement.height * scaleRatio, EDITOR_SCALE_MIN, EDITOR_SCALE_MAX),
      };
    });
  };

  return (
    <div className="safe-shell min-h-screen bg-background text-foreground pb-16">
      <div className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/65 backdrop-blur-xl">
        <div className="container py-4 md:py-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Button asChild variant="outline" className="gap-2 rounded-full">
              <Link href="/">
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold md:text-3xl">
                Compositor em lote
              </h1>
              <p className="text-sm text-muted-foreground">
                Envie varias fotos, remova o fundo e aplique tudo no mesmo template.
              </p>
            </div>
            <Button
              onClick={handleDownloadZip}
              disabled={!processed.length}
              className="gap-2 rounded-2xl bg-[linear-gradient(135deg,#22d3ee,#34d399)] text-slate-950 shadow-[0_16px_40px_rgba(34,211,238,0.22)] disabled:text-slate-950/70"
            >
              <Download className="w-4 h-4" />
              Baixar ZIP
            </Button>
          </div>
        </div>
      </div>

      <div className="container space-y-6 py-6">
        <section className="glass-panel overflow-hidden">
          <div className="grid gap-5 border-b border-white/10 p-5 lg:grid-cols-[minmax(0,1.1fr)_320px] lg:items-center">
            <div className="space-y-3">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-cyan-100">
                <Sparkles className="h-3.5 w-3.5" />
                DG Arena studio
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-white md:text-3xl">
                  Monte lotes prontos para publicar sem sair do fluxo.
                </h2>
                <p className="mt-2 max-w-3xl text-sm text-white/70">
                  Tudo aqui tem funcao: upload em lote, remocao automatica de fundo, ajuste visual por foto e exportacao final organizada em ZIP.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {COMPOSER_STEPS.map(step => (
                <div key={step.title} className="rounded-[22px] border border-white/10 bg-black/22 px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/70">{step.title}</p>
                  <p className="mt-2 text-sm text-white/78">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
          <Card className="border-0 bg-transparent shadow-none">
            <CardHeader>
              <CardTitle>Arquivos</CardTitle>
              <CardDescription>
                Fotos em lote + template base para composicao final.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                  <div className="mb-4 flex items-center gap-2">
                    <Images className="h-4 w-4 text-cyan-300" />
                    <p className="text-sm font-medium text-white">Fotos do lote</p>
                  </div>
                  <Label htmlFor="photos">Fotos</Label>
                  <Input
                    id="photos"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    onChange={handlePhotosChange}
                  />
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG ou WEBP. Ate 20 arquivos por lote.
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                  <div className="mb-4 flex items-center gap-2">
                    <Package className="h-4 w-4 text-emerald-300" />
                    <p className="text-sm font-medium text-white">Template base</p>
                  </div>
                  <Label htmlFor="template">Template</Label>
                  <Input
                    id="template"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleTemplateChange}
                  />
                  <p className="text-xs text-muted-foreground">
                    O template define o tamanho final de todas as imagens.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-border/60 bg-card/50 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <ImagePlus className="h-4 w-4 text-cyan-300" />
                    <h2 className="font-semibold">Fotos selecionadas</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {photos.length ? (
                      photos.map(photo => (
                        <div key={photo.id} className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
                          <img
                            src={photo.previewUrl}
                            alt={photo.file.name}
                            className="aspect-square w-full object-cover"
                          />
                          <p className="truncate px-2 py-2 text-[11px] text-muted-foreground">
                            {photo.file.name}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full rounded-xl border border-dashed border-white/15 p-6 text-sm text-muted-foreground">
                        Nenhuma foto selecionada.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-card/50 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Package className="h-4 w-4 text-emerald-300" />
                    <h2 className="font-semibold">Template</h2>
                  </div>
                  {templatePreview ? (
                    <img
                      src={templatePreview}
                      alt="Template"
                      className="max-h-[360px] w-full rounded-xl border border-white/10 object-contain bg-black/20"
                    />
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/15 p-6 text-sm text-muted-foreground">
                      Nenhum template enviado.
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(6,10,18,0.96),rgba(10,16,28,0.88))] shadow-[0_24px_70px_rgba(0,0,0,0.3)]">
          <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="space-y-3">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-emerald-100">
                <Scissors className="h-3.5 w-3.5" />
                Fluxo de montagem
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-white">
                  Gere o lote e refine cada resultado depois
                </h2>
                <p className="mt-2 max-w-3xl text-sm text-white/70">
                  Primeiro processe as imagens. Depois use o editor visual abaixo para reposicionar, redimensionar e exportar apenas quando tudo estiver pronto.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Button
                variant="outline"
                onClick={() => setPlacement(DEFAULT_PLACEMENT)}
                className="rounded-2xl border-white/15 bg-white/5"
              >
                Restaurar padrao inicial
              </Button>
              <Button
                onClick={handleProcess}
                disabled={isRendering || removeBackgroundMutation.isPending}
                className="gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-white"
              >
                {isRendering || removeBackgroundMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Scissors className="h-4 w-4" />
                )}
                Processar lote
              </Button>
            </div>
          </div>
        </section>

        <Card className="glass-panel">
          <CardHeader>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-cyan-100">
              <Package className="h-3.5 w-3.5" />
              Studio final
            </div>
            <CardTitle className="text-2xl text-white">Resultados prontos para ajuste fino</CardTitle>
            <CardDescription>
              Revise, reposicione e redimensione cada montagem antes de exportar o lote.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activeItem ? (
              <div className="mb-6 rounded-[28px] border border-cyan-300/20 bg-[linear-gradient(145deg,rgba(7,14,24,0.94),rgba(11,20,32,0.92))] p-4 shadow-[0_18px_70px_rgba(8,145,178,0.14)]">
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_320px]">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/70">
                          Editor em foco
                        </p>
                        <h3 className="mt-2 text-xl font-semibold text-white">
                          {activeItem.fileName}
                        </h3>
                        <p className="mt-2 text-sm text-white/65">
                          No celular, use este bloco para editar uma foto por vez com mais precisao.
                        </p>
                      </div>
                      <div className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-cyan-100">
                        Foto ativa
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">Mover</p>
                        <p className="mt-2 text-sm text-white/78">Arraste apenas a pessoa no preview.</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">Escala</p>
                        <p className="mt-2 text-sm text-white/78">Use o slider para ajustar de forma continua.</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">Persistencia</p>
                        <p className="mt-2 text-sm text-white/78">A posicao atual ja entra no ZIP final.</p>
                      </div>
                    </div>
                  </div>

                  <aside className="rounded-[24px] border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/70">
                      Controle rapido
                    </p>
                    <div className="mt-4 space-y-5">
                      <div>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <Label className="text-sm text-white">Escala da foto</Label>
                          <span className="text-sm font-medium text-cyan-100">
                            {Math.round(activeItem.placement.width)}%
                          </span>
                        </div>
                        <Slider
                          min={EDITOR_SCALE_MIN}
                          max={EDITOR_SCALE_MAX}
                          step={1}
                          value={[activeItem.placement.width]}
                          onValueChange={value => {
                            const nextWidth = value[0];
                            if (typeof nextWidth !== "number") return;
                            setProcessed(current =>
                              current.map(item =>
                                item.id !== activeItem.id
                                  ? item
                                  : {
                                      ...item,
                                      placement: {
                                        ...item.placement,
                                        width: nextWidth,
                                        height: clamp(
                                          item.placement.height * (nextWidth / Math.max(item.placement.width, 1)),
                                          EDITOR_SCALE_MIN,
                                          EDITOR_SCALE_MAX
                                        ),
                                      },
                                    }
                              )
                            );
                          }}
                          onValueCommit={async value => {
                            const nextWidth = value[0];
                            if (typeof nextWidth !== "number") return;
                            await handleScaleChange(activeItem.id, nextWidth);
                          }}
                        />
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                        <button
                          type="button"
                          className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-white/15 bg-black/60 px-4 text-sm font-medium text-white shadow-lg backdrop-blur-md transition-transform hover:scale-[1.01]"
                          onClick={async () => {
                            setActiveItemId(activeItem.id);
                            await handleScaleChange(activeItem.id, activeItem.placement.width - 5);
                          }}
                        >
                          <Minus className="mr-2 h-4 w-4" />
                          Diminuir
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/12 px-4 text-sm font-medium text-cyan-50 shadow-lg backdrop-blur-md transition-transform hover:scale-[1.01]"
                          onClick={async () => {
                            setActiveItemId(activeItem.id);
                            await handleScaleChange(activeItem.id, activeItem.placement.width + 5);
                          }}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Aumentar
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-white/15 bg-white/8 px-4 text-sm font-medium text-white/90 shadow-lg backdrop-blur-md transition-transform hover:scale-[1.01]"
                          onClick={async () => {
                            setActiveItemId(activeItem.id);
                            await resetProcessedPlacement(activeItem.id);
                          }}
                        >
                          Resetar foto
                        </button>
                      </div>
                    </div>
                  </aside>
                </div>
              </div>
            ) : null}

            {processed.length ? (
              <div className="mb-5 grid gap-3 rounded-[24px] border border-white/10 bg-white/5 p-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                    Etapa 1
                  </p>
                  <p className="mt-2 text-sm text-white/80">
                    Toque ou clique em um card para colocá-lo em edição.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                    Etapa 2
                  </p>
                  <p className="mt-2 text-sm text-white/80">
                    Arraste somente a pessoa dentro do template para encontrar a posição ideal.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                    Etapa 3
                  </p>
                  <p className="mt-2 text-sm text-white/80">
                    Ajuste o tamanho pelos botões laterais e baixe o ZIP quando terminar.
                  </p>
                </div>
              </div>
            ) : null}

            {processed.length ? (
              <div className="grid gap-5 xl:grid-cols-2">
                {processed.map(item => (
                  <div
                    key={item.id}
                    className={`group relative overflow-hidden rounded-[28px] border p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] transition-all duration-200 ${
                      activeItemId === item.id
                        ? "border-cyan-300/60 bg-[linear-gradient(145deg,rgba(8,16,28,0.98),rgba(16,24,38,0.92))] shadow-[0_24px_90px_rgba(8,145,178,0.18)]"
                        : "border-white/10 bg-[linear-gradient(145deg,rgba(8,12,20,0.94),rgba(14,18,30,0.82))]"
                    }`}
                    onClick={() => setActiveItemId(item.id)}
                  >
                    <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/55 to-transparent" />
                    <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl transition-opacity duration-300 group-hover:opacity-100" />
                    <div className="absolute -bottom-16 -left-12 h-36 w-36 rounded-full bg-emerald-400/10 blur-3xl transition-opacity duration-300 group-hover:opacity-100" />
                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start">
                      <div>
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/70">
                            Composto final
                          </p>
                          <h3 className="mt-2 truncate text-lg font-semibold text-white">
                            {item.fileName}
                          </h3>
                        </div>
                        <button
                          type="button"
                          className={`rounded-full border px-3 py-1 text-[11px] transition-colors ${
                            activeItemId === item.id
                              ? "border-cyan-300/35 bg-cyan-400/15 text-cyan-50"
                              : "border-white/10 bg-white/5 text-white/65 hover:bg-white/10"
                          }`}
                          onClick={event => {
                            event.stopPropagation();
                            setActiveItemId(item.id);
                          }}
                        >
                          {activeItemId === item.id ? "Em edicao" : "Editar esta foto"}
                        </button>
                      </div>
                      <div
                        className={`relative overflow-hidden rounded-xl border border-white/10 bg-black/20 ${
                          draggingId === item.id ? "cursor-grabbing" : "cursor-grab"
                        }`}
                        style={{
                          aspectRatio: `${item.canvasWidth} / ${item.canvasHeight}`,
                          touchAction: "none",
                        }}
                      >
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0))]" />
                        <img
                          src={templatePreview ?? item.finalDataUrl}
                          alt={`${item.fileName} template`}
                          className="absolute inset-0 h-full w-full object-cover"
                          draggable={false}
                          style={{ touchAction: "none" }}
                        />
                        <img
                          src={item.cutoutDataUrl}
                          alt={`${item.fileName} posicionado`}
                          className="absolute select-none object-contain"
                          draggable={false}
                        onPointerDown={event => {
                          event.preventDefault();
                          event.currentTarget.setPointerCapture(event.pointerId);
                          setActiveItemId(item.id);
                          if (typeof document !== "undefined") {
                            document.body.style.overflow = "hidden";
                            document.body.style.touchAction = "none";
                            }
                            const rect = event.currentTarget.parentElement?.getBoundingClientRect();
                            if (!rect) return;
                            dragStateRef.current = {
                              action: "move",
                              itemId: item.id,
                              startClientX: event.clientX,
                              startClientY: event.clientY,
                              startPlacementX: item.placement.x,
                              startPlacementY: item.placement.y,
                              startPlacementWidth: item.placement.width,
                              startPlacementHeight: item.placement.height,
                              previewWidth: rect.width,
                              previewHeight: rect.height,
                              renderedWidth: rect.width * (item.renderedWidth / item.canvasWidth),
                              renderedHeight: rect.height * (item.renderedHeight / item.canvasHeight),
                            };
                            setDraggingId(item.id);
                          }}
                          style={{
                            touchAction: "none",
                            width: `${(item.renderedWidth / item.canvasWidth) * 100}%`,
                            height: `${(item.renderedHeight / item.canvasHeight) * 100}%`,
                            left: `${((item.canvasWidth - item.renderedWidth) * item.placement.x) / item.canvasWidth}%`,
                            top: `${((item.canvasHeight - item.renderedHeight) * item.placement.y) / item.canvasHeight}%`,
                          }}
                        />
                        <div className={`absolute left-3 top-3 rounded-full border px-3 py-1 text-[11px] backdrop-blur-md transition-colors ${
                          activeItemId === item.id
                            ? "border-cyan-300/35 bg-cyan-400/15 text-cyan-50"
                            : "border-white/10 bg-black/45 text-white/70"
                        }`}>
                          Arraste somente a foto
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                            Movimento
                          </p>
                          <p className="mt-2 text-sm text-white/80">
                            Toque ou clique na foto e arraste para reposicionar livremente.
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                            Escala
                          </p>
                          <p className="mt-2 text-sm text-white/80">
                            Use os botoes de tamanho para reduzir ou ampliar sem perder proporcao.
                          </p>
                        </div>
                      </div>
                      </div>

                      <aside className="rounded-[24px] border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/70">
                          Resumo rapido
                        </p>
                        <h4 className="mt-2 text-lg font-semibold text-white">
                          Refino desta foto
                        </h4>
                        <p className="mt-2 text-sm text-white/70">
                          Use este card para entrar em edicao e o painel em foco acima para ajustar com mais precisao.
                        </p>

                        <div className="mt-5 space-y-3">
                          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                            <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                              Escala atual
                            </p>
                            <p className="mt-2 text-lg font-semibold text-cyan-100">
                              {Math.round(item.placement.width)}%
                            </p>
                          </div>
                          <button
                            type="button"
                            className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/12 px-4 text-sm font-medium text-cyan-50 shadow-lg backdrop-blur-md transition-transform hover:scale-[1.01]"
                            onClick={event => {
                              event.stopPropagation();
                              setActiveItemId(item.id);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                          >
                            Abrir editor desta foto
                          </button>
                        </div>

                        <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                            Dica rapida
                          </p>
                          <p className="mt-2 text-sm text-white/80">
                            Arraste no preview e finalize tamanho e reset no editor em foco.
                          </p>
                        </div>
                      </aside>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[28px] border border-dashed border-white/15 bg-[linear-gradient(135deg,rgba(8,12,20,0.7),rgba(8,12,20,0.35))] p-10 text-center">
                <div className="mx-auto flex max-w-md flex-col items-center gap-3">
                  <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-white/55">
                    Editor aguardando lote
                  </div>
                  <h3 className="text-xl font-semibold text-white">
                    Processe as imagens para abrir o studio de edição
                  </h3>
                  <p className="text-sm text-white/65">
                    Assim que o lote for gerado, cada foto aparecerá aqui com preview limpo e painel de ajuste separado.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

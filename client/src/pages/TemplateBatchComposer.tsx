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
  Loader2,
  Package,
  Scissors,
} from "lucide-react";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
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
  const removeBackgroundMutation = trpc.imaging.removeBackgroundBatch.useMutation();

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

  const updatePlacement = (key: keyof Placement, value: number) => {
    setPlacement(current => ({ ...current, [key]: value }));
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
    cutoutSrc: string
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

    const targetWidth = canvas.width * (placement.width / 100);
    const targetHeight = canvas.height * (placement.height / 100);
    const fitted = fitContain(
      cutoutImg.naturalWidth || cutoutImg.width,
      cutoutImg.naturalHeight || cutoutImg.height,
      targetWidth,
      targetHeight
    );
    const posX = (canvas.width - fitted.width) * (placement.x / 100);
    const posY = (canvas.height - fitted.height) * (placement.y / 100);

    ctx.drawImage(
      cutoutImg,
      clamp(posX, 0, canvas.width - fitted.width),
      clamp(posY, 0, canvas.height - fitted.height),
      fitted.width,
      fitted.height
    );

    return canvas.toDataURL("image/png");
  };

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
        backgroundless.map(async item => ({
          id: item.fileName,
          fileName: item.fileName,
          cutoutDataUrl: item.dataUrl,
          finalDataUrl: await renderComposite(templateSrc, item.dataUrl),
        }))
      );

      setProcessed(nextProcessed);
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

  return (
    <div className="safe-shell min-h-screen bg-background text-foreground pb-16">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
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
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Baixar ZIP
            </Button>
          </div>
        </div>
      </div>

      <div className="container space-y-6 py-6">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(360px,0.7fr)]">
          <Card className="border-white/10 bg-black/20">
            <CardHeader>
              <CardTitle>Arquivos</CardTitle>
              <CardDescription>
                Fotos em lote + template base para composicao final.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
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
                <div className="space-y-2">
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

          <Card className="border-white/10 bg-black/20">
            <CardHeader>
              <CardTitle>Posicionamento</CardTitle>
              <CardDescription>
                Ajuste a area de encaixe da imagem recortada dentro do template.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {[
                { key: "x", label: "Posicao X", min: 0, max: 100 },
                { key: "y", label: "Posicao Y", min: 0, max: 100 },
                { key: "width", label: "Largura", min: 10, max: 100 },
                { key: "height", label: "Altura", min: 10, max: 100 },
              ].map(item => (
                <div key={item.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{item.label}</Label>
                    <span className="text-xs text-muted-foreground">
                      {placement[item.key as keyof Placement]}%
                    </span>
                  </div>
                  <Slider
                    min={item.min}
                    max={item.max}
                    step={1}
                    value={[placement[item.key as keyof Placement]]}
                    onValueChange={([value]) =>
                      updatePlacement(item.key as keyof Placement, value)
                    }
                  />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={() => setPlacement(DEFAULT_PLACEMENT)}
                >
                  Restaurar padrao
                </Button>
                <Button
                  onClick={handleProcess}
                  disabled={isRendering || removeBackgroundMutation.isPending}
                  className="gap-2"
                >
                  {isRendering || removeBackgroundMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Scissors className="h-4 w-4" />
                  )}
                  Processar lote
                </Button>
              </div>

              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-cyan-50">
                O redimensionamento mantem a proporcao automaticamente. Largura e altura definem a caixa maxima de encaixe, e a imagem e ajustada por contain dentro dela.
              </div>
            </CardContent>
          </Card>
        </section>

        <Card className="border-white/10 bg-black/20">
          <CardHeader>
            <CardTitle>Resultados</CardTitle>
            <CardDescription>
              Preview do recorte e da composicao final gerada para cada foto.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {processed.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {processed.map(item => (
                  <div
                    key={item.id}
                    className="grid gap-4 rounded-2xl border border-border/60 bg-card/40 p-4 md:grid-cols-2"
                  >
                    <div>
                      <p className="mb-2 text-sm font-medium">Sem fundo</p>
                      <img
                        src={item.cutoutDataUrl}
                        alt={`${item.fileName} sem fundo`}
                        className="w-full rounded-xl border border-white/10 bg-[linear-gradient(45deg,rgba(255,255,255,0.04)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.04)_50%,rgba(255,255,255,0.04)_75%,transparent_75%,transparent)] bg-[length:18px_18px]"
                      />
                    </div>
                    <div>
                      <p className="mb-2 text-sm font-medium">Composto final</p>
                      <img
                        src={item.finalDataUrl}
                        alt={`${item.fileName} final`}
                        className="w-full rounded-xl border border-white/10 bg-black/20"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-muted-foreground">
                Execute o processamento para gerar os previews finais.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

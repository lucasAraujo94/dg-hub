import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Send, Paperclip, X, ArrowLeft, Smile, MessageCircle, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { writeLastSeenChatAt } from "@/lib/chatNotifications";

type DisplayPref = "real" | "hago" | "both";

export default function Chat() {
  const { user, loading } = useAuth({ redirectOnUnauthenticated: true, redirectPath: "#/login" });
  const [mensagemGeral, setMensagemGeral] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [showEmojis, setShowEmojis] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const [displayPref, setDisplayPref] = useState<{ pref: DisplayPref; hago: string }>(() => {
    if (typeof window === "undefined") return { pref: "both", hago: "" };
    try {
      const pref = localStorage.getItem("dg-display-pref") || "both";
      const hago = localStorage.getItem("dg-hago-nickname") || "";
      const safePref = pref === "real" || pref === "hago" || pref === "both" ? (pref as DisplayPref) : "both";
      return { pref: safePref, hago };
    } catch {
      return { pref: "both", hago: "" };
    }
  });

  const emojis = useMemo(
    () => ["😀", "😁", "😂", "🤣", "😅", "😊", "😍", "😘", "🤩", "😎", "🤔", "😴", "😡", "👍", "🙏", "🙌", "🎉", "🔥"],
    []
  );

  useEffect(() => {
    const syncPref = () => {
      if (typeof window === "undefined") return;
      try {
        const pref = localStorage.getItem("dg-display-pref") || "both";
        const hago = localStorage.getItem("dg-hago-nickname") || "";
        const safePref = pref === "real" || pref === "hago" || pref === "both" ? (pref as DisplayPref) : "both";
        setDisplayPref({ pref: safePref, hago });
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", syncPref);
    window.addEventListener("focus", syncPref);
    return () => {
      window.removeEventListener("storage", syncPref);
      window.removeEventListener("focus", syncPref);
    };
  }, []);

  const parseMensagem = (raw: string) => {
    try {
      const obj = JSON.parse(raw);
      if (obj && (obj.text || obj.attachmentUrl)) {
        return {
          text: obj.text || "",
          attachmentUrl: obj.attachmentUrl as string | undefined,
          mimeType: obj.mimeType as string | undefined,
          fileName: obj.fileName as string | undefined,
        };
      }
    } catch {
      /* ignore, plain text */
    }
    return { text: raw };
  };

  const mensagensGeralQuery = trpc.chat.getMensagens.useQuery({ tipo: "geral", limite: 50 }, { refetchOnWindowFocus: false });
  const enviarMensagem = trpc.chat.enviarMensagem.useMutation({
    onSuccess: async () => {
      await mensagensGeralQuery.refetch();
    },
    onError: error => toast.error(error.message || "Falha ao enviar mensagem"),
  });

  const mensagensGeral = mensagensGeralQuery.data ?? [];

  useEffect(() => {
    if (mensagensGeralQuery.isLoading) return;
    const latest = mensagensGeral[mensagensGeral.length - 1];
    const timestamp = latest?.dataEnvio ? new Date(latest.dataEnvio).getTime() : Date.now();
    if (!Number.isNaN(timestamp)) {
      writeLastSeenChatAt(timestamp);
    }
  }, [mensagensGeral, mensagensGeralQuery.isLoading]);

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1] ?? "";
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleEnviarMensagem = async () => {
    const texto = mensagemGeral.trim();
    if (!texto && !arquivo) return;

    let attachmentInput:
      | {
          fileName: string;
          mimeType: string;
          dataBase64: string;
        }
      | undefined;

    if (arquivo) {
      try {
        const dataBase64 = await fileToBase64(arquivo);
        attachmentInput = {
          fileName: arquivo.name,
          mimeType: arquivo.type || "application/octet-stream",
          dataBase64,
        };
      } catch (err) {
        console.error(err);
        toast.error("Falha ao preparar o anexo");
        return;
      }
    }

    await enviarMensagem.mutateAsync({
      tipo: "geral",
      mensagem: texto,
      attachment: attachmentInput,
    });
    setMensagemGeral("");
    setArquivo(null);
    setPreview(null);
    setShowEmojis(false);
  };

  const resolveNome = (u: { name?: string | null; email?: string | null; nickname?: string | null }) => {
    const base = u.name || u.email || "Jogador";
    const nick = u.nickname || displayPref.hago || "";
    if (displayPref.pref === "hago" && nick) return nick;
    if (displayPref.pref === "both" && nick) return `${base} (${nick})`;
    return base;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setArquivo(file);
    const url = URL.createObjectURL(file);
    setPreview(url);
  };

  const handleEmoji = (emoji: string) => {
    setMensagemGeral(prev => prev + emoji);
    setShowEmojis(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], "gravacao.webm", { type: "audio/webm" });
        setArquivo(file);
        const url = URL.createObjectURL(blob);
        setPreview(url);
        chunksRef.current = [];
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível acessar o microfone");
    }
  };

  const stopRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
      setIsRecording(false);
    }
  };

  const renderMensagem = (msg: (typeof mensagensGeral)[number]) => {
    const usuario = (msg as { usuario?: { id?: number; name?: string | null; nickname?: string | null; email?: string | null; avatarUrl?: string | null } }).usuario;
    const parsed = parseMensagem(msg.mensagem);
    const nome = usuario ? resolveNome(usuario) : "Anônimo";
    const avatarUrl = (usuario as { avatarUrl?: string | null } | null | undefined)?.avatarUrl || "";
    const isImage = parsed.attachmentUrl && (parsed.mimeType?.startsWith("image/") ?? false);

    return (
      <div key={msg.id} className="p-3 rounded-lg border border-border/50 bg-card/50 flex gap-3 items-start">
        {avatarUrl ? (
          <img src={avatarUrl} alt={nome} className="h-9 w-9 rounded-full object-cover border border-white/10" />
        ) : (
          <div className="h-9 w-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-sm font-semibold">
            {nome.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="flex-1 space-y-1">
          <div className="text-sm font-semibold">{nome}</div>
          <div className="text-sm text-foreground whitespace-pre-wrap break-words">{parsed.text}</div>
          {parsed.attachmentUrl ? (
            <div className="mt-1">
              {isImage ? (
                <img src={parsed.attachmentUrl} alt={parsed.fileName || "Anexo"} className="max-h-48 rounded-md border border-white/10" />
              ) : parsed.mimeType?.startsWith("audio/") ? (
                <audio controls src={parsed.attachmentUrl} className="w-full">
                  Seu navegador não suporta áudio.
                </audio>
              ) : (
                <a href={parsed.attachmentUrl} target="_blank" rel="noreferrer" className="text-primary text-sm underline">
                  {parsed.fileName || "Ver anexo"}
                </a>
              )}
            </div>
          ) : null}
          <div className="text-[11px] text-muted-foreground">
            {new Date(msg.dataEnvio).toLocaleString("pt-BR")}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/60 backdrop-blur-sm">
        <div className="container flex items-center justify-between py-4 gap-3">
          <Button asChild variant="ghost" className="gap-2">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Link>
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MessageCircle className="h-4 w-4" />
            Chat geral
          </div>
        </div>
      </header>

      <main className="container py-4 sm:py-6 space-y-4">
        <div className="flex flex-col gap-4">
          <div className="flex-1 min-h-[40vh] max-h-[60vh] sm:min-h-[50vh] sm:max-h-[65vh] overflow-y-auto rounded-xl border border-border/60 bg-card/60 p-3 space-y-2">
            {mensagensGeral.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma mensagem ainda.</p>
            ) : (
              mensagensGeral.map(renderMensagem)
            )}
          </div>

          <div className="rounded-xl border border-border/60 bg-card/60 p-3 space-y-3">
            {preview ? (
              <div className="relative inline-block">
                {arquivo?.type.startsWith("audio/") ? (
                  <audio controls src={preview} className="w-full sm:w-64 rounded-md border border-white/10 bg-black/30 p-2" />
                ) : (
                  <img src={preview} alt="Pré-visualização" className="h-32 sm:h-24 rounded-md border border-white/10 object-cover" />
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute -top-2 -right-2 h-7 w-7 rounded-full"
                  onClick={() => {
                    setPreview(null);
                    setArquivo(null);
                    fileInputRef.current && (fileInputRef.current.value = "");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : null}

            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <Input
                placeholder="Digite sua mensagem..."
                value={mensagemGeral}
                onChange={e => setMensagemGeral(e.target.value)}
                className="w-full"
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleEnviarMensagem();
                  }
                }}
              />
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,audio/*"
                onChange={handleFileChange}
              />
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} title="Anexar imagem ou áudio">
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button
                variant={isRecording ? "destructive" : "ghost"}
                size="icon"
                onClick={isRecording ? stopRecording : startRecording}
                title={isRecording ? "Parar gravação" : "Gravar áudio"}
              >
                {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
                <div className="relative">
                  <Button variant="ghost" size="icon" onClick={() => setShowEmojis(s => !s)} title="Emoji">
                    <Smile className="h-4 w-4" />
                  </Button>
                  {showEmojis ? (
                    <div className="absolute right-0 z-10 mt-2 grid grid-cols-5 gap-1 rounded-md border border-border bg-card p-2 text-lg">
                      {emojis.map(em => (
                        <button
                          key={em}
                          className="h-8 w-8 flex items-center justify-center rounded hover:bg-white/10"
                          onClick={() => handleEmoji(em)}
                          type="button"
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <Button onClick={handleEnviarMensagem} disabled={enviarMensagem.isPending}>
                  <Send className="h-4 w-4 mr-1" />
                  Enviar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

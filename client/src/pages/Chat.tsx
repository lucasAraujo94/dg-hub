import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageCircle, Paperclip, X, ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { writeLastSeenChatAt } from "@/lib/chatNotifications";

export default function Chat() {
  const { user, loading } = useAuth({ redirectOnUnauthenticated: true, redirectPath: "#/login" });
  const [mensagemGeral, setMensagemGeral] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const displayPref = useMemo(() => {
    if (typeof window === "undefined") return { pref: "both", hago: "" };
    try {
      const pref = localStorage.getItem("dg-display-pref") || "both";
      const hago = localStorage.getItem("dg-hago-nickname") || "";
      return { pref, hago };
    } catch {
      return { pref: "both", hago: "" };
    }
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
      // plain text
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
  };

  const renderMensagem = (msg: (typeof mensagensGeral)[number]) => {
    const usuario = (msg as { usuario?: { id?: number; name?: string | null; nickname?: string | null; email?: string | null; avatarUrl?: string | null } }).usuario;
    const currentUserName = user?.name || user?.email || undefined;
    const baseName =
      usuario?.name ||
      usuario?.email ||
      (msg.usuarioId && user?.id === msg.usuarioId ? currentUserName : undefined) ||
      `Jogador ${msg.usuarioId ?? "?"}`;
    const hago = usuario?.nickname || (msg.usuarioId && user?.id === msg.usuarioId ? displayPref.hago || user?.nickname || "" : "");
    let displayName = baseName;
    if (displayPref.pref === "hago" && hago) {
      displayName = hago;
    } else if (displayPref.pref === "both" && hago) {
      displayName = `${baseName} (${hago})`;
    }
    const avatarUrl =
      (usuario as any)?.avatarUrl ||
      (msg.usuarioId && user?.id === msg.usuarioId ? (user as any)?.avatarUrl || (user as any)?.avatar : null) ||
      (user as any)?.avatarUrl ||
      (user as any)?.avatar ||
      null;
    const hora = msg.dataEnvio ? new Date(msg.dataEnvio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
    const conteudo = parseMensagem(msg.mensagem);
    return { displayName, hora, conteudo, avatarUrl };
  };

  const loadingGeral = mensagensGeralQuery.isLoading || enviarMensagem.isPending;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container py-6">
          <div className="flex items-center justify-between mb-6">
            <Button
              asChild
              variant="ghost"
              className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-3 py-2 text-sm hover:border-border hover:bg-card"
            >
              <Link href="/">
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </Link>
            </Button>
            <h1 className="text-3xl font-bold gradient-text">Chat da Comunidade</h1>
            <div className="w-20" />
          </div>
          <p className="text-muted-foreground">Interaja com a comunidade.</p>
        </div>
      </div>

      <section className="py-12">
        <div className="container">
          <div className="card-elegant flex flex-col h-96">
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
              {loadingGeral ? (
                <p className="text-sm text-muted-foreground">Carregando chat...</p>
              ) : null}
              {!loadingGeral && mensagensGeral.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
              ) : null}
              {mensagensGeral.map((msg) => {
                const info = renderMensagem(msg);
                return (
                  <div key={msg.id} className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-600 to-cyan-600 flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden">
                      {info.avatarUrl ? (
                        <img src={info.avatarUrl} alt={info.displayName} className="w-full h-full object-cover" />
                      ) : (
                        info.displayName[0]
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">{info.displayName}</span>
                        <span className="text-xs text-muted-foreground">{info.hora}</span>
                      </div>
                      {info.conteudo.text ? <p className="text-sm text-muted-foreground mb-2">{info.conteudo.text}</p> : null}
                      {info.conteudo.attachmentUrl ? (
                        <div className="rounded-md border border-border p-2 max-w-sm bg-card/50">
                          {info.conteudo.mimeType?.startsWith("image/") ? (
                            <img
                              src={info.conteudo.attachmentUrl}
                              alt={info.conteudo.fileName || "Anexo"}
                              className="rounded-md object-cover max-h-64 w-full"
                            />
                          ) : null}
                          <a
                            href={info.conteudo.attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                          >
                            <Paperclip className="w-3 h-3" />
                            {info.conteudo.fileName || "Baixar anexo"}
                          </a>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-4">
              {preview ? (
                <div className="flex items-center gap-3 rounded-md border border-border p-2 bg-card/50">
                  <img src={preview} alt="Pré-visualização" className="h-12 w-12 rounded object-cover" />
                  <span className="text-sm text-muted-foreground truncate flex-1">{arquivo?.name}</span>
                  <Button variant="ghost" size="icon" onClick={() => { setArquivo(null); setPreview(null); }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : null}

              <div className="flex gap-2">
                <label className="inline-flex items-center px-3 rounded-md border border-border bg-card text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                  <Paperclip className="w-4 h-4 mr-2" />
                  Anexar
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setArquivo(file);
                        setPreview(URL.createObjectURL(file));
                      } else {
                        setArquivo(null);
                        setPreview(null);
                      }
                    }}
                  />
                </label>
                <Input
                  placeholder="Digite sua mensagem..."
                  value={mensagemGeral}
                  onChange={e => setMensagemGeral(e.target.value)}
                  className="flex-1 h-14 text-base"
                />
                <Button className="btn-primary" onClick={handleEnviarMensagem} disabled={enviarMensagem.isPending}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 border-t border-border">
        <div className="container">
          <div className="card-elegant">
            <MessageCircle className="w-8 h-8 text-purple-400 mb-4" />
            <h3 className="text-lg font-bold mb-2">Chat Geral</h3>
            <p className="text-sm text-muted-foreground">
              Converse com outros jogadores da comunidade, compartilhe estrategias e faca amizades.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

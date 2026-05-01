import { useEffect, useRef, useState } from "react";
import { Send, Paperclip, X, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { writeLastSeenChatAt } from "@/lib/chatNotifications";
import { SitePage, SiteSection } from "@/components/SitePage";

type DisplayPref = "real" | "hago";

export default function Chat() {
  const { user, loading } = useAuth({ redirectOnUnauthenticated: true, redirectPath: "#/login" });
  const [mensagemGeral, setMensagemGeral] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [displayPref, setDisplayPref] = useState<{ pref: DisplayPref; hago: string }>(() => {
    if (typeof window === "undefined") return { pref: "real", hago: "" };
    try {
      const pref = localStorage.getItem("dg-display-pref") || "real";
      const hago = localStorage.getItem("dg-hago-nickname") || "";
      const safePref = pref === "real" || pref === "hago" ? (pref as DisplayPref) : "real";
      return { pref: safePref, hago };
    } catch {
      return { pref: "real", hago: "" };
    }
  });

  useEffect(() => {
    const syncPref = () => {
      if (typeof window === "undefined") return;
      try {
        const pref = localStorage.getItem("dg-display-pref") || "real";
        const hago = localStorage.getItem("dg-hago-nickname") || "";
        const safePref = pref === "real" || pref === "hago" ? (pref as DisplayPref) : "real";
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
      /* ignore */
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

  const resolveNome = (u: { name?: string | null; email?: string | null; nickname?: string | null }) => {
    const base = u.name || u.email || "Jogador";
    const nick = u.nickname || displayPref.hago || "";
    if (displayPref.pref === "hago" && nick) return nick;
    return base;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setArquivo(file);
    const url = URL.createObjectURL(file);
    setPreview(url);
  };

  const renderMensagem = (msg: (typeof mensagensGeral)[number]) => {
    const usuario = (msg as { usuario?: { name?: string | null; nickname?: string | null; email?: string | null; avatarUrl?: string | null } }).usuario;
    const parsed = parseMensagem(msg.mensagem);
    const nome = usuario ? resolveNome(usuario) : "Anonimo";
    const avatarUrl = (usuario as { avatarUrl?: string | null } | null | undefined)?.avatarUrl || "";
    const isImage = parsed.attachmentUrl && (parsed.mimeType?.startsWith("image/") ?? false);

    return (
      <div key={msg.id} className="flex gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 items-start">
        {avatarUrl ? (
          <img src={avatarUrl} alt={nome} className="h-9 w-9 rounded-full border border-white/10 object-cover" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-sm font-semibold">
            {nome.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="flex-1 space-y-1">
          <div className="text-sm font-semibold text-white">{nome}</div>
          <div className="break-words whitespace-pre-wrap text-sm text-foreground">{parsed.text}</div>
          {parsed.attachmentUrl ? (
            <div className="mt-1">
              {isImage ? (
                <img src={parsed.attachmentUrl} alt={parsed.fileName || "Anexo"} className="max-h-48 rounded-md border border-white/10" />
              ) : (
                <a href={parsed.attachmentUrl} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
                  {parsed.fileName || "Ver anexo"}
                </a>
              )}
            </div>
          ) : null}
          <div className="text-[11px] text-muted-foreground">{new Date(msg.dataEnvio).toLocaleString("pt-BR")}</div>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  return (
    <SitePage
      title="Chat geral"
      description="Converse com a comunidade, compartilhe imagens e mantenha o contexto do DG Arena em um espaco unico."
      badge="Arena social"
      icon={MessageCircle}
    >
      <div className="space-y-6">
        <SiteSection
          title="Sala principal"
          description={`Mensagens recentes do grupo${user?.name ? ` para ${user.name}` : ""}.`}
        >
          <div className="flex flex-col gap-4">
            <div className="min-h-[44vh] max-h-[65vh] space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-black/15 p-3">
              {mensagensGeral.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
              ) : (
                mensagensGeral.map(renderMensagem)
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
              {preview ? (
                <div className="relative inline-block">
                  <img src={preview} alt="Pre-visualizacao" className="h-32 rounded-md border border-white/10 object-cover" />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute -right-2 -top-2 h-7 w-7 rounded-full"
                    onClick={() => {
                      setPreview(null);
                      setArquivo(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  placeholder="Digite sua mensagem..."
                  value={mensagemGeral}
                  onChange={e => setMensagemGeral(e.target.value)}
                  className="w-full"
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleEnviarMensagem();
                    }
                  }}
                />
                <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} title="Anexar imagem">
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button onClick={() => void handleEnviarMensagem()} disabled={enviarMensagem.isPending}>
                    <Send className="mr-1 h-4 w-4" />
                    Enviar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </SiteSection>
      </div>
    </SitePage>
  );
}

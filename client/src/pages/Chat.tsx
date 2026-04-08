import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageCircle, Paperclip, X, ArrowLeft, Smile } from "lucide-react";
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
  const [showEmojis, setShowEmojis] = useState(false);
  const [displayPref, setDisplayPref] = useState<{ pref: "real" | "hago" | "both"; hago: string }>(() => {
    if (typeof window === "undefined") return { pref: "both", hago: "" };
    try {
      const pref = localStorage.getItem("dg-display-pref") || "both";
      const hago = localStorage.getItem("dg-hago-nickname") || "";
      const safePref = pref === "real" || pref === "hago" || pref === "both" ? pref : "both";
      return { pref: safePref, hago };
    } catch {
      return { pref: "both", hago: "" };
    }
  });
  const emojis = useMemo(
    () => ["😀", "😁", "😂", "🤣", "😅", "😊", "😍", "😘", "🤩", "😎", "😇", "🤔", "😴", "😡", "👍", "👎", "🙏", "🙌", "🎉", "🔥"],
    []
  );

  useEffect(() => {
    const syncPref = () => {
      if (typeof window === "undefined") return;
      try {
        const pref = localStorage.getItem("dg-display-pref") || "both";
        const hago = localStorage.getItem("dg-hago-nickname") || "";
        const safePref = pref === "real" || pref === "hago" || pref === "both" ? pref : "both";
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
    setShowEmojis(false);
  };

  const resolveNome = (u: { name?: string | null; email?: string | null; nickname?: string | null }) => {
    const base = u.name || u.email || "Jogador";
    const nick = u.nickname || displayPref.hago || "";
    if (displayPref.pref === "hago" && nick) return nick;
    if (displayPref.pref === "both" && nick) return `${base} (${nick})`;
    return base;
  };

  const renderMensagem = (msg: (typeof mensagensGeral)[number]) => {
    const usuario = (msg as { usuario?: { id?: number; name?: string | null; nickname?: string | null; email?: string | null; avatarUrl?: string | null } }).usuario;
    const currentUserName = user?.name || user?.email || undefined;

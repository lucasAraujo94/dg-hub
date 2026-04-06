import { getCampeonatosParaLembrete, marcarLembreteEnviado } from "../db";
import { sendEmail } from "./email";

const ONE_HOUR_MS = 60 * 60 * 1000;
const WINDOW_MS = ONE_HOUR_MS * 2; // 2h de tolerância
const TARGET_MS = ONE_HOUR_MS * 24;

async function processReminderWindow() {
  const now = Date.now();
  const janelaInicio = new Date(now + TARGET_MS - WINDOW_MS / 2);
  const janelaFim = new Date(now + TARGET_MS + WINDOW_MS / 2);

  const campeonatos = await getCampeonatosParaLembrete(janelaInicio, janelaFim);
  if (!campeonatos.length) return;

  for (const camp of campeonatos) {
    const dataInicio = camp.dataInicio;
    const dataStr = dataInicio ? new Date(dataInicio).toLocaleString("pt-BR") : "Data a definir";
    for (const inscricao of camp.inscricoes) {
      const usuario = (inscricao as any).usuario as
        | { id: number; email?: string | null; name?: string | null; nickname?: string | null; hideEmail?: boolean }
        | undefined;
      if (!usuario?.email) continue;

      const dedup = await marcarLembreteEnviado(usuario.id, camp.id, "24h");
      if (!dedup) continue;

      const destinatarioNome = usuario.nickname
        ? `${usuario.name || usuario.email || "Jogador"} (${usuario.nickname})`
        : usuario.name || usuario.email || "Jogador";

      const subject = `Lembrete: ${camp.nome} começa em 24h`;
      const text = [
        `Olá ${destinatarioNome},`,
        ``,
        `O campeonato "${camp.nome}" começa em ${dataStr}.`,
        `Garanta que suas inscrições e presença estão ok.`,
        ``,
        `- DG Games`,
      ].join("\n");

      await sendEmail({
        to: usuario.email,
        subject,
        text,
      });
    }
  }
}

export function startReminderScheduler() {
  // roda de imediato para pegar campeonatos já na janela
  processReminderWindow().catch(err => console.error("[lembrete] primeira rodada falhou", err));
  // revisita a cada 15 minutos
  setInterval(() => {
    processReminderWindow().catch(err => console.error("[lembrete] erro no ciclo", err));
  }, 15 * 60 * 1000);
}


import { ENV } from "./env";

export type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/**
 * Envia email via SMTP se configurado; caso contrário, faz log de mock.
 * Não interrompe o fluxo em caso de falha, apenas registra o erro.
 */
export async function sendEmail(payload: EmailPayload) {
  const smtpConfigured = Boolean(ENV.smtpHost && ENV.smtpFrom);
  if (!smtpConfigured) {
    console.log("[email:mock]", payload);
    return { sent: false, mocked: true, reason: "SMTP não configurado" } as const;
  }

  try {
    // Importa dinamicamente para não exigir dependência quando não houver SMTP
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: ENV.smtpHost,
      port: ENV.smtpPort || 587,
      secure: false,
      auth: ENV.smtpUser ? { user: ENV.smtpUser, pass: ENV.smtpPass || undefined } : undefined,
    });

    await transporter.sendMail({
      from: ENV.smtpFrom,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html ?? payload.text,
    });

    return { sent: true, mocked: false } as const;
  } catch (error) {
    console.error("[email] Falha ao enviar", error);
    return { sent: false, mocked: false, error } as const;
  }
}


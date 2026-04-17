import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";
import { z } from "zod";
import axios from "axios";
import fs from "fs/promises";
import path from "path";
import {
  creditPixPaymentIfNeeded,
  createPixPaymentRecord,
  getCampeonatos,
  getCampeonatoById,
  createCampeonato,
  inscreverCampeonato,
  getInscricoesCampeonato,
  getRankingPorTipo,
  getEstatisticas,
  criarEstatisticas,
  atualizarEstatisticas,
  getEmblemasPorUsuario,
  getMensagensChat,
  getNotificacoes,
  criarNotificacao,
  getSolicitacoesSaque,
  getAllSolicitacoesSaque,
  getAllPixPayments,
  getExtratoFinanceiro,
  criarSolicitacaoSaque,
  concluirSolicitacaoSaqueComTransferencia,
  getSolicitacaoSaqueById,
  rejeitarSolicitacaoSaque,
  getPartidasCampeonato,
  registrarResultado,
  atualizarRanking,
  conquistarEmblema,
  getUserByEmail,
  createLocalUser,
  setUserRole,
  setUserAsaasCustomerId,
  broadcastTournamentAnnouncement,
  criarMensagemChat,
  setUserAvatar,
  setUserPreferences,
  sortearPartidasCampeonato,
  listUsers,
  getPublicUserById,
  premiarUsuarioInternamente,
  votarEnquete,
  resultadosEnquete,
  criarEnquete,
  excluirEnquete,
  getPixPaymentById,
  syncPixPaymentRecord,
  updateCampeonato,
  deleteCampeonato,
  definirCampeaoCampeonato,
  listUpcomingBirthdays,
} from "./db";
import { sdk } from "./_core/sdk";
import bcrypt from "bcryptjs";
import { storagePut } from "./storage";
import crypto from "crypto";

const { compare, hash } = bcrypt;

const resolvePublicBaseUrl = (req: { headers: Record<string, string | string[] | undefined> }) => {
  const protoHeader = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  const hostHeader = req.headers["x-forwarded-host"] ?? req.headers.host;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  if (host) {
    return `${proto === "http" ? "http" : "https"}://${host}`;
  }
  return `https://${ENV.appId}`;
};

const mapMercadoPagoPix = (payment: any) => {
  const transactionData = payment?.point_of_interaction?.transaction_data ?? {};
  return {
    providerPaymentId: String(payment?.id ?? ""),
    externalReference: payment?.external_reference ? String(payment.external_reference) : null,
    status: String(payment?.status ?? "pending"),
    valor: Number(payment?.transaction_amount ?? 0),
    qrCode: transactionData?.qr_code ?? null,
    qrCodeBase64: transactionData?.qr_code_base64 ?? null,
    ticketUrl: transactionData?.ticket_url ?? null,
    metadataJson: payment?.metadata ? JSON.stringify(payment.metadata) : null,
    rawResponseJson: JSON.stringify(payment),
    approvedAt: payment?.date_approved ? new Date(payment.date_approved) : null,
    expiresAt: payment?.date_of_expiration ? new Date(payment.date_of_expiration) : null,
  };
};

const formatDateOnly = (date: Date) => date.toISOString().slice(0, 10);

const mapAsaasPixPayment = (payment: any) => ({
  providerPaymentId: String(payment?.id ?? ""),
  externalReference: payment?.externalReference ? String(payment.externalReference) : null,
  status: String(payment?.status ?? "PENDING"),
  valor: Number(payment?.value ?? 0),
  qrCode: null,
  qrCodeBase64: null,
  ticketUrl: payment?.invoiceUrl ? String(payment.invoiceUrl) : null,
  metadataJson: null,
  rawResponseJson: JSON.stringify(payment),
  approvedAt: payment?.clientPaymentDate ? new Date(payment.clientPaymentDate) : null,
  expiresAt: payment?.dueDate ? new Date(`${payment.dueDate}T23:59:59Z`) : null,
});

const detectPixKeyType = (
  rawKey: string,
  hint?: string | null
): { key: string; type: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP" } => {
  const key = rawKey.trim();
  const normalized = key.replace(/\s+/g, "");
  const digitsOnly = normalized.replace(/\D/g, "");
  const normalizedHint = hint?.trim().toUpperCase() ?? "";

  if (["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"].includes(normalizedHint)) {
    switch (normalizedHint) {
      case "CPF":
        if (!/^[0-9]{11}$/.test(digitsOnly)) throw new Error("Chave Pix invalida para CPF");
        return { key: digitsOnly, type: "CPF" };
      case "CNPJ":
        if (!/^[0-9]{14}$/.test(digitsOnly)) throw new Error("Chave Pix invalida para CNPJ");
        return { key: digitsOnly, type: "CNPJ" };
      case "EMAIL":
        if (!normalized.includes("@")) throw new Error("Chave Pix invalida para EMAIL");
        return { key: normalized.toLowerCase(), type: "EMAIL" };
      case "PHONE":
        if (/^\+?55[0-9]{11}$/.test(normalized)) {
          return { key: digitsOnly.slice(-11), type: "PHONE" };
        }
        if (!/^[0-9]{11}$/.test(digitsOnly)) throw new Error("Chave Pix invalida para telefone");
        return { key: digitsOnly, type: "PHONE" };
      case "EVP":
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
          throw new Error("Chave Pix invalida para EVP");
        }
        return { key: normalized, type: "EVP" };
    }
  }

  if (normalized.includes("@")) {
    return { key: normalized.toLowerCase(), type: "EMAIL" };
  }
  if (/^[0-9]{11}$/.test(digitsOnly)) {
    return { key: digitsOnly, type: "CPF" };
  }
  if (/^[0-9]{14}$/.test(digitsOnly)) {
    return { key: digitsOnly, type: "CNPJ" };
  }
  if (/^\+?55[0-9]{11}$/.test(normalized)) {
    return { key: digitsOnly.slice(-11), type: "PHONE" };
  }
  if (/^[0-9]{11}$/.test(normalized)) {
    return { key: normalized, type: "PHONE" };
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    return { key: normalized, type: "EVP" };
  }

  throw new Error("Chave Pix invalida para transferencia automatica");
};

const transferWithdrawalViaAsaas = async (params: {
  solicitacaoId: number;
  valor: number;
  pixKey: string;
  pixKeyTypeHint?: string | null;
  usuarioId: number;
}) => {
  if (!ENV.asaasApiKey) {
    throw new Error("ASAAS_API_KEY nao configurado");
  }

  const pix = detectPixKeyType(params.pixKey, params.pixKeyTypeHint);
  const externalReference = `withdraw_${params.solicitacaoId}_${params.usuarioId}`;
  const payload = {
    value: params.valor,
    operationType: "PIX",
    pixAddressKey: pix.key,
    pixAddressKeyType: pix.type,
    description: `Saque automatico DG Hub #${params.solicitacaoId}`,
    externalReference,
  };

  try {
    const response = await axios.post(`${ENV.asaasBaseUrl}/v3/transfers`, payload, {
      headers: {
        access_token: ENV.asaasApiKey,
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("[saques.marcarPago] Asaas transfer failed", {
        status: error.response?.status,
        data: error.response?.data,
        payload,
      });
      const detail =
        typeof error.response?.data === "object" && error.response?.data
          ? JSON.stringify(error.response.data)
          : error.response?.data || error.message;
      throw new Error(`Asaas transfer error: ${detail}`);
    }
    throw error;
  }
};

const ensureUserHasAsaasCustomer = async (user: {
  id: number;
  name?: string | null;
  email?: string | null;
  cpfCnpj?: string | null;
  asaasCustomerId?: string | null;
}) => {
  if (!ENV.asaasApiKey) {
    throw new Error("ASAAS_API_KEY nao configurado");
  }

  const cpfCnpj = user.cpfCnpj?.replace(/\D/g, "") ?? "";
  if (!cpfCnpj || ![11, 14].includes(cpfCnpj.length)) {
    throw new Error("CPF/CNPJ do usuario nao configurado para gerar cobranca Pix");
  }

  if (user.asaasCustomerId) {
    return user.asaasCustomerId;
  }

  const payload = {
    name: user.name?.trim() || user.email?.trim() || `Usuario ${user.id}`,
    cpfCnpj,
    email: user.email?.trim().toLowerCase() || undefined,
    externalReference: `user_${user.id}`,
    notificationDisabled: true,
  };

  try {
    const response = await axios.post(`${ENV.asaasBaseUrl}/v3/customers`, payload, {
      headers: {
        access_token: ENV.asaasApiKey,
        "Content-Type": "application/json",
      },
    });
    const customerId = String(response.data?.id ?? "");
    if (!customerId) {
      throw new Error("Asaas nao retornou customer id");
    }
    await setUserAsaasCustomerId(user.id, customerId);
    return customerId;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const detail =
        typeof error.response?.data === "object" && error.response?.data
          ? JSON.stringify(error.response.data)
          : error.response?.data || error.message;
      throw new Error(`Asaas customer error: ${detail}`);
    }
    throw error;
  }
};

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => {
      if (opts.ctx.user) {
        console.log("[auth.me]", {
          openId: opts.ctx.user.openId,
          hasAvatar: Boolean((opts.ctx.user as any).avatarUrl),
          hasEmail: Boolean(opts.ctx.user.email),
        });
      }
      return opts.ctx.user;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    registerLocal: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string().min(8),
          name: z.string().min(2),
          nickname: z.string().min(2), // Nome no Hago obrigat?rio
        })
      )
      .mutation(async ({ input, ctx }) => {
        const existing = await getUserByEmail(input.email);
        if (existing) {
          throw new Error("E-mail ja cadastrado");
        }

        const passwordHash = await hash(input.password, 10);
        const user = await createLocalUser({
          email: input.email,
          passwordHash,
          name: input.name,
          nickname: input.nickname,
        });

        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name ?? user.email ?? "",
          expiresInMs: ONE_YEAR_MS,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        return { success: true };
      }),
    loginLocal: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(8) }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByEmail(input.email);
        if (!user || !user.passwordHash) {
          throw new Error("Credenciais invalidas");
        }

        const isValid = await compare(input.password, user.passwordHash);
        if (!isValid) {
          throw new Error("Credenciais invalidas");
        }

        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name ?? user.email ?? "",
          expiresInMs: ONE_YEAR_MS,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        return { success: true };
      }),
  }),

  admin: router({
    listUsers: adminProcedure.query(() => listUsers()),
    listSaques: adminProcedure.query(() => getAllSolicitacoesSaque()),
    listPixPayments: adminProcedure.query(() => getAllPixPayments()),
    premiarSaldo: adminProcedure
      .input(
        z.object({
          usuarioId: z.number(),
          valor: z.number().positive(),
          descricao: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return premiarUsuarioInternamente({
          usuarioId: input.usuarioId,
          valor: input.valor,
          descricao: input.descricao,
          createdByUserId: ctx.user?.id ?? null,
        });
      }),
    inscreverUsuarioCampeonato: adminProcedure
      .input(z.object({ usuarioId: z.number(), campeonatoId: z.number() }))
      .mutation(async ({ input }) => {
        await inscreverCampeonato(input.usuarioId, input.campeonatoId);
        return { success: true };
      }),
    sortearPartidas: adminProcedure
      .input(z.object({ campeonatoId: z.number() }))
      .mutation(async ({ input }) => sortearPartidasCampeonato(input.campeonatoId)),
    setRole: adminProcedure
      .input(
        z.object({
          openId: z.string().optional(),
          email: z.string().email().optional(),
          role: z.enum(["user", "admin"]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const isOwner =
          ctx.user?.openId === ENV.ownerOpenId ||
          (!!ENV.ownerEmail && ctx.user?.email?.toLowerCase() === ENV.ownerEmail);
        if (!isOwner) {
          throw new Error("Somente o dono pode alterar permissoes");
        }
        if (!input.openId && !input.email) {
          throw new Error("Informe openId ou email para alterar a permissao");
        }
        return setUserRole({
          openId: input.openId,
          email: input.email,
          role: input.role,
        });
      }),
    broadcastSurpriseTournament: adminProcedure
      .input(
        z
          .object({
            titulo: z.string().optional(),
            mensagem: z.string().optional(),
            hora: z.string().optional(), // HH:mm opcional
          })
          .optional()
      )
      .mutation(async ({ input, ctx }) => {
        const isOwner =
          ctx.user?.openId === ENV.ownerOpenId ||
          (!!ENV.ownerEmail && ctx.user?.email?.toLowerCase() === ENV.ownerEmail);
        if (!isOwner) {
          throw new Error("Somente o dono pode disparar o aviso global");
        }

        const now = new Date();
        const day = now.getDay();
        const daysUntilSaturday = (6 - day + 7) % 7 || 7;
        const nextSaturday = new Date(now);
        nextSaturday.setDate(now.getDate() + daysUntilSaturday);

        if (input?.hora) {
          const [h, m] = input.hora.split(":").map(Number);
          if (!Number.isNaN(h) && !Number.isNaN(m)) {
            nextSaturday.setHours(h, m, 0, 0);
          }
        }

        const titulo = input?.titulo ?? "campeonato";
        const mensagem =
          input?.mensagem ??
          `Campeonato surpresa neste sabado (${nextSaturday.toLocaleDateString()})! Jogo misterioso, prepare-se.`;

        return broadcastTournamentAnnouncement({
          titulo,
          mensagem,
          dataEvento: nextSaturday,
        });
      }),
  }),

  payments: router({
    criarPix: adminProcedure
      .input(
        z.object({
          valor: z.number().positive(),
          usuarioId: z.number(),
          descricao: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ENV.asaasApiKey) {
          throw new Error("ASAAS_API_KEY nao configurado");
        }
        const usuario = await listUsers().then(users => users.find(user => user.id === input.usuarioId));
        if (!usuario) {
          throw new Error("Usuario nao encontrado");
        }
        const customerId = await ensureUserHasAsaasCustomer({
          id: usuario.id,
          name: usuario.name,
          email: usuario.email,
          cpfCnpj: (usuario as any).cpfCnpj,
          asaasCustomerId: (usuario as any).asaasCustomerId,
        });
        const externalReference = `pix_${input.usuarioId}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
        const payload = {
          customer: customerId,
          billingType: "PIX",
          value: input.valor,
          dueDate: formatDateOnly(new Date()),
          description: input.descricao ?? `Deposito PIX - usuario ${input.usuarioId}`,
          externalReference,
        };

        let resp;
        try {
          resp = await axios.post(`${ENV.asaasBaseUrl}/v3/payments`, payload, {
            headers: {
              access_token: ENV.asaasApiKey,
              "Content-Type": "application/json",
            },
          });
        } catch (error) {
          if (axios.isAxiosError(error)) {
            console.error("[payments.criarPix] Asaas create payment failed", {
              status: error.response?.status,
              data: error.response?.data,
              payload,
            });
            const detail =
              typeof error.response?.data === "object" && error.response?.data
                ? JSON.stringify(error.response.data)
                : error.response?.data || error.message;
            throw new Error(`Asaas payment error: ${detail}`);
          }
          throw error;
        }

        const data: any = resp.data;
        const qrResp = await axios.get(`${ENV.asaasBaseUrl}/v3/payments/${data.id}/pixQrCode`, {
          headers: {
            access_token: ENV.asaasApiKey,
          },
        });
        const qrData: any = qrResp.data;
        const created = await createPixPaymentRecord({
          usuarioId: input.usuarioId,
          createdByUserId: ctx.user?.id ?? null,
          provider: "asaas",
          externalReference,
          providerPaymentId: data?.id ? String(data.id) : null,
          status: String(data?.status ?? "PENDING"),
          valor: Number(data?.value ?? input.valor),
          descricao: input.descricao ?? `Deposito PIX - usuario ${input.usuarioId}`,
          qrCode: qrData?.payload ?? null,
          qrCodeBase64: qrData?.encodedImage ?? null,
          ticketUrl: data?.invoiceUrl ?? null,
          metadataJson: null,
          rawResponseJson: JSON.stringify(data),
          approvedAt: data?.clientPaymentDate ? new Date(data.clientPaymentDate) : null,
          expiresAt: qrData?.expirationDate ? new Date(qrData.expirationDate) : null,
        });

        return {
          pixPaymentId: created?.id ?? null,
          id: data?.id,
          externalReference,
          status: data?.status,
          qrCode: qrData?.payload ?? null,
          qrCodeBase64: qrData?.encodedImage ?? null,
          ticketUrl: data?.invoiceUrl ?? null,
        };
      }),
    getPixStatus: adminProcedure
      .input(z.object({ pixPaymentId: z.number() }))
      .query(async ({ input }) => {
        let record = await getPixPaymentById(input.pixPaymentId);
        if (!record) {
          throw new Error("Pagamento PIX nao encontrado");
        }

        if (record.providerPaymentId && ENV.asaasApiKey && !record.creditedAt && record.status !== "RECEIVED") {
          try {
            const paymentResp = await axios.get(`${ENV.asaasBaseUrl}/v3/payments/${record.providerPaymentId}`, {
              headers: { access_token: ENV.asaasApiKey },
            });
            const synced = await syncPixPaymentRecord(mapAsaasPixPayment(paymentResp.data));
            if (synced) {
              record = synced;
            }
            if (record.status === "RECEIVED" && !record.creditedAt && record.providerPaymentId) {
              await creditPixPaymentIfNeeded({
                pixPaymentId: record.id,
                usuarioId: record.usuarioId,
                valor: Number(record.valor),
                providerPaymentId: record.providerPaymentId,
              });
              const refreshed = await getPixPaymentById(record.id);
              if (refreshed) {
                record = refreshed;
              }
            }
          } catch (error) {
            console.warn("[payments.getPixStatus] refresh failed", error);
          }
        }

        if (record.status === "RECEIVED" && !record.creditedAt && record.providerPaymentId) {
          await creditPixPaymentIfNeeded({
            pixPaymentId: record.id,
            usuarioId: record.usuarioId,
            valor: Number(record.valor),
            providerPaymentId: record.providerPaymentId,
          });
          const refreshed = await getPixPaymentById(record.id);
          if (refreshed) {
            record = refreshed;
          }
        }

        return {
          id: record.id,
          usuarioId: record.usuarioId,
          providerPaymentId: record.providerPaymentId,
          externalReference: record.externalReference,
          status: record.status,
          valor: Number(record.valor),
          descricao: record.descricao,
          qrCode: record.qrCode,
          qrCodeBase64: record.qrCodeBase64,
          ticketUrl: record.ticketUrl,
          approvedAt: record.approvedAt,
          creditedAt: record.creditedAt,
          expiresAt: record.expiresAt,
          createdAt: record.createdAt,
        };
      }),
  }),

  profile: router({
    setAvatar: protectedProcedure
      .input(
        z.object({
          fileName: z.string().min(1),
          mimeType: z.string().min(1),
          dataBase64: z.string().min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error("Usuario nao autenticado");

        const allowedMime = ["image/png", "image/jpeg", "image/webp", "audio/mpeg", "audio/webm", "audio/ogg", "audio/mp3"];
        const mime = input.mimeType.toLowerCase();
        if (!allowedMime.includes(mime)) {
          throw new Error("Apenas imagens PNG/JPEG/WEBP ou áudio MP3/OGG/WEBM são permitidos");
        }
        const approxBytes = Math.floor((input.dataBase64.length * 3) / 4); // tamanho estimado
        const MAX_BYTES = 5 * 1024 * 1024; // 5MB para evitar payloads gigantes
        if (approxBytes > MAX_BYTES) {
          throw new Error("Arquivo de avatar muito grande (limite ~5MB)");
        }

        const buffer = Buffer.from(input.dataBase64, "base64");
        const ext = input.fileName.split(".").pop() || "png";
        const safeName = `avatar-${Date.now()}.${ext}`;
        const relKey = `avatars/${ctx.user.id}/${safeName}`;

                        let url: string;
        try {
          // Prefer external storage when configured
          const stored = await storagePut(relKey, buffer, input.mimeType);
          url = stored.url;
        } catch (error) {
          console.warn("[Avatar] Storage upload failed, using inline data URL fallback", error);
          url = `data:${input.mimeType};base64,${input.dataBase64}`;
        }

        // Evita data URL absurda em fallback (mesmo com TEXT). Reusa approxBytes calculado acima.
        if (url.startsWith("data:") && approxBytes > MAX_BYTES) {
          throw new Error("Falha ao salvar avatar: imagem muito grande para fallback (limite ~3MB). Tente novamente ou use uma imagem menor.");
        }

        const updated = await setUserAvatar(ctx.user.id, url);
        return { url: updated.avatarUrl ?? url, avatarUrl: updated.avatarUrl ?? url, id: updated.id };
      }),
    setPreferences: protectedProcedure
      .input(
        z.object({
          nickname: z.string().max(100).nullable().optional(),
          hideEmail: z.boolean().optional(),
          birthDate: z.string().min(10).nullable().optional(),
          cpfCnpj: z.string().max(18).nullable().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error("Usuario nao autenticado");
        let birthDate: Date | null | undefined = undefined;
        if (input.birthDate !== undefined) {
          if (input.birthDate === null || input.birthDate === "") {
            birthDate = null;
          } else {
            const parsed = new Date(`${input.birthDate}T00:00:00Z`);
            if (Number.isNaN(parsed.getTime())) {
              throw new Error("Data de nascimento invalida");
            }
            birthDate = parsed;
          }
        }
        const updated = await setUserPreferences(ctx.user.id, {
          nickname: input.nickname ?? undefined,
          hideEmail: input.hideEmail ?? undefined,
          birthDate,
          cpfCnpj: input.cpfCnpj ?? undefined,
        });
        return updated;
      }),
    birthdays: publicProcedure.query(async () => listUpcomingBirthdays()),
    publicById: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const result = await getPublicUserById(input.userId);
        if (!result) {
          throw new Error("Usuario nao encontrado");
        }
        return result;
      }),
  }),

  poll: router({
    vote: protectedProcedure
      .input(z.object({ pollId: z.number(), escolha: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error("Usuario nao autenticado");
        return votarEnquete(ctx.user.id, input.pollId, input.escolha);
      }),
    results: publicProcedure.query(() => resultadosEnquete()),
    create: adminProcedure
      .input(
        z.object({
          pergunta: z.string().nullable(),
          closesAt: z.date().nullable(),
          options: z.array(z.string().min(1)).min(2).max(6),
        })
      )
      .mutation(({ input }) => criarEnquete(input.pergunta, input.closesAt, input.options)),
    delete: adminProcedure
      .input(z.object({ pollId: z.number() }))
      .mutation(({ input }) => excluirEnquete(input.pollId)),
  }),

  // Campeonatos
  campeonatos: router({
    list: publicProcedure.query(async () => {
      return getCampeonatos();
    }),

    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return getCampeonatoById(input.id);
    }),

    create: adminProcedure
      .input(
        z.object({
          nome: z.string(),
          descricao: z.string().optional(),
          dataInicio: z.date(),
          premioValor: z.number(),
          jogo: z.string().min(2),
        })
      )
      .mutation(async ({ input }) => createCampeonato(input)),
    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          nome: z.string().optional(),
          descricao: z.string().optional(),
          dataInicio: z.date().optional(),
          premioValor: z.number().optional(),
          status: z.string().optional(),
          jogo: z.string().optional(),
          campeaoId: z.number().nullable().optional(),
        })
      )
      .mutation(async ({ input }) => updateCampeonato(input)),
    cancel: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => updateCampeonato({ id: input.id, status: "cancelado" })),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => deleteCampeonato(input.id)),
    definirCampeao: adminProcedure
      .input(z.object({ campeonatoId: z.number(), campeaoId: z.number() }))
      .mutation(async ({ input }) => definirCampeaoCampeonato(input)),

    inscrever: protectedProcedure
      .input(z.object({ campeonatoId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error("Usuario nao autenticado");
        const camp = await getCampeonatoById(input.campeonatoId);
        if (!camp) {
          throw new Error("Campeonato nao encontrado");
        }
        if ((camp as any).status === "cancelado" || (camp as any).status === "finalizado") {
          throw new Error("Inscricoes encerradas para este campeonato");
        }
        if (camp.dataInicio) {
          const start = new Date(camp.dataInicio);
          const startMs = start.getTime();
          if (!Number.isNaN(startMs)) {
            const diff = startMs - Date.now();
            if (diff <= 0) {
              throw new Error("Campeonato ja iniciou ou foi encerrado");
            }
            if (diff < 24 * 60 * 60 * 1000) {
              throw new Error("Inscricoes permitidas somente ate 1 dia antes do inicio");
            }
          }
        }
        await inscreverCampeonato(ctx.user.id, input.campeonatoId);
        await criarNotificacao({
          usuarioId: ctx.user.id,
          mensagem: `Voce se inscreveu em um campeonato!`,
          tipo: "inscricao",
        });
        return { success: true };
      }),

    getParticipantes: publicProcedure
      .input(z.object({ campeonatoId: z.number() }))
      .query(async ({ input }) => {
        return getInscricoesCampeonato(input.campeonatoId);
      }),

    getPartidas: publicProcedure
      .input(z.object({ campeonatoId: z.number() }))
      .query(async ({ input }) => {
        return getPartidasCampeonato(input.campeonatoId);
      }),
  }),

  // Rankings
  rankings: router({
    getByTipo: publicProcedure
      .input(z.object({ tipo: z.enum(["geral", "semanal", "mensal"]), limite: z.number().default(500) }))
      .query(async ({ input }) => {
        return getRankingPorTipo(input.tipo, input.limite);
      }),

    atualizar: protectedProcedure
      .input(z.object({ tipo: z.enum(["geral", "semanal", "mensal"]), pontos: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error("Usuario nao autenticado");
        return atualizarRanking(ctx.user.id, input.tipo, input.pontos);
      }),
  }),

  // Estatisticas
  estatisticas: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new Error("Usuario nao autenticado");
      let stats = await getEstatisticas(ctx.user.id);
      if (!stats) {
        await criarEstatisticas(ctx.user.id);
        stats = await getEstatisticas(ctx.user.id);
      }
      return stats;
    }),

    atualizar: protectedProcedure
      .input(
        z.object({
          vitorias: z.number().optional(),
          derrotas: z.number().optional(),
          sequenciaAtual: z.number().optional(),
          maiorSequencia: z.number().optional(),
          campeonatoVencidos: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error("Usuario nao autenticado");
        return atualizarEstatisticas(ctx.user.id, input);
      }),
  }),

  // Emblemas
  emblemas: router({
    getUsuario: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new Error("Usuario nao autenticado");
      return getEmblemasPorUsuario(ctx.user.id);
    }),

    conquistar: protectedProcedure
      .input(z.object({ emblemaId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error("Usuario nao autenticado");
        return conquistarEmblema(ctx.user.id, input.emblemaId);
      }),
  }),

  // Chat
  chat: router({
    getMensagens: publicProcedure
      .input(z.object({ tipo: z.enum(["geral", "radio"]), limite: z.number().default(50) }))
      .query(async ({ input }) => {
        const mensagens = await getMensagensChat(input.tipo, input.limite);
        return mensagens.reverse();
      }),
    enviarMensagem: protectedProcedure
      .input(
        z.object({
          tipo: z.enum(["geral", "radio"]),
          mensagem: z.string().max(500),
          attachment: z
            .object({
              fileName: z.string().min(1),
              mimeType: z.string().min(1),
              dataBase64: z.string().min(1),
            })
            .optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error("Usuario nao autenticado");
        if (!input.mensagem.trim() && !input.attachment) {
          throw new Error("Envie uma mensagem ou anexe um arquivo");
        }

        let attachmentUrl: string | undefined;
        if (input.attachment) {
          const allowedMime = ["image/png", "image/jpeg", "image/webp", "image/gif", "audio/mpeg", "audio/webm", "audio/ogg", "audio/mp3"];
          if (!allowedMime.includes(input.attachment.mimeType.toLowerCase())) {
            throw new Error("Apenas imagens (png, jpg, webp, gif) são permitidas no chat");
          }
          const approxBytes = Math.floor((input.attachment.dataBase64.length * 3) / 4);
          const MAX_BYTES = 5 * 1024 * 1024; // 5MB
          if (approxBytes > MAX_BYTES) {
            throw new Error("Anexo muito grande (limite 5MB)");
          }

          const ext = input.attachment.fileName.split(".").pop() || "bin";
          const safeName = `chat-${Date.now()}.${ext}`;
          const relKey = `chat/${ctx.user.id}/${safeName}`;
          const buffer = Buffer.from(input.attachment.dataBase64, "base64");
          try {
            const stored = await storagePut(relKey, buffer, input.attachment.mimeType);
            attachmentUrl = stored.url;
          } catch (error) {
            console.warn("[Chat] upload falhou, usando data URL", error);
            attachmentUrl = `data:${input.attachment.mimeType};base64,${input.attachment.dataBase64}`;
          }
        }

        const payload = input.attachment
          ? JSON.stringify({
              text: input.mensagem,
              attachmentUrl,
              mimeType: input.attachment.mimeType,
              fileName: input.attachment.fileName,
            })
          : input.mensagem;

        return criarMensagemChat({
          usuarioId: ctx.user.id,
          tipoChat: input.tipo,
          mensagem: payload,
        });
      }),
  }),

  // Notificacoes
  notificacoes: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new Error("Usuario nao autenticado");
      return getNotificacoes(ctx.user.id);
    }),
  }),

  financeiro: router({
    extrato: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new Error("Usuario nao autenticado");
      return getExtratoFinanceiro(ctx.user.id);
    }),
  }),

  // Saques
  saques: router({
    getSolicitacoes: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new Error("Usuario nao autenticado");
      return getSolicitacoesSaque(ctx.user.id);
    }),

    criar: protectedProcedure
      .input(
        z.object({
          valor: z.number(),
          walletProvider: z.string().min(2),
          walletAddress: z.string().min(4),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error("Usuario nao autenticado");
        const saque = await criarSolicitacaoSaque(ctx.user.id, input.valor, input.walletProvider, input.walletAddress);
        const transfer = await transferWithdrawalViaAsaas({
          solicitacaoId: saque.id,
          usuarioId: saque.usuarioId,
          valor: Number(saque.valor),
          pixKey: saque.walletAddress,
          pixKeyTypeHint: saque.walletProvider,
        });

        const providerStatus = String(transfer?.status ?? "");
        if (providerStatus !== "DONE") {
          throw new Error(`Transferencia Asaas retornou status ${providerStatus || "desconhecido"}`);
        }

        return concluirSolicitacaoSaqueComTransferencia({
          solicitacaoId: saque.id,
          paymentProvider: "asaas",
          providerTransferId: String(transfer?.id ?? ""),
          providerStatus,
          providerResponseJson: JSON.stringify(transfer),
        });
      }),
    rejeitar: adminProcedure
      .input(z.object({ solicitacaoId: z.number() }))
      .mutation(async ({ input }) => rejeitarSolicitacaoSaque(input.solicitacaoId)),
    marcarPago: adminProcedure
      .input(z.object({ solicitacaoId: z.number() }))
      .mutation(async ({ input }) => {
        const saque = await getSolicitacaoSaqueById(input.solicitacaoId);
        if (!saque) {
          throw new Error("Solicitacao de saque nao encontrada");
        }
        if (saque.status === "rejeitado") {
          throw new Error("Saque rejeitado nao pode ser pago");
        }
        if (saque.status === "pago") {
          return saque;
        }
        if (saque.providerTransferId) {
          throw new Error("Esse saque ja possui transferencia registrada");
        }

        const transfer = await transferWithdrawalViaAsaas({
          solicitacaoId: saque.id,
          usuarioId: saque.usuarioId,
          valor: Number(saque.valor),
          pixKey: saque.walletAddress,
          pixKeyTypeHint: saque.walletProvider,
        });

        const providerStatus = String(transfer?.status ?? "");
        if (providerStatus !== "DONE") {
          throw new Error(`Transferencia Asaas retornou status ${providerStatus || "desconhecido"}`);
        }

        return concluirSolicitacaoSaqueComTransferencia({
          solicitacaoId: saque.id,
          paymentProvider: "asaas",
          providerTransferId: String(transfer?.id ?? ""),
          providerStatus,
          providerResponseJson: JSON.stringify(transfer),
        });
      }),
  }),

  // Partidas (Admin)
  partidas: router({
    registrarResultado: adminProcedure
      .input(
        z.object({
          partidaId: z.number(),
          resultado1: z.number(),
          resultado2: z.number(),
          vencedorId: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        await registrarResultado(input.partidaId, input.resultado1, input.resultado2, input.vencedorId);
        // Atualizar estatisticas do vencedor
        await atualizarEstatisticas(input.vencedorId, {
          vitorias: 1,
        });
        // Atualizar ranking
        await atualizarRanking(input.vencedorId, "geral", 10);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;

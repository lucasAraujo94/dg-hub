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
  criarSolicitacaoSaque,
  getPartidasCampeonato,
  registrarResultado,
  atualizarRanking,
  conquistarEmblema,
  getUserByEmail,
  createLocalUser,
  setUserRole,
  broadcastTournamentAnnouncement,
  criarMensagemChat,
  setUserAvatar,
  setUserPreferences,
  sortearPartidasCampeonato,
  listUsers,
  votarEnquete,
  resultadosEnquete,
  criarEnquete,
  excluirEnquete,
  updateCampeonato,
  deleteCampeonato,
  definirCampeaoCampeonato,
} from "./db";
import { sdk } from "./_core/sdk";
import bcrypt from "bcryptjs";
import { storagePut } from "./storage";

const { compare, hash } = bcrypt;

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
        if (!ENV.mpAccessToken) {
          throw new Error("MP_ACCESS_TOKEN nao configurado");
        }
        const payload = {
          transaction_amount: input.valor,
          description: input.descricao ?? `Deposito PIX - usuario ${input.usuarioId}`,
          payment_method_id: "pix",
          payer: {
            email: ctx.user?.email ?? "cliente@example.com",
          },
          metadata: {
            userId: input.usuarioId,
          },
        };

        const resp = await axios.post("https://api.mercadopago.com/v1/payments", payload, {
          headers: {
            Authorization: `Bearer ${ENV.mpAccessToken}`,
            "Content-Type": "application/json",
          },
        });

        const data: any = resp.data;
        const pixInfo = data?.point_of_interaction?.transaction_data;

        return {
          id: data?.id,
          status: data?.status,
          qrCode: pixInfo?.qr_code ?? null,
          qrCodeBase64: pixInfo?.qr_code_base64 ?? null,
          ticketUrl: pixInfo?.ticket_url ?? null,
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

        const allowedMime = ["image/png", "image/jpeg", "image/webp"];
        if (!allowedMime.includes(input.mimeType.toLowerCase())) {
          throw new Error("Apenas imagens PNG, JPEG ou WEBP são permitidas");
        }
        const approxBytes = Math.floor((input.dataBase64.length * 3) / 4); // tamanho estimado
        const MAX_BYTES = 5 * 1024 * 1024; // 5MB
        if (approxBytes > MAX_BYTES) {
          throw new Error("Arquivo de avatar muito grande (limite 5MB)");
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

        await setUserAvatar(ctx.user.id, url);
        return { url };
      }),
    setPreferences: protectedProcedure
      .input(
        z.object({
          nickname: z.string().max(100).nullable().optional(),
          hideEmail: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error("Usuario nao autenticado");
        const updated = await setUserPreferences(ctx.user.id, {
          nickname: input.nickname ?? undefined,
          hideEmail: input.hideEmail ?? undefined,
        });
        return updated;
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
          const allowedMime = ["image/png", "image/jpeg", "image/webp", "image/gif"];
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
        return criarSolicitacaoSaque(ctx.user.id, input.valor, input.walletProvider, input.walletAddress);
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







import { prisma } from "./_core/prisma";
import { ENV } from "./_core/env";
import { Prisma } from "@prisma/client";

type NullableString = string | null | undefined;

export type InsertUser = {
  openId: string;
  name?: NullableString;
  nickname?: NullableString; // Nome no Hago
  email?: NullableString;
  loginMethod?: NullableString;
  passwordHash?: NullableString;
  role?: "user" | "admin";
  lastSignedIn?: Date;
  hideEmail?: boolean;
};

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const normalizedEmail = user.email?.trim().toLowerCase() ?? null;
  const normalizedNickname = user.nickname?.trim() || null;
  const role = user.openId === ENV.ownerOpenId ? ("admin" as const) : user.role;

  const lastSignedIn = user.lastSignedIn ?? new Date();
  const hideEmail = user.hideEmail ?? undefined;

  await prisma.user.upsert({
    where: { openId: user.openId },
    create: {
      openId: user.openId,
      name: user.name ?? null,
      nickname: normalizedNickname ?? user.name ?? null,
      email: normalizedEmail,
      loginMethod: user.loginMethod ?? null,
      passwordHash: user.passwordHash ?? null,
      role: role ?? "user",
      lastSignedIn,
      hideEmail: hideEmail ?? false,
    },
    update: {
      name: user.name ?? undefined,
      nickname: user.nickname !== undefined ? normalizedNickname ?? user.name ?? null : undefined,
      email: normalizedEmail ?? undefined,
      loginMethod: user.loginMethod ?? undefined,
      passwordHash: user.passwordHash ?? undefined,
      role: role ?? undefined,
      lastSignedIn,
      hideEmail,
    },
  });
}

export async function getUserByOpenId(openId: string) {
  return prisma.user.findUnique({ where: { openId } });
}

export async function listUsers() {
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      openId: true,
      name: true,
      nickname: true,
      email: true,
      role: true,
      createdAt: true,
      lastSignedIn: true,
      hideEmail: true,
    },
  });
}

// Poll (enquete)
type PollRow = { id: number; question: string | null; closesAt: Date | null; optionsJson: string | null };

function mapPollRow(row: PollRow) {
  const options = row.optionsJson ? (JSON.parse(row.optionsJson) as string[]) : [];
  return {
    id: row.id,
    question: row.question,
    closesAt: row.closesAt,
    options,
  };
}

export async function criarEnquete(pergunta: string | null, closesAt: Date | null, options: string[]) {
  const sanitized = options
    .map(opt => opt?.trim())
    .filter(Boolean)
    .filter((opt, idx, arr) => arr.indexOf(opt) === idx); // dedup
  if (sanitized.length < 2) {
    throw new Error("Forneça ao menos 2 opções");
  }
  const optionsJson = JSON.stringify(sanitized);

  const result = await prisma.$queryRaw<Array<{ id: number }>>`
    INSERT INTO polls (question, closesAt, createdAt, optionsJson) OUTPUT inserted.id VALUES (${pergunta}, ${closesAt}, GETDATE(), ${optionsJson})
  `;
  const id = result[0]?.id;
  if (!id) throw new Error("Falha ao criar enquete");
  return { id, options: sanitized };
}

async function listarEnquetesAbertas() {
  const rows = await prisma.$queryRaw<Array<PollRow>>`
    SELECT id, question, closesAt, optionsJson
    FROM polls
    WHERE closesAt IS NULL OR closesAt > GETDATE()
    ORDER BY createdAt DESC
  `;
  return rows.map(mapPollRow);
}

export async function votarEnquete(usuarioId: number, pollId: number, escolha: string) {
  const rows = await prisma.$queryRaw<Array<PollRow>>`
    SELECT TOP 1 id, question, closesAt, optionsJson
    FROM polls
    WHERE id = ${pollId} AND (closesAt IS NULL OR closesAt > GETDATE())
  `;
  const poll = rows[0];
  if (!poll) {
    throw new Error("Enquete não encontrada ou encerrada");
  }
  const options = poll.optionsJson ? (JSON.parse(poll.optionsJson) as string[]) : [];
  if (!options.includes(escolha)) {
    throw new Error("Escolha inválida");
  }

  await prisma.$transaction([
    prisma.$executeRaw`DELETE FROM pollVotes WHERE usuarioId = ${usuarioId} AND pollId = ${pollId}`,
    prisma.$executeRaw`INSERT INTO pollVotes (usuarioId, escolha, pollId, createdAt) VALUES (${usuarioId}, ${escolha}, ${pollId}, GETDATE())`,
  ]);
  return { success: true, pollId };
}

export async function resultadosEnquete() {
  const polls = await listarEnquetesAbertas();
  if (!polls.length) return { polls: [] };

  const pollIds = polls.map(p => p.id);
  const voteRows = await prisma.$queryRaw<Array<{ pollId: number; escolha: string; total: bigint }>>`
    SELECT pollId, escolha, COUNT(*) as total
    FROM pollVotes
    WHERE pollId IN (${Prisma.join(pollIds)})
    GROUP BY pollId, escolha
  `;

  const pollsWithCounts = polls.map(p => {
    const counts: Record<string, number> = Object.fromEntries(p.options.map(opt => [opt, 0]));
    voteRows
      .filter(v => v.pollId === p.id)
      .forEach(v => {
        if (counts[v.escolha] !== undefined) {
          counts[v.escolha] = Number(v.total);
        }
      });
    return {
      pollId: p.id,
      question: p.question,
      closesAt: p.closesAt,
      options: p.options,
      counts,
    };
  });

  return { polls: pollsWithCounts };
}

export async function excluirEnquete(pollId: number) {
  await prisma.$transaction([
    prisma.$executeRaw`DELETE FROM pollVotes WHERE pollId = ${pollId}`,
    prisma.$executeRaw`DELETE FROM polls WHERE id = ${pollId}`,
  ]);
  return { success: true };
}

export async function getUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return prisma.user.findUnique({ where: { email: normalizedEmail } });
}

export async function setUserRole(params: { openId?: string; email?: string; role: "user" | "admin" }) {
  const { openId, email, role } = params;
  if (!openId && !email) {
    throw new Error("Provide openId or email to set role");
  }

  const normalizedEmail = email?.trim().toLowerCase();

  const target = await prisma.user.findFirst({
    where: {
      OR: [{ openId: openId || undefined }, { email: normalizedEmail || undefined }],
    },
  });

  if (!target) {
    throw new Error("User not found");
  }

  // Prevent demoting the owner account
  if (target.openId === ENV.ownerOpenId || (ENV.ownerEmail && target.email === ENV.ownerEmail)) {
    if (role !== "admin") {
      throw new Error("Owner role cannot be changed");
    }
  }

  return prisma.user.update({
    where: { id: target.id },
    data: { role },
  });
}

export async function setUserAvatar(userId: number, avatarUrl: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { avatarUrl },
    select: { id: true, avatarUrl: true },
  });
}

export async function setUserPreferences(
  userId: number,
  prefs: { nickname?: string | null; hideEmail?: boolean }
) {
  const normalizedNickname =
    prefs.nickname !== undefined ? (prefs.nickname?.trim() || null) : undefined;
  return prisma.user.update({
    where: { id: userId },
    data: {
      nickname: normalizedNickname,
      hideEmail: prefs.hideEmail ?? undefined,
    },
    select: {
      id: true,
      nickname: true,
      hideEmail: true,
      email: true,
      name: true,
      role: true,
      avatarUrl: true,
      openId: true,
    },
  });
}

export async function createLocalUser(params: {
  email: string;
  passwordHash: string;
  name?: string | null;
  nickname?: string | null;
}) {
  const normalizedEmail = params.email.trim().toLowerCase();
  const openId = `local:${normalizedEmail}`;

  const user = await prisma.user.create({
    data: {
      openId,
      email: normalizedEmail,
      name: params.name ?? params.nickname ?? null,
      nickname: params.nickname ?? params.name ?? null,
      loginMethod: "local",
      passwordHash: params.passwordHash,
      lastSignedIn: new Date(),
    },
  });

  return user;
}

// Campeonatos
export async function getCampeonatos() {
  return prisma.campeonato.findMany({
    orderBy: { dataInicio: "desc" },
    include: {
      _count: { select: { inscricoes: true } },
    },
  });
}

export async function getCampeonatoById(id: number) {
  return prisma.campeonato.findUnique({ where: { id } });
}

export async function createCampeonato(data: {
  nome: string;
  descricao?: string;
  dataInicio: Date;
  premioValor: number;
}) {
  return prisma.campeonato.create({
    data: {
      nome: data.nome,
      descricao: data.descricao ?? null,
      dataInicio: data.dataInicio,
      premioValor: data.premioValor,
    },
  });
}

export async function updateCampeonato(data: {
  id: number;
  nome?: string;
  descricao?: string | null;
  dataInicio?: Date;
  premioValor?: number;
  status?: string;
}) {
  return prisma.campeonato.update({
    where: { id: data.id },
    data: {
      nome: data.nome ?? undefined,
      descricao: data.descricao ?? undefined,
      dataInicio: data.dataInicio ?? undefined,
      premioValor: data.premioValor ?? undefined,
      status: data.status ?? undefined,
    },
  });
}

export async function deleteCampeonato(id: number) {
  return prisma.campeonato.delete({ where: { id } });
}

// Inscrições
export async function inscreverCampeonato(usuarioId: number, campeonatoId: number) {
  return prisma.inscricao.create({ data: { usuarioId, campeonatoId } });
}

export async function getInscricoesCampeonato(campeonatoId: number) {
  return prisma.inscricao.findMany({
    where: { campeonatoId },
    include: {
      usuario: {
        select: {
          id: true,
          name: true,
          nickname: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
  });
}

// Partidas
export async function createPartida(data: {
  campeonatoId: number;
  jogador1Id: number;
  jogador2Id?: number;
  fase: string;
}) {
  return prisma.partida.create({ data });
}

export async function registrarResultado(partidaId: number, resultado1: number, resultado2: number, vencedorId: number) {
  return prisma.partida.update({
    where: { id: partidaId },
    data: {
      resultadoJogador1: resultado1,
      resultadoJogador2: resultado2,
      vencedorId,
      status: "finalizada",
    },
  });
}

export async function getPartidasCampeonato(campeonatoId: number) {
  return prisma.partida.findMany({ where: { campeonatoId } });
}

// Sorteio de partidas para um campeonato (parâmetro: campeonatoId)
export async function sortearPartidasCampeonato(campeonatoId: number) {
  const inscritos = await prisma.inscricao.findMany({
    where: { campeonatoId },
    select: { usuarioId: true },
  });

  if (inscritos.length < 2) {
    throw new Error("É necessário ao menos 2 inscritos para sortear partidas.");
  }

  // Embaralha inscritos de forma simples
  const shuffled = [...inscritos];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Remove partidas antigas para re-sortear
  await prisma.partida.deleteMany({ where: { campeonatoId } });

  const partidasData: Prisma.PartidaCreateManyInput[] = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    const jogador1Id = shuffled[i]?.usuarioId;
    const jogador2Id = shuffled[i + 1]?.usuarioId ?? null;
    partidasData.push({
      campeonatoId,
      jogador1Id,
      jogador2Id,
      fase: "fase 1",
      status: "agendada",
    });
  }

  await prisma.partida.createMany({ data: partidasData });
  return { partidasCriadas: partidasData.length };
}

// Rankings
export async function atualizarRanking(usuarioId: number, tipo: "geral" | "semanal" | "mensal", pontos: number) {
  return prisma.ranking.upsert({
    where: {
      usuarioId_tipoRanking: {
        usuarioId,
        tipoRanking: tipo,
      },
    },
    create: {
      usuarioId,
      tipoRanking: tipo,
      pontuacao: pontos,
    },
    update: {
      pontuacao: pontos,
    },
  });
}

export async function getRankingPorTipo(tipo: "geral" | "semanal" | "mensal", limite: number = 10) {
  return prisma.ranking.findMany({
    where: { tipoRanking: tipo },
    orderBy: { pontuacao: "desc" },
    take: limite,
    include: {
      usuario: {
        select: {
          id: true,
          name: true,
          nickname: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
  });
}

// Estatísticas
export async function criarEstatisticas(usuarioId: number) {
  return prisma.estatistica.create({ data: { usuarioId } });
}

export async function atualizarEstatisticas(
  usuarioId: number,
  data: {
    vitorias?: number;
    derrotas?: number;
    sequenciaAtual?: number;
    maiorSequencia?: number;
    campeonatoVencidos?: number;
  }
) {
  const updateData: Record<string, unknown> = { ...data };
  if (data.vitorias !== undefined && data.derrotas !== undefined) {
    const total = (data.vitorias || 0) + (data.derrotas || 0);
    updateData.aproveitamento = total > 0 ? ((data.vitorias || 0) / total) * 100 : 0;
    updateData.partidasJogadas = total;
  }

  return prisma.estatistica.update({
    where: { usuarioId },
    data: updateData,
  });
}

export async function getEstatisticas(usuarioId: number) {
  return prisma.estatistica.findUnique({ where: { usuarioId } });
}

// Emblemas
export async function criarEmblema(data: { nome: string; descricao?: string; iconeUrl?: string; tipo: string }) {
  return prisma.emblema.create({
    data: {
      nome: data.nome,
      descricao: data.descricao ?? null,
      iconeUrl: data.iconeUrl ?? null,
      tipo: data.tipo,
    },
  });
}

export async function conquistarEmblema(usuarioId: number, emblemaId: number) {
  const existing = await prisma.usuarioEmblema.findFirst({
    where: { usuarioId, emblemaId },
  });

  if (!existing) {
    return prisma.usuarioEmblema.create({ data: { usuarioId, emblemaId } });
  }
  return existing;
}

export async function getEmblemasPorUsuario(usuarioId: number) {
  return prisma.usuarioEmblema.findMany({
    where: { usuarioId },
    include: {
      emblema: {
        select: {
          id: true,
          nome: true,
          descricao: true,
          iconeUrl: true,
          tipo: true,
        },
      },
    },
  });
}

// Chat
export async function criarMensagemChat(data: { usuarioId?: number; tipoChat: "geral" | "radio"; mensagem: string }) {
  return prisma.chatMensagem.create({
    data: {
      usuarioId: data.usuarioId,
      tipoChat: data.tipoChat,
      mensagem: data.mensagem,
    },
  });
}

export async function getMensagensChat(tipoChat: "geral" | "radio", limite: number = 50) {
  const vinteQuatroHorasAtras = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return prisma.chatMensagem.findMany({
    where: { tipoChat, dataEnvio: { gte: vinteQuatroHorasAtras } },
    orderBy: { dataEnvio: "desc" },
    take: limite,
    include: {
      usuario: {
        select: {
          id: true,
          name: true,
          nickname: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
  });
}

// Notificações
export async function criarNotificacao(data: { usuarioId: number; mensagem: string; tipo: string }) {
  return prisma.notificacao.create({
    data: {
      usuarioId: data.usuarioId,
      mensagem: data.mensagem,
      tipo: data.tipo,
    },
  });
}

// Crédito de saldo para usuários (somente admin chama)
export async function creditarSaldo(usuarioId: number, valor: number) {
  if (valor <= 0) {
    throw new Error("Valor deve ser positivo");
  }
  return prisma.user.update({
    where: { id: usuarioId },
    data: { saldoPremio: { increment: valor } },
    select: { id: true, saldoPremio: true },
  });
}

export async function getNotificacoes(usuarioId: number) {
  return prisma.notificacao.findMany({
    where: { usuarioId },
    orderBy: { dataEnvio: "desc" },
  });
}

// Broadcast notification for all users
export async function broadcastTournamentAnnouncement(params: { titulo?: string; mensagem?: string; dataEvento: Date }) {
  const users = await prisma.user.findMany({ select: { id: true } });
  if (users.length === 0) return { inserted: 0 };

  const message =
    params.mensagem ?? `Campeonato surpresa neste sábado (${params.dataEvento.toLocaleDateString()})! Partida especial às 18h.`;

  const created = await prisma.notificacao.createMany({
    data: users.map(u => ({
      usuarioId: u.id,
      mensagem: message,
      tipo: params.titulo ?? "campeonato",
    })),
  });

  return { inserted: created.count };
}

// Saques
export async function criarSolicitacaoSaque(usuarioId: number, valor: number, walletProvider: string, walletAddress: string) {
  return prisma.solicitacaoSaque.create({
    data: {
      usuarioId,
      valor,
      walletProvider,
      walletAddress,
      status: "solicitado",
    },
  });
}

export async function getSolicitacoesSaque(usuarioId: number) {
  return prisma.solicitacaoSaque.findMany({
    where: { usuarioId },
    orderBy: { dataSolicitacao: "desc" },
  });
}

import { prisma, Prisma } from "./_core/prisma";
import { ENV } from "./_core/env";

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
      avatarUrl: true,
      birthDate: true,
    },
  });
}

export async function getPublicUserById(userId: number) {
  const [user, rankingGeral] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        nickname: true,
        avatarUrl: true,
        createdAt: true,
        lastSignedIn: true,
        role: true,
      },
    }),
    getRankingPorTipo("geral", 0),
  ]);
  if (!user) return null;

  const rankingEntry = rankingGeral.find(entry => entry.usuarioId === userId);
  const wins = rankingEntry?.wins ?? rankingEntry?.campeonatosCampeao?.length ?? 0;
  const campeonatosCampeao = rankingEntry?.campeonatosCampeao ?? [];

  return {
    id: user.id,
    name: user.name,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    lastSignedIn: user.lastSignedIn,
    role: user.role,
    ranking: {
      posicao: rankingEntry ? rankingGeral.findIndex(item => item.usuarioId === userId) + 1 : null,
      pontos: rankingEntry?.pontuacao ?? 0,
      wins,
      campeonatos: campeonatosCampeao,
    },
  };
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
    INSERT INTO "polls" ("question", "closesAt", "createdAt", "optionsJson")
    VALUES (${pergunta}, ${closesAt}, NOW(), ${optionsJson})
    RETURNING id
  `;
  const id = result[0]?.id;
  if (!id) throw new Error("Falha ao criar enquete");
  return { id, options: sanitized };
}

async function listarEnquetesAbertas() {
  const rows = await prisma.$queryRaw<Array<PollRow>>`
    SELECT "id", "question", "closesAt", "optionsJson"
    FROM "polls"
    WHERE "closesAt" IS NULL OR "closesAt" > NOW()
    ORDER BY "createdAt" DESC
  `;
  return rows.map(mapPollRow);
}

export async function votarEnquete(usuarioId: number, pollId: number, escolha: string) {
  const rows = await prisma.$queryRaw<Array<PollRow>>`
    SELECT "id", "question", "closesAt", "optionsJson"
    FROM "polls"
    WHERE "id" = ${pollId} AND ("closesAt" IS NULL OR "closesAt" > NOW())
    LIMIT 1
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
    prisma.$executeRaw`DELETE FROM "pollVotes" WHERE "usuarioId" = ${usuarioId} AND "pollId" = ${pollId}`,
    prisma.$executeRaw`INSERT INTO "pollVotes" ("usuarioId", "escolha", "pollId", "createdAt") VALUES (${usuarioId}, ${escolha}, ${pollId}, NOW())`,
  ]);
  return { success: true, pollId };
}

export async function resultadosEnquete() {
  const polls = await listarEnquetesAbertas();
  if (!polls.length) return { polls: [] };

  const pollIds = polls.map(p => p.id);
  const voteRows = await prisma.$queryRaw<Array<{ pollId: number; escolha: string; total: bigint }>>`
    SELECT "pollId", "escolha", COUNT(*) as total
    FROM "pollVotes"
    WHERE "pollId" IN (${Prisma.join(pollIds)})
    GROUP BY "pollId", "escolha"
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
    prisma.$executeRaw`DELETE FROM "pollVotes" WHERE "pollId" = ${pollId}`,
    prisma.$executeRaw`DELETE FROM "polls" WHERE "id" = ${pollId}`,
  ]);
  return { success: true };
}

export async function getUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return prisma.user.findFirst({ where: { email: normalizedEmail } });
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
  prefs: { nickname?: string | null; hideEmail?: boolean; birthDate?: Date | null }
) {
  const normalizedNickname =
    prefs.nickname !== undefined ? (prefs.nickname?.trim() || null) : undefined;
  const birthDate = prefs.birthDate ?? undefined;
  return prisma.user.update({
    where: { id: userId },
    data: {
      nickname: normalizedNickname,
      hideEmail: prefs.hideEmail ?? undefined,
      birthDate,
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
      birthDate: true,
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

export async function listUpcomingBirthdays() {
  const users = await prisma.user.findMany({
    where: { birthDate: { not: null } },
    select: { id: true, name: true, nickname: true, avatarUrl: true, birthDate: true },
  });
  const today = new Date();
  const todayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const toStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

  const enriched = users
    .filter(u => u.birthDate)
    .map(u => {
      const birth = u.birthDate as Date;
      const next = new Date(Date.UTC(today.getUTCFullYear(), birth.getUTCMonth(), birth.getUTCDate()));
      if (next < todayStart) {
        next.setUTCFullYear(next.getUTCFullYear() + 1);
      }
      const diffMs = toStart(next).getTime() - todayStart.getTime();
      const daysUntil = Math.round(diffMs / (1000 * 60 * 60 * 24));
      return {
        id: u.id,
        name: u.name,
        nickname: u.nickname,
        avatarUrl: u.avatarUrl,
        birthDate: birth,
        month: birth.getUTCMonth() + 1,
        day: birth.getUTCDate(),
        daysUntil,
        isToday: daysUntil === 0,
      };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);

  return enriched;
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
  jogo: string;
}) {
  return prisma.campeonato.create({
    data: {
      nome: data.nome,
      descricao: data.descricao ?? null,
      dataInicio: data.dataInicio,
      premioValor: data.premioValor,
      jogo: data.jogo,
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
  jogo?: string;
  campeaoId?: number | null;
}) {
  return prisma.campeonato.update({
    where: { id: data.id },
    data: {
      nome: data.nome ?? undefined,
      descricao: data.descricao ?? undefined,
      dataInicio: data.dataInicio ?? undefined,
      premioValor: data.premioValor ?? undefined,
      status: data.status ?? undefined,
      jogo: data.jogo ?? undefined,
      campeaoId: data.campeaoId !== undefined ? data.campeaoId : undefined,
    },
  });
}

export async function deleteCampeonato(id: number) {
  return prisma.$transaction(async tx => {
    await tx.partida.deleteMany({ where: { campeonatoId: id } });
    await tx.inscricao.deleteMany({ where: { campeonatoId: id } });
    await tx.chaveamento.deleteMany({ where: { campeonatoId: id } });
    return tx.campeonato.delete({ where: { id } });
  });
}

// Inscrições
export async function inscreverCampeonato(usuarioId: number, campeonatoId: number) {
  const existente = await prisma.inscricao.findFirst({
    where: { usuarioId, campeonatoId },
    select: { id: true },
  });
  if (existente) {
    throw new Error("Usuario ja inscrito neste campeonato");
  }
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

export async function definirCampeaoCampeonato(params: { campeonatoId: number; campeaoId: number }) {
  return prisma.$transaction(async tx => {
    const camp = await tx.campeonato.update({
      where: { id: params.campeonatoId },
      data: { campeaoId: params.campeaoId, status: "finalizado" },
    });

    await tx.ranking.upsert({
      where: { usuarioId_tipoRanking: { usuarioId: params.campeaoId, tipoRanking: "geral" } },
      create: { usuarioId: params.campeaoId, tipoRanking: "geral", pontuacao: 100 },
      update: { pontuacao: { increment: 100 } },
    });

    await tx.estatistica.upsert({
      where: { usuarioId: params.campeaoId },
      create: { usuarioId: params.campeaoId, campeonatoVencidos: 1 },
      update: { campeonatoVencidos: { increment: 1 } },
    });

    return camp;
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

  const partidasData: Array<{
    campeonatoId: number;
    jogador1Id: number;
    jogador2Id: number | null;
    fase: string;
    status: string;
  }> = [];
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
      pontuacao: { increment: pontos },
    },
  });
}

export async function getRankingPorTipo(tipo: "geral" | "semanal" | "mensal", limite: number = 10) {
  // Busca ranking existente e todos os usuários para garantir que todos apareçam (mesmo com 0 pontos)
  const [rankingRows, usuarios, campeonatosVencidos] = await Promise.all([
    prisma.ranking.findMany({
      where: { tipoRanking: tipo },
      select: { usuarioId: true, pontuacao: true },
    }),
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        nickname: true,
        email: true,
        avatarUrl: true,
        role: true,
      },
    }),
    prisma.campeonato.findMany({
      where: { campeaoId: { not: null } },
      select: { id: true, nome: true, jogo: true, campeaoId: true },
    }),
  ]);

  const rankingMap = new Map<number, number>();
  rankingRows.forEach(row => rankingMap.set(row.usuarioId, Number(row.pontuacao)));

  const campeaoMap = new Map<number, Array<{ id: number; nome: string; jogo: string }>>();
  campeonatosVencidos.forEach(camp => {
    if (!camp.campeaoId) return;
    const list = campeaoMap.get(camp.campeaoId) ?? [];
    list.push({ id: camp.id, nome: camp.nome, jogo: camp.jogo });
    campeaoMap.set(camp.campeaoId, list);
  });

  const entries = usuarios.map(user => {
    const campeaoWins = campeaoMap.get(user.id) ?? [];
    // Se não existir linha na tabela de ranking, assume 0 + (100 * títulos ganhos)
    const pontosBase = rankingMap.get(user.id) ?? 0;
    const pontos = pontosBase > 0 ? pontosBase : campeaoWins.length * 100;
    return {
      usuarioId: user.id,
      pontuacao: pontos,
      usuario: user,
      campeonatosCampeao: campeaoWins,
      wins: campeaoWins.length,
    };
  });

  const ordenado = entries.sort((a, b) => b.pontuacao - a.pontuacao || (a.usuarioId - b.usuarioId));
  return limite > 0 ? ordenado.slice(0, limite) : ordenado;
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
  if (valor <= 0) {
    throw new Error("Valor do saque deve ser positivo");
  }

  return prisma.$transaction(async tx => {
    const user = await tx.user.findUnique({
      where: { id: usuarioId },
      select: { id: true, saldoPremio: true },
    });

    if (!user) {
      throw new Error("Usuario nao encontrado");
    }

    const saldoAtual = Number(user.saldoPremio);
    if (saldoAtual < valor) {
      throw new Error("Saldo insuficiente para solicitar o saque");
    }

    const saque = await tx.solicitacaoSaque.create({
      data: {
        usuarioId,
        valor,
        walletProvider,
        walletAddress,
        status: "solicitado",
      },
    });

    await tx.notificacao.create({
      data: {
        usuarioId,
        tipo: "saque_solicitado",
        mensagem: `Solicitacao de saque recebida: R$ ${valor.toFixed(2)}`,
      },
    });

    return saque;
  });
}

export async function getSolicitacoesSaque(usuarioId: number) {
  return prisma.solicitacaoSaque.findMany({
    where: { usuarioId },
    orderBy: { dataSolicitacao: "desc" },
  });
}

export async function getAllSolicitacoesSaque() {
  return prisma.solicitacaoSaque.findMany({
    orderBy: { dataSolicitacao: "desc" },
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

export async function aprovarSolicitacaoSaque(solicitacaoId: number) {
  return prisma.$transaction(async tx => {
    const saque = await tx.solicitacaoSaque.findUnique({
      where: { id: solicitacaoId },
      select: {
        id: true,
        usuarioId: true,
        status: true,
        valor: true,
      },
    });

    if (!saque) {
      throw new Error("Solicitacao de saque nao encontrada");
    }
    if (saque.status === "pago") {
      throw new Error("Solicitacao ja foi paga");
    }
    if (saque.status === "rejeitado") {
      throw new Error("Solicitacao rejeitada nao pode ser aprovada");
    }
    if (saque.status === "aprovado") {
      return saque;
    }

    const updated = await tx.solicitacaoSaque.update({
      where: { id: solicitacaoId },
      data: { status: "aprovado" },
    });

    await tx.notificacao.create({
      data: {
        usuarioId: saque.usuarioId,
        tipo: "saque_aprovado",
        mensagem: `Seu saque de R$ ${Number(saque.valor).toFixed(2)} foi aprovado e aguarda pagamento.`,
      },
    });

    return updated;
  });
}

export async function rejeitarSolicitacaoSaque(solicitacaoId: number) {
  return prisma.$transaction(async tx => {
    const saque = await tx.solicitacaoSaque.findUnique({
      where: { id: solicitacaoId },
      select: {
        id: true,
        usuarioId: true,
        status: true,
        valor: true,
      },
    });

    if (!saque) {
      throw new Error("Solicitacao de saque nao encontrada");
    }
    if (saque.status === "rejeitado") {
      return saque;
    }
    if (saque.status === "pago") {
      throw new Error("Saque pago nao pode ser rejeitado");
    }

    const updated = await tx.solicitacaoSaque.update({
      where: { id: solicitacaoId },
      data: { status: "rejeitado" },
    });

    await tx.notificacao.create({
      data: {
        usuarioId: saque.usuarioId,
        tipo: "saque_rejeitado",
        mensagem: `Seu saque de R$ ${Number(saque.valor).toFixed(2)} foi rejeitado.`,
      },
    });

    return updated;
  });
}

export async function marcarSolicitacaoSaqueComoPaga(solicitacaoId: number) {
  return prisma.$transaction(async tx => {
    const saque = await tx.solicitacaoSaque.findUnique({
      where: { id: solicitacaoId },
      select: {
        id: true,
        usuarioId: true,
        status: true,
        valor: true,
      },
    });

    if (!saque) {
      throw new Error("Solicitacao de saque nao encontrada");
    }
    if (saque.status === "rejeitado") {
      throw new Error("Saque rejeitado nao pode ser marcado como pago");
    }
    if (saque.status === "pago") {
      return saque;
    }

    const user = await tx.user.findUnique({
      where: { id: saque.usuarioId },
      select: { id: true, saldoPremio: true },
    });
    if (!user) {
      throw new Error("Usuario do saque nao encontrado");
    }
    if (Number(user.saldoPremio) < Number(saque.valor)) {
      throw new Error("Saldo insuficiente para concluir o saque");
    }

    await tx.user.update({
      where: { id: saque.usuarioId },
      data: { saldoPremio: { decrement: Number(saque.valor) } },
    });

    const updated = await tx.solicitacaoSaque.update({
      where: { id: solicitacaoId },
      data: {
        status: "pago",
        dataPagamento: new Date(),
      },
    });

    await tx.notificacao.create({
      data: {
        usuarioId: saque.usuarioId,
        tipo: "saque_pago",
        mensagem: `Seu saque de R$ ${Number(saque.valor).toFixed(2)} foi marcado como pago.`,
      },
    });

    return updated;
  });
}

export type PixPaymentRecord = {
  id: number;
  usuarioId: number;
  createdByUserId: number | null;
  provider: string;
  externalReference: string;
  providerPaymentId: string | null;
  status: string;
  valor: number | string;
  descricao: string | null;
  qrCode: string | null;
  qrCodeBase64: string | null;
  ticketUrl: string | null;
  metadataJson: string | null;
  rawResponseJson: string | null;
  approvedAt: Date | null;
  creditedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type CreatePixPaymentInput = {
  usuarioId: number;
  createdByUserId?: number | null;
  externalReference: string;
  valor: number;
  descricao?: string | null;
  providerPaymentId?: string | null;
  status?: string;
  qrCode?: string | null;
  qrCodeBase64?: string | null;
  ticketUrl?: string | null;
  metadataJson?: string | null;
  rawResponseJson?: string | null;
  approvedAt?: Date | null;
  expiresAt?: Date | null;
};

type SyncPixPaymentInput = {
  providerPaymentId: string;
  externalReference?: string | null;
  status: string;
  valor?: number | null;
  qrCode?: string | null;
  qrCodeBase64?: string | null;
  ticketUrl?: string | null;
  metadataJson?: string | null;
  rawResponseJson?: string | null;
  approvedAt?: Date | null;
  expiresAt?: Date | null;
};

export async function createPixPaymentRecord(input: CreatePixPaymentInput) {
  const rows = await prisma.$queryRaw<PixPaymentRecord[]>`
    INSERT INTO "pixPayments" (
      "usuarioId",
      "createdByUserId",
      "externalReference",
      "providerPaymentId",
      "status",
      "valor",
      "descricao",
      "qrCode",
      "qrCodeBase64",
      "ticketUrl",
      "metadataJson",
      "rawResponseJson",
      "approvedAt",
      "expiresAt",
      "updatedAt"
    )
    VALUES (
      ${input.usuarioId},
      ${input.createdByUserId ?? null},
      ${input.externalReference},
      ${input.providerPaymentId ?? null},
      ${input.status ?? "pending"},
      CAST(${input.valor.toFixed(2)} AS DECIMAL(10,2)),
      ${input.descricao ?? null},
      ${input.qrCode ?? null},
      ${input.qrCodeBase64 ?? null},
      ${input.ticketUrl ?? null},
      ${input.metadataJson ?? null},
      ${input.rawResponseJson ?? null},
      ${input.approvedAt ?? null},
      ${input.expiresAt ?? null},
      NOW()
    )
    RETURNING *
  `;
  return rows[0] ?? null;
}

export async function getPixPaymentById(id: number) {
  const rows = await prisma.$queryRaw<PixPaymentRecord[]>`
    SELECT * FROM "pixPayments"
    WHERE "id" = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getPixPaymentByExternalReference(externalReference: string) {
  const rows = await prisma.$queryRaw<PixPaymentRecord[]>`
    SELECT * FROM "pixPayments"
    WHERE "externalReference" = ${externalReference}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getPixPaymentByProviderPaymentId(providerPaymentId: string) {
  const rows = await prisma.$queryRaw<PixPaymentRecord[]>`
    SELECT * FROM "pixPayments"
    WHERE "providerPaymentId" = ${providerPaymentId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function syncPixPaymentRecord(input: SyncPixPaymentInput) {
  const providerPaymentId = input.providerPaymentId;
  const externalReference = input.externalReference ?? null;
  const valor = input.valor == null ? null : input.valor.toFixed(2);
  const rows = await prisma.$queryRaw<PixPaymentRecord[]>`
    UPDATE "pixPayments"
    SET
      "providerPaymentId" = ${providerPaymentId},
      "status" = ${input.status},
      "valor" = COALESCE(CAST(${valor} AS DECIMAL(10,2)), "valor"),
      "qrCode" = COALESCE(${input.qrCode ?? null}, "qrCode"),
      "qrCodeBase64" = COALESCE(${input.qrCodeBase64 ?? null}, "qrCodeBase64"),
      "ticketUrl" = COALESCE(${input.ticketUrl ?? null}, "ticketUrl"),
      "metadataJson" = COALESCE(${input.metadataJson ?? null}, "metadataJson"),
      "rawResponseJson" = COALESCE(${input.rawResponseJson ?? null}, "rawResponseJson"),
      "approvedAt" = CASE
        WHEN ${input.approvedAt ?? null} IS NOT NULL THEN ${input.approvedAt ?? null}
        ELSE "approvedAt"
      END,
      "expiresAt" = CASE
        WHEN ${input.expiresAt ?? null} IS NOT NULL THEN ${input.expiresAt ?? null}
        ELSE "expiresAt"
      END,
      "updatedAt" = NOW()
    WHERE "providerPaymentId" = ${providerPaymentId}
       OR (${externalReference} IS NOT NULL AND "externalReference" = ${externalReference})
    RETURNING *
  `;
  return rows[0] ?? null;
}

export async function creditPixPaymentIfNeeded(params: {
  pixPaymentId: number;
  usuarioId: number;
  valor: number;
  providerPaymentId: string;
}) {
  return prisma.$transaction(async tx => {
    const lockedRows = await tx.$queryRaw<Array<{ id: number; creditedAt: Date | null }>>`
      SELECT "id", "creditedAt"
      FROM "pixPayments"
      WHERE "id" = ${params.pixPaymentId}
      FOR UPDATE
    `;
    const pixPayment = lockedRows[0];
    if (!pixPayment || pixPayment.creditedAt) {
      return { credited: false as const };
    }

    await tx.$executeRaw`
      UPDATE "pixPayments"
      SET
        "status" = 'approved',
        "creditedAt" = NOW(),
        "approvedAt" = COALESCE("approvedAt", NOW()),
        "updatedAt" = NOW()
      WHERE "id" = ${params.pixPaymentId}
    `;

    await tx.user.update({
      where: { id: params.usuarioId },
      data: { saldoPremio: { increment: params.valor } },
    });

    await tx.notificacao.create({
      data: {
        usuarioId: params.usuarioId,
        tipo: "deposito_pix",
        mensagem: `PIX aprovado (${params.providerPaymentId})`,
      },
    });

    return { credited: true as const };
  });
}

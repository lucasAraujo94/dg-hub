import { decimal, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  avatarUrl: varchar("avatarUrl", { length: 512 }),
  saldoPremio: decimal("saldoPremio", { precision: 10, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Campeonatos
export const campeonatos = mysqlTable("campeonatos", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  descricao: text("descricao"),
  dataInicio: timestamp("dataInicio").notNull(),
  dataFim: timestamp("dataFim"),
  status: mysqlEnum("status", ["futuro", "ativo", "finalizado"]).default("futuro").notNull(),
  premioValor: decimal("premioValor", { precision: 10, scale: 2 }).default("0").notNull(),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizadoEm").defaultNow().onUpdateNow().notNull(),
});

export type Campeonato = typeof campeonatos.$inferSelect;
export type InsertCampeonato = typeof campeonatos.$inferInsert;

// Inscrições
export const inscricoes = mysqlTable("inscricoes", {
  id: int("id").autoincrement().primaryKey(),
  usuarioId: int("usuarioId").notNull(),
  campeonatoId: int("campeonatoId").notNull(),
  dataInscricao: timestamp("dataInscricao").defaultNow().notNull(),
});

export type Inscricao = typeof inscricoes.$inferSelect;
export type InsertInscricao = typeof inscricoes.$inferInsert;

// Partidas
export const partidas = mysqlTable("partidas", {
  id: int("id").autoincrement().primaryKey(),
  campeonatoId: int("campeonatoId").notNull(),
  jogador1Id: int("jogador1Id").notNull(),
  jogador2Id: int("jogador2Id"),
  resultadoJogador1: int("resultadoJogador1"),
  resultadoJogador2: int("resultadoJogador2"),
  vencedorId: int("vencedorId"),
  fase: varchar("fase", { length: 50 }).notNull(),
  dataPartida: timestamp("dataPartida"),
  status: mysqlEnum("status", ["agendada", "em_andamento", "finalizada"]).default("agendada").notNull(),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
});

export type Partida = typeof partidas.$inferSelect;
export type InsertPartida = typeof partidas.$inferInsert;

// Chaveamentos
export const chaveamentos = mysqlTable("chaveamentos", {
  id: int("id").autoincrement().primaryKey(),
  campeonatoId: int("campeonatoId").notNull().unique(),
  estruturaJson: json("estruturaJson").notNull(),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizadoEm").defaultNow().onUpdateNow().notNull(),
});

export type Chaveamento = typeof chaveamentos.$inferSelect;
export type InsertChaveamento = typeof chaveamentos.$inferInsert;

// Rankings
export const rankings = mysqlTable("rankings", {
  id: int("id").autoincrement().primaryKey(),
  usuarioId: int("usuarioId").notNull(),
  tipoRanking: mysqlEnum("tipoRanking", ["geral", "semanal", "mensal"]).notNull(),
  pontuacao: int("pontuacao").default(0).notNull(),
  posicao: int("posicao"),
  dataAtualizacao: timestamp("dataAtualizacao").defaultNow().onUpdateNow().notNull(),
});

export type Ranking = typeof rankings.$inferSelect;
export type InsertRanking = typeof rankings.$inferInsert;

// Estatísticas de Jogadores
export const estatisticas = mysqlTable("estatisticas", {
  id: int("id").autoincrement().primaryKey(),
  usuarioId: int("usuarioId").notNull().unique(),
  partidasJogadas: int("partidasJogadas").default(0).notNull(),
  vitorias: int("vitorias").default(0).notNull(),
  derrotas: int("derrotas").default(0).notNull(),
  aproveitamento: decimal("aproveitamento", { precision: 5, scale: 2 }).default("0").notNull(),
  sequenciaAtual: int("sequenciaAtual").default(0).notNull(),
  maiorSequencia: int("maiorSequencia").default(0).notNull(),
  campeonatoDisputados: int("campeonatoDisputados").default(0).notNull(),
  campeonatoVencidos: int("campeonatoVencidos").default(0).notNull(),
  atualizadoEm: timestamp("atualizadoEm").defaultNow().onUpdateNow().notNull(),
});

export type Estatistica = typeof estatisticas.$inferSelect;
export type InsertEstatistica = typeof estatisticas.$inferInsert;

// Emblemas
export const emblemas = mysqlTable("emblemas", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  descricao: text("descricao"),
  iconeUrl: varchar("iconeUrl", { length: 512 }),
  tipo: varchar("tipo", { length: 50 }).notNull(),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
});

export type Emblema = typeof emblemas.$inferSelect;
export type InsertEmblema = typeof emblemas.$inferInsert;

// Usuário Emblemas
export const usuarioEmblemas = mysqlTable("usuarioEmblemas", {
  id: int("id").autoincrement().primaryKey(),
  usuarioId: int("usuarioId").notNull(),
  emblemaId: int("emblemaId").notNull(),
  dataConquista: timestamp("dataConquista").defaultNow().notNull(),
});

export type UsuarioEmblema = typeof usuarioEmblemas.$inferSelect;
export type InsertUsuarioEmblema = typeof usuarioEmblemas.$inferInsert;

// Chat Mensagens
export const chatMensagens = mysqlTable("chatMensagens", {
  id: int("id").autoincrement().primaryKey(),
  usuarioId: int("usuarioId"),
  tipoChat: mysqlEnum("tipoChat", ["geral", "radio"]).default("geral").notNull(),
  mensagem: text("mensagem").notNull(),
  dataEnvio: timestamp("dataEnvio").defaultNow().notNull(),
});

export type ChatMensagem = typeof chatMensagens.$inferSelect;
export type InsertChatMensagem = typeof chatMensagens.$inferInsert;

// Notificações
export const notificacoes = mysqlTable("notificacoes", {
  id: int("id").autoincrement().primaryKey(),
  usuarioId: int("usuarioId").notNull(),
  mensagem: text("mensagem").notNull(),
  tipo: varchar("tipo", { length: 50 }).notNull(),
  lida: int("lida").default(0).notNull(),
  dataEnvio: timestamp("dataEnvio").defaultNow().notNull(),
});

export type Notificacao = typeof notificacoes.$inferSelect;
export type InsertNotificacao = typeof notificacoes.$inferInsert;

// Solicitações de Saque
export const solicitacoesSaque = mysqlTable("solicitacoesSaque", {
  id: int("id").autoincrement().primaryKey(),
  usuarioId: int("usuarioId").notNull(),
  valor: decimal("valor", { precision: 10, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["disponivel", "solicitado", "pago"]).default("solicitado").notNull(),
  dataSolicitacao: timestamp("dataSolicitacao").defaultNow().notNull(),
  dataPagamento: timestamp("dataPagamento"),
});

export type SolicitacaoSaque = typeof solicitacoesSaque.$inferSelect;
export type InsertSolicitacaoSaque = typeof solicitacoesSaque.$inferInsert;

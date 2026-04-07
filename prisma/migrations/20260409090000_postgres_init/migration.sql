-- Initial PostgreSQL schema for DG Hub

CREATE TABLE "users" (
    "id" SERIAL PRIMARY KEY,
    "openId" VARCHAR(64) NOT NULL,
    "name" TEXT,
    "nome_no_hago" VARCHAR(100),
    "email" VARCHAR(320),
    "loginMethod" VARCHAR(64),
    "passwordHash" VARCHAR(255),
    "role" VARCHAR(10) NOT NULL DEFAULT 'user',
    "avatarUrl" VARCHAR(2048),
    "hideEmail" BOOLEAN NOT NULL DEFAULT FALSE,
    "saldoPremio" NUMERIC(10, 2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "lastSignedIn" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX "users_openId_key" ON "users" ("openId");

CREATE TABLE "campeonatos" (
    "id" SERIAL PRIMARY KEY,
    "nome" VARCHAR(255) NOT NULL,
    "descricao" TEXT,
    "jogo" VARCHAR(100) NOT NULL,
    "dataInicio" TIMESTAMPTZ NOT NULL,
    "dataFim" TIMESTAMPTZ,
    "status" VARCHAR(20) NOT NULL DEFAULT 'futuro',
    "premioValor" NUMERIC(10, 2) NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "atualizadoEm" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "campeaoId" INTEGER
);

CREATE TABLE "inscricoes" (
    "id" SERIAL PRIMARY KEY,
    "usuarioId" INTEGER NOT NULL,
    "campeonatoId" INTEGER NOT NULL,
    "dataInscricao" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "partidas" (
    "id" SERIAL PRIMARY KEY,
    "campeonatoId" INTEGER NOT NULL,
    "jogador1Id" INTEGER NOT NULL,
    "jogador2Id" INTEGER,
    "resultadoJogador1" INTEGER,
    "resultadoJogador2" INTEGER,
    "vencedorId" INTEGER,
    "fase" VARCHAR(50) NOT NULL,
    "dataPartida" TIMESTAMPTZ,
    "status" VARCHAR(20) NOT NULL DEFAULT 'agendada',
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "chaveamentos" (
    "id" SERIAL PRIMARY KEY,
    "campeonatoId" INTEGER NOT NULL UNIQUE,
    "estruturaJson" TEXT NOT NULL,
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "atualizadoEm" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "rankings" (
    "id" SERIAL PRIMARY KEY,
    "usuarioId" INTEGER NOT NULL,
    "tipoRanking" VARCHAR(20) NOT NULL,
    "pontuacao" INTEGER NOT NULL DEFAULT 0,
    "posicao" INTEGER,
    "dataAtualizacao" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX "rankings_usuario_tipo_unique" ON "rankings" ("usuarioId", "tipoRanking");

CREATE TABLE "estatisticas" (
    "id" SERIAL PRIMARY KEY,
    "usuarioId" INTEGER NOT NULL UNIQUE,
    "partidasJogadas" INTEGER NOT NULL DEFAULT 0,
    "vitorias" INTEGER NOT NULL DEFAULT 0,
    "derrotas" INTEGER NOT NULL DEFAULT 0,
    "aproveitamento" NUMERIC(5, 2) NOT NULL DEFAULT 0,
    "sequenciaAtual" INTEGER NOT NULL DEFAULT 0,
    "maiorSequencia" INTEGER NOT NULL DEFAULT 0,
    "campeonatoDisputados" INTEGER NOT NULL DEFAULT 0,
    "campeonatoVencidos" INTEGER NOT NULL DEFAULT 0,
    "atualizadoEm" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "emblemas" (
    "id" SERIAL PRIMARY KEY,
    "nome" VARCHAR(255) NOT NULL,
    "descricao" TEXT,
    "iconeUrl" VARCHAR(512),
    "tipo" VARCHAR(50) NOT NULL,
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "usuarioEmblemas" (
    "id" SERIAL PRIMARY KEY,
    "usuarioId" INTEGER NOT NULL,
    "emblemaId" INTEGER NOT NULL,
    "dataConquista" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "chatMensagens" (
    "id" SERIAL PRIMARY KEY,
    "usuarioId" INTEGER,
    "tipoChat" VARCHAR(20) NOT NULL DEFAULT 'geral',
    "mensagem" TEXT NOT NULL,
    "dataEnvio" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "notificacoes" (
    "id" SERIAL PRIMARY KEY,
    "usuarioId" INTEGER NOT NULL,
    "mensagem" TEXT NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "lida" INTEGER NOT NULL DEFAULT 0,
    "dataEnvio" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "solicitacoesSaque" (
    "id" SERIAL PRIMARY KEY,
    "usuarioId" INTEGER NOT NULL,
    "valor" NUMERIC(10, 2) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'solicitado',
    "walletProvider" VARCHAR(80) NOT NULL,
    "walletAddress" VARCHAR(255) NOT NULL,
    "dataSolicitacao" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "dataPagamento" TIMESTAMPTZ
);

CREATE TABLE "polls" (
    "id" SERIAL PRIMARY KEY,
    "question" TEXT,
    "closesAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "optionsJson" TEXT
);

CREATE TABLE "pollVotes" (
    "id" SERIAL PRIMARY KEY,
    "usuarioId" INTEGER NOT NULL,
    "escolha" VARCHAR(50) NOT NULL,
    "pollId" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX "pollVotes_usuario_poll_unique" ON "pollVotes" ("usuarioId", "pollId");

ALTER TABLE "campeonatos" ADD CONSTRAINT "campeonatos_campeaoId_fkey" FOREIGN KEY ("campeaoId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "inscricoes" ADD CONSTRAINT "inscricoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "inscricoes" ADD CONSTRAINT "inscricoes_campeonatoId_fkey" FOREIGN KEY ("campeonatoId") REFERENCES "campeonatos"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "partidas" ADD CONSTRAINT "partidas_campeonatoId_fkey" FOREIGN KEY ("campeonatoId") REFERENCES "campeonatos"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "partidas" ADD CONSTRAINT "partidas_jogador1Id_fkey" FOREIGN KEY ("jogador1Id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "partidas" ADD CONSTRAINT "partidas_jogador2Id_fkey" FOREIGN KEY ("jogador2Id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "partidas" ADD CONSTRAINT "partidas_vencedorId_fkey" FOREIGN KEY ("vencedorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "chaveamentos" ADD CONSTRAINT "chaveamentos_campeonatoId_fkey" FOREIGN KEY ("campeonatoId") REFERENCES "campeonatos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rankings" ADD CONSTRAINT "rankings_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "estatisticas" ADD CONSTRAINT "estatisticas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "usuarioEmblemas" ADD CONSTRAINT "usuarioEmblemas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "usuarioEmblemas" ADD CONSTRAINT "usuarioEmblemas_emblemaId_fkey" FOREIGN KEY ("emblemaId") REFERENCES "emblemas"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "chatMensagens" ADD CONSTRAINT "chatMensagens_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "solicitacoesSaque" ADD CONSTRAINT "solicitacoesSaque_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "pollVotes" ADD CONSTRAINT "pollVotes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pollVotes" ADD CONSTRAINT "pollVotes_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `campeonatos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`descricao` text,
	`dataInicio` timestamp NOT NULL,
	`dataFim` timestamp,
	`status` enum('futuro','ativo','finalizado') NOT NULL DEFAULT 'futuro',
	`premioValor` decimal(10,2) NOT NULL DEFAULT '0',
	`criadoEm` timestamp NOT NULL DEFAULT (now()),
	`atualizadoEm` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campeonatos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chatMensagens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`usuarioId` int,
	`tipoChat` enum('geral','radio') NOT NULL DEFAULT 'geral',
	`mensagem` text NOT NULL,
	`dataEnvio` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chatMensagens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chaveamentos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campeonatoId` int NOT NULL,
	`estruturaJson` json NOT NULL,
	`criadoEm` timestamp NOT NULL DEFAULT (now()),
	`atualizadoEm` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chaveamentos_id` PRIMARY KEY(`id`),
	CONSTRAINT `chaveamentos_campeonatoId_unique` UNIQUE(`campeonatoId`)
);
--> statement-breakpoint
CREATE TABLE `emblemas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`descricao` text,
	`iconeUrl` varchar(512),
	`tipo` varchar(50) NOT NULL,
	`criadoEm` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `emblemas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `estatisticas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`usuarioId` int NOT NULL,
	`partidasJogadas` int NOT NULL DEFAULT 0,
	`vitorias` int NOT NULL DEFAULT 0,
	`derrotas` int NOT NULL DEFAULT 0,
	`aproveitamento` decimal(5,2) NOT NULL DEFAULT '0',
	`sequenciaAtual` int NOT NULL DEFAULT 0,
	`maiorSequencia` int NOT NULL DEFAULT 0,
	`campeonatoDisputados` int NOT NULL DEFAULT 0,
	`campeonatoVencidos` int NOT NULL DEFAULT 0,
	`atualizadoEm` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `estatisticas_id` PRIMARY KEY(`id`),
	CONSTRAINT `estatisticas_usuarioId_unique` UNIQUE(`usuarioId`)
);
--> statement-breakpoint
CREATE TABLE `inscricoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`usuarioId` int NOT NULL,
	`campeonatoId` int NOT NULL,
	`dataInscricao` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inscricoes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notificacoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`usuarioId` int NOT NULL,
	`mensagem` text NOT NULL,
	`tipo` varchar(50) NOT NULL,
	`lida` int NOT NULL DEFAULT 0,
	`dataEnvio` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notificacoes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `partidas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campeonatoId` int NOT NULL,
	`jogador1Id` int NOT NULL,
	`jogador2Id` int,
	`resultadoJogador1` int,
	`resultadoJogador2` int,
	`vencedorId` int,
	`fase` varchar(50) NOT NULL,
	`dataPartida` timestamp,
	`status` enum('agendada','em_andamento','finalizada') NOT NULL DEFAULT 'agendada',
	`criadoEm` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `partidas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rankings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`usuarioId` int NOT NULL,
	`tipoRanking` enum('geral','semanal','mensal') NOT NULL,
	`pontuacao` int NOT NULL DEFAULT 0,
	`posicao` int,
	`dataAtualizacao` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rankings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `solicitacoesSaque` (
	`id` int AUTO_INCREMENT NOT NULL,
	`usuarioId` int NOT NULL,
	`valor` decimal(10,2) NOT NULL,
	`status` enum('disponivel','solicitado','pago') NOT NULL DEFAULT 'solicitado',
	`dataSolicitacao` timestamp NOT NULL DEFAULT (now()),
	`dataPagamento` timestamp,
	CONSTRAINT `solicitacoesSaque_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `usuarioEmblemas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`usuarioId` int NOT NULL,
	`emblemaId` int NOT NULL,
	`dataConquista` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `usuarioEmblemas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` varchar(512);--> statement-breakpoint
ALTER TABLE `users` ADD `saldoPremio` decimal(10,2) DEFAULT '0' NOT NULL;
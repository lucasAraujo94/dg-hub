-- Add missing "jogo" column to campeonatos for production DB
IF COL_LENGTH('campeonatos', 'jogo') IS NULL
BEGIN
    ALTER TABLE [campeonatos]
    ADD [jogo] VARCHAR(100) NOT NULL CONSTRAINT DF_campeonatos_jogo DEFAULT 'indefinido';
END;

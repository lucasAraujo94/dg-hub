-- Adds missing campeaoId column and FK to users if not present
IF COL_LENGTH('campeonatos', 'campeaoId') IS NULL
BEGIN
    ALTER TABLE [campeonatos]
    ADD [campeaoId] INT NULL;

    ALTER TABLE [campeonatos]
    ADD CONSTRAINT [FK_campeonatos_campeao_users_id]
        FOREIGN KEY ([campeaoId]) REFERENCES [users]([id]);
END;

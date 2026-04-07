# Migração para PostgreSQL (Neon como opção preferida)

## Visão geral
- Stack: React/Vite, Node+tRPC, Prisma.
- Nova base: PostgreSQL (`provider = "postgresql"`). Preferir Neon (free/eficiente); alternativa: Render Postgres.
- Build desacoplado do banco: `pnpm build` não roda migrations; execute-as separadamente quando o banco estiver online.

## Checklist de código
- Prisma atualizado para Postgres (`prisma/schema.prisma` e migrations novas).
- Queries raw ajustadas para sintaxe Postgres (NOW, LIMIT, RETURNING, nomes entre aspas).
- Migrations legadas de SQL Server removidas; nova migration inicial `20260409090000_postgres_init`.
- `package.json` não roda `prisma migrate deploy` no build.

## Variáveis de ambiente
- `DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require`
- Neon: use a URL da conexão (pooler recomendado).
- Render Postgres: use a URL da instância com `sslmode=require`.

## Ordem de deploy
1. Criar base Postgres (Neon ou Render) e copiar `DATABASE_URL` (pooler).
2. Rodar `pnpm install` (atualiza lock, remove `mssql`).
3. Rodar `pnpm prisma migrate deploy` apontando para o Postgres novo.
4. Rodar `pnpm prisma generate`.
5. Rodar `pnpm build`.
6. Subir app com o novo `DATABASE_URL`.

## Plano de migração de dados (SQL Server -> Postgres)
1. **Congelar escrita**: colocar app em manutenção ou modo somente leitura.
2. **Exportar SQL Server** (via `sqlcmd`/PowerShell; ajuste credenciais/host):
   ```powershell
   $tables = @("users","campeonatos","inscricoes","partidas","chaveamentos","rankings","estatisticas","emblemas","usuarioEmblemas","chatMensagens","notificacoes","solicitacoesSaque","polls","pollVotes")
   foreach ($t in $tables) {
     sqlcmd -S "<sqlserver-host>" -d "<db>" -U "<user>" -P "<pass>" -Q "SET NOCOUNT ON; SELECT * FROM $t ORDER BY id" -s"," -W -o "$t.csv"
   }
   ```
   Alternativa: `bcp` ou `pgloader` direto se preferir.
3. **Criar schema no Postgres**: `pnpm prisma migrate deploy` (usa a nova migration).
4. **Importar no Postgres** (`psql`, no mesmo diretório dos CSVs):
   ```bash
   psql "$DATABASE_URL" -c "TRUNCATE TABLE \"pollVotes\",\"polls\",\"solicitacoesSaque\",\"notificacoes\",\"chatMensagens\",\"usuarioEmblemas\",\"emblemas\",\"estatisticas\",\"rankings\",\"chaveamentos\",\"partidas\",\"inscricoes\",\"campeonatos\",\"users\" RESTART IDENTITY CASCADE;"
   for t in users campeonatos inscricoes partidas chaveamentos rankings estatisticas emblemas usuarioEmblemas chatMensagens notificacoes solicitacoesSaque polls pollVotes; do
     psql "$DATABASE_URL" -c "\\copy \"$t\" FROM '$t.csv' CSV HEADER";
   done
   # Ajustar sequences
   psql "$DATABASE_URL" -c "SELECT 'SELECT setval('''||pg_get_serial_sequence('\"'||relname||'\"','id')||''', COALESCE(MAX(id),1)) FROM '||relname||';' FROM pg_class WHERE relkind='r' AND relname IN ('users','campeonatos','inscricoes','partidas','chaveamentos','rankings','estatisticas','emblemas','usuarioEmblemas','chatMensagens','notificacoes','solicitacoesSaque','polls','pollVotes');" | psql "$DATABASE_URL"
   ```
5. **Validar**: comparar contagem por tabela e amostras (users, campeonatos, chatMensagens).
6. **Reativar escrita** e monitorar logs.

## Rollback
- Mantenha backup/export do SQL Server original.
- Se algo falhar, volte o `DATABASE_URL` para SQL Server e reimplante a versão anterior do app.
- Tenha dump do Postgres pós-migração para retorno rápido se necessário.

## Riscos e mitigação
- Falha de importação por tipos/charset: CSV em UTF-8; campos JSON (`optionsJson`, `estruturaJson`, `mensagem`) continuam como TEXT.
-, Sequence desalinhada: execute o ajuste de `setval` após importação.
- Tempo de inatividade: use janela de manutenção; o build não depende mais do DB, apenas a migração/importação.

## Testes recomendados
- `pnpm check`
- `pnpm test` (unitários)
- Smoke manual: login, criar/enviar mensagem no chat, criar/consultar campeonato, votar em enquete.

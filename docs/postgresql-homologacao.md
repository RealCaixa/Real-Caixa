# PostgreSQL em Homologacao - Real Caixa Site

Esta fase prepara o Real Caixa Site para usar banco cloud persistente em homologacao real.

## Estado atual

- `DATABASE_PROVIDER=sqljs` continua sendo o padrao.
- `sql.js` nao foi removido.
- A camada de adapters foi criada em `backend/database-adapters`.
- O facade central `backend/database.js` expoe `get`, `all`, `run`, `transaction` e `close`.
- O schema PostgreSQL esta em `database/postgres/schema.sql`.
- O script inicial e `npm run db:postgres:init` dentro de `backend`.

Importante: os repositorios principais passam pelo facade central e continuam compativeis com `sql.js`. O adapter PostgreSQL traduz placeholders `?` para `$1`, `$2`, prepara `RETURNING id` em inserts e o runtime Express ja pode iniciar com `DATABASE_PROVIDER=postgres` quando `DATABASE_URL` estiver configurado.

## Variaveis de ambiente

Local com sql.js:

```env
DATABASE_PROVIDER=sqljs
REALCAIXA_DB_PATH=./realcaixa.db
JWT_SECRET=segredo-local
```

Homologacao com PostgreSQL:

```env
DATABASE_PROVIDER=postgres
DATABASE_URL=postgresql://usuario:senha@host:5432/database
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=false
DATABASE_POOL_MAX=5
DATABASE_IDLE_TIMEOUT_MS=30000
JWT_SECRET=<segredo-longo-e-aleatorio>
NODE_ENV=production
```

## Supabase

1. Criar um projeto em Supabase.
2. Abrir `Project Settings > Database`.
3. Copiar a connection string em modo URI.
4. Substituir senha e host conforme indicado pelo Supabase.
5. Configurar:

```env
DATABASE_PROVIDER=postgres
DATABASE_URL=postgresql://postgres:<senha>@db.<project-ref>.supabase.co:5432/postgres
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=false
```

6. Rodar:

```bash
cd backend
npm install
npm run db:postgres:init
```

## Neon

1. Criar projeto no Neon.
2. Criar database de homologacao.
3. Copiar a connection string pooled ou direct.
4. Configurar:

```env
DATABASE_PROVIDER=postgres
DATABASE_URL=postgresql://<usuario>:<senha>@<host>/<database>?sslmode=require
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=false
```

5. Rodar:

```bash
cd backend
npm install
npm run db:postgres:init
```

## Railway PostgreSQL

1. Criar um servico PostgreSQL no Railway.
2. Copiar `DATABASE_URL`.
3. Configurar:

```env
DATABASE_PROVIDER=postgres
DATABASE_URL=${{Postgres.DATABASE_URL}}
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=false
```

4. Rodar o script de schema no ambiente que tenha acesso ao banco.

## Inicializar schema

```bash
cd backend
npm run db:postgres:init
```

Esse comando:

- exige `DATABASE_PROVIDER=postgres`;
- exige `DATABASE_URL`;
- aplica `database/postgres/schema.sql`;
- nao migra dados do `realcaixa.db`.

## Rodar local com sql.js

```bash
cd backend
npm install
npm test
npm start
```

Variaveis:

```env
DATABASE_PROVIDER=sqljs
REALCAIXA_DB_PATH=./realcaixa.db
JWT_SECRET=segredo-local
```

## Rodar homologacao com PostgreSQL

1. Criar banco cloud.
2. Configurar variaveis do provedor.
3. Rodar `npm run db:postgres:init`.
4. Iniciar o backend com `npm start`.
5. Validar `/api/health`.
6. Executar cadastro em `/cadastro` ou `POST /api/auth/cadastro`.
7. Executar login em `/login` ou `POST /api/auth/login`.
8. Acessar `/dashboard` com o token retornado.
9. Fazer deploy preview apenas depois do fluxo local/cloud isolado passar.

Comandos:

```bash
cd backend
npm install
npm run db:postgres:init
npm start
```

Validacao rapida:

```bash
curl http://localhost:3000/api/health
```

Resposta esperada:

```json
{
  "status": "online",
  "database_driver": "postgres",
  "database_provider": "postgres"
}
```

## Riscos restantes

- O runtime PostgreSQL foi liberado, mas ainda precisa ser validado contra um banco cloud real com dados de homologacao.
- Algumas queries usam funcoes comuns como `date(...)` e `datetime(...)`; o adapter traduz o basico, mas relatorios devem ser acompanhados no primeiro teste cloud.
- Migracao de dados de `realcaixa.db` para PostgreSQL ainda nao foi implementada.
- Rotinas de backup/restore cloud ainda precisam ser adaptadas para PostgreSQL.
- Transacoes e concorrencia precisam ser testadas com usuarios simultaneos no PostgreSQL real.

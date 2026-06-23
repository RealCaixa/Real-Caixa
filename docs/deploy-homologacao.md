# Deploy de Homologacao - Real Caixa Site

Este guia prepara um deploy de teste do Portal Cloud Real Caixa sem publicar automaticamente.

## Situacao atual

- O backend real esta em `backend/server.js`.
- A home publica esta em `backend/public/index.html` e continua sendo servida pelo Express.
- O projeto agora possui `vercel.json` e `api/index.js` para adaptar o Express ao runtime serverless da Vercel.
- O healthcheck publico e `GET /api/health`.
- Localmente, `DATABASE_PROVIDER=sqljs` continua funcionando.
- Para homologacao operacional, usar `DATABASE_PROVIDER=postgres` com banco persistente.

## Alerta importante sobre banco

O banco `sql.js`/`realcaixa.db` nao e adequado para Vercel em producao ou homologacao com escrita real.

Em ambiente serverless:

- o filesystem pode ser recriado entre execucoes;
- escritas no arquivo podem ser perdidas;
- multiplas instancias podem divergir;
- nao ha garantia de concorrencia segura.

Use PostgreSQL persistente para qualquer homologacao com cadastro, login, PDV ou ativacao real. O banco `sql.js` deve ficar apenas para desenvolvimento local e testes rapidos.

## Escolha recomendada

Para homologacao, a opcao recomendada e **Render + PostgreSQL gerenciado**.

- Vercel + Neon/Supabase: bom para preview rapido e frontend/publicacao simples, mas o backend Express em serverless exige cuidado extra com cold start, conexoes e tarefas administrativas.
- Render + PostgreSQL: mais simples para o backend Node/Express atual, com processo persistente, logs diretos, healthcheck e banco gerenciado no mesmo fluxo.
- Railway + PostgreSQL: rapido para prototipo, mas pode variar mais em custo/limites conforme uso.

Recomendacao pratica:

1. Homologacao operacional: Render + PostgreSQL.
2. Preview visual/URL temporaria: Vercel + Neon.
3. Ambiente experimental rapido: Railway + PostgreSQL.

## Criar banco PostgreSQL

Opcoes aceitas:

- Supabase PostgreSQL
- Neon PostgreSQL
- Railway PostgreSQL
- Render PostgreSQL

Depois de criar o banco, copiar a connection string para `DATABASE_URL`.

## Instalar Vercel CLI

```bash
npm install -g vercel
```

## Login

```bash
vercel login
```

## Configurar variaveis

No painel da Vercel, Render ou Railway, configurar:

```env
NODE_ENV=production
DATABASE_PROVIDER=postgres
DATABASE_URL=postgresql://usuario:senha@host:5432/database
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=false
JWT_SECRET=<segredo-longo-e-aleatorio>
JWT_EXPIRES_IN=8h
CORS_ORIGINS=https://realcaixa-homologacao.seudominio.com
HOMOLOGACAO_URL=https://realcaixa-homologacao.seudominio.com
LOG_LEVEL=info
```

Valores recomendados:

Nao usar segredo padrao em homologacao.

Existe um modelo em:

```text
backend/.env.homolog.example
```

## Inicializar schema PostgreSQL

Executar de uma maquina com acesso ao `DATABASE_URL`:

```bash
cd backend
npm install
npm run db:postgres:init
npm run check:homologacao
```

O comando `check:homologacao` verifica:

- provider do banco;
- conexao PostgreSQL;
- tabelas principais;
- versao do app;
- status do storage.

## Deploy na Vercel

Na raiz do `REALCAIXA-SITE`:

```bash
vercel
```

A CLI exibira uma URL preview parecida com:

```text
https://realcaixa-site-<hash>-<time>.vercel.app
```

Antes do deploy, adicionar variaveis:

```bash
vercel env add NODE_ENV preview
vercel env add DATABASE_PROVIDER preview
vercel env add DATABASE_URL preview
vercel env add DATABASE_SSL preview
vercel env add DATABASE_SSL_REJECT_UNAUTHORIZED preview
vercel env add JWT_SECRET preview
vercel env add JWT_EXPIRES_IN preview
vercel env add CORS_ORIGINS preview
vercel env add HOMOLOGACAO_URL preview
vercel env add LOG_LEVEL preview
```

## Deploy no Render

1. Criar `Web Service`.
2. Conectar o repositorio.
3. Definir root/build conforme o projeto:
   - Build command: `cd backend && npm install`
   - Start command: `cd backend && npm start`
4. Configurar variaveis de ambiente.
5. Criar PostgreSQL no Render ou informar `DATABASE_URL` externo.
6. Rodar `npm run db:postgres:init` antes de liberar o teste.

## Deploy no Railway

1. Criar projeto.
2. Adicionar servico PostgreSQL.
3. Adicionar servico Node apontando para o repositorio.
4. Configurar:
   - Build: `cd backend && npm install`
   - Start: `cd backend && npm start`
5. Configurar variaveis e rodar init do schema.

## Testar URLs

Depois do preview, validar:

```text
https://<preview>.vercel.app/
https://<preview>.vercel.app/api/health
https://<preview>.vercel.app/login
https://<preview>.vercel.app/cadastro
https://<preview>.vercel.app/dashboard
```

O `/api/health` deve retornar:

```json
{
  "status": "online",
  "database_driver": "postgres",
  "database_provider": "postgres"
}
```

## Smoke test pos-deploy

Configurar a URL de homologacao:

```bash
cd backend
set SMOKE_BASE_URL=https://sua-url-homologacao
npm run smoke:homologacao
```

No PowerShell:

```powershell
cd backend
$env:SMOKE_BASE_URL="https://sua-url-homologacao"
npm run smoke:homologacao
```

O smoke test valida:

- `/api/health`
- `/cadastro`
- `/login`
- `/dashboard`
- `/api/licenca/verificar`
- `/api/pdvs/heartbeat`

## Fluxos manuais obrigatorios

1. Abrir `/`.
2. Abrir `/cadastro`.
3. Cadastrar empresa de teste.
4. Fazer login em `/login`.
5. Acessar `/dashboard`.
6. Criar filial em `/filiais`.
7. Verificar licenca em `POST /api/licenca/verificar`.
8. Ativar PDV em `POST /api/pdvs/registrar`.
9. Enviar heartbeat em `POST /api/pdvs/heartbeat`.
10. Confirmar PDV listado em `/pdvs`.

## Apontar o PDV para a homologacao

No REALCAIXA-PRO:

1. Abrir o app.
2. Entrar em `Configuracao tecnica`.
3. Informar a URL preview da Vercel.
4. Salvar.
5. Executar diagnostico.
6. Ativar ou validar o PDV.

## Promover para dominio de homologacao

Somente depois dos testes preview:

```bash
vercel --prod
```

Nao executar este comando sem confirmacao.

## Ordem exata para publicar homologacao

1. Criar PostgreSQL no Render, Supabase, Neon ou Railway.
2. Copiar `DATABASE_URL`.
3. Configurar variaveis do ambiente de homologacao.
4. Rodar:

```bash
cd backend
npm install
npm run db:postgres:init
npm run check:homologacao
npm test
npm audit --audit-level=high
```

5. Fazer deploy preview/staging.
6. Rodar:

```bash
cd backend
set SMOKE_BASE_URL=https://sua-url-homologacao
npm run smoke:homologacao
```

7. Testar cadastro, login, dashboard e ativacao do PDV manualmente.
8. Somente depois disso apontar o PDV de teste para a URL homologada.

## Checklist rapido

- [ ] `npm test` passou dentro de `backend`.
- [ ] `npm audit --audit-level=high` passou dentro de `backend`.
- [ ] PostgreSQL criado.
- [ ] `DATABASE_PROVIDER=postgres` configurado.
- [ ] `DATABASE_URL` configurado.
- [ ] `JWT_SECRET` configurado na Vercel.
- [ ] `CORS_ORIGINS` inclui a URL de homologacao.
- [ ] `npm run db:postgres:init` executado.
- [ ] `npm run check:homologacao` passou.
- [ ] `/api/health` responde.
- [ ] `/api/health` mostra `database_provider: "postgres"`.
- [ ] Home publica abre.
- [ ] Login/cadastro abrem.
- [ ] Cadastro cria empresa no PostgreSQL.
- [ ] Login retorna token JWT.
- [ ] Dashboard abre autenticado.
- [ ] Ativacao do PDV funciona.
- [ ] Heartbeat do PDV funciona.
- [ ] PDV aponta para a URL homologada.

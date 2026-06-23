# Plano de Migracao: sql.js para PostgreSQL

## Objetivo

Migrar o Real Caixa Cloud de `sql.js` local para PostgreSQL em ambiente cloud, mantendo isolamento por empresa, integridade transacional e caminho de rollback.

## Tabelas principais

- `empresas`
- `usuarios`
- `licencas`
- `filiais`
- `pdvs`
- `categorias`
- `produtos`
- `estoque_movimentacoes`
- `contas_receber`
- `contas_pagar`
- `financeiro_categorias`
- `financeiro_lancamentos`
- `contadores`
- `contador_empresas`
- `assistente_auditoria`
- `sync_logs`
- `sync_vendas`
- `sync_venda_itens`
- `sync_venda_pagamentos`
- `sync_caixa_movimentacoes`
- `sync_caixa_fechamentos`
- `pdv_licenciamento_logs`

## Ordem recomendada

1. Criar schema PostgreSQL equivalente com constraints e indices.
2. Migrar tabelas de identidade: `empresas`, `usuarios`, `licencas`.
3. Migrar estrutura operacional: `filiais`, `pdvs`, `categorias`, `produtos`.
4. Migrar financeiro e estoque.
5. Migrar sincronizacao e logs.
6. Migrar contador e auditoria do assistente.
7. Rodar validacao de contagem, chaves estrangeiras e checksums por empresa.
8. Executar ambiente staging apontando para PostgreSQL.
9. Congelar escrita no sql.js durante janela curta.
10. Fazer dump final, importar e virar trafego.

## Riscos

- Diferenças de tipos entre SQLite/sql.js e PostgreSQL.
- Datas salvas como texto precisam ser normalizadas para `timestamptz` ou `date`.
- Constraints novas podem falhar caso existam duplicidades antigas.
- Sync PDV offline pode tentar reenviar eventos durante a janela de migracao.
- Escritas concorrentes exigem transacoes reais e tratamento de conflito.

## Estrategia de backup

- Antes da migracao, salvar copia do arquivo `.db` atual.
- Exportar dump SQL e arquivo binario original.
- Em PostgreSQL, usar `pg_dump` apos importacao inicial.
- Guardar manifest com contagem por tabela e hash por empresa.
- Manter plano de rollback apontando o Portal para o banco antigo ate a virada ser validada.

## Reforcos de integridade no PostgreSQL

- `UNIQUE (empresa_id, codigo_interno)` em `produtos`.
- `UNIQUE (empresa_id, codigo_barras)` parcial para codigo de barras preenchido.
- `UNIQUE (empresa_id, email)` em `usuarios`.
- `UNIQUE (empresa_id, cnpj)` parcial em `filiais`.
- `UNIQUE (empresa_id, codigo_pdv)` em `pdvs`.
- `UNIQUE (empresa_id, uuid)` nas tabelas de eventos sincronizados.

## Validacao pos-migracao

- Rodar `npm test`.
- Ativar um PDV em staging.
- Sincronizar Portal para PDV.
- Enviar venda PDV para Portal.
- Conferir estoque, financeiro automatico, auditoria de sync e assistente.

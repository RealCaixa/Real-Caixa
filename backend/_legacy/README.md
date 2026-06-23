# Legado Desativado

Esta pasta guarda arquivos antigos que nao fazem parte do fluxo ativo do Real Caixa Cloud.

O servidor atual (`backend/server.js`) usa os modulos:

- `backend/auth`
- `backend/users`
- `backend/produtos`
- `backend/categorias`
- `backend/estoque`
- `backend/financeiro`
- `backend/filiais`
- `backend/pdvs`
- `backend/sync`
- `backend/contador`
- `backend/assistente`

Os arquivos movidos para `_legacy` nao devem ser importados por novas funcionalidades. O antigo `auth.js` foi neutralizado para falhar rapidamente caso algum modulo legado seja carregado por engano, removendo o risco de uso de segredos hardcoded.

Antes de reutilizar qualquer logica desta pasta, reimplemente no padrao modular atual e com variaveis de ambiente.

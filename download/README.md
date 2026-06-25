# Instaladores Real Caixa

Esta pasta armazena os instaladores oficiais do PDV Desktop publicados pelo site.

Padrao de arquivo:

```text
RealCaixa_Setup_<versao>.exe
```

Exemplos:

```text
RealCaixa_Setup_2.1.0.exe
RealCaixa_Setup_2.1.1.exe
RealCaixa_Setup_2.2.0.exe
```

Para publicar uma nova versao:

1. Gerar o instalador oficial no projeto REALCAIXA-PRO.
2. Copiar o `.exe` para esta pasta.
3. Atualizar o botao da home em `backend/public/index.html`.
4. Atualizar `versao.json` com a nova versao e `linkDownload`.
5. Fazer deploy do REALCAIXA-SITE.

A URL publica segue o formato:

```text
/download/RealCaixa_Setup_<versao>.exe
```

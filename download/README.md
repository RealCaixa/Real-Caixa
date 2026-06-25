# Instaladores Real Caixa

O site agora busca automaticamente o instalador publicado na ultima GitHub Release
do repositorio `RealCaixa/Real-Caixa`.

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

Fluxo para publicar uma nova versao:

1. Gerar o instalador oficial no projeto REALCAIXA-PRO.
2. Criar uma GitHub Release com a tag da versao, por exemplo `v2.1.1`.
3. Anexar o asset com o nome `RealCaixa_Setup_2.1.1.exe`.
4. Fazer deploy do REALCAIXA-SITE.

O botao "Baixar Instalador" chama `/api/download/latest`, que procura o asset
`RealCaixa_Setup_<versao>.exe` na ultima release e usa a URL oficial do GitHub.

Esta pasta fica como fallback local. Se a GitHub Release estiver indisponivel,
o site usa `versao.json`.

A URL publica local segue o formato:

```text
/download/RealCaixa_Setup_<versao>.exe
```

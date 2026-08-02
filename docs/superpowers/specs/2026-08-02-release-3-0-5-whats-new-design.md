# Release 3.0.5 e modal de novidades

## Objetivo

Publicar o Checkpoint Launcher `3.0.5` com um modal completo de novidades exibido uma unica vez nesta versao, tanto para usuarios que atualizaram quanto para instalacoes novas.

## Experiencia do modal

O modal aparece depois do login e do encerramento da introducao inicial, sem disputar foco com essa experiencia. Ele preserva a paleta, transparencias, tipografia, sons e linguagem flat atuais do launcher.

O cabecalho apresenta o selo `VERSAO 3.0.5`, o titulo `Uma nova fase do Checkpoint` e uma introducao curta. O conteudo e dividido em tres destaques:

1. **Spotify dentro do launcher:** player redesenhado, busca, playlists, fila e Jam.
2. **Controle tambem no jogo:** navegacao completa no overlay, troca de abas e comandos do Spotify.
3. **Perfis e estabilidade:** melhor organizacao dos perfis e correcoes no Spotify, inputs e notificacoes.

O rodape oferece `Ver notas completas` e a acao principal `Comecar`. O link abre a release `v3.0.5` no navegador padrao. Tanto `Comecar` quanto o botao de fechar registram que as novidades foram vistas.

## Acessibilidade e controle

O modal reutiliza `ModalShell` e seus contratos de foco. Mouse e teclado continuam funcionando. Com controle, o direcional navega, A/X confirma e B/circulo fecha. A borda indicativa aparece somente quando o controle e o metodo ativo.

## Catalogo versionado

Um modulo dedicado exporta os destaques por versao, separado da composicao visual. O app consulta a versao instalada pelo IPC `app:get-version`; em ambiente sem Electron, usa a versao publica do build como fallback seguro.

A chave local `checkpoint:last-seen-release` armazena a ultima versao confirmada. Se o valor for diferente de `3.0.5`, o modal abre. A verificacao acontece somente quando existe usuario autenticado e a introducao terminou. Falha ao acessar o armazenamento nao interrompe o launcher; durante a sessao corrente, o modal nao deve entrar em loop.

Instalacoes novas tambem exibem o modal. Ele nao reaparece depois de confirmado, salvo quando uma versao futura possuir outro registro no catalogo.

## Conteudo da release

As notas publicas de `3.0.5` devem refletir apenas mudancas presentes depois da tag `v3.0.4`:

- experiencia Spotify dedicada, com biblioteca, busca, playlists, fila e Jam;
- melhorias de perfil e organizacao visual;
- compatibilidade do Spotify com preload Electron legado;
- ordem sequencial dos inputs da sidebar pelo controle;
- identificacao correta das notificacoes de faixa do Spotify;
- navegacao do overlay in-game por controle e comandos do Spotify;
- deduplicacao do botao central para evitar abrir e fechar no mesmo toque.

## Publicacao

A versao deve ser `3.0.5` no `package.json` e no lockfile. `RELEASE_NOTES.md` recebe uma secao nova no topo. A tag final e `v3.0.5`.

Antes da publicacao, executar as validacoes aplicaveis do repositorio: instalacao pelo lockfile, typecheck/testes, lint, build, cobertura, auditoria, geracao dos artefatos, verificacao da release e smoke do executavel. Qualquer verificacao obrigatoria que falhar bloqueia a afirmacao de que a release esta pronta.

A release publica do GitHub precisa conter artefatos coerentes do mesmo build: instalador `.exe`, `latest.yml` e blockmap. Nenhum token, `.env`, service account ou certificado entra no commit ou no bundle. O auto-update so e considerado distribuido depois que esses artefatos estiverem acessiveis na release publica.

## Testes de aceitacao

- abre na primeira execucao autenticada da `3.0.5` depois da introducao;
- abre para atualizacao a partir de uma versao anterior;
- nao abre novamente depois de `Comecar` ou fechar pelo X;
- volta a abrir quando a versao instalada muda para uma versao futura catalogada;
- funciona sem Electron usando o fallback de versao;
- falha de `localStorage` nao quebra a Home nem causa repeticao na sessao;
- link das notas aponta para `v3.0.5`;
- navegacao por mouse, teclado e controle permanece funcional;
- versoes do pacote, lockfile, tag e metadata dos artefatos sao identicas.

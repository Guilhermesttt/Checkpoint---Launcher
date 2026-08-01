# Tipografia do launcher no overlay in-game

## Objetivo

Aplicar ao overlay nativo as mesmas famílias tipográficas usadas pelo launcher sem converter o overlay para React/TSX e sem alterar layout, IPC ou comportamento.

## Decisão

- Reutilizar o carregamento remoto do Google Fonts já usado em `index.html`.
- Usar `Inter` como fonte de corpo e interface.
- Usar `Unbounded` somente em títulos, marcas e destaques para preservar legibilidade nos cards pequenos.
- Manter `Segoe UI` e fontes do sistema como fallback quando não houver conexão.
- Atualizar a Content Security Policy do overlay somente para permitir o CSS do Google Fonts e os arquivos de fonte do Google Fonts.

## Escopo técnico

- Alterar apenas `electron/overlay.html` e testes diretamente relacionados.
- Não usar o protótipo `src/overlay/OverlayApp.tsx`.
- Não mudar dimensões, vídeos, animações, áudio, atalhos, chat, capturas ou contratos IPC.
- Verificar o carregamento declarado das fontes, os seletores de títulos, os testes do overlay e o build.

## Fora de escopo

A integração com Spotify em `src/services/spotify.ts` será tratada depois, em uma etapa separada.

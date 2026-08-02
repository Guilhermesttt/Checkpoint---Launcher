# Controle no overlay in-game

## Objetivo

Permitir que o overlay in-game seja aberto, fechado e operado inteiramente pelo controle, incluindo os comandos essenciais do Spotify, sem interferir nos inputs do jogo quando o overlay estiver fechado.

## Mapeamento aprovado

- Botao central/Guide: abre ou fecha o overlay.
- Direcional: move o foco entre os elementos interativos visiveis.
- A no Xbox / X no PlayStation: ativa o elemento em foco.
- B no Xbox / circulo no PlayStation: volta ou fecha o overlay.
- L1/R1: alterna entre as abas do overlay.
- L2/R2 na aba Spotify: faixa anterior/proxima.

## Arquitetura

O launcher continua detectando o botao central enquanto o overlay esta fechado, pois sua janela e o provider de gamepad ja permanecem ativos. Ao abrir, o renderer do overlay assume a navegacao e os comandos de midia. O processo principal do Electron mantem o estado autoritativo de abertura e aplica um cooldown curto ao toggle, evitando que launcher e overlay processem o mesmo toque duas vezes.

O overlay usa a Gamepad API para detectar bordas de pressionamento, aplicar deadzone ao analogico esquerdo e transformar o movimento em navegacao direcional. Apenas controles visiveis e habilitados participam da ordem. A troca de aba restaura o foco no primeiro item util da nova aba.

Os comandos do Spotify reutilizam `overlay:panel-action` e os tipos existentes (`spotify-previous`, `spotify-next` e `spotify-toggle`). Nenhum token ou chamada da API do Spotify sera exposto diretamente no HTML do overlay.

## Comportamento de foco

O elemento selecionado recebe uma borda indicativa apenas enquanto o metodo ativo for o controle. Mouse e teclado removem o estado visual de navegacao por gamepad. O direcional usa navegacao espacial baseada na posicao dos elementos, para que cima, baixo, esquerda e direita sigam a geometria apresentada na tela em vez da ordem acidental do DOM.

L1/R1 percorre as abas em ordem circular. B/circulo retorna para o nivel anterior quando houver uma subarea aberta; na raiz, fecha o overlay. Inputs do overlay nao sao processados quando o painel estiver fechado.

## Confiabilidade

- Toggle por borda: segurar o botao central nao repete o comando.
- Cooldown no processo principal: sinais duplicados proximos resultam em uma unica mudanca.
- Um controle ativo por vez, preferindo o que gerou o ultimo input.
- L2/R2 disparam uma vez por pressionamento para nao pular varias faixas.
- A ausencia de Gamepad API nao afeta mouse ou teclado.

## Validacao

Os testes devem cobrir abertura unica pelo botao central, fechamento pelo mesmo botao, navegacao espacial, troca circular de abas, confirmacao e retorno, comandos anterior/proxima do Spotify e ausencia de comandos enquanto o overlay estiver fechado. A verificacao final inclui testes direcionados, suite completa pertinente e build de producao.

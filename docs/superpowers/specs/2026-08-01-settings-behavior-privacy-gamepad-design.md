# Ajustes: comportamentos, áudio, privacidade e controle

Data: 2026-08-01
Status: aprovado para planejamento

## Objetivo

Reorganizar a tela de Ajustes para caber com clareza na janela do launcher, transformar a antiga área de desempenho em comportamentos reais do aplicativo, adicionar privacidade persistente ao perfil e tornar a navegação por controle previsível.

A aparência atual do working tree e das capturas aprovadas é a referência visual. Cores, gradientes e opacidades existentes não serão alterados. O trabalho visual fica limitado a hierarquia, espaçamento, tipografia, dimensões, alinhamento e raios.

## Escopo

O trabalho cobre quatro frentes relacionadas dentro de Ajustes:

1. Comportamentos do App.
2. Efeitos Sonoros & Áudio.
3. Contas conectadas e Privacidade.
4. Indicador e movimentação de foco por controle.

Steam sync, autenticação, conquistas, amigos/chat, Discord Rich Presence, overlays, notificações, temas, sons e navegação existente fora das áreas alteradas devem continuar funcionando.

## Abordagem escolhida

A implementação usará navegação guiada nos Ajustes e um algoritmo espacial melhorado como fallback no restante do launcher. Essa abordagem oferece direção determinística na tela reportada sem exigir a reescrita imediata de toda a navegação global.

Os componentes de Ajustes continuarão seguindo a estrutura React atual. Preferências exclusivas do dispositivo ficam no `PreferencesContext`; privacidade, por ser uma propriedade social da conta, fica persistida no Supabase e é aplicada no servidor.

## Design visual

### Hierarquia compartilhada

- Cada aba terá um título principal, uma descrição curta e grupos internos claramente separados.
- Títulos de seção, rótulos, textos auxiliares e ações usarão uma escala tipográfica consistente; textos essenciais não poderão ficar truncados em resoluções suportadas.
- Containers externos terão raio maior que seus elementos internos. Cards irmãos usarão o mesmo raio e espaçamento.
- A densidade será reduzida sem criar grandes vazios: controles relacionados ficarão no mesmo grupo e ações secundárias não disputarão atenção com valores e rótulos.
- Os breakpoints deverão manter o conteúdo utilizável em uma janela de 1365 × 768 e em larguras menores já suportadas pelo layout atual.

### Efeitos Sonoros & Áudio

- Os quatro controles serão organizados em grade 2 × 2 quando houver espaço e em uma coluna em larguras estreitas.
- Cada item mostrará ícone, nome completo, descrição curta, valor percentual, slider e, quando aplicável, botão `Testar`.
- Valor e ação ficarão alinhados, sem sobreposição e sem truncar o nome do canal.
- `Mudo` e `Máximo` serão informações secundárias próximas ao slider.
- Música continuará respeitando o limite funcional atual de 35, embora o valor seja apresentado como percentual configurável do launcher.
- Testes de som continuarão acionando o mesmo canal que o usuário está ajustando.

## Comportamentos do App

A seção anteriormente chamada `Desempenho` será renomeada para `Comportamentos do App`. Ela reunirá cinco preferências:

1. `Iniciar com o Windows` — preserva a integração Electron existente.
2. `Ocultar ao Jogar` — preserva o comportamento atual de ocultar o launcher quando um jogo inicia.
3. `Minimizar para a bandeja ao fechar` — ao usar o botão de fechar da janela, oculta o launcher e mantém processos permitidos em segundo plano.
4. `Restaurar a última tela aberta` — restaura apenas a categoria principal e, no caso de Ajustes, sua subaba. Modais, menus flutuantes e painéis temporários não são restaurados.
5. `Confirmar antes de sair` — pede confirmação antes de encerrar o processo do launcher.

As três novas opções serão preferências por usuário e por dispositivo, seguindo o armazenamento local já usado pelo `PreferencesContext`.

Precedência ao fechar:

- Se `Minimizar para a bandeja ao fechar` estiver ativo, o botão de fechar oculta a janela e não abre confirmação.
- Se a minimização estiver desativada e `Confirmar antes de sair` estiver ativo, o botão de fechar abre a confirmação.
- Se ambas estiverem desativadas, o botão de fechar encerra o aplicativo.
- Uma ação explícita `Sair do aplicativo` respeita a confirmação, mas encerra o processo após a confirmação mesmo que a minimização para bandeja esteja ativa.
- Encerramentos necessários para atualização ou desligamento do sistema não ficam presos ao diálogo.

O `Modo de Desempenho` da aba `Personalização` permanece onde está e conserva seu efeito atual sobre animações, vídeo e música. Ele é uma configuração técnica diferente do bloco renomeado em `Geral`.

## Contas conectadas e Privacidade

`Contas conectadas` e `Privacidade do perfil` serão blocos distintos dentro da aba `Contas & Privacidade`.

### Contas conectadas

- Steam e Discord mantêm conexão, sincronização e desvinculação atuais.
- Spotify continua claramente marcado como indisponível enquanto não existir integração completa.
- Os cards devem mostrar estado, identidade conectada e ação principal sem truncamento.

### Visibilidade do perfil

Haverá uma escolha binária persistida na conta:

- `Público`: usuários autenticados do Checkpoint podem encontrar e visualizar o perfil completo permitido pela plataforma.
- `Privado`: nome e avatar continuam disponíveis na busca para possibilitar pedidos de amizade; bio, jogos, atividade, conquistas, gêneros e estatísticas ficam disponíveis apenas ao próprio usuário e a amigos aceitos.

O valor padrão para contas existentes e novas será `Público`, preservando o comportamento social atual. Alterar a visibilidade terá estado de carregamento, confirmação de sucesso e rollback visual em caso de falha.

Uma migration adicionará a visibilidade com restrição de valores válidos. As rotas do servidor que buscam usuários, retornam perfis, atividades ou estatísticas deverão aplicar a mesma regra; não será suficiente esconder dados apenas no renderer. As políticas RLS e consultas que usam credenciais administrativas serão revisadas para impedir que uma rota contorne a escolha do usuário.

## Controle e foco

### Visibilidade da borda

A borda indicativa de foco por controle será exibida somente quando as duas condições forem verdadeiras:

1. existe um controle conectado; e
2. o último tipo de entrada detectado foi o controle.

Usar mouse ou teclado remove imediatamente o indicador visual, sem desconectar o controle. Voltar a usar o controle reativa a borda. O foco nativo de teclado continuará disponível para acessibilidade e não será confundido com o indicador do controle.

### Movimento direcional

- Nas abas e grupos de Ajustes, cada controle interativo receberá um grupo e uma posição de navegação explícitos; vizinhos especiais serão declarados quando a ordem visual não puder ser derivada da grade.
- Cima/baixo percorre a hierarquia visual e mantém a coluna sempre que possível.
- Esquerda/direita ajusta o slider quando um slider está focado; fora dele, move o foco horizontalmente.
- `X` ativa botões e switches.
- O algoritmo espacial de fallback descarta candidatos fora de um cone direcional, favorece sobreposição no eixo secundário e só então compara distância. Isso impede que um elemento diagonal, porém ligeiramente mais próximo, vença um elemento visualmente abaixo.
- Elementos ocultos, desabilitados ou fora do grupo ativo não participam da navegação.
- Ao trocar de aba, o primeiro controle útil do conteúdo recebe foco; o sistema não deixa atributos de foco antigos em elementos desmontados.
- O elemento focado é rolado apenas o necessário para permanecer visível.

## Fluxo de dados

### Preferências locais

Os setters do `PreferencesContext` atualizam React imediatamente e persistem chaves associadas ao usuário. Comportamentos que dependem do processo principal usam a ponte preload/IPC existente ou uma extensão tipada dela. A restauração da última tela ocorre somente após a hidratação da preferência, evitando piscar primeiro na rota padrão.

### Privacidade

Ao abrir a aba, a UI usa o perfil autenticado já hidratado ou busca o campo de visibilidade. Ao alterar a escolha, a UI entra em estado de salvamento, persiste no backend e atualiza o perfil compartilhado. Em falha, restaura o valor anterior e mostra erro acionável. Rotas sociais consultam a relação entre solicitante e dono do perfil antes de compor campos detalhados.

### Entrada do controle

O `GamepadContext` continua sendo a fonte de conexão e do último tipo de input. O estado é refletido em um atributo de nível alto para que o CSS exiba a borda apenas no modo correto. O hook de foco resolve primeiro a navegação declarada e usa o cálculo espacial somente quando não houver vizinho explícito.

## Tratamento de erros

- Falhas ao salvar preferências locais não quebram a tela; o estado da sessão continua utilizável e a falha é registrada no log do renderer sem expor dados sensíveis.
- Falhas IPC restauram o estado confirmado pelo processo principal quando houver retorno verificável.
- Falha ao salvar privacidade restaura a seleção anterior e informa que a alteração não foi aplicada.
- Perfil sem campo de visibilidade é tratado como público durante a migração compatível.
- Ausência ou desconexão do controle remove o indicador e cancela repetições de direção pendentes.

## Testes e validação

### Testes automatizados

- Hidratação e persistência das três novas preferências locais.
- Precedência entre minimizar para bandeja, confirmar saída e encerramentos forçados.
- Restauração somente de categoria e subaba válidas.
- Persistência da visibilidade e rollback em falha.
- Respostas públicas e privadas para desconhecido, amigo aceito e próprio usuário.
- Ausência de campos privados em busca e endpoints sociais.
- Indicador de controle para conexão, alternância de último input e desconexão.
- Movimento para cima, baixo, esquerda e direita em grids, sliders, switches e troca de aba.
- Regressões dos testes existentes de Steam, amigos/chat, overlay, sons e controle.

### Verificação manual

- Conferir a tela em 1365 × 768 e nos breakpoints existentes, sem textos essenciais cortados ou controles sobrepostos.
- Navegar toda a tela apenas com controle e repetir o caminho que antes saltava para a direção errada.
- Alternar entre controle, mouse e teclado para confirmar a borda correta.
- Reiniciar o launcher para validar persistência e restauração.
- Testar perfil privado com uma conta amiga e outra sem amizade.

Antes de concluir, executar testes direcionados, typecheck, lint e build. Limitações de ambiente ou validações externas pendentes deverão ser relatadas sem tratar o trabalho como lançado.

## Fora de escopo

- Alterar cores, gradientes ou opacidades.
- Implementar Spotify.
- Criar níveis adicionais como `Somente amigos` além do modelo público/privado aprovado.
- Reescrever toda a navegação por controle do launcher.
- Restaurar modais ou estado transitório ao iniciar.
- Alterar regras de Steam sync, conquistas, chat, Discord, overlays ou notificações além do necessário para preservar compatibilidade.

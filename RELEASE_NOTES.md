## Checkpoint Launcher — v2.0.0

Lançamento: 16 de julho de 2026.

A versão 2.0.0 amplia o Checkpoint de um launcher de biblioteca para uma experiência desktop e in-game integrada. O foco desta versão é o novo overlay, a confiabilidade das conquistas, a continuidade em segundo plano e um fluxo mais completo para jogos locais.

### Novo overlay in-game

- Central multipágina no tema preto e branco do Checkpoint, com páginas de Início, Chat, Jogo, Mídia, Conquistas, Configurações e Perfil.
- Amigos online e offline, busca, perfil próprio e avatar do Discord quando a conta está conectada.
- Chat em tempo real dentro do jogo, com lista de conversas separada, envio, exibição do indicador de digitação do amigo e feedback de erro.
- Badge de chat exibido somente quando há mensagens não lidas.
- Página do jogo em execução com duração da sessão, tempo total, conquistas, amigos jogando, plataforma, executável, desenvolvedor, lançamento, modo de janela e resolução.
- Lista rolável de conquistas do jogo atual, com ícone, descrição, data e estados bloqueado/desbloqueado.
- Galeria de capturas recentes, captura imediata, abertura da pasta e exclusão para a Lixeira com confirmação dupla.
- Atalho de captura personalizável com `F1`–`F24`, `Print Screen` e combinações com `Ctrl`, `Alt` ou `Shift`.
- Abertura por `Ctrl + Shift + O` e suporte ao botão Guide/PS/Home do controle quando disponibilizado pelo sistema.
- Novos toasts compactos para jogo iniciado, dica de abertura do overlay e conquista desbloqueada.

### Conquistas e perfis

- Totais canônicos calculados sobre toda a biblioteca, sem o antigo limite de 80 jogos.
- Agregação de conquistas locais por jogo e Steam App ID, com deduplicação de caches e tolerância a cache corrompido.
- Sincronização Steam em lotes, com registro de cobertura e preservação de totais válidos quando um jogo falha.
- Perfil próprio e perfis de amigos passam a consumir o mesmo resumo consolidado.
- Receiver de emulador passa a usar a porta realmente escolhida pela bridge local.
- Filhos iniciados pelo mesmo launcher ou no diretório do jogo podem ser adotados como o processo real; se nenhum processo qualificado for encontrado, a sessão local é encerrada após o timeout.

### Segundo plano e jogos locais

- Presença, sessões, polling da Steam e watchers de conquistas continuam ativos com a janela escondida ou minimizada na bandeja.
- Sessões Steam abertas por URI usam a presença pública da conta para confirmar início e encerramento; sessões não observáveis ficam marcadas como provisórias e possuem expiração de segurança.
- Perfis de inicialização por jogo local com monitor, modo padrão/borderless/janela, resolução, prioridade, argumentos e diretório de trabalho.
- Tentativa de aplicar monitor, modo de janela e resolução a jogos locais; o overlay exibe o perfil solicitado, sem afirmar que o jogo aceitou a configuração.
- Encerramento mais seguro de watchers, timers e processos auxiliares ao sair do launcher.

### Interface e experiência

- Modal Adicionar/Editar jogo redesenhado em seções para plataforma, preenchimento automático, identidade e artes.
- Prévia fixa do card, checklist de cadastro, validação visível e ação correta para criar ou editar.
- Buscas Steam/Epic cancelam respostas atrasadas ao trocar de plataforma ou fechar o modal.
- No chat da janela principal, teclado virtual do controle e conversa passam a ocupar áreas lado a lado.
- Feed de atividade para jogos iniciados e conquistas de amigos.
- Publicação do feed passa pelo backend, que deriva identidade, amizade, audiência e horário sem confiar nesses campos enviados pelo cliente.
- Artes locais do modal são validadas, redimensionadas e comprimidas antes de entrarem no documento do jogo.

### Qualidade e segurança

- Novos testes para overlay, chat, capturas, controle, perfis de inicialização, polling oculto, resumo de conquistas e bibliotecas com mais de 80 jogos.
- Regras e índices do Firestore atualizados para o feed social.
- IPCs do desktop permanecem restritos pelo preload e pelas validações de segurança.

### Limitações conhecidas

- Fullscreen exclusivo pode impedir que uma janela externa apareça sobre o jogo. Para o overlay, use modo janela ou borderless.
- O botão Guide/PS/Home pode ser capturado pela Xbox Game Bar, Steam ou pelo driver do controle.
- Feed social e resumo agregado da Steam exigem que o backend, as regras e os índices desta versão estejam publicados.
- Capturas são armazenadas localmente. Backup de saves na nuvem e coleções inteligentes não fazem parte desta versão.
- Chat e histórico recente são transitórios: o backend mantém até 30 mensagens por conversa em memória e pode perdê-las ao reiniciar.

---

## Versões anteriores

O histórico completo, inclusive a v1.0.9, está disponível em [GitHub Releases](https://github.com/Guilhermesttt/Checkpoint---Launcher/releases).

### Checkpoint Launcher — v1.0.8

Atualização focada na robustez do sistema de conquistas para jogos locais com emuladores Steam.

### Melhorias e correções desta versão

#### 🏆 Sistema de Conquistas — Correções
- **Nome e descrição reais no overlay:** Conquistas agora mostram o nome e descrição corretos ao invés do ID técnico bruto (ex: `ACH_WIN_000`). O sistema resolve metadados em duas etapas: primeiro no cache da Steam API salvo pelo launcher, depois no `steam_settings/achievements.json` local do Goldberg
- **Ícone da conquista no overlay:** O card de conquista agora exibe o ícone real da conquista (URL da CDN Steam). Fallback para o ícone de troféu quando não disponível
- **Conquistas subsequentes funcionando:** Corrigido bug em que apenas a primeira conquista aparecia no overlay. A causa era o mecanismo de detecção de duplicatas do bridge silenciando conquistas novas. O overlay agora recebe notificações diretamente do watcher, sem passar pela camada de persistência
- **Proteção contra parse errors:** O estado de conquistas não é mais zerado quando o arquivo do emulador está sendo escrito ao mesmo tempo que é lido, evitando falsos positivos

#### 🕹️ Detecção de Emuladores — Novo suporte
- **`readGoldbergSettingsAchievements`:** Nova função que lê o schema de conquistas diretamente do `steam_settings/achievements.json` do Goldberg, incluindo nome display multilíngue, descrição e caminho de ícone local. Serve como fallback universal quando o schema remoto da Steam não está disponível
- Suporte aprimorado ao formato Goldberg com `display_name: { english: "..." }` e `description: { english: "..." }`

#### 🛡️ Estabilidade
- Callbacks de watcher (`setInterval` / `setTimeout`) agora tratam erros do handler async com `.catch()` explícito, evitando unhandled rejections silenciosas

---

## Checkpoint Launcher — v0.0.1



Primeira release pública estável do Checkpoint Launcher, um hub pessoal de jogos com sincronização da Steam, overlay in-game e recursos sociais integrados.

### O que tem nessa versão
- Sincronização com a Steam para biblioteca, perfil, metadados e conquistas
- Uso do `Steam App ID` como base de dados dos jogos, inclusive para jogos locais
- Sistema de conquistas mais integrado, com suporte a leitura de schema da Steam para jogos locais
- Overlay in-game com notificações de conquista, mensagens e atividade social
- Chat de amigos em tempo real com contador de não lidas, overlay de nova mensagem e indicador de digitação
- Links clicáveis no chat, com preview para links de imagem
- Lista de amigos com presença em tempo real, status online/offline/jogando e abertura rápida de chat/perfil
- Importação manual de jogos da Epic Games com scraping mais completo de descrição, screenshots e metadados
- Integração com Discord para presença e recursos sociais
- UI temática com efeitos sonoros inspirados em GameCube, Xbox 360 e PS2
- Ajustes de UX na Home, nos modais sociais e no fluxo de amizade
- Correções de estabilidade no launcher, incluindo encerramento correto de processos em segundo plano

### Melhorias e correções desta versão
- Correção do fechamento do launcher para evitar processos presos em segundo plano
- Correção do fluxo de presença dos amigos
- Correção e refinamento do sistema de chat
- Scroll estilizado no chat
- Badges de mensagens não lidas na lista de amigos
- Botão para enviar mensagem direto pela Home social
- Remoção de dependência de upload local no chat, usando links de imagem no lugar

> ⚠️ O projeto continua em desenvolvimento ativo. Bugs, ajustes visuais e mudanças de comportamento ainda podem acontecer entre versões.

### Instalação
Baixe o `.zip`, extraia em qualquer pasta e execute o launcher. Nenhuma instalação adicional é necessária.

### Asset
- `Checkpoint-Launcher-Windows.zip` — build completa para Windows

---

Encontrou algum problema? Abra uma issue no repositório.

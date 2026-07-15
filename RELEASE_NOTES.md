## Checkpoint Launcher — v1.0.8

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

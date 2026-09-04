# Release Notes — Phelierium Game Hub

## Phelierium Game Hub — v3.3.0 (Security & Platform Sync)

Grande atualização com reformulação de segurança e sincronização de plataformas (Epic Games e Steam), ciclo de vida com journaling e purga transacional, sanitização estrita de descrições da loja, CSP reforçado e gate de segurança com 20 controles automatizados.

### Destaques da versão 3.3.0

#### 🛡️ Arquitetura Segura para Epic Games Desktop
- **Isolamento de Credenciais e Processo:** Execução local do Legendary fixado na versão 0.21.0 com validação de hash SHA-256 (`4c01a1...`), sem tokens transitando pelo servidor remoto ou expostos ao renderer.
- **Normalização Sanitizada:** Remoção integral de tokens brutos, refresh tokens e códigos de autorização nos payloads de conta e biblioteca.
- **Superfície Express Minimizada:** Eliminação de endpoints privados da Epic no servidor remoto, tornando o backend estritamente voltado para callbacks OAuth e APIs públicas com rate limiting dedicado.

#### 🔄 Ciclo de Vida Resiliente & Purga Transacional
- **Máquina de Estados Pura por Plataforma:** Gerenciamento isolado das transições de conexão, sincronização e desconexão (`connecting`, `syncing`, `disconnecting`, `idle`, `error`) com suporte a progresso nativo e retry determinístico.
- **Limpeza Atômica Local com Journaling:** Tabela SQLite `platform_cleanup_state` e transações atômicas para remoção de dados locais e caches de conquistas, com recuperação automática de limpezas interrompidas no boot.
- **Purga em Nuvem com RPC Escopada:** Migração Supabase com função RPC `purge_my_platform_data(platform_name)` com `SECURITY DEFINER` e validação estrita do `auth.uid()` do chamador.

#### ✨ Experiência Visual e Acessibilidade (UX)
- **Skeletons de Biblioteca Dinâmicos:** `PlatformLibrarySkeleton` com animação de shimmer, contadores em tempo real e conformidade ARIA (`role="status"`, `aria-busy="true"`).
- **Indicadores de Sincronização na Sidebar:** Badges e ícones animados para Steam e Epic durante sincronizações em segundo plano.
- **Transições Suaves de Remoção:** `PlatformRemovalTransition` garantindo feedback contínuo de fases sem desaparecimento abrupto de cards nas configurações.

#### 🔒 Gate de Lançamento e 20 Controles de Segurança
- **Sanitização Centralizada com DOMPurify:** Sanitizador estrito `sanitizeStoreHtml` para descrições e requisitos da loja.
- **Content Security Policy Estrito:** Meta tag CSP no empacotamento desktop sem `unsafe-eval` e Helmet CSP no servidor API.
- **Varredura de Segredos & CI:** Script automatizado `scripts/scan-secrets.cjs` e workflow no GitHub Actions rodando os 20 controles antes de qualquer release.

---

## Phelierium Game Hub — v3.2.4 (Telemetria de Controle, Voz Ultrarrápida & Galeria In-Game)

Atualização massiva trazendo telemetria nativa de bateria e conexão USB/Bluetooth para controles, conexões instantâneas de chamadas de voz com LiveKit Cloud e compartilhamento de tela, galeria in-game e navegação espacial por D-Pad, sistema abrangente de troféus em tempo real, presença social instantânea e instalador com suporte completo a Modo Escuro (Dark Mode).

### Destaques da versão 3.2.4

#### 🎮 Telemetria Avançada & Bateria de Controles
- **Leitura Precisa de Bateria e Conexão:** Detecção nativa em tempo real de nível de bateria (porcentagem e status de carregamento) e conexão determinística USB vs Bluetooth para controles PlayStation DualSense (PS5), DualShock 4 e Xbox.
- **Feedback Visual na HUD & Overlay:** Indicadores visuais de status de hardware integrados na barra superior, no dashboard principal e no overlay durante as partidas.

#### 🎙️ Chamadas de Voz Instantâneas & Compartilhamento de Tela
- **Conexão Ultrarrápida via LiveKit Cloud SFU:** Conexões imediatas com sinalização WebRTC Trickle ICE paralelo e Content Security Policy (CSP) otimizado, eliminando atrasos no estabelecimento da chamada.
- **Compartilhamento de Tela com Áudio Integrado:** Seletor nativo de telas e janelas para streaming de gameplay entre amigos, com mixagem e controle de ganho sonoro.

#### 🖼️ Galeria de Fotos In-Game & Navegação Espacial no Controle
- **Navegação D-Pad em Malha Espacial:** Seleção de capturas de tela tanto no overlay in-game quanto no `GameDetailPanel` com foco contínuo e responsivo.
- **Visualizador Fullscreen e Atalhos Rápidos:** Abertura instantânea de capturas em alta resolução com atalho no botão Quadrado / X para exclusão rápida e confirmação sem mouse.

#### 🏆 Sistema de Troféus & Gamificação em Tempo Real
- **Desbloqueio com Efeitos Sonoros:** Stream em tempo real de conquistas com banners animados (toasts) no topo da tela e efeitos sonoros sincronizados.
- **Histórico e Perfis Sociais:** Visualização detalhada de conquistas, tempo de jogo e estatísticas completas em perfis públicos com fallback seguro para privacidade.

#### 💬 Chat em Tempo Real & Presença Social
- **Sincronização Imediata de Status:** Notificações de amigos online com debounce de eventos de saída para evitar spam de alertas.
- **AuthProvider com Supabase e Google OAuth:** Troca segura de tokens no servidor e restauração instantânea de sessão protegida com JWT.

#### 🖤 Instalador NSIS Dark Mode & Visual Personalizado
- **Tema Escuro Nativo no Instalador:** Janela inteira, rodapé, barra de título e controles do assistente de instalação configurados em Dark Theme.
- **Artes de Cabeçalho e Lateral em 24-bits:** Bitmaps de alta resolução no instalador com a identidade visual cósmica do Phelierium Hub.

#### ⚡ Performance 60 FPS Console-Grade
- **Virtualização de Listas e Aceleração GPU:** Janelamento inteligente com `requestAnimationFrame` em painéis extensos de conquistas e listas de amigos, garantindo 60 FPS estáveis.

---

## Phelierium Game Hub — v3.2.3

Atualização com correção de carregamento de capturas locais no painel de detalhes dos jogos (`cp-media://`) e navegação completa por controle/gamepad e botões interativos no visualizador de capturas de tela do overlay.

---

## Phelierium Game Hub — v3.2.2

Atualização com redesenho cósmico do Overlay in-game, otimizações de performance estilo console 60 FPS e refinamentos sonoros do tema Phelierium.

### Destaques da versão 3.2.2

#### 🌌 Overlay Cósmico Glassmorphism
- **Design Sideral Monocromático:** Reformulação visual completa com tipografia Space Grotesk (display) e Inter (corpo), paleta mono pura preto e branco e nós estelares orbitais.
- **Vidro Translúcido com Backdrop-Filter:** Painel de comando em vidro translúcido de alta definição que preserva a visibilidade clara da gameplay em segundo plano.
- **Foco e Limpeza:** Remoção do módulo legado do Spotify, deixando o Command Panel mais limpo, ágil e focado na experiência gamer.

#### ⚡ Performance 60 FPS Console-Grade
- **Aceleração por Hardware GPU (`translateZ(0)` & `will-change`):** Todos os cards de amigos, conquistas, métricas de sessão e conversas agora operam em camadas compostas na GPU.
- **Isolamento de Renderização com CSS Containment:** Grids e listas com `contain: content`, eliminando engasgos (stuttering) e reflows durante o scroll e interações rápidas.
- **Micro-interações Ágeis:** Transições encurtadas para 120ms com curvas rápidas de aceleração `cubic-bezier`.

#### 🔊 Efeitos Sonoros Phelierium Default
- **Sons Nativos Integrados:** Áudio de início de jogo (`ui_game_start`), nova mensagem no chat (`ui_new_chat_message`), chamadas e notificações mapeadas para o tema padrão.
- **Correção de Áudio Fantasma:** Eliminação de gatilhos indevidos de áudio ao minimizar o hub ou alternar janelas.

---

## Phelierium Game Hub — v3.2.1

Atualização de estabilidade, acessibilidade e refinamentos de qualidade de vida do overlay e navegação.

### Destaques da versão 3.2.1

#### 🚀 Estabilidade & Overlay
- **Deduplicação e Tratamento de Alertas:** Deduplicação inteligente de notificações no overlay com suporte a `aria-live` para melhor acessibilidade.
- **Validação de Payload:** Sanitização e validação de schema via Zod nos eventos do processo principal e IPC do Electron.

#### 🎮 Acessibilidade e Navegação
- **Suporte a Gamepad e Teclado:** Navegação fluida no OverlayApp e modais de chamada de voz com foco visual nativo.
- **Detecção de Motion Reduzido:** Integração com preferências do sistema operacional (`usePrefersReducedMotion`) e suavização adaptativa em transições de UI.

#### 🛠️ Empacotamento e Qualidade
- **Verificação de Integridade de Release:** Suíte de validação automatizada de checksum SHA-512, blockmaps do auto-updater e instalador NSIS.

---

## Phelierium Game Hub — v3.2.0

Atualização de performance, modernização estética da biblioteca e otimização abrangente de assets e renderização.

### Destaques da versão 3.2.0

#### 🚀 Performance & Otimização de Assets
- **Remoção de dependências pesadas:** Remoção do Three.js e substituição por efeitos e transições puras aceleradas por GPU, reduzindo o tamanho do bundle e melhorando os tempos de inicialização e responsividade.
- **Otimização de Pacotes de Sons e Mídia:** Otimização e padronização dos assets sonoros para carregamento instantâneo e menor consumo de memória.
- **Transições Suaves com Hardware Acceleration:** Animações e efeitos de hover reformulados com transformações 3D aceleradas por hardware no `GameCard` e na interface principal.

#### 🎮 Modernização de Interface e Usabilidade
- **GameCard Redesenhado:** Visual moderno, clean e com sombras dinâmicas de iluminação ambiente.
- **Navegação Completa por Gamepad & Teclado:** Suporte fluido para navegação entre tabs, carrosséis e overlays com controle ou teclado.
- **Áudio WebRTC Sem Latência e Soft Limiter:** Reprodução nativa sem atrasos e com proteção contra picos de volume.
- **Barramento U2U em Tempo Real:** Sincronização ultra-rápida de status, presença e mensagens com latência sub-50ms.

#### 🛠️ Estabilidade e Correções
- **Validação de Notificações com Zod:** Segurança e integridade de tipos em todas as notificações enviadas para o overlay.
- **Persistência Confiável de Perfis e Credenciais:** Armazenamento síncrono atômico para perfis de mods e credenciais seguras.
- **Compatibilidade e Integrações:** Atualização dos conectores Spotify e plataformas de jogos.

---

## Checkpoint Launcher — v3.1.2

- **Áudio WebRTC Sem Latência e DOM AutoPlay**
- **Barramento Global de Eventos U2U em Tempo Real**
- Edição de canais de voz, simulador de chamadas e overlays reativos instantâneos.

---

## Checkpoint Launcher — v3.1.1

- Supressão de ruído por IA (RNNoise WASM), ganho real WebRTC e correções de chamada.

---

## Checkpoint Launcher — v3.1.0

- Atualização de layout, modais sociais e melhorias de busca.

---

## Checkpoint Launcher — v0.0.1

Primeira release pública estável do Checkpoint Launcher.

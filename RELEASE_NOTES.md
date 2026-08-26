# Release Notes — Phelierium Game Hub

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

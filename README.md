<div align="center">

# 🎮 Checkpoint Launcher

**O hub definitivo para a sua biblioteca de jogos — com voz, chat e comunidade embutidos.**

Um gerenciador de jogos de alto desempenho para Windows que reúne toda a sua biblioteca (Steam, Epic, GOG, EA, Ubisoft, Xbox e mais) em um único lugar — com conquistas, overlay in-game, mods via Nexus e um sistema social completo com **chamadas de voz, compartilhamento de tela e salas em grupo**, direto no launcher.

[![Latest Release](https://img.shields.io/github/v/release/Guilhermesttt/Checkpoint---Launcher?style=for-the-badge&color=6366f1&label=vers%C3%A3o)](https://github.com/Guilhermesttt/Checkpoint---Launcher/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/Guilhermesttt/Checkpoint---Launcher/total?style=for-the-badge&color=6366f1&label=downloads)](https://github.com/Guilhermesttt/Checkpoint---Launcher/releases)
[![Platform](https://img.shields.io/badge/platform-Windows-6366f1?style=for-the-badge&logo=windows11&logoColor=white)](#-instalação)
[![License](https://img.shields.io/badge/licença-Todos%20os%20direitos%20reservados-6366f1?style=for-the-badge)](#-licença)

[**⬇️ Baixar agora**](https://github.com/Guilhermesttt/Checkpoint---Launcher/releases/latest) · [Notas da versão](RELEASE_NOTES.md) · [Reportar um bug](https://github.com/Guilhermesttt/Checkpoint---Launcher/issues) · [Sugerir uma feature](https://github.com/Guilhermesttt/Checkpoint---Launcher/issues/new)

</div>

---

## 🗣️ Fale, jogue, compartilhe — sem sair do launcher

O Checkpoint nasceu de um problema real: plataformas de chamada foram cortando funcionalidades que gamers usam todo dia. Por isso construímos um sistema de comunicação nativo, pensado do zero para quem joga:

| | |
|---|---|
| 🎙️ **Chamadas de voz em WebRTC** | Baixa latência, ponto a ponto, sem depender de servidor de mídia de terceiros. |
| 🖥️ **Compartilhamento de tela em 1080p** | Mostre sua gameplay pro grupo em alta qualidade, direto do desktop. |
| 👥 **Salas em grupo** | Chame a squad inteira pra call antes, durante ou depois da partida. |
| 🔇 **Controles completos de call** | Mute, ativação por voz (PTT/VAD), indicadores de fala e seleção de dispositivo. |
| 🟢 **Presença em tempo real** | Veja quem tá online, o que cada amigo está jogando, e entre na conversa. |

> Tudo isso integrado ao mesmo lugar onde você já gerencia sua biblioteca — sem alternar entre launcher, Discord e outro app de call.

---

## 🚀 Principais Recursos

### 🎮 Biblioteca & Jogos
- **Biblioteca Unificada** — Steam, Epic Games Store, GOG, EA App, Ubisoft Connect, Xbox, Battle.net, Riot Games, Rockstar e executáveis locais, tudo num só lugar.
- **Central de Conquistas** — acompanhamento de progresso da Steam, Epic e conquistas locais (com suporte a emuladores Steam compatíveis).
- **Overlay In-game** — atalho personalizável (`Ctrl + Shift + O` ou botão Guide do controle), galeria de capturas nativa e feed de atividades.
- **Perfis Avançados de Inicialização** — seleção de monitor, modo de janela, resolução, prioridade de processo e argumentos de linha de comando por jogo.

### 🧩 Mods
- **Integrado com Nexus Mods** — navegação no catálogo, busca de mods, downloads assistidos por protocolo `nxm://`, instalação e gerenciamento de arquivos por jogo.

### 💬 Social & Comunicação
- **Hub Social & Chat** — amigos no Checkpoint, chat integrado com indicador de digitação e mensagens não lidas.
- **Voz, tela e grupos** — veja a seção acima ☝️.

### 🎨 Experiência
- **Estética Visual Premium** — cores adaptadas dinamicamente às capas dos jogos (com clamping automático de contraste), raios aninhados e suporte total a temas escuros.
- **Navegação Elegante** — breadcrumbs funcionais e sistema padronizado de sub-tabs (`Amigos`, `Chat`, `Solicitações`, `Mods`, `Gerenciar`).
- **Atualizações Confiáveis** — atualizador automático via GitHub Releases, com inspeção detalhada de erros e tratamento amigável de logs.

---

## 🛠️ Arquitetura Técnica

| Camada | Tecnologias |
|---|---|
| **Frontend** | React 19 · TypeScript · TailwindCSS · Framer Motion · Lucide Icons |
| **Desktop Runtime** | Electron 39 — arquitetura Multi-Window (Janela Principal + Overlay In-Game) |
| **Comunicação em tempo real** | WebRTC (`simple-peer`) + `desktopCapturer` para voz, vídeo e screen share |
| **Bundler** | Vite 8 |
| **Banco de Dados Local** | SQLite (via `userData`) para biblioteca, sessões e arquivos de mods |
| **Backend & Cloud** | Supabase + backend Node.js próprio para autenticação, presença social e chat |
| **Publicação & Auto-update** | Electron Builder + `electron-updater` via GitHub Releases |

---

## 💻 Desenvolvimento Local

### Pré-requisitos
- Node.js >= 22.0.0
- npm >= 10.0.0

### Instalação

```powershell
# Clone o repositório
git clone https://github.com/Guilhermesttt/Checkpoint---Launcher.git
cd Checkpoint---Launcher

# Instale as dependências
npm install

# Inicie o ambiente de desenvolvimento (Vite + Electron)
npm run electron:dev
```

### Comandos de Teste e Build

```powershell
# Executar a suíte de testes unitários e checagem de tipos
npm run test:ci

# Validar compilação e empacotamento
npm run build

# Empacotar instalador Windows (NSIS)
npm run dist
```

---

## 🗺️ Roadmap

- [ ] Supressão de ruído nativa nas chamadas de voz
- [ ] Melhorias de estabilidade e arquitetura no sistema de chamadas em grupo
- [ ] Refino visual da aba retrô/CRT
- [ ] Suporte a mais launchers de terceiros

> Acompanhe o desenvolvimento e sugira ideias na aba [Issues](https://github.com/Guilhermesttt/Checkpoint---Launcher/issues).

---

## 🤝 Contribuindo

O Checkpoint está em desenvolvimento ativo. Encontrou um bug ou tem uma sugestão? Abra uma [issue](https://github.com/Guilhermesttt/Checkpoint---Launcher/issues) — todo feedback ajuda a moldar o projeto.

---

## 📄 Licença

Desenvolvido por **Guilherme Sant'Ana**. Todos os direitos reservados.

<div align="center">

**[⬆ Voltar ao topo](#-checkpoint-launcher)**

</div>

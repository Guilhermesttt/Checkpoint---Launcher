<div align="center">

<img src="src/assets/Pherielium_logo.png" alt="Pherielium Logo" width="160" />

# PHERIELIUM

**Seus jogos. Seu mundo. Seu Pherielium.**

Um hub de jogos unificado, construído para trazer a experiência de console definitiva para o seu PC.

[![Landing Page](https://img.shields.io/badge/site-pherielium.netlify.app-000000?style=for-the-badge)](https://pherielium.netlify.app)
[![GitHub](https://img.shields.io/badge/GitHub-repo-black?style=for-the-badge&logo=github)](https://github.com/Guilhermesttt/Checkpoint---Launcher)
![Status](https://img.shields.io/badge/status-em%20desenvolvimento-blueviolet?style=for-the-badge)
![Version](https://img.shields.io/badge/version-3.2.2-informational?style=for-the-badge)

</div>

---

## Sobre o projeto

**Pherielium** (antigo *Checkpoint Launcher*) é um hub gamer unificado que reúne biblioteca, controles, conquistas, mods, voz e transmissão em um único lugar — sem depender de um emaranhado de launchers separados. A proposta é simples: trazer a fluidez e a imersão de um console para dentro do seu PC, mantendo tudo local-first, rápido e sob seu controle.

Construído com **Electron + React + TypeScript**, o Pherielium recentemente passou por um rebrand completo: novo nome, nova identidade visual (paleta monocromática em preto puro `#030405`, com uma linguagem visual orgânica de nós e conexões inspirada em constelações) e um novo logo.

---

## ✨ Principais recursos

- **Biblioteca Universal** — Steam, Epic Games, EA App, Ubisoft, Riot Games, Rockstar Games, Xbox, Battle.net, GOG e jogos locais, tudo em um só lugar.
- **Suporte total a controles** — reconhecimento automático de DualSense, Xbox, Switch e controles genéricos, com mapeamento customizado.
- **Conquistas locais & Steam Verde** — sistema próprio de achievements para jogos offline, locais e sem launcher.
- **Mod Manager integrado** — busca e instalação de mods do Nexus Mods com 1 clique, direto pelo launcher.
- **Calls & transmissão 1080p** — salas de voz P2P via WebRTC e compartilhamento de tela Full HD a 60 FPS, sem assinatura.
- **In-Game Overlay** — menu rápido sobreposto ao jogo com conquistas, amigos, chat e call em tempo real.
- **Radar Gamer** — feed de notícias e lançamentos da indústria em tempo real.
- **100% Local-First** — dados, jogos e progresso vivem na sua máquina, sem login forçado.
- **Zero Bloatware** — feito em C++/Rust/TypeScript para máximo desempenho e mínimo consumo de recursos.

---

## 🖥️ Tech Stack

| Camada | Tecnologias |
|---|---|
| Desktop App | Electron, React, TypeScript |
| Landing Page | Next.js / React, Vengeance UI |
| Backend | Node.js (hospedado no Render.com) |
| Comunicação em tempo real | WebRTC (voz, screen share) |
| Integrações | Steam API, RetroAchievements, Nexus Mods, Discord/Google OAuth, Epic Games (manifest local) |

---

## 🗺️ Roadmap

**✅ Disponível agora**
- Hub Gamer Unificado
- Suporte a controles multiplataforma
- Conquistas para jogos locais
- Visual monocromático de console

**🚧 Em desenvolvimento**
- Calls & transmissão 1080p 60fps
- In-Game Overlay completo
- Mod Manager Nexus integrado
- Radar Gamer de notícias

**🔭 No horizonte**
- Sincronização em nuvem opcional
- Temas customizáveis avançados
- Hub de comunidade aberto
- Plugins e extensões da comunidade

---

## 🚀 Rodando localmente

```bash
# Clone o repositório
git clone https://github.com/Guilhermesttt/Checkpoint---Launcher.git
cd Checkpoint---Launcher

# Instale as dependências
npm install

# Rode em modo desenvolvimento
npm run electron:dev
```

> Ajuste os comandos acima conforme os scripts reais definidos no `package.json` do projeto.

---

## 📄 Licença

Código aberto e auditável — transparência total sobre como arquivos e credenciais são manuseados. *(Defina aqui a licença oficial do projeto, ex. MIT.)*

---

<div align="center">

**[Download](https://pherielium.netlify.app/download)** · **[Site](https://pherielium.netlify.app)** · **[GitHub](https://github.com/Guilhermesttt/Checkpoint---Launcher)**

<sub>© 2026 Pherielium — Personal Gaming Hub</sub>

</div>

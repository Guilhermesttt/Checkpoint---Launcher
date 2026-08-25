# Pherielium — Product Truth

## Overview
**Pherielium** (antigo *Checkpoint Launcher*) é um hub gamer unificado e aplicativo de produtividade para Windows que centraliza biblioteca de jogos, mods, conquistas, comunicação por voz/transmissão e feed de notícias em uma experiência fluida, local-first e imersiva.

## Target Audience
- **Jogadores de PC:** Que buscam uma experiência de navegação limpa, sem a poluição de múltiplos inicializadores comerciais concorrentes.
- **Usuários de Controles/Console Experience:** Gamers que jogam na TV ou monitor com joystick e desejam navegação rápida e ágil.
- **Entusiastas de Mods:** Usuários que gerenciam modificações via Nexus Mods de maneira prática e centralizada.
- **Usuários focados em Privacidade & Performance:** Valorizam arquitetura *local-first*, sem telemetria invasiva ou consumo excessivo de recursos em segundo plano.

## Platform & Architecture
- **Plataforma Principal:** Windows Desktop (Desktop App via Electron)
- **Tecnologias:** React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion, WebRTC, Lucide React
- **Arquitetura:** Local-first, dados de jogos e preferências persistidos localmente com integrações opcionais via APIs externas (Steam, Nexus Mods, RetroAchievements, Supabase).

## Core Capabilities & Features
1. **Hub Gamer Unificado (Game Library):**
   - Agregação e escaneamento automático de jogos (Steam, Epic Games, GOG, emuladores e executáveis locais).
   - Detecção de capas, artes de fundo, metadados e estatísticas de tempo de jogo.
2. **Nexus Mods Manager Integrado:**
   - Navegação, download, ativação/desativação e monitoramento de versões de mods diretamente na interface do jogo.
3. **Radar Gamer (Feed de Notícias & Comunidade):**
   - Agregação de notícias curadas do ecossistema de games e feeds RSS de fontes confiáveis com filtros por categoria/fonte.
4. **Conquistas & Telemetria Local:**
   - Integração com RetroAchievements e sistema de conquistas locais para títulos independentes/emulados.
5. **Comunicação em Tempo Real (WebRTC):**
   - Canais de voz P2P e transmissão de tela em alta definição (1080p 60fps).
6. **In-Game Overlay & Gamepad Support:**
   - Menu rápido sobreposto durante a jogatina e controle total via joystick com navegação direcional fluida.

## Guiding Principles & Product Commitments
- **Zero Ruído / Produtividade Minimalista:** A interface prioriza o foco no jogo e nas tarefas, evitando poluição visual, pop-ups desnecessários ou interfaces saturadas estilo terminal militar.
- **Estética de Espaço Sideral (Constelação & Nós):** Identidade baseada em fundo preto profundo (`#030405`), nós conectados, linhas orbitais e iluminação estelar suave.
- **Transparência e Autonomia:** O usuário tem controle total sobre seus arquivos, diretórios e integrações.

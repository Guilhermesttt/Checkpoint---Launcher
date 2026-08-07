# Checkpoint Launcher

O **Checkpoint Launcher** é um gerenciador de jogos de alto desempenho e interface moderna para Windows. Ele reúne biblioteca unificada (Steam, Epic Games, GOG, EA, Ubisoft, Xbox e jogos locais), conquistas, feed social, overlay in-game e gerenciamento integrado de **Nexus Mods** em uma experiência otimizada para teclado, mouse e controle.

[Baixar a versão mais recente](https://github.com/Guilhermesttt/Checkpoint---Launcher/releases/latest) · [Notas da versão](RELEASE_NOTES.md) · [Reportar um problema](https://github.com/Guilhermesttt/Checkpoint---Launcher/issues)

---

## 🚀 Principais Recursos

- 🎮 **Biblioteca Unificada**: Suporte a Steam, Epic Games Store, GOG, EA App, Ubisoft Connect, Xbox, Battle.net, Riot Games, Rockstar e executáveis locais.
- ⚡ **Integrado com Nexus Mods**: Navegação no catálogo, busca de mods, downloads assistidos por protocolo `nxm://`, instalação e gerenciamento de arquivos por jogo.
- 🧭 **Navegação Elegante**: Migalhas de pão (breadcrumbs) funcionais e interativas, sistema estandardizado de sub-tabs (`Amigos`, `Chat`, `Solicitações`, `Mods`, `Gerenciar`).
- 🎨 **Estética Visual Premium**: Adaptabilidade dinâmica de cores baseadas nas capas dos jogos (com clamping automático de contraste), raios aninhados e suporte total a temas escuros.
- 🛡️ **Atualizações Confiáveis**: Atualizador automático via GitHub Releases com suporte a inspeção detalhada de erros e tratamento amigável de logs.
- 💬 **Hub Social & Chat**: Amigos no Checkpoint, presença em tempo real (quem está jogando o quê), chat integrado com indicador de digitação e mensagens não lidas.
- 🏆 **Central de Conquistas**: Acompanhamento de progresso de conquistas da Steam, Epic e conquistas locais (com suporte a emuladores Steam compatíveis).
- 🎥 **Overlay In-game**: Overlay com atalho personalizável (`Ctrl + Shift + O` ou botão Guide do controle), galeria de capturas nativa e feed de atividades.
- ⚙️ **Perfis Avançados de Inicialização**: Seleção de monitor, modo de janela, resolução, prioridade de processo e argumentos de linha de comando por jogo.

---

## 🛠️ Arquitetura Técnica

- **Frontend**: React 19, TypeScript, TailwindCSS, Framer Motion, Lucide Icons.
- **Desktop Runtime**: Electron 39 com arquitetura Multi-Window (Janela Principal + Overlay In-Game).
- **Gerenciador de Bundles**: Vite 8.
- **Banco de Dados Local**: SQLite (via `userData`) para persistência de biblioteca, sessões e arquivos de mods.
- **Serviços Cloud**: Supabase & Backend Node.js em nuvem para autenticação, presença social e chat.
- **Publicação e Auto-update**: Electron Builder + `electron-updater` via GitHub Releases.

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

## 📄 Licença

Desenvolvido por **Guilherme Sant'Ana**. Todos os direitos reservados.

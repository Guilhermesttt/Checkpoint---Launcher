# Registro do Checkpoint Launcher na Nexus Mods

Este documento prepara a build de avaliação solicitada pela política de uso da
API da Nexus Mods. Nenhuma chave pessoal deve ser enviada por e-mail, publicada
no GitHub ou configurada no Render, Netlify ou Supabase.

## O que a build de avaliação demonstra

- catálogo público de mods em destaque por jogo;
- configuração do domínio Nexus de cada jogo;
- validação de uma chave pessoal diretamente pela API da Nexus;
- armazenamento local da chave com a criptografia do sistema operacional;
- consulta autenticada dos arquivos disponíveis em um mod;
- remoção imediata da chave pelo usuário;
- headers `Application-Name` e `Application-Version` em todas as chamadas
  autenticadas.

O Checkpoint não envia a chave para o backend próprio. No Windows, o Electron
usa o DPAPI por meio de `safeStorage`; o arquivo local contém apenas o conteúdo
criptografado.

## Como testar

1. Instale ou execute a build Windows do Checkpoint Launcher.
2. Entre em **Mods** e abra um jogo.
3. Abra a aba **Configurar**.
4. Em **Conta Nexus de desenvolvimento**, abra a página de chaves pessoais.
5. Gere ou copie uma chave da conta Nexus usada pelo avaliador.
6. Cole a chave no Checkpoint e selecione **Validar e salvar**.
7. Volte para **Descobrir**, escolha um mod e selecione **Arquivos**.
8. Confirme que a lista de arquivos, versões, categorias e tamanhos foi
   carregada.
9. Volte para **Configurar** e selecione **Desconectar** para remover a chave.

## Checklist antes de enviar

- [ ] Gerar uma build limpa do Windows.
- [ ] Testar a conexão com uma chave pessoal que não esteja no repositório.
- [ ] Confirmar que a chave não aparece em logs ou requisições ao backend.
- [ ] Criar uma GitHub Pre-release e anexar o ZIP/instalador.
- [ ] Capturar telas da biblioteca de jogos, catálogo, conexão validada e lista
      de arquivos.
- [ ] Anexar `assets/icon.png` ao e-mail como logo.
- [ ] Substituir `[TESTING BUILD URL]` no modelo abaixo.

## E-mail para registro

Destinatário: `support@nexusmods.com`

Assunto: `Third-party API application registration — Checkpoint Launcher`

```text
Hello Nexus Mods team,

I would like to request the registration of Checkpoint Launcher as a
public-facing application using the Nexus Mods API.

Application name:
Checkpoint Launcher

Current version:
3.0.0

Platform:
Windows desktop application built with Electron

Short description:
Checkpoint Launcher is a Windows game launcher with an integrated mod manager.
It allows users to discover Nexus Mods content for locally installed games,
inspect available files, and manage local mod state from a single interface.

Testing build:
[TESTING BUILD URL]

Source code:
https://github.com/Guilhermesttt/Checkpoint---Launcher

Website:
https://checkpointlauncher.com

Privacy policy:
https://checkpointlauncher.com/privacy-policy

Testing instructions:
1. Open Mods and select a game.
2. Open the Configure tab.
3. Paste a personal Nexus Mods API key under "Nexus development account".
4. Select "Validate and save".
5. Return to Discover, select a mod and click "Files".
6. The launcher will retrieve the authenticated file list from the Nexus Mods API.
7. The key can be removed with the Disconnect action.

Credential and data handling:
- Personal API keys are validated directly with the Nexus Mods API.
- Keys are never sent to Checkpoint servers, Render, Netlify or Supabase.
- On Windows, the key is encrypted locally with the operating system's DPAPI
  through Electron safeStorage.
- The renderer cannot read a saved key back from the main process.
- API actions are initiated by the user.
- The application sends consistent Application-Name and Application-Version
  headers.

Current API usage:
- Public Nexus Mods v3 trending-mod feed.
- Authenticated account validation for development testing.
- Authenticated retrieval of mod file metadata.

Planned registered-app flow:
- Replace manual personal-key entry for public users with Nexus Mods SSO.
- Handle user-initiated Nexus download actions.
- Download to a local staging directory.
- Provide backups, deployment, enable/disable controls and conflict handling
  appropriate for each supported game.

Please review the testing build and let us know the app slug/appid and the
current recommended SSO/download flow for a new Nexus Mods v3 integration.

I have attached a high-resolution Checkpoint Launcher logo suitable for a dark
background.

Kind regards,
Guilherme Sant'Ana
Checkpoint Launcher
https://checkpointlauncher.com
```


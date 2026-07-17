# Checkpoint Launcher

![Checkpoint Launcher](public/Checkpoint_Logo.png)

O Checkpoint é um launcher de jogos para Windows que reúne biblioteca, conquistas, amigos e ferramentas in-game em uma interface pensada para teclado, mouse e controle.

Ele sincroniza jogos da Steam, aceita jogos locais e importações assistidas da Epic Games, inicia executáveis pelo desktop e mantém o monitoramento de sessões e conquistas enquanto a janela principal está em segundo plano.

[Baixar a versão mais recente](https://github.com/Guilhermesttt/Checkpoint---Launcher/releases/latest) · [Notas da versão](RELEASE_NOTES.md) · [Reportar um problema](https://github.com/Guilhermesttt/Checkpoint---Launcher/issues)

## Principais recursos

- Biblioteca unificada para Steam, Epic Games e jogos locais.
- Sincronização da biblioteca, horas e conquistas da Steam; o enriquecimento detalhado de metadados prioriza até 80 jogos por sincronização.
- Conquistas locais com suporte a arquivos de progresso de emuladores Steam compatíveis.
- Totais de conquistas consolidados em toda a biblioteca, inclusive em perfis de amigos.
- Overlay in-game com amigos, chat, jogo atual, capturas, conquistas, configurações e perfil.
- Chat em tempo real, presença, indicador de digitação e mensagens não lidas.
- Capturas de tela pelo overlay, galeria recente, abertura da pasta e exclusão para a Lixeira.
- Atalho de captura personalizável e navegação por controle.
- Perfis de inicialização por jogo local: monitor, modo de janela, resolução, prioridade, argumentos e diretório de trabalho.
- Feed social para jogos iniciados e conquistas.
- Integração com Discord para conta e avatar.
- Atualizador integrado pelo GitHub Releases, com download iniciado pelo usuário.

## O que há de novo na versão 2.0.0

A 2.0.0 transforma o overlay em uma central in-game multipágina e reforça a base de conquistas e execução em segundo plano.

- Overlay redesenhado no mesmo tema preto e branco do launcher.
- Páginas próprias para chat, jogo em execução, mídia, conquistas, configurações e perfil.
- Lista rolável de conquistas do jogo atual, com progresso, estados bloqueado/desbloqueado, descrição e data.
- Chat utilizável sem reabrir a janela principal do launcher.
- Captura nativa com atalho configurável e exclusão segura com confirmação.
- Abertura do overlay por `Ctrl + Shift + O` e suporte ao botão Guide/PS/Home do controle.
- Dica compacta ao iniciar um jogo e novos toasts de início e conquista.
- Continuidade de presença, polling e watchers com o launcher minimizado ou oculto na bandeja.
- Contagem canônica de conquistas sem o antigo limite de 80 jogos e sem zerar resultados válidos por uma falha isolada.
- Perfis de inicialização para jogos locais.
- Novo feed de atividade para jogos iniciados e conquistas.
- Modal Adicionar/Editar jogo reorganizado por plataforma, preenchimento automático, dados e artes, com prévia e validação visível.
- No chat da janela principal, teclado virtual e conversa permanecem visíveis ao mesmo tempo.

Consulte [RELEASE_NOTES.md](RELEASE_NOTES.md) para a lista detalhada e as limitações conhecidas.

## Overlay in-game

O overlay pode ser aberto durante uma sessão por:

- Teclado: `Ctrl + Shift + O`.
- Controle: botão central Guide/PS/Home, quando o dispositivo e o Windows expõem esse botão ao aplicativo.

O atalho de captura pode ser alterado nas configurações do overlay. São aceitas teclas `F1` a `F24`, `Print Screen` e combinações com `Ctrl`, `Alt` ou `Shift`.

> O overlay é indicado para jogos em janela ou borderless. Fullscreen exclusivo pode impedir que qualquer janela externa seja exibida acima do jogo; nesse caso, use borderless.

## Plataformas e integrações

| Integração | Uso no Checkpoint |
| --- | --- |
| Steam | Biblioteca, perfil, metadados, horas, inicialização e conquistas |
| Epic Games | Busca/importação assistida; inicialização por executável local ou, quando o identificador completo estiver disponível, pelo launcher Epic |
| Discord | Conta conectada e avatar |
| Firestore | Perfis, amizades, feed social e um resumo público compacto da biblioteca |
| Realtime Database | Mensagens, digitação, recibos de leitura e índice de conversas |
| SQLite | Biblioteca completa, caminhos locais, preferências e horas observadas no computador |
| Backend Checkpoint | Validação de amizades do chat, integrações protegidas e publicação do feed |
| Jogos locais | Executável, perfil de inicialização, presença e conquistas compatíveis |

## Instalação

1. Abra [GitHub Releases](https://github.com/Guilhermesttt/Checkpoint---Launcher/releases).
2. Baixe `Checkpoint-Launcher-Setup-<versão>.exe`.
3. Execute o instalador e escolha a pasta de instalação.
4. Entre na sua conta e conecte as integrações desejadas.

Requisitos: Windows 10/11 de 64 bits e conexão com a internet para autenticação, sincronização e recursos sociais.

## Desenvolvimento local

Pré-requisitos:

- Node.js 22 ou superior.
- npm com o lockfile do projeto.
- Java 21 para os testes das regras do Firestore e Realtime Database.
- Projeto Firebase e credenciais opcionais das integrações que você deseja testar.

Configuração:

```powershell
git clone https://github.com/Guilhermesttt/Checkpoint---Launcher.git
Set-Location Checkpoint---Launcher
npm ci
Copy-Item .env.example .env
```

Preencha apenas as variáveis necessárias no `.env`. Chaves privadas, tokens, service accounts e certificados nunca devem ser commitados.

Execução do app desktop completo:

```powershell
npm run electron:dev
```

Validações principais:

```powershell
npm run lint
npm run build
npm run test:typecheck
npm run test
npm run test:rules
npm run audit:ci
```

## Estrutura do projeto

- `src/`: interface React, estado, serviços e páginas do launcher.
- `electron/`: runtime desktop, IPC, overlay, capturas, watchers e inicialização de jogos.
- `server/`: API Express para Steam, Epic, OAuth e integrações do backend.
- `tests/`: testes unitários, de DOM, IPC, SQLite e regras Firebase.
- `docs/`: documentação técnica e checklist de release.

## Privacidade e segurança

O Checkpoint mantém a biblioteca completa em SQLite dentro de `app.getPath("userData")`. O Firestore recebe somente o resumo público sem caminhos de executáveis ou imagens base64; mensagens ficam no Realtime Database. Steam e Discord são opcionais. Segredos de backend não devem ser expostos ao renderer nem armazenados no repositório. Antes de publicar uma versão, siga o [checklist de release e privacidade](docs/RELEASE_CHECKLIST.md).

## Limitações conhecidas

- O botão central do controle pode ser reservado pela Xbox Game Bar, Steam ou pelo próprio driver.
- Fullscreen exclusivo não garante a sobreposição do overlay; borderless é o modo recomendado.
- Jogos Steam abertos por URI são verificados quando a presença do perfil está visível. Sessões Epic por URI e perfis Steam privados permanecem provisórios e expiram após 12 horas se não houver um processo local verificável.
- Recursos sociais e resumos públicos dependem do backend e das regras dos dois bancos estarem publicados.
- O chat carrega as 50 mensagens mais recentes e o backend remove mensagens com mais de 30 dias quando uma conversa é aberta.
- A biblioteca SQLite é específica do computador. Steam pode reconstruir seus jogos em outra máquina, mas jogos manuais exigem nova adição ou uma futura função de exportação/importação.
- Capturas ainda são locais; backup e versionamento de saves na nuvem não fazem parte da 2.0.0.

O projeto está em desenvolvimento ativo. Relatos reproduzíveis e sugestões podem ser enviados pela página de [issues](https://github.com/Guilhermesttt/Checkpoint---Launcher/issues).

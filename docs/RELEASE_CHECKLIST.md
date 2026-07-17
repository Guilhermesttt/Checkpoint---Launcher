# Checklist de release, privacidade e rollback

Use este documento para todo release público. O responsável pelo release deve registrar o resultado no PR ou na descrição da versão.

## Qualidade obrigatória

- [ ] `npm ci` executado a partir do lockfile versionado.
- [ ] `npm run lint`, `npm run build` e `npm run test:coverage` aprovados.
- [ ] `npm run test:rules` aprovado no Firebase Emulator.
- [ ] `npm run audit:ci` sem vulnerabilidade de produção alta ou crítica sem exceção documentada.
- [ ] Versão do `package.json`, tag e `release/latest.yml` idênticas.
- [ ] `npm run release:verify` confirmou o SHA-512 usado pelo auto-update.
- [ ] `npm run release:smoke` validou instalação, `--smoke-test` e desinstalação.
- [ ] Assinatura Authenticode válida no artefato público (`REQUIRE_SIGNED_RELEASE=1`).
- [ ] O bundle de produção aponta para o backend público, sem depender do `.env` local.
- [ ] Backend e regras do Firestore e Realtime Database compatíveis com a versão foram publicados e verificados.

## Privacidade e dados

- [ ] Nenhum `.env`, service account, token Firebase/Discord/Steam ou certificado está no commit/artefato.
- [ ] Apenas variáveis `VITE_*` deliberadamente públicas entram no renderer.
- [ ] Logs não contêm token, e-mail completo, conteúdo de chat, caminho pessoal ou credencial.
- [ ] Mensagens continuam limitadas e acessíveis apenas aos participantes validados pelo backend.
- [ ] O resumo em `publicProfiles/{uid}` não contém e-mail, caminhos locais nem imagens base64.
- [ ] A biblioteca SQLite fica em `app.getPath("userData")` e só é acessada por IPC validado.
- [ ] Perfil não aceita campos arbitrários nem alteração de `uid`/`createdAt`.
- [ ] Uploads e anexos têm tipo, tamanho e retenção revisados.
- [ ] URLs externas e chamadas IPC permanecem restritas a protocolos/origens permitidos.
- [ ] Política/aviso de privacidade descreve Steam, Discord, Firebase, presença e telemetria utilizada.
- [ ] Foi confirmado se há mecanismo de exportação e exclusão de conta/dados; limitações estão documentadas.

## Auto-update

- [ ] Update testado saindo da versão pública anterior para a nova, sem apagar dados em `userData`.
- [ ] `latest.yml`, instalador e blockmap pertencem ao mesmo build.
- [ ] Download interrompido não corrompe a instalação atual.
- [ ] Botões “buscar”, “baixar” e “reiniciar e instalar” reportam erro recuperável.
- [ ] O instalador não reduz versão silenciosamente nem troca o canal de publicação.

## Rollback

1. Interromper ou remover o release defeituoso e marcar a versão como indisponível.
2. Restaurar `latest.yml` e artefatos da última versão estável, preservando nomes e hashes correspondentes.
3. Se dados/regras estiverem envolvidos, publicar primeiro regras compatíveis com clientes novos e antigos.
4. Criar patch com versão superior; o updater não deve depender de downgrade automático.
5. Validar o patch com a suíte completa e smoke de atualização partindo da versão afetada.
6. Comunicar impacto, dados potencialmente envolvidos e procedimento manual quando necessário.

Nunca apague ou migre dados locais no startup sem backup, versão de schema e caminho de recuperação testado.

# Arquitetura híbrida de dados

## Responsabilidades

- SQLite (`checkpoint-library.sqlite`): biblioteca completa e dados específicos do computador.
- Firestore (`publicProfiles/{uid}`): um resumo público compacto, adequado para uma única leitura ao abrir o perfil.
- Firestore (`profiles/{uid}`): conta, conexões, presença e relações sociais privadas.
- Realtime Database (`chats/{chatId}`): mensagens, digitação e recibos.

## Migração da biblioteca

Na primeira abertura desktop por UID, o renderer consulta a biblioteca legada em
`users/{uid}/games` e envia os documentos ao processo principal. O SQLite marca
`legacy_imported_at` somente depois da transação local terminar. Os documentos
legados não são apagados automaticamente; a remoção deve ocorrer apenas depois
de uma versão publicada validar a migração em produção.

## Resumo público

Toda mutação local incrementa `revision` e marca `summary_dirty`. O renderer
recalcula e grava um único documento em `publicProfiles/{uid}`. A confirmação
limpa o estado pendente apenas se a revisão enviada ainda for a atual, evitando
perder uma alteração feita durante a requisição.

Listas de destaque têm no máximo dez itens, aceitam apenas imagens HTTP(S) e
nunca incluem executável, argumentos, diretórios ou conteúdo base64.

## Chat

O cliente solicita `POST /api/chat/open`. O backend valida a amizade no
Firestore e cria os participantes pelo Firebase Admin. Clientes não podem
alterar participantes. Após essa autorização, mensagens e eventos de digitação
trafegam diretamente pelo Realtime Database.

O cliente escuta apenas o índice do usuário e, para a conversa aberta, as 50
mensagens mais recentes. Mensagens com mais de 30 dias são removidas em lotes
quando a conversa é aberta.

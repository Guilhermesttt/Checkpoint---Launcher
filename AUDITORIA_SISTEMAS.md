# Auditoria de Qualidade dos Sistemas Críticos

Este documento consolida a revisão de qualidade dos sistemas de **Nível/Troféus**, **Amigos (online/offline)**, **Call** e **Gerenciamento de Mods**, com foco em estabilidade, manutenção e experiência do usuário.

---

## 1) Resumo executivo

O projeto apresenta base sólida (boa separação por serviços/hooks/componentes e cobertura de testes), mas ainda há oportunidades relevantes de melhoria em:

- confiabilidade de eventos em tempo real;
- padronização de estados e erros;
- redução de acoplamento em módulos grandes;
- clareza de UX para estados de falha, reconexão e progresso.

**Prioridade de impacto (ordem):**
1. Sistema de Call
2. Sistema de Nível/Troféus
3. Sistema de Amigos (online/offline)
4. Gerenciamento de Mods

---

## 2) Sistema de Nível e Troféus

### Pontos fortes

- Arquitetura em camadas bem definida (`achievementDetector`, `trophyRealtime`, `trophyUnlockStream`, `useTrophyUnlockStream`).
- Estratégia de deduplicação de unlocks.
- Integração com histórico de troféus.

### Pontos de melhoria

1. Há tratamento silencioso de falhas em pontos de UI (ex.: áudio no `LevelUpModal`), reduzindo observabilidade.
2. Dependência de evento global para level-up pode dificultar rastreabilidade e evolução.
3. Debounce de persistência pode perder atualização em teardown/navegação rápida.

### Recomendações

- Centralizar eventos de progressão (nível/troféu) em event bus tipado único.
- Remover `catch` vazio e adotar logger padronizado com contexto.
- Fazer flush explícito de pendências na desmontagem para reduzir risco de perda.

---

## 3) Sistema de Amigos (online/offline)

### Pontos fortes

- Estrutura separada por hook/serviço.
- Cobertura de cenários sociais no conjunto de testes.

### Pontos de melhoria

1. Estados online/offline podem oscilar em reconexão.
2. Atualizações de presença/lista/chat podem chegar fora de ordem e gerar inconsistência visual.
3. Fallbacks de erro e indisponibilidade podem ficar fragmentados na UI.

### Recomendações

- Introduzir estado intermediário (`reconnecting` ou `stale`) além de online/offline.
- Resolver conflitos por versão temporal (`updatedAt`) e regras de precedência.
- Unificar padrão de feedback de rede em componentes reutilizáveis.

---

## 4) Sistema de Call

### Pontos fortes

- Cobertura ampla de eventos de chamada (invite, signal, state, kick, privacy, member join/leave, end).
- Estratégia de múltiplos canais para entrega de convite.

### Pontos de melhoria

1. Módulo de call concentra muitas responsabilidades (ciclo de canal, sinalização, entrega, governança).
2. Fluxo baseado em timeout pode mascarar falha de subscrição real.
3. Predomínio de tratamento com log sem superfície clara para UX de erro/retry.

### Recomendações

- Modularizar serviço em subdomínios:
  - lifecycle de canal;
  - transporte de convites;
  - sinalização de sessão;
  - governança de sala.
- Expor estados explícitos de conexão (`subscribed`, `degraded`, `failed`) para UI.
- Adotar retry com backoff e limite, com feedback de reconexão ao usuário.

---

## 5) Sistema de Gerenciamento de Mods

### Pontos fortes

- Contratos tipados bem definidos para conexão, catálogo, download e instalação.
- Separação clara entre camada de UI e bridge desktop.

### Pontos de melhoria

1. Dependência de bridge desktop precisa de UX de contingência mais clara.
2. Fluxo de erro parcial (download OK / instalação falha) pode ficar opaco.
3. Validações de entrada devem permanecer consistentes ponta a ponta.

### Recomendações

- Formalizar máquina de estados de operação de mod.
- Padronizar taxonomia de erros acionáveis para o usuário.
- Registrar trilha de operação por mod (status técnico + mensagem amigável).

---

## 6) Plano de ação recomendado (4 semanas)

### Semana 1 — Confiabilidade de Call

- Separar responsabilidades do módulo de call.
- Implementar estados de conexão/degradação na UI.
- Adicionar retry/backoff para subscrição e sinalização.

### Semana 2 — Nível/Troféus

- Consolidar barramento tipado de eventos.
- Eliminar falhas silenciosas com logging consistente.
- Garantir flush de persistência pendente em teardown.

### Semana 3 — Amigos (online/offline)

- Introduzir estado de reconexão e sincronização.
- Resolver conflitos temporais de presença.
- Padronizar componentes de feedback de rede/erro.

### Semana 4 — Mods

- Implementar state machine do fluxo de mod.
- Melhorar mensagens de erro com ações recomendadas.
- Adicionar observabilidade de execução por operação.

---

## 7) Critérios de sucesso

- Menos falhas intermitentes em fluxos realtime (call, presença, troféus).
- Redução de estados visuais inconsistentes para usuário.
- Maior previsibilidade de manutenção dos módulos críticos.
- Melhor clareza de UX em erro, reconexão e progresso.

# In-Game Overlay Gamepad Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir abrir, fechar e navegar pelo overlay in-game com controle, incluindo troca de faixas do Spotify.

**Architecture:** O renderer persistente do overlay recebe um controlador de gamepad isolado, que faz polling mesmo em segundo plano e emite acoes sem acessar dados sensiveis. O Electron main continua autoritativo sobre visibilidade e aplica deduplicacao temporal; os comandos Spotify seguem pelo IPC existente ate o renderer principal.

**Tech Stack:** Electron 39, JavaScript de browser, React/TypeScript, Vitest e JSDOM.

## Global Constraints

- Preservar mouse e teclado existentes.
- Nao expor credenciais ou chamadas Spotify no HTML do overlay.
- Processar navegacao apenas com o painel aberto; o botao Guide pode abrir ou fechar.
- Usar borda de pressionamento para Guide e gatilhos, evitando repeticao ao segurar.
- Exibir foco especial apenas durante navegacao por controle.

---

### Task 1: Motor isolado de gamepad do overlay

**Files:**
- Create: `electron/overlay-gamepad.js`
- Create: `tests/overlay-gamepad.test.ts`

**Interfaces:**
- Consumes: `navigator.getGamepads()`, `requestAnimationFrame`, callbacks `isPanelOpen`, `togglePanel`, `moveFocus`, `activateFocus`, `goBack`, `switchTab`, `spotifyTrack`.
- Produces: `window.createOverlayGamepadController(options)` retornando `{ start(): void, stop(): void }`.

- [ ] **Step 1: Write the failing tests**

Cobrir borda unica do Guide, bloqueio de navegacao com painel fechado, direcional/analogico, A/B, L1/R1 e L2/R2:

```ts
const controller = createController({ getGamepads: () => gamepads, ...actions });
controller.start();
gamepads = [makeGamepad([16])];
runFrame();
runFrame();
expect(actions.togglePanel).toHaveBeenCalledOnce();
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- tests/overlay-gamepad.test.ts`
Expected: FAIL porque `electron/overlay-gamepad.js` e a factory ainda nao existem.

- [ ] **Step 3: Implement the minimal controller**

Criar uma factory sem dependencias que detecta bordas e traduz o mapeamento aprovado:

```js
window.createOverlayGamepadController = ({ getGamepads, requestFrame, cancelFrame, isPanelOpen, actions }) => {
  const previous = new Map();
  const onPress = (name) => {
    if (name === "GUIDE") return actions.togglePanel();
    if (!isPanelOpen()) return;
    if (name === "A") return actions.activateFocus();
    if (name === "B") return actions.goBack();
    if (name === "L1" || name === "R1") return actions.switchTab(name === "L1" ? -1 : 1);
    if (name === "L2" || name === "R2") return actions.spotifyTrack(name === "L2" ? -1 : 1);
  };
  return { start, stop };
};
```

Aplicar deadzone `0.35`, repeticao direcional controlada em `180ms`, threshold de gatilho `0.55` e fallback Guide por View+Menu.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -- tests/overlay-gamepad.test.ts`
Expected: todos os testes do motor passam.

- [ ] **Step 5: Commit**

```bash
git add electron/overlay-gamepad.js tests/overlay-gamepad.test.ts
git commit -m "feat: add in-game overlay gamepad engine"
```

### Task 2: Integracao, foco espacial e Spotify

**Files:**
- Modify: `electron/overlay.html`
- Modify: `tests/overlay-render.test.ts`
- Modify: `tests/spotify-surface-contract.test.ts`

**Interfaces:**
- Consumes: `window.createOverlayGamepadController(options)` da Task 1 e `window.achievementOverlay.panelAction(action)`.
- Produces: navegacao espacial em `[data-gamepad-focus]`, troca circular de abas e acoes `spotify-previous`/`spotify-next`.

- [ ] **Step 1: Write the failing integration tests**

Adicionar o script externo ao harness JSDOM e testar:

```ts
panelVisibility({ open: true, state: {} });
pressGamepadButton(5); // R1
expect(document.querySelector('[data-panel-tab="chats"]')).toHaveClass("is-active");
activateTab("spotify");
pressGamepadButton(7); // R2
expect(panelAction).toHaveBeenCalledWith({ kind: "spotify-next" });
```

Também testar A clicando o foco atual, B fechando/voltando e foco movendo para o candidato geometricamente correto.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- tests/overlay-render.test.ts tests/spotify-surface-contract.test.ts`
Expected: FAIL porque o script, atributos e integracao ainda nao existem.

- [ ] **Step 3: Wire the controller into the overlay**

Carregar `overlay-gamepad.js` antes do script inline. Marcar os elementos interativos automaticamente, calcular candidatos por `getBoundingClientRect()`, aplicar `.is-gamepad-focused` e rolar o foco para a area visivel.

```js
const overlayGamepad = window.createOverlayGamepadController({
  getGamepads: () => navigator.getGamepads?.() || [],
  requestFrame: requestAnimationFrame,
  cancelFrame: cancelAnimationFrame,
  isPanelOpen: () => commandPanel?.classList.contains("is-open"),
  actions: {
    togglePanel: () => window.achievementOverlay.panelAction({ kind: "toggle", source: "gamepad" }),
    spotifyTrack: (direction) => window.achievementOverlay.panelAction({ kind: direction < 0 ? "spotify-previous" : "spotify-next" }),
  },
});
overlayGamepad.start();
```

L2/R2 so enviam Spotify quando a aba Spotify estiver ativa. L1/R1 percorrem `friends`, `chats`, `game`, `media`, `achievements`, `spotify`, `settings`, `profile` circularmente.

- [ ] **Step 4: Add controller-only focus styling**

```css
body.gamepad-navigation .is-gamepad-focused {
  outline: 2px solid rgba(255, 255, 255, 0.92);
  outline-offset: 3px;
}
```

Mouse, wheel e teclado removem `gamepad-navigation`; novo input do controle restaura a classe.

- [ ] **Step 5: Run tests to verify GREEN**

Run: `npm test -- tests/overlay-gamepad.test.ts tests/overlay-render.test.ts tests/spotify-surface-contract.test.ts`
Expected: todos os testes direcionados passam.

- [ ] **Step 6: Commit**

```bash
git add electron/overlay.html tests/overlay-render.test.ts tests/spotify-surface-contract.test.ts
git commit -m "feat: control in-game overlay and Spotify with gamepad"
```

### Task 3: Deduplicacao autoritativa do toggle

**Files:**
- Modify: `electron/main.cjs`
- Create: `tests/overlay-gamepad-main-contract.test.ts`

**Interfaces:**
- Consumes: acoes IPC `overlay:toggle-panel` e `overlay:panel-action` com `kind: "toggle"`.
- Produces: `requestOverlayPanelToggle(source)` que retorna o estado sem alternar novamente dentro da janela de deduplicacao.

- [ ] **Step 1: Write the failing main-process contract test**

```ts
expect(mainSource).toContain("const requestOverlayPanelToggle =");
expect(mainSource).toContain("OVERLAY_GAMEPAD_TOGGLE_COOLDOWN_MS");
expect(mainSource.match(/requestOverlayPanelToggle/g)?.length).toBeGreaterThanOrEqual(3);
```

- [ ] **Step 2: Run test to verify RED**

Run: `npm test -- tests/overlay-gamepad-main-contract.test.ts`
Expected: FAIL porque a deduplicacao central ainda nao existe.

- [ ] **Step 3: Centralize toggles**

```js
const OVERLAY_GAMEPAD_TOGGLE_COOLDOWN_MS = 650;
let lastOverlayGamepadToggleAt = 0;
const requestOverlayPanelToggle = (source = "unknown") => {
  const now = Date.now();
  if (source === "gamepad" && now - lastOverlayGamepadToggleAt < OVERLAY_GAMEPAD_TOGGLE_COOLDOWN_MS) return overlayPanelOpen;
  if (source === "gamepad") lastOverlayGamepadToggleAt = now;
  setOverlayPanelOpen(!overlayPanelOpen);
  return overlayPanelOpen;
};
```

Usar a funcao nos dois handlers IPC e manter o atalho de teclado sem bloqueio indevido.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -- tests/overlay-gamepad-main-contract.test.ts tests/gamepad-navigation.test.tsx`
Expected: testes passam e o toggle existente do launcher continua emitindo uma vez.

- [ ] **Step 5: Full verification and commit**

Run: `npm run test:ci`
Run: `npm run build`
Run: `npm run lint`

```bash
git add electron/main.cjs tests/overlay-gamepad-main-contract.test.ts
git commit -m "fix: deduplicate in-game overlay gamepad toggle"
```

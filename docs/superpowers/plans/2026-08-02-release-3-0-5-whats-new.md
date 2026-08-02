# Release 3.0.5 Whats New Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar a versao `3.0.5` com um modal completo de novidades exibido uma vez por instalacao e versao.

**Architecture:** Um catalogo TypeScript descreve releases sem acoplar dados ao componente visual. Um hook resolve a versao via IPC, consulta armazenamento local com fallback de sessao e controla a abertura; o modal reutiliza `ModalShell`. Depois dos testes, a versao e as notas sao atualizadas e os artefatos NSIS sao validados antes da publicacao.

**Tech Stack:** React 19, TypeScript 6, Electron 39, Tailwind CSS, Framer Motion, Vitest, electron-builder e GitHub Releases.

## Global Constraints

- A versao final e `3.0.5` e a tag final e `v3.0.5`.
- O modal aparece depois do login e da introducao, inclusive em instalacoes novas.
- `Comecar` e fechar pelo X registram a versao como visualizada.
- A paleta, transparencias, tipografia, sons e navegacao por controle atuais devem ser preservados.
- Nenhum token, `.env`, service account ou certificado entra no commit ou bundle.
- A release publica precisa conter instalador `.exe`, `latest.yml` e blockmap do mesmo build.

---

### Task 1: Catalogo e estado persistente das novidades

**Files:**
- Create: `src/releases/releaseHighlights.ts`
- Create: `src/hooks/useWhatsNewRelease.ts`
- Create: `tests/use-whats-new-release.test.tsx`

**Interfaces:**
- Produces: `LATEST_RELEASE`, `getReleaseHighlights(version)` e `useWhatsNewRelease(enabled)` retornando `{ release, dismiss }`.
- Consumes: `window.electronAPI.getVersion()` e `localStorage`.

- [ ] **Step 1: Write failing behavior tests**

```tsx
renderHook(() => useWhatsNewRelease(true));
await waitFor(() => expect(result.current.release?.version).toBe("3.0.5"));
act(() => result.current.dismiss());
expect(localStorage.getItem("checkpoint:last-seen-release")).toBe("3.0.5");
```

Cobrir instalacao nova, versao ja vista, hook desabilitado, falha do IPC e falha do armazenamento.

- [ ] **Step 2: Run RED**

Run: `npm test -- tests/use-whats-new-release.test.tsx`
Expected: FAIL porque catalogo e hook ainda nao existem.

- [ ] **Step 3: Implement catalog and hook**

```ts
export const LATEST_RELEASE: ReleaseHighlights = {
  version: "3.0.5",
  title: "Uma nova fase do Checkpoint",
  releaseUrl: "https://github.com/Guilhermesttt/Checkpoint---Launcher/releases/tag/v3.0.5",
  highlights: [
    { id: "spotify", title: "Spotify dentro do launcher", description: "Player redesenhado, busca, playlists, fila e Jam." },
    { id: "controller", title: "Controle tambem no jogo", description: "Navegue pelo overlay e controle suas faixas sem sair da partida." },
    { id: "stability", title: "Perfis e estabilidade", description: "Melhor organizacao visual e correcoes no Spotify, inputs e notificacoes." },
  ],
};
```

O hook consulta `getVersion`, usa `LATEST_RELEASE.version` como fallback, ignora versoes sem catalogo e usa um ref de sessao para impedir loop quando `localStorage` falha.

- [ ] **Step 4: Run GREEN**

Run: `npm test -- tests/use-whats-new-release.test.tsx`
Expected: todos os cenarios passam.

- [ ] **Step 5: Commit**

```bash
git add src/releases/releaseHighlights.ts src/hooks/useWhatsNewRelease.ts tests/use-whats-new-release.test.tsx
git commit -m "feat: track whats new releases"
```

### Task 2: Modal completo e integracao no app

**Files:**
- Create: `src/components/WhatsNewModal.tsx`
- Modify: `src/App.tsx`
- Create: `tests/whats-new-modal.test.tsx`
- Modify: `tests/app-whats-new-contract.test.ts`

**Interfaces:**
- Consumes: `ReleaseHighlights`, `ModalShell`, `window.electronAPI.openExternalUrl` e `useWhatsNewRelease(isReady)`.
- Produces: `WhatsNewModal({ release, onClose })`.

- [ ] **Step 1: Write failing component and integration tests**

```tsx
render(<WhatsNewModal release={LATEST_RELEASE} onClose={onClose} />);
expect(screen.getByText("Uma nova fase do Checkpoint")).toBeInTheDocument();
expect(screen.getAllByTestId("release-highlight")).toHaveLength(3);
await user.click(screen.getByRole("button", { name: "Comecar" }));
expect(onClose).toHaveBeenCalledOnce();
```

Testar link externo, fechamento pelo X e contrato em `App.tsx` somente quando `isIntroVisible === false`.

- [ ] **Step 2: Run RED**

Run: `npm test -- tests/whats-new-modal.test.tsx tests/app-whats-new-contract.test.ts`
Expected: FAIL porque componente e integracao nao existem.

- [ ] **Step 3: Implement the modal**

```tsx
<ModalShell isOpen onClose={onClose} ariaLabel={`Novidades da versao ${release.version}`} gamepadPriority={180}>
  <header><span>VERSAO {release.version}</span><h2>{release.title}</h2></header>
  <section>{release.highlights.map((highlight) => <article data-testid="release-highlight" key={highlight.id}><h3>{highlight.title}</h3><p>{highlight.description}</p></article>)}</section>
  <footer><button type="button">Ver notas completas</button><button type="button" onClick={onClose}>Comecar</button></footer>
</ModalShell>
```

Usar os tres blocos aprovados, botao X, link de notas via `openExternalUrl`, `Comecar`, layout responsivo e o mesmo estilo preto/translucido do launcher.

- [ ] **Step 4: Integrate after intro**

```tsx
const { release: whatsNewRelease, dismiss: dismissWhatsNew } = useWhatsNewRelease(
  Boolean(user?.uid) && isIntroVisible === false,
);
```

Renderizar o modal junto de `Home`, acima dos overlays da janela principal.

- [ ] **Step 5: Run GREEN**

Run: `npm test -- tests/use-whats-new-release.test.tsx tests/whats-new-modal.test.tsx tests/app-whats-new-contract.test.ts`
Expected: todos os testes passam.

- [ ] **Step 6: Commit**

```bash
git add src/components/WhatsNewModal.tsx src/App.tsx tests/whats-new-modal.test.tsx tests/app-whats-new-contract.test.ts
git commit -m "feat: show whats new modal for version 3.0.5"
```

### Task 3: Metadados e notas da versao 3.0.5

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `RELEASE_NOTES.md`
- Create: `tests/release-3-0-5-contract.test.ts`

**Interfaces:**
- Consumes: commits entre `v3.0.4` e `HEAD`.
- Produces: metadados coerentes `3.0.5` e notas publicas usadas no GitHub.

- [ ] **Step 1: Write failing release contract test**

```ts
expect(packageJson.version).toBe("3.0.5");
expect(lockfile.version).toBe("3.0.5");
expect(lockfile.packages[""].version).toBe("3.0.5");
expect(releaseNotes).toContain("Checkpoint Launcher — v3.0.5");
```

- [ ] **Step 2: Run RED**

Run: `npm test -- tests/release-3-0-5-contract.test.ts`
Expected: FAIL com versao atual `3.0.4`.

- [ ] **Step 3: Bump and document**

Run: `npm version 3.0.5 --no-git-tag-version`

Adicionar no topo de `RELEASE_NOTES.md` os recursos e correcoes confirmados depois de `v3.0.4`, sem alterar o historico anterior.

- [ ] **Step 4: Run GREEN**

Run: `npm test -- tests/release-3-0-5-contract.test.ts`
Expected: contrato passa.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json RELEASE_NOTES.md tests/release-3-0-5-contract.test.ts
git commit -m "chore: prepare release 3.0.5"
```

### Task 4: Validacao, artefatos e publicacao

**Files:**
- Generate: `release/Checkpoint-Launcher-Setup-3.0.5.exe`
- Generate: `release/Checkpoint-Launcher-Setup-3.0.5.exe.blockmap`
- Generate: `release/latest.yml`

**Interfaces:**
- Consumes: tree limpo, credencial GitHub apenas no ambiente e scripts do `package.json`.
- Produces: tag `v3.0.5`, release publica e auto-update acessivel.

- [ ] **Step 1: Validate source tree**

Run: `npm ci`
Run: `npm run test:ci`
Run: `npm run lint`
Run: `npm run test:coverage`
Run: `npm run audit:ci`
Run: `npm run build`

Registrar separadamente avisos nao bloqueantes; qualquer erro bloqueia a publicacao.

- [ ] **Step 2: Generate NSIS artifacts without publishing**

Run: `npx electron-builder --win nsis --publish never`
Run: `npm run release:verify`

Confirmar que instalador, blockmap e `latest.yml` existem, pertencem a `3.0.5` e possuem hashes coerentes.

- [ ] **Step 3: Run available smoke verification**

Run: `npm run release:smoke`

Se o ambiente nao permitir instalacao interativa ou assinatura, registrar a limitacao com exatidao antes de decidir sobre a publicacao.

- [ ] **Step 4: Publish Git history and release**

```bash
git push origin main
git tag -a v3.0.5 -m "Checkpoint Launcher 3.0.5"
git push origin v3.0.5
npx electron-builder --win nsis --publish always
```

O ultimo comando so roda com credencial GitHub disponivel no ambiente. Nao imprimir ou persistir a credencial.

- [ ] **Step 5: Verify public release**

Confirmar no GitHub que `v3.0.5` esta publica e contem `.exe`, `.blockmap` e `latest.yml`. Confirmar que o branch local esta sincronizado e que a tree permanece limpa.

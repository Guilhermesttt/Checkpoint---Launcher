# Phelierium 20-Point Security Release Gate

Este documento estabelece os 20 controles de segurança obrigatórios para o lançamento do **Phelierium Game Hub**, cobrindo o frontend Electron desktop, o backend Express em Render e a integração em nuvem com o Supabase.

---

## Tabela de Controles e Evidências

| ID | Controle | Categoria | Implementação / Localização | Evidência Automatizada |
|---|---|---|---|---|
| 1 | **SQL Injection & Parameterized Access** | Banco de Dados | `supabaseAdmin` com queries parametrizadas e chamadas RPC. | `tests/platform-purge-migration.test.ts` |
| 2 | **XSS & Store HTML Sanitization** | Renderer | `src/utils/sanitizeStoreHtml.ts` com DOMPurify e tags estritas. | `tests/sanitize-store-html.test.ts` |
| 3 | **Auth Token & Credentials Boundary** | Autenticação | `electron/epic-account.cjs` sanitiza e remove tokens brutos da IPC. | `tests/epic-account.test.ts` |
| 4 | **Password Hashing & Auth Provider** | Autenticação | Gerenciado via Supabase Auth (BCrypt/Argon2); sem senhas locais. | `tests/auth-provider-profile.test.tsx` |
| 5 | **Sensitive Data & Error Redaction** | Observabilidade | `server/security-boundaries.mjs` normaliza erros e mascara caminhos. | `tests/server-security-boundaries.test.ts` |
| 6 | **OAuth State & CSRF Nonces** | Autenticação | States aleatórios criptográficos com TTL de 5-10 minutos. | `server/index.mjs` & `tests/api.test.ts` |
| 7 | **Rate Limiting & Abuse Prevention** | API | Limites estritos via `express-rate-limit` para auth, queries e sync. | `server/index.mjs` |
| 8 | **Security Headers & CORS Config** | API | Helmet com CSP restrito e CORS para origens permitidas. | `tests/content-security-policy.test.ts` |
| 9 | **Dependency Security Audit** | Supply Chain | `npm audit --omit=dev --audit-level=high` sem vulnerabilidades altas/críticas. | `npm run security:audit` |
| 10 | **Secret & Credential Scanner** | Código-fonte | `scripts/scan-secrets.cjs` verifica arquivos rastreados e histórico Git. | `tests/secret-scanner.test.ts` |
| 11 | **Transport Security & HTTPS Enforcement** | Rede | Validação de HTTPS em produção e terminação TLS no Render. | `tests/external-url-security.test.ts` |
| 12 | **Row Level Security & Scoped RPCs** | Banco de Dados | `purge_my_platform_data(text)` escopado para `auth.uid()`. | `tests/platform-purge-migration.test.ts` |
| 13 | **Strict Input Validation & Zod Schemas** | API | Schemas Zod `.strict()` para parâmetros de autenticação e IPC. | `tests/epic-account.test.ts` |
| 14 | **Error Information Leakage Prevention** | Observabilidade | `normalizeSafeError` omite stack traces e caminhos do SO. | `tests/server-security-boundaries.test.ts` |
| 15 | **Upload & Media Boundary Validation** | Armazenamento | Limite de tamanho, tipos MIME permitidos e nomes sanitizados. | `server/index.mjs` |
| 16 | **Packaged & API Content Security Policy** | Renderer | Meta tag CSP estrita sem `unsafe-eval` no `index.html`. | `tests/content-security-policy.test.ts` |
| 17 | **Desktop IPC Security & Window Isolation** | Desktop | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. | `tests/ipc-security.test.ts` |
| 18 | **Executable Integrity & Safe Spawning** | Desktop | Legendary 0.21.0 verificado via hash SHA-256 e sem shell injection. | `tests/legendary-manager.test.ts` |
| 19 | **Transactional Local Purge & Cleanup Journal** | Ciclo de Vida | Tabela SQLite `platform_cleanup_state` e purge atômico. | `tests/platform-lifecycle-service.test.ts` |
| 20 | **Automated CI/CD Release Gate** | Lançamento | Script `scripts/security-gate.cjs` e workflow GitHub Actions. | `tests/security-gate.test.ts` |

---

## Execução do Gate de Segurança

Para rodar a verificação completa localmente:

```powershell
npm run security:gate
```

O comando gerará o artefato de evidência em `artifacts/security-gate.json`.

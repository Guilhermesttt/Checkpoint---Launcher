# Pherielium — Design System & Visual Guidelines

## 🌌 Visual Identity: Constelação, Órbita & Espaço Sideral

A linguagem visual do Pherielium foi concebida para unir **produtividade minimalista** com a imersão misteriosa do **espaço sideral**. Inspirada na estrutura molecular/estelar da logo do Pherielium (nós interligados por conexões orgânicas e trajetórias orbitais), a interface abandona caixas de terminal e HUDs militares em favor de superfícies etéreas, nós pontuais de luz e tipografia impecável.

---

## 🎨 Color Palette & Elevation

| Token / Papel | Valor Hex / RGBA | Uso |
|---|---|---|
| **Deep Space (Canvas)** | `#030405` | Fundo principal da aplicação e janelas |
| **Orbital Surface (Card/Modal)** | `#08090C` | Superfície base para cards, painéis e diálogos |
| **Elevated Surface (Flyout/Menu)** | `#0E1015` | Menus suspensos, sidebars elevadas e dropdowns |
| **Stellar Border** | `rgba(255, 255, 255, 0.08)` | Bordas discretas e divisores sutis |
| **Active Border / Node** | `rgba(255, 255, 255, 0.22)` | Bordas de foco, itens selecionados e nós de destaque |
| **Primary Text (Stellar White)** | `#FFFFFF` | Títulos, valores de destaque e CTAs primários |
| **Secondary Text (Nebula Grey)** | `#9EA3B0` | Descrições, metadados secundários e rótulos de navegação |
| **Muted Text (Deep Shadow)** | `#5C6170` | Textos desativados, timestamps discretos e atalhos |
| **Constellation Glow** | `0 0 20px rgba(255, 255, 255, 0.12)` | Halo suave em torno de elementos em hover/foco |

---

## 🔤 Typography

- **Display & Headings:** `Space Grotesk`, `system-ui`, `sans-serif`
  - Utilizada em títulos de página, contadores numéricos, cartões de destaque e elementos de branding.
  - Peso recomendado: `600 (Semibold)` ou `700 (Bold)`.
  - Tracking: Levemente expandido (`tracking-tight` a `tracking-wide` conforme contexto).
- **Body & Interface:** `Inter`, `system-ui`, `sans-serif`
  - Utilizada no corpo de texto, botões, campos de formulário, breadcrumbs e listas de metadados.
  - Pesos recomendados: `400 (Regular)` e `500 (Medium)`.
- **Accent & Citações:** `Raleway`, `sans-serif`
  - Utilizada exclusivamente em toques editoriais refinados ou subtítulos decorativos específicos.

---

## 🔘 Component Guidelines

### 1. Painéis & Superfícies (`Atmospheric Panels`)
- **Raio de Borda:** `rounded-2xl` (16px) ou `rounded-3xl` (24px) para painéis principais.
- **Acabamento:** Fundo `#08090C` com `backdrop-blur-md` e borda `border-white/[0.08]`.
- **Sem Cantoneiras:** Eliminação total de cantos cortados ou miras telescópicas estilo sci-fi militar.

### 2. Botões & Ações (`Stellar Buttons`)
- **Action Button (Primário):** Fundo branco sólido (`#FFFFFF`), texto preto profundo (`#030405`), cantos `rounded-xl` ou `rounded-full`, peso `font-semibold`. Ao hover: leve escala e halo suave.
- **Ghost / Orbital Button (Secundário):** Fundo transparente ou `bg-white/[0.05]`, borda `border-white/[0.12]`, texto branco. Ao hover: fundo `bg-white/[0.10]` e borda `border-white/[0.25]`.
- **Icon Button:** Formato circular (`rounded-full`), dimensões 36x36px ou 40x40px, com transição de opacidade e halo orbital no hover.

### 3. Cards de Jogos & Mods (`Constellation Nodes`)
- Layout em grade com espaçamento uniforme (mínimo de 16px de gap).
- Efeito de hover suave com elevação sutil (`translate-y-[-2px]`) e halo esbranquiçado orbital (`--cosmos-glow`).
- Metadados organizados em pílulas transparentes (`bg-white/[0.06] text-white/80 rounded-full px-2.5 py-0.5 text-xs`).

### 4. Navegação & Sidebar
- Fundo em degradê escuro sutil com separador vertical translúcido.
- Indicador de rota ativa utilizando um ponto luminoso branco (nó estelar) e fundo `bg-white/[0.08]`.

---

## ⚡ Motion & Micro-Interactions

- **Transições:** Duração rápida a moderada (180ms - 240ms) com curva `cubic-bezier(0.22, 1, 0.36, 1)`.
- **Glow Pulse:** Pulso de brilho suave e lento (4s) em indicadores de status e nós conectados.
- **Acessibilidade:** Suporte completo a `prefers-reduced-motion` com desativação de partículas dinâmicas e transições instantâneas.

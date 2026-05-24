---
name: OpenClaw Web
description: In-browser developer workbench UI — Bits UI / shadcn-svelte, OKLCH neutrals, Figma-grounded components.
colors:
  background: "oklch(1 0 0)"
  foreground: "oklch(0.145 0 0)"
  primary: "oklch(0.205 0 0)"
  primary-foreground: "oklch(0.985 0 0)"
  secondary: "oklch(0.97 0 0)"
  secondary-foreground: "oklch(0.205 0 0)"
  muted: "oklch(0.97 0 0)"
  muted-foreground: "oklch(0.556 0 0)"
  accent: "oklch(0.97 0 0)"
  accent-foreground: "oklch(0.205 0 0)"
  destructive: "oklch(0.577 0.245 27.325)"
  border: "oklch(0.922 0 0)"
  ring: "oklch(0.708 0 0)"
  card: "oklch(1 0 0)"
  card-foreground: "oklch(0.145 0 0)"
  sidebar: "oklch(0.985 0 0)"
  sidebar-foreground: "oklch(0.145 0 0)"
  sidebar-primary: "oklch(0.205 0 0)"
  sidebar-primary-foreground: "oklch(0.985 0 0)"
  marketing-violet: "#aa3bff"
  marketing-code-surface: "#f4f3ec"
  dark-background: "oklch(0.145 0 0)"
  dark-foreground: "oklch(0.985 0 0)"
  dark-card: "oklch(0.205 0 0)"
  dark-sidebar-accent: "oklch(0.488 0.243 264.376)"
typography:
  display:
    fontFamily: "'Inter Variable', system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 5vw, 3.5rem)"
    fontWeight: 500
    lineHeight: 1.18
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "'Inter Variable', system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.18
    letterSpacing: "-0.01em"
  title:
    fontFamily: "'Inter Variable', system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.35
  body:
    fontFamily: "'Inter Variable', system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0.01em"
  label:
    fontFamily: "'Inter Variable', system-ui, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 500
    lineHeight: 1.35
  mono:
    fontFamily: "ui-monospace, Consolas, monospace"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.35
rounded:
  sm: "calc(0.625rem * 0.6)"
  md: "calc(0.625rem * 0.8)"
  lg: "0.625rem"
  xl: "calc(0.625rem * 1.4)"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "0 0.5rem"
    height: "1.75rem"
  button-primary-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0 0.5rem"
    height: "1.75rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.destructive}"
    rounded: "{rounded.md}"
  card-default:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.lg}"
    padding: "1rem"
---

# Design System: OpenClaw Web

## 1. Overview

**Creative North Star: "The Embedded Workbench"**

OpenClaw Web is a **product** surface: a browser-hosted developer environment (WebContainer, file tooling, previews, shell). Visual design serves density, legibility, and long sessions—not marketing spectacle. The system stacks **Figma Bits UI kit** (source of truth for controls) on **shadcn-svelte + Tailwind v4** primitives implemented in `apps/claw-container`, with OKLCH semantic tokens in `app.css`.

Two layers coexist by design:

1. **Workbench chrome** (`bg-background`, `text-foreground`, sidebar tokens): restrained neutrals, Inter Variable, compact `text-xs` controls, ring-based elevation—not heavy drop shadows.
2. **Legacy/marketing shell** (`--text`, `--accent-bg`, purple highlights): older landing styles in the same `app.css`; new product screens should prefer semantic tokens unless a spec explicitly references the marketing layer.

**Figma is normative for component shape and states.** `docs/design/BitsUI.md` maps each control to a Figma `node-id`. If code and Figma disagree, fix code or update the doc in the same change—do not improvise a third style.

Explicitly rejected: generic AI SaaS templates (purple gradient heroes, identical icon-card grids, decorative glass, side-stripe callouts), pure `#000`/`#fff`, gray-on-tinted-color body text, bounce/elastic motion, and modal-first flows when inline patterns suffice.

**Key Characteristics:**

- **Product register**: tool UI density; hierarchy via weight and muted foreground, not oversized display type everywhere.
- **OKLCH semantic tokens** with `.dark` class and `prefers-color-scheme` hooks; base radius `0.625rem` (10px) scaled to `sm`–`4xl`.
- **Inter Variable** as the single sans workhorse; monospace only for code blocks and counters.
- **Bits UI primitives** (Dialog, Tabs, Sidebar, Select, etc.) wrapped in `$lib/components/ui/*`.
- **Ring + tonal layering** for cards and popovers; shadows reserved for legacy marketing blocks.
- **Compact control sizes** (`h-7` default button, `text-xs/relaxed` body in components).

## 2. Colors

The palette is **restrained neutrals + one functional destructive + optional marketing violet**—not a drenched brand campaign.

### Primary

- **Ink Primary** (`oklch(0.205 0 0)`): Default filled buttons, primary actions, sidebar primary in light mode. Near-black with zero chroma—authority without hue noise.
- **On-Ink** (`oklch(0.985 0 0)`): Text and icons on primary fills.

### Secondary

- **Mist Surface** (`oklch(0.97 0 0)`): Secondary buttons, muted fills, tab list backgrounds (`bg-muted`).
- **Ink on Mist** (`oklch(0.205 0 0)`): Secondary button labels.

### Tertiary

- **Signal Violet** (`#aa3bff` / `rgba(170, 59, 255, 0.1)` surfaces): Legacy marketing accent only (`--accent-bg`, `--accent-border`). Do not promote to workbench primary without a Figma change.
- **Sidebar Focus Violet** (`oklch(0.488 0.243 264.376)`): Dark-mode sidebar primary accent—use only in sidebar chrome, not global CTAs.

### Neutral

- **Canvas** (`oklch(1 0 0)` light / `oklch(0.145 0 0)` dark): Page background via `--background`.
- **Body Ink** (`oklch(0.145 0 0)` light / `oklch(0.985 0 0)` dark): Primary text via `--foreground`.
- **Whisper** (`oklch(0.556 0 0)`): Secondary copy via `--muted-foreground`.
- **Hairline** (`oklch(0.922 0 0)` light / `oklch(1 0 0 / 10%)` dark): Borders and dividers.
- **Legacy Body Gray** (`#6b6375` / `#9ca3af` dark): Marketing `var(--text)` only—migrate new screens to `--muted-foreground`.
- **Code Parchment** (`#f4f3ec` / `#1f2028` dark): Inline code backgrounds.

### Named Rules

**The Figma-First Rule.** Any new button, input, dialog, or tab state must be traceable to a row in `docs/design/BitsUI.md` before merge.

**The One-Violet Rule.** Marketing violet appears on ≤10% of any workbench screen. Workbench actions use ink primary, not Signal Violet.

**The No-Pure-Black Rule.** Never set `#000` or `#fff`. Use OKLCH canvas/ink tokens or tinted legacy variables.

## 3. Typography

**Display Font:** Inter Variable (with `system-ui`, sans-serif fallback)  
**Body Font:** Inter Variable (same stack)  
**Label/Mono Font:** Inter Variable for UI labels; `ui-monospace, Consolas, monospace` for code

**Character:** Technical and calm—tight sizes, medium weight for headings, relaxed line-height for dense panels. Legacy marketing pages use larger static headings (`56px` h1) outside the component scale.

### Hierarchy

- **Display** (500, `clamp(2.25rem, 5vw, 3.5rem)`, 1.18): Marketing heroes only—not workbench tabs or sidebars.
- **Headline** (500, `1.5rem` / `1.25rem` mobile, 1.18): Section titles in marketing content; prefer `text-sm font-medium` in app chrome.
- **Title** (500, `0.75rem`, 1.35): Card titles, tab triggers, sidebar menu buttons (`text-xs font-medium`).
- **Body** (400, `0.75rem`, 1.45, max **65–75ch** in prose): Default UI copy, tab content, form help.
- **Label** (500, `0.625rem`, 1.35): Button text (`text-xs`), badges, compact metadata.
- **Mono** (400, `0.9375rem`, 1.35): `code`, counters, terminal-adjacent output.

### Named Rules

**The Compact UI Rule.** Inside `$lib/components/ui/*`, default to `text-xs` and `text-xs/relaxed`. Do not import marketing `56px` headings into product routes.

**The Inter-Is-Baseline Rule.** Inter is the project default, not a differentiator. Pair with spacing, hierarchy, and Figma-accurate states—not novelty display fonts.

## 4. Elevation

Depth is conveyed primarily by **tonal contrast and 1px rings**, not dramatic shadows. Cards use `ring-1 ring-foreground/10` on `bg-card`; popovers and dialogs rely on Bits UI overlays plus border tokens.

Legacy marketing blocks use `--shadow` (`0 10px 15px -3px` rgba black ~10–40%). Do not copy that shadow stack onto workbench cards.

### Shadow Vocabulary

- **Marketing lift** (`0 10px 15px -3px, 0 4px 6px -2px`): Hero/marketing sections only.
- **Focus ring** (`ring-2` + `ring-ring/30` or `ring-destructive/20`): Interactive focus—not elevation.

### Named Rules

**The Flat-By-Default Rule.** Surfaces sit flat at rest. Hover states adjust background opacity (`hover:bg-primary/80`, `hover:bg-muted`), not Y-translate stacks, except the subtle `active:translate-y-px` on buttons.

**The Ring-Not-Card-Grid Rule.** Prefer bordered sections and sidebar grouping over identical shadowed card matrices.

## 5. Components

### Buttons

- **Shape:** Gently rounded (`rounded-md`, base `--radius` 0.625rem).
- **Primary:** `bg-primary text-primary-foreground`, height `1.75rem` default, `text-xs font-medium`, focus `ring-2 ring-ring/30`.
- **Hover / Focus:** Primary `/80` background; outline/ghost use `hover:bg-input/50` or `hover:bg-muted`; destructive uses tinted red backgrounds, not solid fill by default.
- **Secondary / Ghost / Outline / Link / Destructive:** As defined in `buttonVariants` (`apps/claw-container/src/lib/components/ui/button/button.svelte`). Sizes `xs`–`lg` and icon variants for toolbar-density UIs.

### Chips

- Use Bits UI **Toggle** / **Toggle group** patterns from Figma (`node-id` in BitsUI.md). Selected state: `bg-muted` / `aria-expanded` on outline buttons—not ad-hoc pill gradients.

### Cards / Containers

- **Corner Style:** `rounded-lg` (`--radius-lg`).
- **Background:** `bg-card text-card-foreground`.
- **Shadow Strategy:** `ring-1 ring-foreground/10`, no box-shadow.
- **Border:** Ring doubles as edge; optional `border-border` on sections.
- **Internal Padding:** `py-4` default, `py-3` when `data-size=sm`; gap `gap-4` / `gap-3`.

### Inputs / Fields

- **Style:** `border-input`, `dark:bg-input/30` on outline controls; radius `rounded-md`.
- **Focus:** `focus-visible:ring-2` with `ring-ring/30`; invalid states use `ring-destructive/20` and `border-destructive`.
- **Error / Disabled:** `disabled:opacity-50`, `aria-invalid` styling on buttons/inputs—match Figma destructive/error nodes.

### Navigation

- **Tabs (workbench):** `TabsList` with muted segmented background; triggers `flex-1`, `text-sm` route labels; content separated by `border-t border-border` (see `Home.svelte`).
- **Sidebar:** `sidebar-*` tokens, `rounded-[calc(var(--radius-sm)+2px)]` menu buttons, icon `size-4`, collapsible icon mode at `size-8`.
- **Mobile:** Full-width tab triggers; maintain touch targets ≥44px via padding, not smaller text alone.

### Panel / Workbench Shell

- **Signature pattern:** Full-height `min-h-[100dvh] flex-col` layout, header tabs + scrollable `main`, footer `border-t` with `text-muted-foreground` meta links—density-first shell for OpenClaw demos and container routes.

## 6. Do's and Don'ts

### Do:

- **Do** open `docs/design/BitsUI.md` and the linked Figma node before changing any control variant or spacing.
- **Do** use semantic tokens (`bg-background`, `text-muted-foreground`, `border-border`) in new Svelte routes and features.
- **Do** keep body copy within **65–75ch** in readable prose areas.
- **Do** use OKLCH tokens from `:root` / `.dark` in `apps/claw-container/src/app.css` as the single source of truth for theme changes.
- **Do** match Bits UI dark variants when implementing `dark:` Tailwind classes alongside Figma "dark" frames.
- **Do** prefer inline panels, tabs, and sidebars over modals for frequent actions.

### Don't:

- **Don't** ship purple-to-blue gradients, neon glows, or glassmorphism as default chrome—reserved only if explicitly in Figma for that node.
- **Don't** use `border-left` or `border-right` >1px as a colored accent stripe on lists, alerts, or cards.
- **Don't** use `background-clip: text` gradient headings.
- **Don't** lay out features as identical icon + title + blurb card grids without a Figma reference.
- **Don't** default to Inter + purple accent as the only "brand" move.
- **Don't** use pure `#000` / `#fff` or untinted gray text on tinted backgrounds.
- **Don't** animate layout properties or use bounce/elastic easing.
- **Don't** open a modal when a tab, drawer, or inline expansion can carry the flow.
- **Don't** invent component styles that contradict the Bits UI kit; update `BitsUI.md` if Figma changed.

# Product

## Register

product

## Users

**Primary: product engineers and technical builders** working in the browser. They run or extend OpenClaw Web demos and apps (`claw-container`, `webcontainer-openclaw`) to drive a **WebContainer** workspace: terminal (`jsh`), virtual filesystem, HTTP preview, and emerging file-manager flows. Sessions are long, interruptible, and often split across file tree, shell output, and preview.

**Secondary: coding agents** (Cursor and similar) that edit this monorepo. They need predictable structure (`AGENTS.md`, specs, `docs/design/BitsUI.md`), checkpoint-friendly changes, and UI that does not fight the documented design system.

**Tertiary: PoC / demo viewers** who use one-click flows (export/import workspace, showcase routes) to validate feasibility without local Node installs.

**Context when using the product:** a laptop browser tab, daylight or a dim desk, attention split between code changes, command output, and preview reloads. Success means the environment feels **dependable and inspectable**, not flashy.

## Product Purpose

OpenClaw Web is a **monorepo for an in-browser developer workbench**: reusable runtime in `packages/web-os` (WebContainer boot, `ShellSession`, preview attachment, file-manager persistence) and Svelte/Vite front ends that expose that runtime to humans and agents.

The product exists to prove and ship **browser-native dev loops** (edit files, run shell, see preview, persist workspace state) without requiring a local machine, while staying **spec-driven** and safe for agentic development.

**Success looks like:**

- A user (or agent) can boot a workspace, interact with the shell, see preview URLs, and trust file/sync behavior against written specs.
- New UI surfaces match **Bits UI / Figma** and `DESIGN.md` without one-off styling drift.
- Demos and `claw-container` share `web-os` contracts instead of duplicating integration logic.

## Brand Personality

**Precise. Calm. Trustworthy.**

Voice is **direct and technical**: short labels, no marketing fluff on workbench screens, errors that state what failed and what to do next. Emotional goal is **quiet competence** (the UI disappears into the task), not delight-first spectacle.

**Reference feel (product lane):**

- **VS Code / GitHub Codespaces** for shell + panel density and familiar chrome.
- **StackBlitz / CodeSandbox** for in-browser workspace mental model.
- **Linear** for restrained neutrals, tight controls, and clear hierarchy in tool UI (not for marketing layout).

**What to borrow:** predictable navigation, honest loading/empty states, semantic color for state, monospace for code/terminal adjacency.

## Anti-references

**Do not resemble:**

- Generic **AI SaaS landing** tropes: purple-to-blue gradient heroes, hero-metric stat blocks, identical icon+title+card grids, glassmorphism chrome, gradient text headings.
- **Decorative product UI**: side-stripe colored borders on lists/cards, bounce/elastic motion, modal-first flows when tabs or inline panels suffice.
- **Off-system controls**: shadcn/Bits variants invented without a `docs/design/BitsUI.md` Figma `node-id`.
- **Marketing register on workbench routes**: large display type, legacy violet accent (`#aa3bff`) as the primary CTA color inside app shells.
- **Category-reflex palettes** chosen only because the domain is "dev tools" (default dark-neon, observability blue, or Inter+purple as the entire identity).

**Named bad patterns:** nested cards, pure `#000`/`#fff`, gray text on tinted surfaces, layout-property animation, em-dash-heavy microcopy.

## Design Principles

1. **The tool should disappear.** Familiar patterns (tabs, sidebar, dialogs, tables) earn trust; novelty belongs in capabilities, not chrome.
2. **Spec is truth.** Behavior and UX boundaries live in `docs/specs` and micro-specs first; code and UI follow, with reverse sync when reality changes.
3. **Figma-first fidelity.** Bits UI kit is the control source; implementation gaps are bugs, not creative license.
4. **State must be legible.** Loading, empty, error, and destructive paths are first-class; never hide failure behind silent no-ops.
5. **Agent-safe terrain.** `AGENTS.md`, `PRODUCT.md`, and `DESIGN.md` stay aligned so automated edits stay on-brand and reviewable.

## Accessibility & Inclusion

- **Target:** **WCAG 2.1 Level AA** for workbench UI (contrast, focus visibility, keyboard operability).
- **Focus:** visible `focus-visible` rings on interactive controls (see `DESIGN.md` / shadcn button patterns); do not rely on color alone for state.
- **Motion:** honor **`prefers-reduced-motion`**; no bounce/elastic easing; avoid animating layout properties.
- **Input modalities:** terminal and file tree must remain keyboard-usable where the underlying primitives allow; Bits UI headless components carry expected ARIA roles.
- **Theming:** support **light and dark** (`.dark` + system preference) without locking "developer UI" to dark-by-default reflex.
- **Copy:** plain language for errors; avoid color-only status (pair icon + text where Figma provides patterns).

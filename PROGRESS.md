# PROGRESS — AirBattle

> Update this file before every push. The next model only has the repo — write so they can continue instantly.

## Current status
- **Phase:** 4 (starting) — Phases 1–3 done (core, menus/bot levels, local 2P)
- **Last worked by:** Fable (2026-11-16)
- **Live URL:** https://levivandam.github.io/Airbattle-/ (not deployed yet)

## Next step
Phase 4: implement spawning/pickup/activation in `src/core/powerups/index.ts` (queries already in `core/effects.ts`, physics already honours them), token + shield + freeze visuals in `src/render/powerfx.ts` (register via `view.layers`), HUD effect icons with countdown rings in `src/ui/hud.ts` (`hud.fx` container exists). `CORE_TYPES` lists the 6 core power-ups.

## How to check things quickly
- `npm test` — headless physics/bot sanity tests (vitest).
- Screenshot: `npx vite preview --port 4173` then a Playwright script using global playwright + `channel: 'chrome'` with swiftshader flags (see git history of PROGRESS for the idea); `window.game` is exposed for inspecting state.

## Done
- 2026-11-16 — Spec, plan and working rules written with Levi (SPEC.md, PLAN.md, CLAUDE.md).

- 2026-11-16 — Phase 0: Vite + TS + Three.js scaffold, placeholder page, `.github/workflows/deploy.yml` (Pages via Actions, `enablement: true`).

- 2026-11-16 — Phase 1: core sim (`src/core/*`: state, physics, match rules, effect queries, sim step), bot (`src/ai`), Three.js view (`src/render`), pointer input, HUD scoreboard/banners. Bot-vs-bot tests pass. The power-up *queries* (`core/effects.ts`) already exist; spawning/pickup comes in Phase 4 (`core/powerups/index.ts` is a stub).

- 2026-11-16 — Phase 2: `src/ui/app.ts` (title, menu, bot setup, settings, stats, pause, results), `src/storage/settings.ts` + `stats.ts`, bot levels incl. adaptive, time mode + golden goal, attract-mode (bot vs bot) behind the menus, auto Low graphics.
- 2026-11-16 — Phase 3: local 2P — mouse (P1) vs keyboard (`src/input/keyboard.ts`, P2), split multi-touch (`src/input/pointer.ts` mode 'split'), two mirrored scoreboards + mirrored banners on touch.

## In progress
- (nothing)

## Known bugs / issues
- GitHub Pages was not enabled at first push (deploy run failed). Levi was asked to set Settings → Pages → Source: GitHub Actions. Check `gh run list -R levivandam/Airbattle-`.

## Decisions log
- 2026-11-16 — Stack: Vite + TS + Three.js, own 2D physics, PeerJS for online, procedural adaptive music by default. Offline game fully finished (Phase 5) before online work (Phase 6). Core 6 power-ups first, extra 6 later. Matchmaking last and needs Levi's Firebase/Supabase account.

## Things Levi needs to do
- [ ] Enable GitHub Pages with Source = GitHub Actions (only if the first deploy asks for it)
- [ ] (Phase 8) Create a free Firebase or Supabase project
- [ ] (Optional) Supply CC0 music stems if he prefers real tracks over generated music

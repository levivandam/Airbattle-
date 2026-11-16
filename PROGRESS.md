# PROGRESS — AirBattle

> Update this file before every push. The next model only has the repo — write so they can continue instantly.

## Current status
- **Phase:** 5 (starting) — Phases 1–4 done (core, menus/bot levels, local 2P, power-ups)
- **Last worked by:** Fable (2026-11-16)
- **Live URL:** https://levivandam.github.io/Airbattle-/ (live)

## Next step
Phase 5: `src/audio/sfx.ts` + `src/audio/music.ts` (procedural adaptive music L0–L3, driven by `intensity()` from `core/match.ts` and `app.onScene`), `src/render/fx.ts` (screen shake, goal particles, puck trail, slow-mo on the winning goal via `game.timeScale`). Stats, mallet colours and graphics Low/auto are already done.

## How to check things quickly
- `npm test` — headless physics/bot sanity tests (vitest).
- Screenshot: `npx vite preview --port 4173` then a Playwright script using global playwright + `channel: 'chrome'` with swiftshader flags (see git history of PROGRESS for the idea); `window.game` is exposed for inspecting state.

## Done
- 2026-11-16 — Spec, plan and working rules written with Levi (SPEC.md, PLAN.md, CLAUDE.md).

- 2026-11-16 — Phase 0: Vite + TS + Three.js scaffold, placeholder page, `.github/workflows/deploy.yml` (Pages via Actions, `enablement: true`).

- 2026-11-16 — Phase 1: core sim (`src/core/*`: state, physics, match rules, effect queries, sim step), bot (`src/ai`), Three.js view (`src/render`), pointer input, HUD scoreboard/banners. Bot-vs-bot tests pass. The power-up *queries* (`core/effects.ts`) already exist; spawning/pickup comes in Phase 4 (`core/powerups/index.ts` is a stub).

- 2026-11-16 — Phase 2: `src/ui/app.ts` (title, menu, bot setup, settings, stats, pause, results), `src/storage/settings.ts` + `stats.ts`, bot levels incl. adaptive, time mode + golden goal, attract-mode (bot vs bot) behind the menus, auto Low graphics.
- 2026-11-16 — Phase 3: local 2P — mouse (P1) vs keyboard (`src/input/keyboard.ts`, P2), split multi-touch (`src/input/pointer.ts` mode 'split'), two mirrored scoreboards + mirrored banners on touch.

- 2026-11-16 — Phase 4: power-up system in `src/core/powerups/index.ts` (DEFS table, spawn every 8–12 s, pickup by last toucher, refresh-not-stack), visuals in `src/render/powerfx.ts`, HUD chips with countdown rings. **All 12 power-ups are implemented and enabled already** (the 6 extra ones were cheap because physics reads effects through `core/effects.ts`), so Phase 7 is reduced to a balance pass + online check.

## In progress
- (nothing)

## Known bugs / issues
- (none known) — feel/balance has only been checked with bots and screenshots, not by a human yet.

## Decisions log
- 2026-11-16 — Stack: Vite + TS + Three.js, own 2D physics, PeerJS for online, procedural adaptive music by default. Offline game fully finished (Phase 5) before online work (Phase 6). Core 6 power-ups first, extra 6 later. Matchmaking last and needs Levi's Firebase/Supabase account.

- 2026-11-16 — Extra 6 power-ups built together with the core 6 (same data-driven system); `enabledTypes()` in `ui/app.ts` returns ALL_TYPES.

## Things Levi needs to do
- [x] Enable GitHub Pages with Source = GitHub Actions (done, deploys work)
- [ ] (Phase 8) Create a free Firebase or Supabase project
- [ ] (Optional) Supply CC0 music stems if he prefers real tracks over generated music

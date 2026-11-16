# PROGRESS — AirBattle

> Update this file before every push. The next model only has the repo — write so they can continue instantly.

## Current status
- **Phase:** 10 (next) — v1 (Phases 0–7) is live. Levi playtested it; v2 plan written in `SPEC-V2.md` + PLAN.md Phases 10–14.
- **Last worked by:** Opus (v2 planning, 2026-11-16) after Fable built Phases 0–7
- **Live URL:** https://levivandam.github.io/Airbattle-/ (live)

## Next step
**Read `SPEC-V2.md` first.** Then start **Phase 10** (controls, feel, WASD solo, bot rebalance). Root causes of the bad controls are listed in SPEC-V2 §A: start in `src/core/physics.ts` (`moveMallet`, `collideMallet`, `stepPuck`), `src/core/state.ts` (`T`), `src/game.ts` (HumanPointer), `src/render/view.ts` (pick plane, mallet interpolation), `src/ai/botConfig.ts`.

Firebase (needed for Phase 12): **config received and saved in `src/net/firebaseConfig.ts`** (project `airbattle-9491c`, Realtime Database in europe-west1 exists). Levi still had to enable Anonymous + Google sign-in and add the authorized domain (steps 3–4 below) — verify at the start of Phase 12 (an anonymous sign-in error `auth/operation-not-allowed` means it's not enabled). Original steps (Firebase's console menu has moved: Realtime Database is under 'Databases & Storage', Authentication under 'Security'):
1. https://console.firebase.google.com → Add project "airbattle" → Google Analytics off → Create.
2. Build → Realtime Database → Create database → location Belgium (europe-west1) → "Start in locked mode".
3. Build → Authentication → Get started → Sign-in method → enable **Anonymous** and **Google**.
4. Authentication → Settings → Authorized domains → Add `levivandam.github.io`.
5. Project settings (gear) → "Your apps" → web icon `</>` → nickname "airbattle" → Register → copy the `firebaseConfig = {...}` block and give it to Claude.

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

- 2026-11-16 — Phase 5: audio (`src/audio/engine.ts`, `sfx.ts`, `music.ts` — fully synthesized, adaptive levels 0–3 switching on bar boundaries, driven from `main.ts` by `intensity()`), effects (`src/render/fx.ts`: particles, puck trail, screen shake, goal light flash, slow-mo + zoom on the winning goal). NOTE: audio could not be listened to in the sandbox (headless) — only checked that it runs without errors. Levi should judge the sound/music mix.

- 2026-11-16 — Phase 6: online with room codes. `src/net/peer.ts` (PeerJS transport, lazy-loaded; `?net=local` = BroadcastChannel transport for testing two tabs), `src/net/protocol.ts`, `src/net/online.ts` (lobby screens, host-authoritative snapshots at 30 Hz, guest interpolation 100 ms + own-mallet prediction, events with ack, ping, disconnect + rematch, `?room=CODE` invite links). Tested end-to-end with two tabs via `?net=local`.
- 2026-11-16 — README.md written for Levi.

## In progress
- (nothing)

## Known bugs / issues
- **From Levi's playtest (fix in Phase 10):** mallet lags behind the mouse (speed cap + smoothing), hitbox feels off, aiming too hard, Normal bot far too strong (Levi lost 7-0 three times), and the bot feels robotic (same moves, same rhythm, never takes risks).
- Feel/balance has only been checked with bots and screenshots, not by a human yet.
- Online over the real PeerJS broker could NOT be tested from the sandbox (no access to 0.peerjs.com). Only the `?net=local` transport was tested. First real test must be done by Levi.
- Audio was never listened to (headless sandbox).
- No TURN server: players behind strict NAT (some mobile/school networks) may fail to connect; the UI shows a friendly error after 12 s.

## Decisions log
- 2026-11-16 — v2 decisions with Levi: mallet exactly under the mouse; WASD solo with auto-switch, fast + dash; 5 bot levels (Rookie–Pro) + Adaptive, Normal ≈ 50/50; campaign = 4 worlds × (5 levels + boss) with stars, skins and table themes as rewards (power-ups stay unlocked), level types: targets, obstacles, bigger puck courses, bot challenges; matchmaking via Firebase RTDB + anonymous auth, bot while waiting, nickname; Elo rating only for Google-signed-in players.
- 2026-11-16 — Stack: Vite + TS + Three.js, own 2D physics, PeerJS for online, procedural adaptive music by default. Offline game fully finished (Phase 5) before online work (Phase 6). Core 6 power-ups first, extra 6 later. Matchmaking last and needs Levi's Firebase/Supabase account.

- 2026-11-16 — Extra 6 power-ups built together with the core 6 (same data-driven system); `enabledTypes()` in `ui/app.ts` returns ALL_TYPES.

## Things Levi needs to do
- [x] Enable GitHub Pages with Source = GitHub Actions (done, deploys work)
- [x] (Phase 12) Create the Firebase project and send the web config
- [ ] (Phase 12) Enable Anonymous + Google sign-in and add `levivandam.github.io` as authorized domain (confirm with Levi)
- [ ] (Phase 12, optional) Free TURN server account (Metered or Cloudflare) for better connections with strangers
- [ ] (Optional) Supply CC0 music stems if he prefers real tracks over generated music

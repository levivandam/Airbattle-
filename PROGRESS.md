# PROGRESS — AirBattle

> Update this file before every push. The next model only has the repo — write so they can continue instantly.

## Current status
- **Phase:** 12 built (Quick match), needs Levi to paste the database rules and test. Next build phase: 13 (campaign Worlds 2–4).
- **Last worked by:** Fable (2026-11-16, Phases 10–11)
- **Live URL:** https://levivandam.github.io/Airbattle-/ (live)

## Next step
1. **Quick match needs a real-world test.** The Firebase code path (`FirebaseLobby` in `src/net/matchmaking.ts`) has never run against the real project — the sandbox blocks Firebase. Levi must (a) enable Anonymous sign-in, (b) paste `database.rules.json` into Realtime Database → Rules → Publish, then try Quick match in two browsers. Errors show as a toast: 'anonymous sign-in is disabled' / 'database rules are missing' / 'could not reach'. Fix whatever he reports first.
2. Then **Phase 13**: Worlds 2–4 + table themes, see below.

How the campaign is put together (for adding Worlds 2–4):
- A level is data: `src/campaign/types.ts` (`LevelDef`), worlds in `src/campaign/levels/worldN.ts`, registered in `levels/index.ts` (remove the name from `COMING` when a world is added).
- `runner.ts`: `buildArena(def)` → `Arena` in the game state; `LevelRun.tick` checks targets / gates / finish / fail / stars. `core/arena.ts` + `core/physics.ts` handle walls, bumpers and movers (spin / slide bars). `render/arena.ts` draws them. `campaign/ui.ts` has the map, level start and result screens; `progress.ts` stores stars + skins.
- Level kinds that already work: `targets`, `score`, `course` (gates in order + finish zone; bigger arenas via `custom.bounds`, the camera fits the bounds), `bot`, `boss` (bot `params` overrides + permanent `effects`).
- `tests/campaign.test.ts` probes every solo level for solvability — keep it passing for new levels (extend it with multi-shot search for long courses).
- Not built yet: table themes as rewards, per-level star gates between worlds, bumpers/movers are implemented but unused in World 1.

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

- 2026-11-16 — Phase 10: mallet 1:1 under the pointer (no smoothing; `MALLET_MAX` 60 is only a safety cap), swept mallet–puck collision with dynamic sub-steps, hit strength from averaged mallet velocity, `PUCK_MAX` 6.5, puck radius 0.045, pick plane at grip height, local mallets drawn without interpolation (`view.direct`), cursor hidden, aim line (`render/fx.ts`, setting `aimLine`), WASD/arrows solo with auto-switch + dash (`SoloKeys` in `input/keyboard.ts`, driven from `Game.frame`), bot rewritten (`ai/bot.ts`: look → decide → hand motion; 8 moves with anti-repeat memory, patience, risk/press, mood, idle drift, mistakes, adapt) with levels Rookie/Easy/Normal/Hard/Pro/Adaptive (`ai/botConfig.ts`). Tests: 7 passing incl. fast-flick, 1-tick follow and bot-variety checks.

- 2026-11-16 — Levi's Phase 10 feedback: mouse feels better but could be smoother; puck too fast; bots improved; WASD plays badly (not fixed yet). Applied: pointer movement spread evenly over the physics ticks of each frame (`HumanPointer` in `game.ts`), `pointerrawupdate` for lower mouse latency, `PUCK_MAX` 5.0, `MALLET_E` 0.62, `DRAG` 0.5.

- 2026-11-16 — Levi: WASD too fast to aim / no tempo control → keyboard speed now ramps (tap = slow 1.1, hold 0.45 s = 3.0), dash unchanged. Not re-tested by Levi.
- 2026-11-16 — Phase 11: campaign engine + World 1 'Training Hall' (5 levels + boss 'The Wall', reward: Gold mallet skin selectable in Settings). Decisions: boss opens at 8 of 15 stars; in custom arenas the mallet may move anywhere in the level's zone (it does not collide with walls); big courses are shown whole by fitting the camera to the level bounds instead of a follow-camera.

- 2026-11-16 — Phase 12: Quick match. `src/net/matchmaking.ts` (Firebase RTDB queue `/queue/{uid}` with onDisconnect, per-user inbox `/matches/{uid}`, lowest uid in the queue claims the oldest other entry in a transaction; `?net=local` mock lobby), `src/net/quick.ts` (nickname screen, bot match while waiting, 'Opponent found' offer with 10 s accept, requeue on skip/no-show), `Online.hostQuick/joinQuick` (auto-start, join retries), nicknames in the HUD, `database.rules.json`. Firebase SDK is lazy-loaded. Tested with two tabs via `?net=local` only.

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

- 2026-11-16 — Known side effect of 1:1 controls: the Speed Boost power-up does nothing for mouse/touch players (it still helps keyboard players and bots). Consider replacing its effect (e.g. stronger hits + faster dash) in a balance pass.

## Things Levi needs to do
- [x] Enable GitHub Pages with Source = GitHub Actions (done, deploys work)
- [x] (Phase 12) Create the Firebase project and send the web config
- [ ] (Phase 12) Enable Anonymous sign-in (Google sign-in + authorized domain only needed for Phase 14)
- [ ] (Phase 12) Paste `database.rules.json` into Firebase → Realtime Database → Rules → Publish, then test Quick match in two browsers
- [ ] (Phase 12, optional) Free TURN server account (Metered or Cloudflare) for better connections with strangers
- [ ] (Optional) Supply CC0 music stems if he prefers real tracks over generated music

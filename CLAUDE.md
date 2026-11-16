# CLAUDE.md — instructions for any Claude model working on AirBattle

You may be **Fable** (first builder) or **Opus** (taking over when Fable ran out). Either way, follow this file.

## Start of every session (mandatory)
1. Read `PROGRESS.md` first — it tells you exactly where work stopped.
2. Read `PLAN.md` (phases + checkboxes) and the relevant parts of `SPEC.md`.
3. Run `git log --oneline -20` and `git status` to confirm the state matches PROGRESS.md. If there are uncommitted changes from a previous session, inspect them: keep them if they build and make sense, otherwise stash them and note it.
4. `npm install && npm run build` — confirm the project builds before changing anything.
5. Continue from the **"Next step"** in PROGRESS.md. Do not restart, re-architect, or rewrite working code.

## Working rules
- **Small steps, commit often.** Commit after every meaningful working step (at least every ~30–45 min of work) with a clear message. Push to `main` after each commit that builds. `main` must always build and be playable.
- **Update `PROGRESS.md` before every push**: what's done, current step, next step, known bugs, decisions. Assume you can be cut off at any moment — the next model has only the repo.
- Tick boxes in `PLAN.md` as you finish items.
- Finish a phase before starting the next. Never start online (Phase 6) before Phase 5 is done.
- Decisions in SPEC.md §2 are fixed. If you must deviate, log the reason under "Decisions" in PROGRESS.md.
- Keep `npm run build` (incl. `tsc`) error-free. No `any` sprawl; small modules.
- **Testing: proportionate.** Quick checks while building (build passes, quick headless screenshot or a short scripted physics test where useful). One fuller test pass at the end of each phase. Do not spend long on exhaustive test runs.
  - Pure logic (physics, bot, power-ups, match rules) should be testable without a browser: keep it free of Three.js/DOM imports. A few `vitest` tests for physics edge cases (tunneling, center-line) are worth it.
  - For visual checks, use headless Chromium (Playwright) screenshots if available in the sandbox; otherwise ask Levi to open the Pages URL and describe what he sees.
- Copyright: only code-generated audio or files with a clear CC0 / Pixabay-license source, logged in `CREDITS.md`. No copyrighted characters/brands in visuals.
- If you need something only Levi can do (enable GitHub Pages, create a Firebase/Supabase account, test on his phone), **ask him clearly in plain Dutch with step-by-step instructions**, and continue with other work meanwhile if possible.

## Communicating with Levi
- Levi is Dutch and non-technical in coding. Reply to him in **Dutch**, plain language, with concrete examples. The game itself is in English.
- After each phase: tell him what he can now try at the URL and what to look for.

## Architecture (keep to this)
```
src/
  main.ts                 entry, boot, screen routing
  core/                   pure game logic — NO three.js / DOM imports
    physics.ts            2D circles/walls, fixed step, swept collisions
    match.ts              rules: score, modes, golden goal, match point, resets
    state.ts              GameState type (serializable — used for online sync)
    powerups/             registry + one file per power-up (data + apply/expire)
  ai/
    bot.ts                prediction + decision
    botConfig.ts          difficulty parameter tables + adaptive logic
  input/                  mouse, touch (split multi-touch), keyboard
  render/                 three.js scene, table, mallets, puck, effects, camera
  ui/                     HTML/CSS overlay screens + HUD
  audio/                  sfx.ts, music.ts (adaptive L0–L3)
  net/                    peer.ts (PeerJS), protocol.ts, sync.ts
  storage/                settings.ts, stats.ts (localStorage, try/catch)
public/audio/             optional audio files (licensed, see CREDITS.md)
```
Game loop: fixed-step `core` simulation at 120 Hz → `render` interpolates between states. All gameplay state lives in `GameState` so online can snapshot it.

## Deployment
GitHub Actions → GitHub Pages on push to `main`. URL: `https://levivandam.github.io/Airbattle-/`. If deploy fails with a Pages-not-enabled error, ask Levi to set **Settings → Pages → Build and deployment → Source: GitHub Actions**.

# AirBattle — Build Plan

Rule: **every phase ends with a working, deployed, playable game.** Never leave `main` broken.
Do phases in order. Tick checkboxes here as you complete them, and log details in `PROGRESS.md`.
Spec: `SPEC.md`. Working rules: `CLAUDE.md`.

---

## Phase 0 — Project setup
- [x] Vite + TypeScript + Three.js project; `base: './'` in `vite.config.ts`
- [x] Folder structure as in CLAUDE.md
- [x] GitHub Actions workflow `.github/workflows/deploy.yml` building and deploying to GitHub Pages (actions/upload-pages-artifact + actions/deploy-pages)
- [x] `npm run build` passes; push; tell Levi he must enable **Settings → Pages → Source: GitHub Actions** once (if the deploy fails for that reason)
**Done when:** a placeholder page with a spinning 3D table-shaped box is live on the Pages URL.

## Phase 1 — Core game (vs simple bot)
- [x] 3D arcade table (rail, markings, goals), lighting, shadows, camera per SPEC §3
- [x] 2D physics module (fixed 120 Hz, swept collisions, no tunneling) — pure TS, no Three.js imports
- [x] Mouse + touch control of the bottom mallet; mallet can't cross center
- [x] Simple bot (Normal-ish) for the top mallet
- [x] Goals, scoring, first-to-7, puck reset after goal, stuck-puck rule
- [x] Minimal HUD (score)
**Done when:** you can play a full match to 7 vs the bot on laptop and phone, and it feels good (hard hits possible, no tunneling).

## Phase 2 — Game flow & bot levels
- [x] Title screen, main menu, pause, countdown, results screen, rematch
- [x] Settings screen (match mode: goals / time 2-3-5 min, power-ups toggle placeholder, graphics, volumes, screen shake) persisted in localStorage
- [x] Time mode + golden goal; MATCH POINT banner
- [x] Bot: Easy / Normal / Hard / Adaptive per SPEC §4.1, parameter table in `src/ai/botConfig.ts`
**Done when:** a non-technical person can open the URL and play any bot level in either mode without help.

## Phase 3 — Local 2 players
- [x] Laptop: mouse vs WASD/arrows (with inertia), key layout setting
- [x] Touch: split-screen multi-touch, top HUD rotated 180°
**Done when:** two people can play on one laptop and on one phone/tablet laid flat.

## Phase 4 — Core power-ups (6)
- [x] Power-up system: spawner, token visual, pickup by last-toucher, instant activation, durations, HUD icons with countdown rings, refresh-not-stack
- [x] Power Shot, Big Mallet, Multi-Puck, Shield, Freeze, Small Goal (SPEC §7.1)
- [x] Bot sometimes steers for power-ups (Normal/Hard)
- [x] Power-ups toggle in settings works
- [x] Design the system so effects are **data-driven + pure functions on game state** (needed for online sync later)
**Done when:** all 6 work vs bot and in local PvP, with visible effects and no crashes over a few full matches.

## Phase 5 — Audio, effects, stats, customization
- [x] SFX set (SPEC §8.1)
- [x] Adaptive music engine L0–L3 with crossfades on bar boundaries, triggers per SPEC §8.2 (procedural by default; file-stem support optional)
- [x] Effects: screen shake, goal particles + light flash, puck trail, slow-mo winning goal
- [x] Stats screen + localStorage
- [x] Mallet color picker
- [x] Graphics High/Low + auto-downgrade
**Done when:** the offline game feels complete and polished. ← **This is the "minimum finished game".**

## Phase 6 — Online with room codes
- [x] PeerJS integration, create/join room, `?room=` link, copy button
- [x] Host-authoritative sim, guest input, snapshots ~30 Hz, interpolation, own-mallet prediction, rotated camera for guest
- [x] Power-ups, goals, match end, rematch synced via events
- [x] Ping display, disconnect handling, friendly error if PeerJS broker unreachable
- [x] Test with two browser tabs (done with the `?net=local` test transport)
- [ ] **Real-internet test with PeerJS between two devices (laptop + phone) — NOT done yet, needs Levi + a friend**
**Done when:** Levi can send a link to a friend and play a full match with power-ups.

## Phase 7 — Extra power-ups (6)
- [x] Speed Boost, Ghost Puck, Fast Puck, Shrink, Reverse, Ice Rink (SPEC §7.2) — offline and online
- [ ] Balance pass on all 12 after human playtesting; record tuning in PROGRESS.md

## Phase 8 — (superseded by Phases 12 and 14 in the v2 plan below)
- [ ] **Stop and ask Levi** to create a free Firebase or Supabase project (explain step by step) and give you the public config keys
- [ ] Simple lobby/queue: waiting players pair up, then hand off to the PeerJS connection
- [ ] "Quick match" button appears only when configured

## Phase 9 — Final polish & QA
- [ ] One full test pass on laptop + phone (all modes), fix bugs
- [x] README for Levi: how to play, how to share, how the site updates
- [ ] Performance check (fps on Low/High)


---

# v2 plan (after Levi's first playtest) — see `SPEC-V2.md`

## Phase 10 — Controls, feel & bot rebalance (DO FIRST)
- [x] Mallet 1:1 under pointer, no smoothing, high safety cap, swept mallet–puck collision (SPEC-V2 §A)
- [x] Hit strength from real mallet velocity; raise PUCK_MAX, retune; puck radius ~0.045
- [x] Local mallet rendered at latest target; pick at grip height; hide cursor over table
- [x] Aim line after hard hits (+ settings toggle)
- [x] WASD/arrows solo with auto-switch + dash (Shift/Space) with cooldown ring
- [x] Bot: Rookie / Easy / Normal / Hard / Pro / Adaptive, all clearly weaker than v1 at the same name; default Easy
- [x] Human-like bot: move repertoire with anti-repeat memory, irregular rhythm, risk-taking, mood, idle motion, human mistakes, personality per level (SPEC-V2 §A 'Human-like bot')
- [x] New vitest tests (fast mallet always hits; mallet reaches target in 1 tick)
- [ ] **Ask Levi to playtest** (asked 2026-11-16, waiting for feedback) (controls + one game per bot level) and tune from his feedback
**Done when:** Levi says hitting and aiming feel good and Normal is a fair fight.

## Phase 11 — Campaign engine + World 1
- [ ] Physics: segment walls, circular bumpers, kinematic moving/rotating obstacles (standard table unchanged)
- [ ] Level data format + loader; arena of any shape; camera fit/follow for big tracks
- [ ] Targets, gates, finish zones, shot/time counters, win/lose + star conditions, retry
- [ ] Campaign menu button, world map with nodes + stars, unlock rules, localStorage progress
- [ ] World 1 (5 levels + boss "The Wall"), each verified solvable; first mallet-skin unlock
**Done when:** World 1 is playable start to finish with stars and the boss reward.

## Phase 12 — Quick match (matchmaking) — NEEDS LEVI'S FIREBASE CONFIG
- [x] Levi created the Firebase project + Realtime Database and gave the web config → `src/net/firebaseConfig.ts`
- [ ] Confirm Anonymous + Google auth are enabled and `levivandam.github.io` is an authorized domain
- [ ] `database.rules.json` + plain-Dutch instructions for Levi to paste them
- [ ] Nickname, queue with onDisconnect, transaction matching, hand-off to PeerJS room
- [ ] Bot while waiting + "Opponent found" accept banner
- [ ] Optional TURN server in PeerJS config (if Levi made an account)
- [ ] Test with two tabs (two anonymous users) and once on two real devices with Levi
If the Firebase config is not there yet when you reach this phase: ask Levi (steps are in PROGRESS.md) and continue with Phase 13 meanwhile.

## Phase 13 — Campaign Worlds 2–4 + rewards
- [ ] World 2 Obstacle Alley (+ boss "Bumper King", neon table unlock)
- [ ] World 3 Puck Course: bigger tracks (+ boss "Speed Demon", ice table unlock)
- [ ] World 4 Bot Gauntlet (+ boss "The Champion", champion table unlock)
- [ ] Skins + table themes selectable in Settings; bonus skin per fully-starred world
- [ ] Table theme choice used in vs bot / local / online (host decides)

## Phase 14 — Accounts & rating
- [ ] "Sign in with Google" (Settings + Quick match screen); nickname and campaign progress synced to Firebase
- [ ] Elo rating for signed-in players, rating-band matching, dual result reporting, leaver rule
- [ ] Database rules that limit cheating; tell Levi the honest limits
- [ ] Final QA on laptop + phone for everything

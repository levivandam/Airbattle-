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
- [ ] Title screen, main menu, pause, countdown, results screen, rematch
- [ ] Settings screen (match mode: goals / time 2-3-5 min, power-ups toggle placeholder, graphics, volumes, screen shake) persisted in localStorage
- [ ] Time mode + golden goal; MATCH POINT banner
- [ ] Bot: Easy / Normal / Hard / Adaptive per SPEC §4.1, parameter table in `src/ai/botConfig.ts`
**Done when:** a non-technical person can open the URL and play any bot level in either mode without help.

## Phase 3 — Local 2 players
- [ ] Laptop: mouse vs WASD/arrows (with inertia), key layout setting
- [ ] Touch: split-screen multi-touch, top HUD rotated 180°
**Done when:** two people can play on one laptop and on one phone/tablet laid flat.

## Phase 4 — Core power-ups (6)
- [ ] Power-up system: spawner, token visual, pickup by last-toucher, instant activation, durations, HUD icons with countdown rings, refresh-not-stack
- [ ] Power Shot, Big Mallet, Multi-Puck, Shield, Freeze, Small Goal (SPEC §7.1)
- [ ] Bot sometimes steers for power-ups (Normal/Hard)
- [ ] Power-ups toggle in settings works
- [ ] Design the system so effects are **data-driven + pure functions on game state** (needed for online sync later)
**Done when:** all 6 work vs bot and in local PvP, with visible effects and no crashes over a few full matches.

## Phase 5 — Audio, effects, stats, customization
- [ ] SFX set (SPEC §8.1)
- [ ] Adaptive music engine L0–L3 with crossfades on bar boundaries, triggers per SPEC §8.2 (procedural by default; file-stem support optional)
- [ ] Effects: screen shake, goal particles + light flash, puck trail, slow-mo winning goal
- [ ] Stats screen + localStorage
- [ ] Mallet color picker
- [ ] Graphics High/Low + auto-downgrade
**Done when:** the offline game feels complete and polished. ← **This is the "minimum finished game".**

## Phase 6 — Online with room codes
- [ ] PeerJS integration, create/join room, `?room=` link, copy button
- [ ] Host-authoritative sim, guest input, snapshots ~30 Hz, interpolation, own-mallet prediction, rotated camera for guest
- [ ] Power-ups, goals, match end, rematch synced via events
- [ ] Ping display, disconnect handling, friendly error if PeerJS broker unreachable
- [ ] Test with two browser tabs (and, if possible, laptop + phone)
**Done when:** Levi can send a link to a friend and play a full match with power-ups.

## Phase 7 — Extra power-ups (6)
- [ ] Speed Boost, Ghost Puck, Fast Puck, Shrink, Reverse, Ice Rink (SPEC §7.2) — offline and online
- [ ] Balance pass on all 12; record tuning in PROGRESS.md

## Phase 8 — Quick match (matchmaking) — NEEDS LEVI
- [ ] **Stop and ask Levi** to create a free Firebase or Supabase project (explain step by step) and give you the public config keys
- [ ] Simple lobby/queue: waiting players pair up, then hand off to the PeerJS connection
- [ ] "Quick match" button appears only when configured

## Phase 9 — Final polish & QA
- [ ] One full test pass on laptop + phone (all modes), fix bugs
- [ ] README for Levi: how to play, how to share, how the site updates
- [ ] Performance check (fps on Low/High)

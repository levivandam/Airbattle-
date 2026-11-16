# AirBattle — Spec v2 (feedback round, 2026-11-16)

Levi played v1. This file adds to `SPEC.md`; **where they conflict, this file wins.**

Levi's feedback, in his own words (translated): *"Controls are bad. The puck lags behind your mouse so you keep missing. The hitbox feels weird, aiming is way too hard, and the Normal bot is far too good: I lost 7-0 three times against Normal."*

---

## A. Controls & feel (top priority, do this first)

### Root causes found in v1 code
1. `T.MALLET_MAX = 5` caps mallet speed (`core/physics.ts` → `moveMallet`). A fast mouse flick is far faster, so the mallet trails the cursor. **This is the main bug.**
2. `FOLLOW = 55` exponential smoothing adds extra lag.
3. The puck takes the mallet's velocity, so a capped mallet also means weak, unsatisfying hits.
4. Rendering interpolates between ticks, which adds up to one tick of visual delay.
5. Pointer picking hits the table plane at y = 0, while the mallet knob the player looks at sits ~0.1 higher. With the tilted camera, cursor and mallet appear slightly offset ("weird hitbox").

### Required behaviour
- **Mouse/touch: the mallet sits exactly under the pointer (1:1), with no smoothing.** It may only be held back by the table edge, the center line, and the puck itself.
- Keep a very high safety cap (~25 u/s) only to prevent teleporting. Use **continuous (swept) collision** between mallet and puck: sub-step the mallet's movement in pieces no longer than ~half the puck radius per sub-step, so a fast flick still hits the puck instead of passing through it.
- Hit strength = the mallet's real velocity (measured over the last ~2–3 ticks) → hard flicks give hard shots. Raise `PUCK_MAX` to around 6–7 and re-tune `MALLET_E`/`DRAG` so the game feels fast but controllable.
- Render the **local human's mallet at the latest pointer target** (no interpolation delay). Pick on a plane at mallet-grip height so the cursor visually lands on the mallet. Hide the OS cursor over the table during play (the mallet is the cursor).
- Hitbox: the visual radius of the puck and mallets must equal their physics radius. Make the puck slightly bigger (~0.045) so it's easier to hit and aim.
- **Aiming:** a shot's direction must be predictable: contact point + mallet direction. Add a short, faint **aim line** for ~0.3 s after a hard hit (showing where the puck goes, including one wall bounce), so players learn bank shots. Toggle in Settings (default on).
- Keep the existing vitest physics tests green, and add tests: (a) a mallet moving 20 u/s through a resting puck always hits it; (b) the mallet reaches the pointer target within 1 tick when unobstructed.

### WASD solo
- In **all single-player modes** (vs bot, campaign, online), the player can also steer with **W A S D or the arrow keys**. **Auto-switch:** whichever input was used last controls the mallet (moving the mouse switches back).
- **Fast and direct:** near-instant acceleration, max speed ~3.5 u/s, quick stop when keys are released.
- **Dash:** Shift or Space gives a short burst (~0.15 s at ~2.2× speed, cooldown ~0.6 s) for hard shots. Show the cooldown as a small ring under the mallet.
- In Local 2 Players nothing changes (P1 mouse, P2 keys).

### Bot difficulty
- **Five levels + Adaptive:** Rookie, Easy, Normal, Hard, Pro, Adaptive.
- Targets: **Normal ≈ 50/50 against an average casual player.** Rookie should be beatable by a first-time player (slow, often out of position, weak shots). Pro is for experts.
- The bot's mallet speed and reaction must stay clearly *below* what a human with the new 1:1 controls can do at Rookie/Easy/Normal. Hard and Pro may match it.
- In v1 even "Easy" probably felt hard because the human was handicapped. After the controls fix, **ask Levi to play each level once** and tune `src/ai/botConfig.ts` from his feedback. Default menu choice: Easy.

### Human-like bot ("less robotic")
Levi: *"The bot feels too much like a bot. Make it feel more like a human, who sometimes takes a risk and doesn't always use the same moves and rhythm."*
The v1 bot always does the same thing (defend line → get behind puck → shoot straight or bank) at a steady decision rhythm. Requirements for all levels:
- **Shot variety with memory:** a repertoire of at least 5 moves: straight shot, bank left, bank right, double bank, soft push/"dink", fake (wind up one way, hit the other), wait-and-pounce, and a quick deflection without taking possession. Choose by weighted random, and **lower the weight of the last 2–3 moves used**, so it doesn't repeat itself.
- **Irregular rhythm:** sometimes it hits immediately, sometimes it controls the puck and waits 0.3–1.5 s while moving the mallet around it (like a person lining up a shot), sometimes it rushes. Reaction delays vary per decision (random within a range), not a fixed timer.
- **Risk-taking:** it sometimes **leaves its goal to attack aggressively** (higher chance when behind, at match point for the opponent, or late in timed mode), and sometimes tries a hard, low-percentage shot. That opens chances for the player.
- **Mood:** after conceding 2 in a row it gets a bit reckless (faster, more risks, more mistakes) for ~10 s. When leading by 3+ it gets lazier and more casual. All levels use this, with the effect scaled by level.
- **Idle motion:** while the puck is on the other side, the mallet drifts and shifts slightly (no frozen statue, no perfect centring), and sometimes "reads" the wrong side.
- **Human mistakes:** occasional mistiming (arrives a bit early or late), over-committing to a fake by the player, mis-hitting (glancing contact). More often on lower levels, rare but present on Pro.
- **Adapts to the player (Hard/Pro):** remembers which side the player scores from most and leans that way, so the player has to vary too.
- **Personality per level:** e.g. Rookie = cautious and slow, Easy = playful but sloppy, Normal = balanced, Hard = aggressive bank-shot lover, Pro = patient and tricky. Campaign bosses get their own personalities.
- Implementation hint: split `src/ai/bot.ts` into perception (with noise/delay) → decision (state machine: defend / possess / line up / shoot / recover, with weighted move choice) → motor (move toward the target with human-like speed curves, not perfect straight lines). All personality numbers live in `src/ai/botConfig.ts`.
- Check: in a bot-vs-bot test, log the moves used; no single move should be more than ~40% of all shots, and the time between hits should vary visibly (not one fixed interval).

---

## B. Single-player campaign

### Structure — worlds with a boss
- **4 worlds × 6 levels** (5 levels + 1 boss) = 24 levels. One level takes 30–120 s.
- **Stars:** each level gives 1–3 stars. 1★ = complete. 2★ and 3★ = level-specific extra goals (time limit, max shots, no goal conceded, all targets hit…).
- **Unlocking:** level n+1 opens when level n is done. A new world opens with enough stars from the previous one (e.g. 10 of 18 stars from levels 1–5), and the boss needs ~12.
- **Rewards:** each boss unlocks a **mallet skin**. Finishing a world unlocks a **table theme** that can be picked in normal matches (vs bot, local, online: the host's choice). Getting all stars in a world unlocks a bonus skin. *(Power-ups are NOT locked; they stay always available.)*
- Progress is saved in localStorage. If the player is signed in (see C), it is also saved to Firebase so it carries across devices.
- Main menu gets a **Campaign** button (the largest one, above Play vs Bot). There is a **world map** screen showing levels as nodes with stars.

### Level types (all four wanted)
1. **Target practice:** hit targets (discs, zones, moving targets) with the puck; limited shots or time. Teaches aiming and bank shots.
2. **Obstacles:** walls, bumpers, rotating bars, moving blocks, one-way gates, on the normal table. Score past them.
3. **Puck courses (bigger tracks):** levels **bigger than or shaped differently from a normal table**: curves, narrow corridors, long tracks, several rooms. Like minigolf with a puck: steer the puck through gates to a finish, in few hits and on time. The mallet follows the puck through the course (the player's mallet "zone" moves with it, or the player can move anywhere — pick whichever plays best and log it). The camera follows the puck and zooms out to show the course ahead.
4. **Bot challenges:** special rules against a bot: win with a smaller goal, score only via bank shots, survive 60 s without conceding, the bot has Shield every 10 s, etc.

### Suggested worlds (designer may refine; log changes in PROGRESS.md)
| World | Theme / unlocked table | Focus | Boss |
|---|---|---|---|
| 1 Training Hall | classic table (default) | aiming, targets, first bank shots | "The Wall": defends with a huge mallet |
| 2 Obstacle Alley | neon table | bumpers, moving blocks, rotating bars | "Bumper King": obstacles that move toward you |
| 3 Puck Course | ice-rink table | bigger tracks, gates, curves | "Speed Demon": race a bot puck through the course |
| 4 Bot Gauntlet | gold/champion table | rule-twist matches | "The Champion": Pro-level bot that uses power-ups smartly |

### Engine requirements
- **Levels are data**, one file per level (e.g. `src/campaign/levels/w1-3.ts`), describing: arena shape (polygon walls), goals (position/size, may be 0 or several), obstacles (static segments, circular bumpers with extra bounce, moving/rotating bodies with simple paths), targets/gates/finish zone, puck start(s), mallet zone, optional bot + rules, win/lose conditions and star conditions, and par values.
- Generalise physics so it supports **line-segment walls and circular obstacles**, plus kinematic moving obstacles (puck vs swept segment). Keep the standard table fast and unchanged in behaviour.
- A "Retry" (R key / button) restarts a level instantly. Show the level goal at the start and the star conditions on the result screen.
- Level design must be playtested by a quick bot or scripted check that each level is **solvable** (e.g. a scripted shot reaches the finish), not just loadable.

---

## C. Matchmaking ("Quick match") + accounts

### Service: Firebase (Levi creates the project; free Spark plan)
- **Firebase Realtime Database** for the queue (its `onDisconnect()` removes players who close the tab, so no "ghost" players).
- **Firebase Authentication:** **anonymous sign-in by default** (invisible to the player) + optional **"Sign in with Google"**.
- Firebase web config keys go in `src/net/firebaseConfig.ts`. They are public by design; security comes from the **database rules** (`database.rules.json` in the repo, which Levi pastes in the console or which is deployed via instructions).
- Spark plan = **no Cloud Functions**, so matching runs in the clients using RTDB transactions.

### Flow
1. Player taps **Quick match** and picks/keeps a **nickname** (3–16 chars, letters/numbers/_ only, stored locally; signed-in users keep it on their account).
2. Client writes `/queue/{uid}` `{nick, rated, rating, ts}` with `onDisconnect().remove()`.
3. **Meanwhile the player plays a bot (Normal)** right away. When an opponent is found: banner "Opponent found: NICK. [Play now]" with a 10 s accept; the bot match is abandoned without stats. If declined or timed out → back to the queue.
4. Matching: the client looks for the oldest other waiting entry and claims both in **one transaction**, writing `/matches/{id}` `{host, guest, code, ts}`. Both clients watch `/matches` for their uid. Host opens a PeerJS room with that code; guest joins. From here the existing online code (`src/net/online.ts`) is reused unchanged.
5. Clean up queue and match entries afterwards. Stale entries (> 2 min) are ignored.

### Rating (only for signed-in players)
- **Signed in with Google → rating (Elo, start 1000, K = 32)**, shown in the menu and next to the nickname. Signed-in players are matched preferably within ±150 rating, widening by +50 every 10 s.
- **Not signed in → nickname only**, no rating. A match between a rated and an unrated player is unrated.
- Result reporting: **both clients report the result** to `/results/{matchId}/{uid}`; ratings update only when both reports agree. Disconnect during a match = loss for the leaver (only if the remaining player reports it and the leaver's report is missing after 60 s).
- **Honest limitation (tell Levi):** without a server you can't fully stop a determined cheater from faking results or their own rating. Database rules can limit the damage (only write your own entries, rating changes within ±K, a match may only be reported once). Real anti-cheat needs Cloud Functions (paid Blaze plan, credit card) — out of scope unless Levi asks.

### Connectivity
- Strangers on strict networks (school, work, 4G) often fail to connect with only STUN. Add a **TURN server** to the PeerJS config (e.g. a free tier from Metered or Cloudflare Calls/TURN) — needs another free account from Levi; keep the key in config. Without it, show the existing friendly error.

---

## D. Order of work
See `PLAN.md` Phases 10–14. Controls first: everything else is pointless if hitting the puck feels bad.

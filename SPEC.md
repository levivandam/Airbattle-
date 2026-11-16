# AirBattle — Product Specification

Browser air hockey game, 3D bird's-eye view, played vs a bot, locally vs a friend, or online vs a friend.
Owner: Levi (non-technical; explain choices in plain language when reporting to him).
All in-game text is **English**.

---

## 1. Platforms & hosting

- Runs in modern browsers on **laptop/desktop (mouse + keyboard)** and **phone/tablet (touch, multi-touch)**.
- Hosted on **GitHub Pages** from repo `levivandam/Airbattle-`, deployed by a GitHub Actions workflow on every push to `main`.
- Expected URL: `https://levivandam.github.io/Airbattle-/` (use relative asset paths / Vite `base: './'` so the exact path does not matter).
- Must hold **60 fps on a mid-range laptop** and be playable (≥ 45 fps) on a mid-range phone. Provide a **Graphics: High / Low** setting (Low = no shadows, lower pixel ratio, fewer particles). Auto-pick Low on touch devices with `devicePixelRatio > 2` or when fps drops below 40 for 3 s (then show a small toast).

## 2. Tech stack (decided — do not change without a strong reason, and log it in PROGRESS.md)

| Concern | Choice | Why |
|---|---|---|
| Build | **Vite + TypeScript** | fast, catches bugs, trivial Pages deploy |
| 3D | **Three.js** | real 3D table, lights, shadows |
| Physics | **Own 2D physics** on the table plane (circles vs walls/circles), fixed timestep 120 Hz | air hockey is 2D; full physics engines add weight and nondeterminism |
| Online | **PeerJS (WebRTC)** with the free public PeerJS broker, room codes | no own server needed; works on static hosting |
| Matchmaking (later phase) | Firebase or Supabase free tier | needs an account Levi creates — **stop and ask him** when you reach it |
| Audio | **Web Audio API** (optionally Tone.js) | needed for adaptive music |
| Storage | `localStorage` (wrapped in try/catch) | stats, settings, mallet color |

No backend of our own. No accounts.

## 3. Look & feel — "Classic arcade hall"

- **Table:** white/off-white playing surface with a subtle grid of air holes, red center line and center circle, blue goal creases, **wooden rail** around the table with a slight bevel. Real 3D geometry.
- **Mallets ("sticks"):** classic shape (wide base + handle knob), default **red (player 1 / bottom)** and **blue (player 2 / top)**; player can recolor (see §9).
- **Puck:** dark/black disk, slight gloss, soft shadow.
- **Camera:** almost straight down, tilted ~12–18° toward the local player so rails and mallets show depth. The **local player's side is always at the bottom** of the screen (online guest gets a camera rotated 180°).
- **Environment:** dim arcade room around the table (dark floor, faint neon signs/arcade cabinets out of focus is a nice-to-have), one warm overhead lamp casting shadows.
- **Scoreboard:** 3D/LED-style score display at the table's head, plus a clean HTML overlay HUD (score, timer if timed mode, active power-up icons with countdown rings).
- Orientation: table is **portrait** (long axis vertical). On landscape laptop screens, the table is centered with environment on the sides.

## 4. Game modes

Main menu: **Play vs Bot · Local 2 Players · Online · Settings · Stats**.

### 4.1 Play vs Bot (PvE)
Difficulty choices: **Easy · Normal · Hard · Adaptive**.
- Bot predicts puck path incl. wall bounces, moves its mallet to intercept, then strikes toward the player's goal (with angle shots off walls on Normal/Hard).
- Each level is defined by parameters: reaction delay, max mallet speed, aim error, prediction depth (number of bounces), aggression (how far forward it attacks).
  - Easy: slow reaction (~350 ms), large aim error, defends mostly, 0–1 bounce prediction.
  - Normal: ~200 ms, medium error, mixes defend/attack, 1 bounce.
  - Hard: ~90 ms, small error, aggressive, 2 bounces, uses bank shots.
- **Adaptive:** parameters slide continuously between Easy and Hard based on the score difference and recent goals (player leads → bot gets stronger; player trails → bot weakens). Should feel human: occasional mistakes even on Hard.
- Bot must collect power-ups sometimes on purpose (Normal/Hard steer the puck toward a power-up when safe).

### 4.2 Local 2 Players (local PvP)
- **Laptop:** Player 1 (bottom) = mouse. Player 2 (top) = **WASD** (or arrow keys, configurable) with acceleration/inertia so keyboard play feels fair.
- **Phone/tablet laid flat:** multi-touch — each player drags on **their own half** of the screen; the touch on a half controls that half's mallet. The top player's HUD elements are rotated 180° so they can read them.

### 4.3 Online (room code)
- **Create room** → shows a short code (e.g. 5 characters, no ambiguous letters) + **Copy link** button (link with `?room=CODE` auto-joins).
- **Join room** → enter code.
- Host is authoritative: host runs the physics; guest sends its pointer/mallet target; host sends state snapshots (~30 Hz) and events (goal, power-up spawned/collected/ended, match end). Guest renders with interpolation (~100 ms buffer) and **predicts its own mallet locally** so control feels instant.
- Show ping in a corner. Handle disconnects: "Opponent disconnected" screen with Back to menu. Rematch button after a match.
- The host picks match settings (goals/time). Power-ups work identically online.
- **Matchmaking with strangers** ("Quick match") is a later phase (see PLAN.md). Until then the button is hidden.

## 5. Match rules

- **Default: first to 7 goals.**
- **Optional (settings / pre-match): time mode** — 2, 3 or 5 minutes; most goals wins; tie → **golden goal** (next goal wins).
- After a goal: short goal celebration (~1.5 s), the puck is placed on the side of the player who **conceded**, frozen for a moment, then free.
- **Match point:** a player needs 1 more goal (first-to-N mode). Show "MATCH POINT" banner.
- Pause (Esc / pause button) in PvE and local PvP; online: no pause, only "leave match" with confirm.
- Puck stuck detection: if the puck is nearly still in one half for 5 s, place it back at the center of that half (it stays with that player) — avoids stalemates and stalling.

## 6. Physics feel

- Table units: width 1.0 × length 2.0 (logical), goal width ~0.30 (scales with power-ups).
- Mallets cannot cross the center line; mallet speed is derived from pointer movement and capped.
- Collision mallet→puck transfers the mallet's velocity (that's what makes hard hits possible); puck → walls restitution ~0.9; very light friction (air table). Max puck speed cap.
- Use sub-stepping / swept collision so a fast puck **never tunnels** through a mallet or wall.
- Fixed timestep 120 Hz, render interpolated.

## 7. Power-ups

**How they work:** every 8–12 s (random) a power-up token appears on the table (max 1 at a time; not within 0.25 of a goal; at most 1 on each half alternately is fine). It hovers/spins slightly with a glowing icon. **The player who last touched the puck gets it when the puck passes over the token.** Activation is **instant** on pickup. Short banner + icon in HUD with a countdown ring. Same power-up cannot stack on the same player; picking it again refreshes the duration.

Power-ups are disabled-able in Settings (all on/off) for purists.

### 7.1 Core set (phase 1 of power-ups)
| Name (in game) | Effect | Duration |
|---|---|---|
| **Power Shot** | your hits launch the puck 1.6× harder (orange trail on the puck) | 8 s |
| **Big Mallet** | your mallet radius ×1.5 | 10 s |
| **Multi-Puck** | 2 extra pucks spawn at the center; every puck can score; after the first goal all extra pucks vanish | until a goal, max 15 s |
| **Shield** | glowing barrier in front of your goal blocks the first shot that hits it | 8 s or 1 block |
| **Freeze** | opponent's mallet is frozen in place (ice effect) | 1.2 s |
| **Small Goal** | your own goal shrinks to 60 % width | 10 s |

### 7.2 Extra set (later phase)
| Name | Effect | Duration |
|---|---|---|
| **Speed Boost** | your mallet max speed ×1.4 | 10 s |
| **Ghost Puck** | puck flickers/turns almost invisible (only faint ripples) | 2.5 s |
| **Fast Puck** | puck speeds up a bit after every hit | until next goal |
| **Shrink** | opponent's mallet radius ×0.65 | 8 s |
| **Reverse** | opponent's controls mirrored left/right | 4 s |
| **Ice Rink** | opponent's half becomes slippery: their mallet has momentum/drifts | 6 s |

Balance rule: no single power-up may decide a match on its own; tune durations after playtesting and note changes in PROGRESS.md.

## 8. Audio

### 8.1 Sound effects
Mallet hit (louder with impact speed), wall hit, goal horn + crowd cheer, power-up spawn/pickup/expire (per type), countdown beeps, menu clicks, match win/lose jingles. All generated with Web Audio **or** CC0 files.

### 8.2 Adaptive music (important to Levi)
- **Lobby/menus:** calm, relaxed arcade/lo-fi loop.
- **In match:** more competitive, upbeat arcade/synthwave.
- **Intensity rises as the match gets tense.** Four intensity levels, smoothly crossfaded (no hard cuts, change on bar boundaries):
  - **L0 Lobby** – calm.
  - **L1 Match** – base groove.
  - **L2 Tension** – triggered by: any player on **match point**, OR time mode with **≤ 60 s** left. Adds drums/bass layer, slightly faster tempo or filter opens.
  - **L3 Climax** – triggered by: **both players on match point**, OR **last 30 s**, OR **golden goal**. Full layers, driving hi-hats, higher energy.
  - Short stinger on goals; music ducks briefly under the goal horn.
- **Copyright-free requirement.** Preferred implementation: **procedurally generated music in code** (Web Audio / Tone.js) built from layers (pad, bass, drums, lead) so intensity = enabling layers + tempo/filter changes. Code-generated music is automatically free of copyright issues and makes the intensity system easy.
- Optional upgrade: if Levi provides audio files, support **CC0 / Pixabay-license** stems in `public/audio/music/` (`lobby.mp3`, `match_l1.mp3`, `match_l2.mp3`, `match_l3.mp3`, same BPM and length for layering). Record every file's source + license in `CREDITS.md`. Never add files with unclear licenses. (The build sandbox usually cannot download from music sites — ask Levi to add files himself.)
- Settings: separate **Music** and **SFX** volume sliders + mute button in HUD. Audio starts only after first user interaction (browser rule).

## 9. Extras

- **Effects:** screen shake on very hard hits (scaled, can be turned off), particle burst + table-light flash on goals, puck trail at high speed, **slow-motion on the match-winning goal** (~1 s at 30 % speed, camera slight zoom).
- **Stats (localStorage):** wins/losses per bot difficulty, win streak (current + best), total goals scored, fastest puck speed hit, matches played (local + online count). Stats screen with a Reset button (confirm).
- **Custom mallet:** pick your mallet color (8–10 preset colors) and a ring/accent color; stored locally; online, opponent sees your colors (if both pick the same color, the guest's mallet gets an automatic outline/contrast tweak).

## 10. UX details

- First load: short title screen "AIRBATTLE" → tap/click to start (unlocks audio).
- Countdown 3-2-1-GO at match start.
- Results screen: winner, score, a couple of match stats (hardest shot, power-ups collected), buttons Rematch / Menu.
- Responsive HUD; touch targets ≥ 44 px; works in portrait on phones (landscape shows a hint to rotate or adapts).
- Prevent page scrolling/zooming on touch during play.
- Settings persist: match mode default, power-ups on/off, graphics, volumes, screen shake, P2 key layout.

## 11. Out of scope

Accounts, global leaderboards, chat, tournaments, in-app purchases, more than 2 players.

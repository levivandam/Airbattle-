# AirBattle

3D air hockey in the browser — play against a bot, a friend on the same device, or a friend online. With 12 power-ups and music that gets more intense as the match gets tighter.

**Play:** https://levivandam.github.io/Airbattle-/

## How to play
- **Play vs Bot** — move your mallet with the mouse (laptop) or your finger (phone). Easy / Normal / Hard / Adaptive.
- **Local 2 Players** — laptop: player 1 uses the mouse, player 2 uses W A S D (or the arrow keys, see Settings). Phone/tablet: lay it flat, each player drags on their own half.
- **Online** — one player picks *Create room* and shares the code or the invite link; the other picks *Join room*.
- First to 7 goals wins, or pick a 2 / 3 / 5 minute match (a tie goes to golden goal).
- Power-ups appear on the table. Whoever touched the puck last when it slides over one gets it.

## How the site updates
Every push to `main` is built and published to GitHub Pages automatically (`.github/workflows/deploy.yml`). It takes about a minute.

## For developers / AI assistants
Read [CLAUDE.md](CLAUDE.md) first, then [PROGRESS.md](PROGRESS.md), [PLAN.md](PLAN.md) and [SPEC.md](SPEC.md).

```bash
npm install
npm run dev     # local dev server
npm test        # quick physics / bot / power-up checks
npm run build   # type-check + production build to dist/
```
Tip: open two tabs with `?net=local` to test online play without internet.

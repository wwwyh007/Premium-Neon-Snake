# Premium Neon Snake — Web Alpha

The browser-native evolution of the Python/Pygame desktop game.

## Current alpha

- React 19 + TypeScript game shell
- HTML Canvas renderer with neon glow effects
- Classic and Obstacle modes
- Five snake skins, including a new random gradient per run
- Keyboard, WASD, and touch controls
- Timer, shields, and special rewards
- D1-backed global top 10, personal run history, and all-time best
- Responsive layout for desktop and mobile

## Local development

Requirements: Node.js 22.13+ and npm 11+.

```powershell
npm install
npm run dev
```

Build and test:

```powershell
npm test
```

## Structure

- `app/game-engine.ts` — pure game rules and state transitions
- `app/NeonSnakeGame.tsx` — React controls, Canvas renderer, skins, and score UI
- `app/api/scores/route.ts` — validated leaderboard and history API
- `db/` and `drizzle/` — D1 score schema and migration
- `app/globals.css` — responsive neon arcade design system
- `tests/` — game-engine and server-rendering checks

## Next milestone

Add sound, particle feedback, challenge events, and optional player accounts.

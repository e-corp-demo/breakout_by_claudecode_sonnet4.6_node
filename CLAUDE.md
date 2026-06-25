# breakout_pi_4

Premium arcade Breakout game. HTML5 Canvas frontend, Node.js/Express backend.

## Stack

- **Frontend:** vanilla JS canvas (`public/game.js`), no build step
- **Backend:** Express (`server.js`), multer for uploads, JSON file for scores
- **Run:** `npm start` → http://localhost:3000

## Key files

| File | Purpose |
|------|---------|
| `public/game.js` | All game logic, rendering, input, score API calls |
| `public/index.html` | Shell + leaderboard sidebar |
| `public/style.css` | Layout/styling |
| `server.js` | REST API: GET/POST `/scores`, POST `/upload-bg` |
| `scores.json` | Persistent top-20 scores (server-side) |
| `sonar-project.properties` | SonarQube: project `e-corp-demo_breakout_pi_4`, org `e-corp-demo` |

## API

- `GET /scores` → top 10 scores
- `POST /scores` `{name, score}` → upsert, returns top 10
- `POST /upload-bg` multipart `background` field → `{path: "/uploads/..."}`

## Game architecture

Single `gameLoop()` via `requestAnimationFrame`. State machine: `idle | playing | paused | levelup | gameover`.

Key functions in `game.js`:
- `buildBricks()` — 7 rows × cols, color-coded by row
- `update()` — physics tick: ball, paddle, collisions, particles
- `resolveAABB(b)` — brick collision + side detection
- `spawnParticles(brick)` — 8–12 particles per brick break
- `drawBackground()` — space gradient + neon grid + stars
- `gameLoop()` — update + draw each frame

## Constraints

- No framework, no bundler — raw Canvas API only
- Score name: max 12 chars, uppercase alphanumeric + space/dash/underscore
- Upload: images only, max 15 MB
- Keep neon/glow aesthetic — `shadowBlur` on ball, paddle, bricks
- Infinite levels: ball speed increases each level

## SonarQube

Post-edit hook active via `.claude/hooks/sonar-sqaa/`. Runs after Edit/Write.

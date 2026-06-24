# RuleAdd

[한국어](./README.md) · **English**

> A 3D dodging puzzle where the rules pile up one by one. Move the white sphere through the gap in the approaching wall.

### ▶ [Play now — rule-add.netlify.app](https://rule-add.netlify.app)

---

## What is this?

**RuleAdd** is a 3D *Hole-in-the-wall* dodging puzzle built with WebGL (three.js). A 3D evolution of the Chrome dinosaur mini-game: you move a white sphere (the player) on a white background and slip it through the **gap** of walls approaching along the Z axis.

The twist is right there in the name — **rules are added over time (Rule + Add)**. Every round stacks a new rule onto the right-hand panel, turning the game into a spatial-reasoning + logic puzzle. **Difficulty doesn't come from wall speed — it comes only from the accumulating rules.** There's no ending; you survive as long as you can and chase a high score.

## Core mechanic

- Walls approach, blocking some cells and leaving **at least one gap**.
- Move the sphere into the gap to pass. **Hit a blocked cell and you lose a life**; at zero, it's game over.
- Each wall set passed adds score, and every 10 sets the round goes up and **a new rule activates**.

## Controls

| Key | Action |
|-----|--------|
| `A` / `D` | Move left · right |
| `W` / `S` | Move up · down (2D mode) |

## Rules — one stacks each round

Later rules win on conflict (later-wins).

| Rule | Effect |
|------|--------|
| **Rule 1** | Hit a wall and you die. Move left/right. |
| **Rule 2** | Walls with an arrow shift one cell in the arrow's direction when you get close. |
| **Rule 3** | Walls of a certain color **don't move (stop)** even with an arrow. |
| **Rule 4** | Walls of a certain color **don't collide (pass-through)**. |
| **Rule 5** | ⓧ-marked walls **grow** in that direction — a trap that looks like an empty cell. |
| **Rule 6** | The grid **expands by one cell per side** (4 → 5 cells, 4×4 → 5×5). |
| **Round 7+** | Endless progression — speed +5% / further expansion / new color rules (including reverse direction) keep being added. |

## Five difficulties

| Mode | Traits |
|------|--------|
| **Easy** | Slow speed · 5 lives · loose progression |
| **Normal** | Default speed · 3 lives · rules added each round |
| **Hard** | Fast speed · 3 lives · starts with all static rules (5 cells) |
| **Blind** | Like Normal but the **rule panel is hidden** — figure it out yourself |
| **2D** | Starts on a 4×4 grid with up/down (`W`/`S`) added |

## Scoring & leaderboard

- Each set passed scores **`base (100) × round²`** — points snowball in later rounds.
- On game over, your run is recorded to the **local top 5** and the **global top 10** (Firebase), with name and comment.
- Korean / English toggle supported.

## Tech stack

- **three.js** — WebGL 3D scene / camera / meshes
- **TypeScript** + **Vite** — type safety + fast dev server / bundling
- **Firebase** — global leaderboard
- Deploy: **Netlify** ([rule-add.netlify.app](https://rule-add.netlify.app))

Rules are data-driven: a new rule is just an `{appliesTo, modify}` object, and the engine folds active rules in order.

## Run locally

```bash
npm install
npm run dev        # Vite dev server (play in the browser)
npm run build      # typecheck + production build
npm run typecheck  # typecheck only
```

> To use the global leaderboard, copy the Firebase config into `.env` (see `.env.example`). The game and local scores work without it.

## Credits

**Computer Graphics personal project** — [youner119](https://github.com/youner119)

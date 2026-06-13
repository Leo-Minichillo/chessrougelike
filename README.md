# ♞ Gambit — A Chess Roguelike

Enter your Elo, then climb a branching map fighting AI opponents calibrated to
your skill. You play **real, legal chess** — but between battles you collect
**relics and spells that bend the rules in your favour**. Slay the Spire meets
chess.

> Vertical-slice MVP: one full act — Elo entry → branching map → battles, elites,
> shops, events, a puzzle → boss → win/lose.

## Quick start

```bash
npm install
npm run dev      # play at the printed localhost URL
npm test         # run the test suite
npm run build    # production build
```

## How it plays

1. **Enter your Elo** (100–2800). It sets the difficulty of the whole run; the
   map ramps difficulty above that as you climb.
2. **Pick a path** through the branching map. Node types: ⚔️ Battle, 💀 Elite,
   🛒 Shop, ❓ Event, 🧩 Puzzle, 👑 Boss.
3. **Win battles** by checkmate *or* by reaching a material edge / a flavoured
   objective ("Behead the Champion" — capture the enemy queen). Battles use
   reduced-material skirmishes so they stay short and punchy.
4. **Collect relics** after wins and from shops, then unleash them mid-battle.
5. **Beat the Necromancer** boss (it resurrects its dead every third turn) to
   win the act. Lose all your hearts and the run is over.

### Relics & spells (MVP)

| Relic | Type | Effect |
|---|---|---|
| ⏳ Time Stutter | spell ×2 | Take two moves in a row (you start with this) |
| ❄️ Frostbite | spell ×1 | Freeze an enemy piece for the next enemy turn |
| 🐴 Conscript | spell ×1 | Summon a knight on your back rank |
| ⭐ Battlefield Promotion | spell ×1 | Promote a pawn to a queen instantly |
| 💥 Banish | spell ×1 | Delete an enemy piece (not the king) |
| 🪙 Tithe | passive | +5 gold per capture |
| 📦 Stockpile | passive | +1 charge to all spells each battle |
| 🦇 Vampiric Edge | passive | First capture each battle also drains an adjacent pawn |

## Architecture

```
src/
  engine/   BattleEngine.ts   the keystone: wraps chess.js, owns turn/FEN, the
                              ONLY place the board is mutated (all rule-bending
                              funnels through here, always FEN-validated)
            fenUtils.ts        safe board mutation + FEN validation
            objectives.ts      win/loss conditions
  ai/       minimax.ts         self-contained alpha-beta AI (the opponent)
            engine.worker.ts   runs the search off the UI thread
            EngineClient.ts    Promise wrapper around the worker
            eloMapping.ts      Elo -> engine config + per-node escalation
  relics/   relicDefs.ts       data-driven relic table + lifecycle hooks
  map/      mapGen.ts          seeded Slay-the-Spire-style DAG
  run/      runState.ts, encounters.ts, rewards.ts, events.ts
  state/    useGameStore.ts    Zustand store wiring phase ↔ run ↔ battle
  components/ board/, screens/, hud/
```

**Design keystone:** `chess.js` is strict (legal moves only), so it is the
source of truth for the *board* but never for *whose turn / how many moves*.
`BattleEngine` owns turn and extra-move bookkeeping; rule-bending powers mutate
the board via `put`/`remove`/`load` and are re-validated before they commit (an
illegal result simply fizzles instead of corrupting the game).

### A note on the AI

The opponent is a compact, self-contained alpha-beta engine
(`src/ai/minimax.ts`) running in a Web Worker. It needs no network access and no
cross-origin isolation headers, so the slice runs anywhere out of the box, and
its strength is dialled directly from your Elo (search depth + evaluation noise
+ deliberate-blunder rate).

The original plan named **stockfish.wasm**. It remains a clean drop-in: the
`EngineClient` interface and the worker's request/response message shape are
engine-agnostic, and `eloToEngineConfig()` already emits the Stockfish knobs
(`UCI_LimitStrength`, `UCI_Elo`, `Skill Level`, `movetime`) alongside the
minimax ones. Swapping in Stockfish later is contained to `engine.worker.ts` +
`EngineClient.ts` (and uncommenting the COOP/COEP headers in `vite.config.ts`
for a multithreaded build).

## Tuning

- `ELO_HUMANIZE_OFFSET` in `src/ai/eloMapping.ts` — one constant to shift overall
  difficulty after playtesting.
- The in-battle debug line shows the computed effective Elo and engine config
  per encounter.

## Tests

`npm test` covers the Elo mapping bands, objective evaluation, FEN validation,
every rule-bending relic (each must yield a legal board), map generation /
reachability, the minimax engine, and a full headless battle loop.

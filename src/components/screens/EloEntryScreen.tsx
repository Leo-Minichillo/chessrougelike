import { useEffect, useState } from 'react';
import { useGameStore } from '../../state/useGameStore';

function tierFor(elo: number): { name: string; blurb: string } {
  if (elo < 600) return { name: 'Wood League', blurb: 'The enemy will hang pieces. Pounce!' };
  if (elo < 900) return { name: 'Beginner', blurb: 'Loose play — punish the blunders.' };
  if (elo < 1200) return { name: 'Casual', blurb: 'They have a plan. So should you.' };
  if (elo < 1500) return { name: 'Club Player', blurb: 'Tactics everywhere. Stay sharp.' };
  if (elo < 1800) return { name: 'Tournament', blurb: 'Few free pieces. Earn every edge.' };
  if (elo < 2100) return { name: 'Expert', blurb: 'The relics are your lifeline now.' };
  if (elo < 2400) return { name: 'Master', blurb: 'Ruthless. Bend the rules to survive.' };
  return { name: 'Grandmaster', blurb: 'Good luck. You will need every spell.' };
}

export function EloEntryScreen() {
  const startRun = useGameStore((s) => s.startRun);
  const loadSaved = useGameStore((s) => s.loadSaved);
  const [elo, setElo] = useState(800);
  const [hasSave, setHasSave] = useState(false);

  useEffect(() => {
    try {
      setHasSave(!!localStorage.getItem('gambit:run'));
    } catch {
      /* ignore */
    }
  }, []);

  const tier = tierFor(elo);

  return (
    <div className="elo-entry panel">
      <h2>Enter your Elo</h2>
      <p className="muted">
        Your rating sets the difficulty of the entire run. Climb the branching map,
        collect rule-bending relics, and topple the boss.
      </p>

      <input
        className="elo-input"
        type="number"
        min={100}
        max={2800}
        value={elo}
        onChange={(e) => setElo(clamp(parseInt(e.target.value || '0', 10)))}
      />
      <input
        className="elo-slider"
        type="range"
        min={100}
        max={2800}
        step={25}
        value={elo}
        onChange={(e) => setElo(parseInt(e.target.value, 10))}
      />

      <div>
        <div className="tier-badge">{tier.name}</div>
        <p className="muted">{tier.blurb}</p>
      </div>

      <div className="col" style={{ marginTop: 18 }}>
        <button className="btn primary" onClick={() => startRun(elo)}>
          ⚔️ Begin Run
        </button>
        {hasSave && (
          <button className="btn" onClick={() => loadSaved()}>
            ↩ Resume Saved Run
          </button>
        )}
      </div>
    </div>
  );
}

function clamp(n: number): number {
  if (Number.isNaN(n)) return 100;
  return Math.max(100, Math.min(2800, n));
}

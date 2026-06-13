import { useGameStore } from '../../state/useGameStore';

export function EndScreen({ kind }: { kind: 'victory' | 'defeat' }) {
  const run = useGameStore((s) => s.run);
  const abandonRun = useGameStore((s) => s.abandonRun);

  return (
    <div className={`end-screen ${kind}`}>
      <h2>{kind === 'victory' ? '👑 VICTORY' : '💀 DEFEAT'}</h2>
      <p className="muted">
        {kind === 'victory'
          ? 'You toppled the Necromancer and conquered the act. The board is yours.'
          : 'Your last heart shattered. The run ends here.'}
      </p>
      {run && (
        <p className="muted">
          Elo {run.baseElo} · {run.relics.length} relics gathered · 🪙 {run.gold}
        </p>
      )}
      <button className="btn primary" style={{ marginTop: 16 }} onClick={abandonRun}>
        New Run
      </button>
    </div>
  );
}

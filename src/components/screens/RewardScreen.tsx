import { useGameStore } from '../../state/useGameStore';
import { RelicCard } from '../hud/RelicCard';

export function RewardScreen() {
  const options = useGameStore((s) => s.rewardOptions);
  const claimReward = useGameStore((s) => s.claimReward);
  const actCleared = useGameStore((s) => s.actCleared);

  return (
    <div className="panel center">
      {actCleared !== null ? (
        <>
          <h2 style={{ color: 'var(--good)' }}>⚔️ Act {actCleared} Cleared!</h2>
          <p className="muted">The boss falls. Claim a spoil before you descend deeper.</p>
        </>
      ) : (
        <>
          <h2>Victory! Choose your spoils</h2>
          <p className="muted">Pick one reward to carry forward — or skip for nothing.</p>
        </>
      )}
      <div className="card-grid">
        {options.map((opt) => (
          <RelicCard key={opt.def.id} option={opt} onClick={() => claimReward(opt)} />
        ))}
      </div>
      <button className="btn" style={{ marginTop: 20 }} onClick={() => claimReward(null)}>
        {actCleared !== null ? 'Onward →' : 'Skip'}
      </button>
    </div>
  );
}

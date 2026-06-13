import { useGameStore } from '../../state/useGameStore';
import { RelicCard } from '../hud/RelicCard';

export function RewardScreen() {
  const options = useGameStore((s) => s.rewardOptions);
  const claimReward = useGameStore((s) => s.claimReward);

  return (
    <div className="panel center">
      <h2>Victory! Choose your spoils</h2>
      <p className="muted">Pick one relic to carry forward — or skip for nothing.</p>
      <div className="card-grid">
        {options.map((def) => (
          <RelicCard key={def.id} def={def} onClick={() => claimReward(def)} />
        ))}
      </div>
      <button className="btn" style={{ marginTop: 20 }} onClick={() => claimReward(null)}>
        Skip
      </button>
    </div>
  );
}

import { useGameStore } from '../../state/useGameStore';
import { RelicCard } from '../hud/RelicCard';

export function BoonScreen() {
  const options = useGameStore((s) => s.boonOptions);
  const chooseBoon = useGameStore((s) => s.chooseBoon);

  return (
    <div className="panel center">
      <h2>Choose your Boon</h2>
      <p className="muted">
        Begin your run with one gift — a permanent <strong>relic</strong>, or a{' '}
        <strong>spell</strong> you can cast once every battle (it never runs out).
      </p>
      <div className="card-grid">
        {options.map((opt) => (
          <RelicCard key={opt.def.id} option={opt} boon onClick={() => chooseBoon(opt)} />
        ))}
      </div>
    </div>
  );
}

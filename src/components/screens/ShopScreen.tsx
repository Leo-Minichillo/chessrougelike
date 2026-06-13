import { useGameStore } from '../../state/useGameStore';
import { RelicCard } from '../hud/RelicCard';
import { HEAL_COST } from '../../run/rewards';

export function ShopScreen() {
  const run = useGameStore((s) => s.run);
  const shop = useGameStore((s) => s.shop);
  const buyRelic = useGameStore((s) => s.buyRelic);
  const buyHeal = useGameStore((s) => s.buyHeal);
  const leaveShop = useGameStore((s) => s.leaveShop);
  if (!run || !shop) return null;

  return (
    <div className="panel center">
      <h2>🛒 The Wandering Bazaar</h2>
      <p className="muted">
        Gold: <strong style={{ color: 'var(--accent)' }}>🪙 {run.gold}</strong>
      </p>
      <div className="card-grid">
        {shop.stock.map((s) => (
          <RelicCard
            key={s.def.id}
            def={s.def}
            cost={s.cost}
            disabled={run.gold < s.cost}
            onClick={() => buyRelic(s.def)}
          />
        ))}
        {shop.stock.length === 0 && <p className="muted">Sold out!</p>}
      </div>

      <div className="row" style={{ justifyContent: 'center', marginTop: 20 }}>
        <button
          className="btn"
          disabled={run.gold < HEAL_COST || run.lives >= run.maxLives}
          onClick={buyHeal}
        >
          ❤️ Heal 1 heart (🪙 {HEAL_COST})
        </button>
        <button className="btn primary" onClick={leaveShop}>
          Leave Shop
        </button>
      </div>
    </div>
  );
}

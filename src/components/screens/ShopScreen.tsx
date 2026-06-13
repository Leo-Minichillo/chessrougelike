import { useGameStore } from '../../state/useGameStore';
import { RelicCard } from '../hud/RelicCard';
import { HEAL_COST, RECHARGE_COST } from '../../run/rewards';

export function ShopScreen() {
  const run = useGameStore((s) => s.run);
  const shop = useGameStore((s) => s.shop);
  const buyItem = useGameStore((s) => s.buyItem);
  const buyHeal = useGameStore((s) => s.buyHeal);
  const buyRecharge = useGameStore((s) => s.buyRecharge);
  const leaveShop = useGameStore((s) => s.leaveShop);
  if (!run || !shop) return null;

  const spellsFull = run.spells.length === 0;

  return (
    <div className="panel center">
      <h2>🛒 The Wandering Bazaar</h2>
      <p className="muted">
        Gold: <strong style={{ color: 'var(--accent)' }}>🪙 {run.gold}</strong>
      </p>
      <div className="card-grid">
        {shop.stock.map((item) => (
          <RelicCard
            key={item.def.id}
            option={item}
            cost={item.cost}
            disabled={run.gold < item.cost}
            onClick={() => buyItem(item)}
          />
        ))}
        {shop.stock.length === 0 && <p className="muted">Sold out!</p>}
      </div>

      <div className="row wrap" style={{ justifyContent: 'center', marginTop: 20 }}>
        <button
          className="btn"
          disabled={run.gold < HEAL_COST || run.lives >= run.maxLives}
          onClick={buyHeal}
        >
          ❤️ Heal 1 heart (🪙 {HEAL_COST})
        </button>
        <button
          className="btn"
          disabled={run.gold < RECHARGE_COST || spellsFull}
          onClick={buyRecharge}
          title="Restore 1 charge to each spell"
        >
          🔋 Recharge spells (🪙 {RECHARGE_COST})
        </button>
        <button className="btn primary" onClick={leaveShop}>
          Leave Shop
        </button>
      </div>
    </div>
  );
}

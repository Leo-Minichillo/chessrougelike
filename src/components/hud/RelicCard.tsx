import type { RewardOption } from '../../run/rewards';

export function RelicCard({
  option,
  cost,
  disabled,
  boon,
  onClick,
}: {
  option: RewardOption;
  cost?: number;
  disabled?: boolean;
  boon?: boolean; // starting boon: spells are "once per battle, permanent"
  onClick: () => void;
}) {
  const { def, kind } = option;
  const isSpell = kind === 'spell';
  const kindLabel = isSpell
    ? boon
      ? 'Spell · TWICE per battle (permanent)'
      : `Spell · +${def.charges ?? 1} charges`
    : boon
      ? 'Relic · passive (legendary)'
      : 'Relic · passive';
  return (
    <div
      className={`relic-card rarity-${def.rarity}`}
      style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
      onClick={() => !disabled && onClick()}
    >
      <div className="rc-ico">{def.icon}</div>
      <div className="rc-name">{def.name}</div>
      <div className={`rc-kind ${isSpell ? 'active' : 'passive'}`}>{kindLabel}</div>
      <div className="rc-desc">{def.description}</div>
      {cost !== undefined && <div className="rc-cost">🪙 {cost}</div>}
    </div>
  );
}

import type { RewardOption } from '../../run/rewards';

export function RelicCard({
  option,
  cost,
  disabled,
  onClick,
}: {
  option: RewardOption;
  cost?: number;
  disabled?: boolean;
  onClick: () => void;
}) {
  const { def, kind } = option;
  const isSpell = kind === 'spell';
  return (
    <div
      className={`relic-card rarity-${def.rarity}`}
      style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
      onClick={() => !disabled && onClick()}
    >
      <div className="rc-ico">{def.icon}</div>
      <div className="rc-name">{def.name}</div>
      <div className={`rc-kind ${isSpell ? 'active' : 'passive'}`}>
        {isSpell ? `Spell · +${def.charges ?? 1} charges` : 'Relic · passive'}
      </div>
      <div className="rc-desc">{def.description}</div>
      {cost !== undefined && <div className="rc-cost">🪙 {cost}</div>}
    </div>
  );
}

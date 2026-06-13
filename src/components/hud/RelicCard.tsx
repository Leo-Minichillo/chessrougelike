import type { RelicDef } from '../../relics/relicTypes';

export function RelicCard({
  def,
  cost,
  disabled,
  onClick,
}: {
  def: RelicDef;
  cost?: number;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={`relic-card rarity-${def.rarity}`}
      style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
      onClick={() => !disabled && onClick()}
    >
      <div className="rc-ico">{def.icon}</div>
      <div className="rc-name">{def.name}</div>
      <div className={`rc-kind ${def.kind}`}>
        {def.kind}
        {def.kind === 'active' && def.charges ? ` · ${def.charges} charge${def.charges > 1 ? 's' : ''}` : ''}
      </div>
      <div className="rc-desc">{def.description}</div>
      {cost !== undefined && <div className="rc-cost">🪙 {cost}</div>}
    </div>
  );
}

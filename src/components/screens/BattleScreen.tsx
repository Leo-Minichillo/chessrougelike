import { useGameStore } from '../../state/useGameStore';
import { Board } from '../board/Board';

export function BattleScreen() {
  const battle = useGameStore((s) => s.battle);
  const selected = useGameStore((s) => s.selected);
  const legalTargets = useGameStore((s) => s.legalTargets);
  const targeting = useGameStore((s) => s.targeting);
  const pendingPromotion = useGameStore((s) => s.pendingPromotion);
  const clickSquare = useGameStore((s) => s.clickSquare);
  const activateRelic = useGameStore((s) => s.activateRelic);
  const cancelTargeting = useGameStore((s) => s.cancelTargeting);
  const choosePromotion = useGameStore((s) => s.choosePromotion);

  if (!battle) return null;
  const interactive = battle.phase === 'playerInput';
  const mat = battle.materialBalance;

  return (
    <div className="battle-wrap">
      <div className="board-panel">
        <div className="objective-banner">
          <div>
            <strong>{battle.title}</strong>
          </div>
          <div className="muted" style={{ fontSize: 13 }}>{battle.flavor}</div>
          <div style={{ marginTop: 4 }}>
            🎯 <span className="obj">{battle.objectiveLabel}</span>
          </div>
        </div>

        <Board
          fen={battle.fen}
          selected={selected}
          legalTargets={legalTargets}
          frozen={battle.frozen}
          targetingTargets={targeting?.validTargets ?? []}
          lastMove={battle.lastMove}
          checkedKing={battle.checkedKing}
          interactive={interactive && !pendingPromotion}
          onSquareClick={clickSquare}
        />

        <div className="material">
          Material:{' '}
          {mat === 0 ? (
            <span className="muted">even</span>
          ) : mat > 0 ? (
            <span className="ahead">+{mat} you</span>
          ) : (
            <span className="behind">{mat} you</span>
          )}
        </div>

        {battle.phase === 'aiThinking' && <div className="thinking">The enemy is thinking…</div>}
        {targeting && (
          <div className="targeting-hint">
            Choose a target square — or{' '}
            <button className="btn" style={{ padding: '2px 8px' }} onClick={cancelTargeting}>
              cancel
            </button>
          </div>
        )}
      </div>

      <div className="sidebar">
        <div className="panel" style={{ padding: 14 }}>
          <strong>Spells</strong>
          <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>
            Charges don't refresh between battles — spend wisely.
          </div>
          <div className="relic-bar">
            {battle.spells.map((s) => (
              <button
                key={s.def.id}
                className={`spell-btn ${!s.usable ? 'disabled' : ''} ${
                  targeting?.relicId === s.def.id ? 'armed' : ''
                }`}
                disabled={!s.usable}
                title={s.def.description}
                onClick={() => activateRelic(s.def.id)}
              >
                <span className="ico">{s.def.icon}</span>
                <span className="nm">{s.def.name}</span>
                <span className="ch">×{s.charges}</span>
              </button>
            ))}
            {battle.spells.length === 0 && <span className="muted">No spells.</span>}
          </div>

          <div style={{ marginTop: 12 }}>
            <strong>Relics</strong>
            <div style={{ marginTop: 6 }}>
              {battle.relics.map((def) => (
                <span key={def.id} className="relic-chip" title={def.description}>
                  <span className="ico">{def.icon}</span>
                  {def.name}
                </span>
              ))}
              {battle.relics.length === 0 && <span className="muted">None</span>}
            </div>
          </div>
        </div>

        <div className="battle-log">
          {battle.logs.length === 0 && <div className="muted">The battle begins…</div>}
          {[...battle.logs].reverse().map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>

        <div className="panel debug">
          effElo {battle.config.effectiveElo} · depth {battle.config.depth} · rand{' '}
          {battle.config.randomness.toFixed(2)} · blunder {battle.config.blunderChance.toFixed(2)}
        </div>
      </div>

      {pendingPromotion && (
        <div className="modal-backdrop">
          <div className="panel center">
            <h3>Promote to…</h3>
            <div className="promo-pick">
              {(['q', 'r', 'b', 'n'] as const).map((p) => (
                <div key={p} className="promo" onClick={() => choosePromotion(p)}>
                  <img
                    src={`${import.meta.env.BASE_URL}pieces/cburnett/w${p.toUpperCase()}.svg`}
                    alt={p}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

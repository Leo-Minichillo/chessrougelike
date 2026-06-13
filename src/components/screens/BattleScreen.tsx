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
          <div className="relic-bar" style={{ marginTop: 8 }}>
            {battle.relics.filter((r) => r.def.kind === 'active').map((r) => (
              <button
                key={r.def.id}
                className={`spell-btn ${!r.usable ? 'disabled' : ''} ${
                  targeting?.relicId === r.def.id ? 'armed' : ''
                }`}
                disabled={!r.usable}
                title={r.def.description}
                onClick={() => activateRelic(r.def.id)}
              >
                <span className="ico">{r.def.icon}</span>
                <span className="nm">{r.def.name}</span>
                <span className="ch">×{r.charges}</span>
              </button>
            ))}
            {battle.relics.filter((r) => r.def.kind === 'active').length === 0 && (
              <span className="muted">No spells yet.</span>
            )}
          </div>

          <div style={{ marginTop: 12 }}>
            <strong>Passives</strong>
            <div style={{ marginTop: 6 }}>
              {battle.relics.filter((r) => r.def.kind !== 'active').map((r) => (
                <span key={r.def.id} className="relic-chip" title={r.def.description}>
                  <span className="ico">{r.def.icon}</span>
                  {r.def.name}
                </span>
              ))}
              {battle.relics.filter((r) => r.def.kind !== 'active').length === 0 && (
                <span className="muted">None</span>
              )}
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
                  {{ q: '♛', r: '♜', b: '♝', n: '♞' }[p]}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

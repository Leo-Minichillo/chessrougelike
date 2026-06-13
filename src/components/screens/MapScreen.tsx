import { useGameStore } from '../../state/useGameStore';
import { availableNodes } from '../../map/mapGen';
import { NODE_ICON, NODE_LABEL, type MapNode } from '../../map/mapTypes';
import { getRelic } from '../../relics/relicDefs';

export function MapScreen() {
  const run = useGameStore((s) => s.run);
  const chooseNode = useGameStore((s) => s.chooseNode);
  const abandonRun = useGameStore((s) => s.abandonRun);
  const toast = useGameStore((s) => s.toast);
  if (!run) return null;

  const reachable = new Set(availableNodes(run.map, run.currentNodeId).map((n) => n.id));

  return (
    <div className="map-wrap">
      <div className="panel map-board">
        {toast && <div className="toast">{toast}</div>}
        <h3 className="center" style={{ marginTop: 0 }}>
          Act {run.act} — choose your path
        </h3>
        {[...run.map.rows].reverse().map((row, ri) => (
          <div className="map-row" key={ri}>
            {row.map((node) => (
              <NodeButton
                key={node.id}
                node={node}
                reachable={reachable.has(node.id)}
                onClick={() => reachable.has(node.id) && chooseNode(node.id)}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="sidebar">
        <div className="panel" style={{ padding: 16 }}>
          <div className="stat-line">
            <span>Elo</span>
            <strong>{run.baseElo}</strong>
          </div>
          <div className="stat-line">
            <span>Hearts</span>
            <span className="hearts">
              {'❤️'.repeat(run.lives)}
              {'🖤'.repeat(Math.max(0, run.maxLives - run.lives))}
            </span>
          </div>
          <div className="stat-line">
            <span>Gold</span>
            <strong style={{ color: 'var(--accent)' }}>🪙 {run.gold}</strong>
          </div>
        </div>

        <div className="panel" style={{ padding: 16 }}>
          <strong>Relics</strong>
          <div style={{ marginTop: 8 }}>
            {run.relics.map((r, i) => {
              const def = getRelic(r.defId);
              return (
                <span key={i} className="relic-chip" title={def.description}>
                  <span className="ico">{def.icon}</span>
                  {def.name}
                  {def.kind === 'active' && <span className="muted"> ×{r.maxCharges}</span>}
                </span>
              );
            })}
          </div>
        </div>

        <button className="btn danger" onClick={abandonRun}>
          Abandon Run
        </button>
      </div>
    </div>
  );
}

function NodeButton({
  node,
  reachable,
  onClick,
}: {
  node: MapNode;
  reachable: boolean;
  onClick: () => void;
}) {
  const cls = [
    'map-node',
    node.type === 'boss' ? 'boss' : '',
    reachable ? 'reachable' : '',
    node.visited ? 'visited' : '',
  ].join(' ');
  return (
    <div className={cls} onClick={onClick}>
      <span className="ico">{NODE_ICON[node.type]}</span>
      <span className="lbl">{NODE_LABEL[node.type]}</span>
    </div>
  );
}

import { useLayoutEffect, useRef, useState } from 'react';
import { useGameStore } from '../../state/useGameStore';
import { availableNodes } from '../../map/mapGen';
import { NODE_ICON, NODE_LABEL, type MapNode } from '../../map/mapTypes';
import { getRelic } from '../../relics/relicDefs';
import { MAX_ACTS } from '../../run/runState';

interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  active: boolean;
}

export function MapScreen() {
  const run = useGameStore((s) => s.run);
  const chooseNode = useGameStore((s) => s.chooseNode);
  const abandonRun = useGameStore((s) => s.abandonRun);
  const toast = useGameStore((s) => s.toast);

  const wrapRef = useRef<HTMLDivElement>(null);
  const nodeEls = useRef<Map<string, HTMLDivElement>>(new Map());
  const [lines, setLines] = useState<Line[]>([]);

  const reachable = run
    ? new Set(availableNodes(run.map, run.currentNodeId).map((n) => n.id))
    : new Set<string>();

  // Measure node centers and build connector lines between each node and its
  // edge targets. Recomputed on layout changes and window resize.
  useLayoutEffect(() => {
    if (!run) return;
    const compute = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const w = wrap.getBoundingClientRect();
      const out: Line[] = [];
      for (const row of run.map.rows) {
        for (const node of row) {
          const fromEl = nodeEls.current.get(node.id);
          if (!fromEl) continue;
          const fr = fromEl.getBoundingClientRect();
          const fx = fr.left + fr.width / 2 - w.left;
          const fy = fr.top + fr.height / 2 - w.top;
          for (const eId of node.edges) {
            const toEl = nodeEls.current.get(eId);
            if (!toEl) continue;
            const tr = toEl.getBoundingClientRect();
            out.push({
              x1: fx,
              y1: fy,
              x2: tr.left + tr.width / 2 - w.left,
              y2: tr.top + tr.height / 2 - w.top,
              // glow the edges that lead to a currently-reachable node
              active: reachable.has(eId),
            });
          }
        }
      }
      setLines(out);
    };
    compute();
    const t = setTimeout(compute, 120); // re-measure after fonts/layout settle
    window.addEventListener('resize', compute);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', compute);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.map, run?.currentNodeId]);

  if (!run) return null;

  return (
    <div className="map-wrap">
      <div className="panel map-board">
        {toast && <div className="toast">{toast}</div>}
        <h3 className="center" style={{ marginTop: 0 }}>
          Act {run.act} of {MAX_ACTS} — choose your path
        </h3>
        <div className="map-graph" ref={wrapRef}>
          <svg className="map-edges">
            {lines.map((l, i) => (
              <line
                key={i}
                x1={l.x1}
                y1={l.y1}
                x2={l.x2}
                y2={l.y2}
                className={l.active ? 'edge active' : 'edge'}
              />
            ))}
          </svg>
          <div className="map-rows">
            {[...run.map.rows].reverse().map((row, ri) => (
              <div className="map-row" key={ri}>
                {row.map((node) => (
                  <NodeButton
                    key={node.id}
                    node={node}
                    reachable={reachable.has(node.id)}
                    refCb={(el) => {
                      if (el) nodeEls.current.set(node.id, el);
                      else nodeEls.current.delete(node.id);
                    }}
                    onClick={() => reachable.has(node.id) && chooseNode(node.id)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
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
          <strong>Spells</strong>
          <div style={{ marginTop: 8 }}>
            {run.spells.map((s, i) => {
              const def = getRelic(s.defId);
              return (
                <span key={i} className="relic-chip" title={def.description}>
                  <span className="ico">{def.icon}</span>
                  {def.name}
                  <span className="muted"> ×{s.charges}</span>
                </span>
              );
            })}
            {run.spells.length === 0 && <span className="muted">None</span>}
          </div>
          <strong style={{ display: 'block', marginTop: 12 }}>Relics</strong>
          <div style={{ marginTop: 8 }}>
            {run.relics.map((r, i) => {
              const def = getRelic(r.defId);
              return (
                <span key={i} className="relic-chip" title={def.description}>
                  <span className="ico">{def.icon}</span>
                  {def.name}
                </span>
              );
            })}
            {run.relics.length === 0 && <span className="muted">None</span>}
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
  refCb,
  onClick,
}: {
  node: MapNode;
  reachable: boolean;
  refCb: (el: HTMLDivElement | null) => void;
  onClick: () => void;
}) {
  const cls = [
    'map-node',
    node.type === 'boss' ? 'boss' : '',
    reachable ? 'reachable' : '',
    node.visited ? 'visited' : '',
  ].join(' ');
  return (
    <div className={cls} ref={refCb} onClick={onClick}>
      <span className="ico">{NODE_ICON[node.type]}</span>
      <span className="lbl">{NODE_LABEL[node.type]}</span>
    </div>
  );
}

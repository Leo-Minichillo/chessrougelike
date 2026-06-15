import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { Square } from '../../engine/types';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const CELL = 100;
const BASE = import.meta.env.BASE_URL; // '/' in dev, '/chessrougelike/' on Pages

function pieceHref(color: 'w' | 'b', type: string): string {
  return `${BASE}pieces/cburnett/${color}${type.toUpperCase()}.svg`;
}

interface BoardProps {
  fen: string;
  selected: Square | null;
  legalTargets: Square[];
  frozen: Square[];
  targetingTargets: Square[];
  lastMove: { from: Square; to: Square } | null;
  checkedKing: Square | null;
  interactive: boolean;
  onSquareClick: (sq: Square) => void;
  onCancel: () => void;
}

interface DragState {
  from: Square;
  color: 'w' | 'b';
  type: string;
  vx: number; // viewBox coords of the cursor
  vy: number;
}

interface Arrow {
  from: Square;
  to: Square;
}

const CENTER = (sq: Square) => ({
  x: FILES.indexOf(sq[0]) * CELL + CELL / 2,
  y: (8 - parseInt(sq[1], 10)) * CELL + CELL / 2,
});

export function Board(props: BoardProps) {
  const {
    fen,
    selected,
    legalTargets,
    frozen,
    targetingTargets,
    lastMove,
    checkedKing,
    interactive,
    onSquareClick,
    onCancel,
  } = props;

  const board = useMemo(() => new Chess(fen).board(), [fen]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  // chess.com-style annotations (right-click): arrows + square highlights.
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [highlights, setHighlights] = useState<Square[]>([]);
  const [rightDrag, setRightDrag] = useState<{ from: Square; vx: number; vy: number } | null>(null);

  // Annotations are per-position: clear them whenever the board changes.
  useEffect(() => {
    setArrows([]);
    setHighlights([]);
    setRightDrag(null);
  }, [fen]);

  const highlightSet = new Set(highlights);

  const legal = new Set(legalTargets);
  const targets = new Set(targetingTargets);
  const frozenSet = new Set(frozen);
  const lastSet = new Set(lastMove ? [lastMove.from, lastMove.to] : []);
  const targeting = targetingTargets.length > 0;

  // Map a client point to a board square (and to viewBox coords).
  function locate(clientX: number, clientY: number) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { sq: null as Square | null, vx: 0, vy: 0 };
    const fx = Math.floor(((clientX - rect.left) / rect.width) * 8);
    const fy = Math.floor(((clientY - rect.top) / rect.height) * 8);
    const vx = ((clientX - rect.left) / rect.width) * 800;
    const vy = ((clientY - rect.top) / rect.height) * 800;
    const sq =
      fx >= 0 && fx < 8 && fy >= 0 && fy < 8 ? (`${FILES[fx]}${8 - fy}` as Square) : null;
    return { sq, vx, vy };
  }

  function pieceAt(sq: Square) {
    const f = FILES.indexOf(sq[0]);
    const r = 8 - parseInt(sq[1], 10);
    return board[r][f];
  }

  function toggleArrow(from: Square, to: Square) {
    setArrows((prev) => {
      const i = prev.findIndex((a) => a.from === from && a.to === to);
      if (i >= 0) return prev.filter((_, j) => j !== i);
      return [...prev, { from, to }];
    });
  }
  function toggleHighlight(sq: Square) {
    setHighlights((prev) => (prev.includes(sq) ? prev.filter((s) => s !== sq) : [...prev, sq]));
  }

  function onPointerDown(e: React.PointerEvent, sq: Square) {
    // Right button → chess.com-style annotation (or cancel an armed spell).
    if (e.button === 2) {
      e.preventDefault();
      if (targeting) {
        onCancel();
        return;
      }
      const { vx, vy } = locate(e.clientX, e.clientY);
      svgRef.current?.setPointerCapture(e.pointerId);
      setRightDrag({ from: sq, vx, vy });
      return;
    }
    if (e.button !== 0) return;
    // Left interaction clears annotations, like chess.com.
    setArrows([]);
    setHighlights([]);
    if (!interactive) return;
    const p = pieceAt(sq);
    // Start a drag only when grabbing your own piece outside targeting mode.
    if (!targeting && p && p.color === 'w') {
      onSquareClick(sq); // select it (shows legal targets)
      const { vx, vy } = locate(e.clientX, e.clientY);
      svgRef.current?.setPointerCapture(e.pointerId);
      setDrag({ from: sq, color: p.color, type: p.type, vx, vy });
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (rightDrag) {
      const { vx, vy } = locate(e.clientX, e.clientY);
      setRightDrag({ ...rightDrag, vx, vy });
      return;
    }
    if (!drag) return;
    const { vx, vy } = locate(e.clientX, e.clientY);
    setDrag({ ...drag, vx, vy });
  }

  function onPointerUp(e: React.PointerEvent) {
    const { sq } = locate(e.clientX, e.clientY);
    if (rightDrag) {
      // Drop on the same square = highlight; on a different square = arrow.
      if (sq && sq === rightDrag.from) toggleHighlight(sq);
      else if (sq) toggleArrow(rightDrag.from, sq);
      setRightDrag(null);
      return;
    }
    if (drag) {
      // Dropping on a different square attempts the move; same square = a click.
      if (sq && sq !== drag.from) onSquareClick(sq);
      setDrag(null);
    } else if (sq && interactive) {
      // Plain click (target square, capture, or spell target).
      onSquareClick(sq);
    }
  }

  return (
    <div className="board-frame">
      <svg
        ref={svgRef}
        className="board-svg"
        viewBox="0 0 800 800"
        role="grid"
        aria-label="chess board"
        style={{ touchAction: 'none' }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <defs>
          <linearGradient id="lightSq" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f3e2c0" />
            <stop offset="100%" stopColor="#e6d2a8" />
          </linearGradient>
          <linearGradient id="darkSq" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#9c7a4f" />
            <stop offset="100%" stopColor="#84653d" />
          </linearGradient>
          <radialGradient id="checkGlow" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="#ff5a5a" stopOpacity="0.95" />
            <stop offset="60%" stopColor="#e23b3b" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#e23b3b" stopOpacity="0" />
          </radialGradient>
          <filter id="pieceShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.35" />
          </filter>
        </defs>

        {board.map((row, r) =>
          row.map((piece, f) => {
            const sq = `${FILES[f]}${8 - r}` as Square;
            const isLight = (r + f) % 2 === 0;
            const x = f * CELL;
            const y = r * CELL;
            const isLastMove = lastSet.has(sq);
            const beingDragged = drag?.from === sq;
            return (
              <g
                key={sq}
                onPointerDown={(e) => onPointerDown(e, sq)}
                style={{ cursor: interactive ? (drag ? 'grabbing' : 'pointer') : 'default' }}
              >
                <rect x={x} y={y} width={CELL} height={CELL} fill={isLight ? 'url(#lightSq)' : 'url(#darkSq)'} />

                {isLastMove && (
                  <rect x={x} y={y} width={CELL} height={CELL} fill="#f6d860" opacity={0.38} />
                )}
                {selected === sq && (
                  <rect x={x} y={y} width={CELL} height={CELL} fill="#f6d860" opacity={0.5} />
                )}
                {highlightSet.has(sq) && (
                  <rect x={x} y={y} width={CELL} height={CELL} fill="#e6852b" opacity={0.5} />
                )}
                {checkedKing === sq && (
                  <rect x={x} y={y} width={CELL} height={CELL} fill="url(#checkGlow)" />
                )}
                {frozenSet.has(sq) && (
                  <rect x={x} y={y} width={CELL} height={CELL} fill="var(--frozen)" opacity={0.45} />
                )}
                {targets.has(sq) && (
                  <rect
                    x={x + 4}
                    y={y + 4}
                    width={CELL - 8}
                    height={CELL - 8}
                    fill="none"
                    stroke="var(--accent-2)"
                    strokeWidth={5}
                    rx={10}
                    className="target-ring"
                  />
                )}
                {legal.has(sq) && !piece && (
                  <circle cx={x + CELL / 2} cy={y + CELL / 2} r={15} fill="rgba(30,30,30,0.42)" />
                )}
                {legal.has(sq) && piece && (
                  <circle
                    cx={x + CELL / 2}
                    cy={y + CELL / 2}
                    r={46}
                    fill="none"
                    stroke="rgba(30,30,30,0.5)"
                    strokeWidth={6}
                  />
                )}

                {f === 0 && (
                  <text
                    x={x + 5}
                    y={y + 20}
                    fontSize={15}
                    fontWeight={700}
                    fill={isLight ? '#84653d' : '#f3e2c0'}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {8 - r}
                  </text>
                )}
                {r === 7 && (
                  <text
                    x={x + CELL - 14}
                    y={y + CELL - 6}
                    fontSize={15}
                    fontWeight={700}
                    fill={isLight ? '#84653d' : '#f3e2c0'}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {FILES[f]}
                  </text>
                )}

                {piece && !beingDragged && (
                  <image
                    href={pieceHref(piece.color, piece.type)}
                    x={x + 7}
                    y={y + 7}
                    width={CELL - 14}
                    height={CELL - 14}
                    filter="url(#pieceShadow)"
                    className={isLastMove && lastMove?.to === sq ? 'piece piece-moved' : 'piece'}
                    style={{ pointerEvents: 'none' }}
                  />
                )}
                {frozenSet.has(sq) && (
                  <text x={x + CELL - 22} y={y + 26} fontSize={24} style={{ pointerEvents: 'none' }}>
                    ❄
                  </text>
                )}
              </g>
            );
          })
        )}

        {/* annotation arrows (right-click drag), drawn on top of the pieces */}
        <g style={{ pointerEvents: 'none' }}>
          {arrows.map((a, i) => (
            <ArrowShape key={i} from={CENTER(a.from)} to={CENTER(a.to)} />
          ))}
          {rightDrag && (
            <ArrowShape
              from={CENTER(rightDrag.from)}
              to={{ x: rightDrag.vx, y: rightDrag.vy }}
              preview
            />
          )}
        </g>

        {/* the piece currently being dragged, following the cursor */}
        {drag && (
          <image
            href={pieceHref(drag.color, drag.type)}
            x={drag.vx - 46}
            y={drag.vy - 46}
            width={92}
            height={92}
            filter="url(#pieceShadow)"
            style={{ pointerEvents: 'none' }}
          />
        )}
      </svg>
    </div>
  );
}

// A chess.com-style annotation arrow from one square centre to another, with a
// triangular head. `preview` renders the in-progress (right-drag) arrow.
function ArrowShape({
  from,
  to,
  preview,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  preview?: boolean;
}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 8) return null;
  const ux = dx / len;
  const uy = dy / len;
  const head = 34;
  const halfW = 22;
  // start a little out of the from-centre; line stops where the head begins
  const sx = from.x + ux * 24;
  const sy = from.y + uy * 24;
  const bx = to.x - ux * head;
  const by = to.y - uy * head;
  const px = -uy;
  const py = ux;
  const color = '#e6852b';
  return (
    <g opacity={preview ? 0.55 : 0.78}>
      <line x1={sx} y1={sy} x2={bx} y2={by} stroke={color} strokeWidth={15} strokeLinecap="round" />
      <polygon
        points={`${to.x},${to.y} ${bx + px * halfW},${by + py * halfW} ${bx - px * halfW},${by - py * halfW}`}
        fill={color}
      />
    </g>
  );
}

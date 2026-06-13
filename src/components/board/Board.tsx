import { useMemo } from 'react';
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
}

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
  } = props;

  const board = useMemo(() => new Chess(fen).board(), [fen]);
  const legal = new Set(legalTargets);
  const targets = new Set(targetingTargets);
  const frozenSet = new Set(frozen);
  const lastSet = new Set(lastMove ? [lastMove.from, lastMove.to] : []);

  return (
    <div className="board-frame">
      <svg className="board-svg" viewBox="0 0 800 800" role="grid" aria-label="chess board">
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
            return (
              <g
                key={sq}
                onClick={() => interactive && onSquareClick(sq)}
                style={{ cursor: interactive ? 'pointer' : 'default' }}
              >
                <rect x={x} y={y} width={CELL} height={CELL} fill={isLight ? 'url(#lightSq)' : 'url(#darkSq)'} />

                {isLastMove && (
                  <rect x={x} y={y} width={CELL} height={CELL} fill="#f6d860" opacity={0.38} />
                )}
                {selected === sq && (
                  <rect x={x} y={y} width={CELL} height={CELL} fill="#f6d860" opacity={0.5} />
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

                {/* coordinate labels along the board edge (lichess style) */}
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

                {piece && (
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
      </svg>
    </div>
  );
}

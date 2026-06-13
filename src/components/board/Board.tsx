import { useMemo } from 'react';
import { Chess } from 'chess.js';
import type { Square } from '../../engine/types';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const CELL = 100;

// Unicode glyphs; we color white vs black via fill + stroke for contrast.
const GLYPH: Record<string, string> = {
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚',
};

interface BoardProps {
  fen: string;
  selected: Square | null;
  legalTargets: Square[];
  frozen: Square[];
  targetingTargets: Square[];
  interactive: boolean;
  onSquareClick: (sq: Square) => void;
}

export function Board(props: BoardProps) {
  const { fen, selected, legalTargets, frozen, targetingTargets, interactive, onSquareClick } = props;

  const board = useMemo(() => new Chess(fen).board(), [fen]);
  const legal = new Set(legalTargets);
  const targets = new Set(targetingTargets);
  const frozenSet = new Set(frozen);

  return (
    <svg className="board-svg" viewBox="0 0 800 800" role="grid" aria-label="chess board">
      {board.map((row, r) =>
        row.map((piece, f) => {
          const sq = `${FILES[f]}${8 - r}` as Square;
          const isLight = (r + f) % 2 === 0;
          const x = f * CELL;
          const y = r * CELL;
          return (
            <g
              key={sq}
              onClick={() => interactive && onSquareClick(sq)}
              style={{ cursor: interactive ? 'pointer' : 'default' }}
            >
              <rect
                x={x}
                y={y}
                width={CELL}
                height={CELL}
                fill={isLight ? 'var(--light-sq)' : 'var(--dark-sq)'}
              />
              {selected === sq && (
                <rect x={x} y={y} width={CELL} height={CELL} fill="var(--sel)" opacity={0.55} />
              )}
              {frozenSet.has(sq) && (
                <rect x={x} y={y} width={CELL} height={CELL} fill="var(--frozen)" opacity={0.4} />
              )}
              {targets.has(sq) && (
                <rect
                  x={x + 3}
                  y={y + 3}
                  width={CELL - 6}
                  height={CELL - 6}
                  fill="none"
                  stroke="var(--accent-2)"
                  strokeWidth={5}
                  rx={8}
                />
              )}
              {legal.has(sq) && (
                <circle
                  cx={x + CELL / 2}
                  cy={y + CELL / 2}
                  r={piece ? 44 : 16}
                  fill={piece ? 'none' : 'rgba(40,40,40,0.45)'}
                  stroke={piece ? 'rgba(40,40,40,0.55)' : 'none'}
                  strokeWidth={6}
                />
              )}
              {piece && (
                <text
                  x={x + CELL / 2}
                  y={y + CELL / 2 + 4}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={70}
                  fill={piece.color === 'w' ? '#f7f4ee' : '#15110b'}
                  stroke={piece.color === 'w' ? '#3a2f1d' : '#000'}
                  strokeWidth={1.5}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {GLYPH[piece.type]}
                </text>
              )}
              {frozenSet.has(sq) && (
                <text x={x + CELL - 16} y={y + 20} fontSize={22} style={{ pointerEvents: 'none' }}>
                  ❄
                </text>
              )}
            </g>
          );
        })
      )}
    </svg>
  );
}

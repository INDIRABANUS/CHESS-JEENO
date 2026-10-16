import React from 'react';
import { Trophy, Clock, CheckCircle2, Swords, Sparkles } from 'lucide-react';

/**
 * Clean Staunton chess piece vector components.
 * ViewBox 0 0 45 45 ensures crisp scaling at any resolution.
 */
export const PawnPiece = ({ isWhite = true, className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 45 45" className={className} aria-hidden="true">
    <g
      fill={isWhite ? '#F8FAFC' : '#1E293B'}
      stroke={isWhite ? '#475569' : '#0F172A'}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="22.5" cy="12" r="6" fill={isWhite ? '#FFFBEB' : '#0F172A'} />
      <path d="M19 18h7v2h-7z" fill={isWhite ? '#FEF3C7' : '#1E293B'} />
      <path d="M18 20c0 4-2 7-4 15h17c-2-8-4-11-4-15z" />
      <path d="M12 35h21v4H12z" rx="1" fill={isWhite ? '#F1F5F9' : '#0B1120'} />
      <path d="M10 39h25v2H10z" />
    </g>
  </svg>
);

export const KnightPiece = ({ isWhite = true, className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 45 45" className={className} aria-hidden="true">
    <g
      fill={isWhite ? '#FFFBEB' : '#0F172A'}
      stroke={isWhite ? '#D97706' : '#334155'}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 8c-3 0-6 2-7 5-1 3-3 5-5 6-1 1-1 3 0 4 2 1 4 0 5-1-1 3 0 6 2 8 3 3 7 4 10 3 4-1 6-4 7-8 1-5 1-10-3-14-3-2-6-3-9-3z" />
      <circle cx="16" cy="15" r="1.5" fill={isWhite ? '#D97706' : '#F8FAFC'} />
      <path d="M12 21c2 0 3-1 4-2" />
      <path d="M15 32c2 1 5 1 8 0" />
      <path d="M11 36h23v4H11z" fill={isWhite ? '#FEF3C7' : '#0B1120'} />
      <path d="M9 40h27v2H9z" />
    </g>
  </svg>
);

export const BishopPiece = ({ isWhite = true, className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 45 45" className={className} aria-hidden="true">
    <g
      fill={isWhite ? '#F8FAFC' : '#1E293B'}
      stroke={isWhite ? '#475569' : '#0F172A'}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="22.5" cy="8" r="2" fill={isWhite ? '#FDE68A' : '#475569'} />
      <path d="M17 14c0-3 2.5-5 5.5-5s5.5 2 5.5 5c0 4-2 7-3.5 11h-4C19 21 17 18 17 14z" />
      <path d="M20 13l5 5M25 13l-5 5" strokeWidth="1" />
      <path d="M18 25h9v3h-9z" fill={isWhite ? '#FEF3C7' : '#0B1120'} />
      <path d="M16 28c0 2 1 4 2 7h9c1-3 2-5 2-7z" />
      <path d="M12 35h21v4H12z" />
      <path d="M10 39h25v2H10z" />
    </g>
  </svg>
);

export const RookPiece = ({ isWhite = true, className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 45 45" className={className} aria-hidden="true">
    <g
      fill={isWhite ? '#F8FAFC' : '#1E293B'}
      stroke={isWhite ? '#475569' : '#0F172A'}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13 10h4v4h3v-4h5v4h3v-4h4v7H13z" />
      <path d="M15 17h15v3H15z" fill={isWhite ? '#FEF3C7' : '#0B1120'} />
      <path d="M16 20h13v12H16z" />
      <path d="M14 32h17v4H14z" />
      <path d="M11 36h23v4H11z" fill={isWhite ? '#FEF3C7' : '#0B1120'} />
      <path d="M9 40h27v2H9z" />
    </g>
  </svg>
);

export const QueenPiece = ({ isWhite = true, className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 45 45" className={className} aria-hidden="true">
    <g
      fill={isWhite ? '#F8FAFC' : '#1E293B'}
      stroke={isWhite ? '#475569' : '#0F172A'}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="10" cy="12" r="1.8" fill={isWhite ? '#FDE68A' : '#475569'} />
      <circle cx="16" cy="9" r="1.8" fill={isWhite ? '#FDE68A' : '#475569'} />
      <circle cx="22.5" cy="8" r="2" fill={isWhite ? '#F59E0B' : '#64748B'} />
      <circle cx="29" cy="9" r="1.8" fill={isWhite ? '#FDE68A' : '#475569'} />
      <circle cx="35" cy="12" r="1.8" fill={isWhite ? '#FDE68A' : '#475569'} />
      <path d="M11 14l3 10h17l3-10-5 5-6.5-9-6.5 9z" />
      <path d="M13 24h19v3H13z" fill={isWhite ? '#FEF3C7' : '#0B1120'} />
      <path d="M15 27c0 3 1 5 1.5 8h12c.5-3 1.5-5 1.5-8z" />
      <path d="M12 35h21v4H12z" />
      <path d="M10 39h25v2H10z" />
    </g>
  </svg>
);

export const KingPiece = ({ isWhite = true, className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 45 45" className={className} aria-hidden="true">
    <g
      fill={isWhite ? '#FFFBEB' : '#1E293B'}
      stroke={isWhite ? '#D97706' : '#0F172A'}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22.5 5v5M20 7.5h5" strokeWidth="2" stroke={isWhite ? '#D97706' : '#94A3B8'} />
      <path d="M15 13c3-2 12-2 15 0 2 3 0 7-1 9H16c-1-2-3-6-1-9z" />
      <path d="M15 22h15v3H15z" fill={isWhite ? '#FEF3C7' : '#0B1120'} />
      <path d="M16 25c0 3 1 6 1.5 10h10c.5-4 1.5-7 1.5-10z" />
      <path d="M12 35h21v4H12z" fill={isWhite ? '#FEF3C7' : '#0B1120'} />
      <path d="M10 39h25v2H10z" />
    </g>
  </svg>
);

// Italian Game setup representation
const BOARD_STATE = {
  // Rank 8
  a8: { type: 'r', isWhite: false },
  c8: { type: 'b', isWhite: false },
  d8: { type: 'q', isWhite: false },
  e8: { type: 'k', isWhite: false },
  h8: { type: 'r', isWhite: false },
  // Rank 7
  a7: { type: 'p', isWhite: false },
  b7: { type: 'p', isWhite: false },
  c7: { type: 'p', isWhite: false },
  d7: { type: 'p', isWhite: false },
  f7: { type: 'p', isWhite: false },
  g7: { type: 'p', isWhite: false },
  h7: { type: 'p', isWhite: false },
  // Rank 6
  c6: { type: 'n', isWhite: false },
  // Rank 5
  c5: { type: 'b', isWhite: false },
  e5: { type: 'p', isWhite: false },
  // Rank 4
  c4: { type: 'b', isWhite: true },
  e4: { type: 'p', isWhite: true },
  // Rank 3 (Nf3 active tactical highlight)
  f3: { type: 'n', isWhite: true, highlight: 'active' },
  // Rank 2
  a2: { type: 'p', isWhite: true },
  b2: { type: 'p', isWhite: true },
  c2: { type: 'p', isWhite: true },
  d2: { type: 'p', isWhite: true },
  f2: { type: 'p', isWhite: true },
  g2: { type: 'p', isWhite: true },
  h2: { type: 'p', isWhite: true },
  // Rank 1
  a1: { type: 'r', isWhite: true },
  b1: { type: 'n', isWhite: true },
  c1: { type: 'b', isWhite: true },
  d1: { type: 'q', isWhite: true },
  e1: { type: 'k', isWhite: true },
  h1: { type: 'r', isWhite: true },
  // Move source square highlight
  g1: { highlight: 'source' },
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1];

const renderPiece = (piece) => {
  if (!piece || !piece.type) return null;
  const props = { isWhite: piece.isWhite, className: 'w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:scale-110 drop-shadow-xs' };
  switch (piece.type) {
    case 'p': return <PawnPiece {...props} />;
    case 'n': return <KnightPiece {...props} />;
    case 'b': return <BishopPiece {...props} />;
    case 'r': return <RookPiece {...props} />;
    case 'q': return <QueenPiece {...props} />;
    case 'k': return <KingPiece {...props} />;
    default: return null;
  }
};

/**
 * Tasteful, responsive Chess Hero Visual.
 * Showcases an authentic 8x8 tactical board with Staunton pieces and match info card.
 */
const ChessHeroVisual = () => {
  return (
    <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
      {/* Refined ambient aura */}
      <div
        className="absolute -inset-2 bg-gradient-to-tr from-amber-500/10 via-indigo-600/10 to-emerald-500/10 rounded-3xl blur-xl opacity-70 pointer-events-none"
        aria-hidden="true"
      />

      {/* Main Container Card */}
      <div className="relative rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden transition-all duration-300">
        {/* Arena Header Bar */}
        <div className="px-4 py-3 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2 min-w-0">
            <span className="flex h-2 w-2 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs font-bold tracking-wider uppercase text-slate-200 truncate">
              Live Tournament Board
            </span>
          </div>

          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-slate-800/90 text-amber-300 text-[11px] font-semibold border border-amber-500/30">
            <Sparkles className="h-3 w-3 text-amber-400" />
            <span>Nf3 • Move 3</span>
          </div>
        </div>

        {/* Board & Layout */}
        <div className="p-4 sm:p-5 space-y-4 bg-gradient-to-b from-slate-50/50 to-white dark:from-slate-900 dark:to-slate-900/95">
          {/* Tactical 8x8 Chess Board */}
          <div className="relative mx-auto max-w-[340px] sm:max-w-[380px] rounded-xl overflow-hidden shadow-inner border border-slate-300 dark:border-slate-700 bg-slate-200 dark:bg-slate-800 p-2 sm:p-2.5">
            {/* Top file coordinates */}
            <div className="grid grid-cols-8 text-center text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400 pb-1 select-none">
              {FILES.map((f) => (
                <span key={`top-${f}`}>{f}</span>
              ))}
            </div>

            {/* 8x8 Grid */}
            <div className="grid grid-rows-8 gap-0 rounded-lg overflow-hidden border border-slate-400/30 dark:border-slate-700 select-none">
              {RANKS.map((rank, rIdx) => (
                <div key={`rank-${rank}`} className="grid grid-cols-8">
                  {FILES.map((file, fIdx) => {
                    const coord = `${file}${rank}`;
                    const isDarkSquare = (rIdx + fIdx) % 2 === 1;
                    const piece = BOARD_STATE[coord];
                    const isSourceHighlight = piece?.highlight === 'source';
                    const isActiveHighlight = piece?.highlight === 'active';

                    return (
                      <div
                        key={coord}
                        title={`Square ${coord}${piece?.type ? ` (${piece.isWhite ? 'White' : 'Black'} ${piece.type.toUpperCase()})` : ''}`}
                        className={`relative aspect-square flex items-center justify-center transition-colors group ${
                          isActiveHighlight
                            ? 'bg-amber-400/40 dark:bg-amber-500/30 ring-2 ring-inset ring-amber-500'
                            : isSourceHighlight
                            ? 'bg-amber-200/50 dark:bg-amber-900/30 ring-1 ring-inset ring-amber-400/50'
                            : isDarkSquare
                            ? 'bg-slate-700/80 dark:bg-slate-800 text-slate-200'
                            : 'bg-amber-50/90 dark:bg-slate-700/50 text-slate-800'
                        }`}
                      >
                        {/* Rank indicator on left edge (file a) */}
                        {fIdx === 0 && (
                          <span className="absolute top-0.5 left-0.5 text-[8px] font-mono font-bold opacity-60 pointer-events-none">
                            {rank}
                          </span>
                        )}

                        {/* File indicator on bottom edge (rank 1) */}
                        {rIdx === 7 && (
                          <span className="absolute bottom-0.5 right-0.5 text-[8px] font-mono font-bold opacity-60 pointer-events-none">
                            {file}
                          </span>
                        )}

                        {/* Chess Piece */}
                        {renderPiece(piece)}

                        {/* Tactical target dot for active square */}
                        {isActiveHighlight && (
                          <span className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500 shadow-xs" />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Bottom file coordinates */}
            <div className="grid grid-cols-8 text-center text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400 pt-1 select-none">
              {FILES.map((f) => (
                <span key={`bottom-${f}`}>{f}</span>
              ))}
            </div>
          </div>

          {/* Real-time Match Details Card */}
          <div className="p-3.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800">
                  Swiss System
                </span>
                <span className="text-slate-500 dark:text-slate-400 font-medium">Round 3 • Board 1</span>
              </div>
              <div className="flex items-center space-x-1 font-mono text-slate-600 dark:text-slate-300">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-semibold">5m + 3s</span>
              </div>
            </div>

            <div className="pt-1 flex items-center justify-between border-t border-slate-200/70 dark:border-slate-700/60 text-[11px] text-slate-600 dark:text-slate-300">
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-white border border-slate-400 shadow-xs inline-block" />
                <span className="font-semibold">White</span>
                <span className="text-slate-400">vs</span>
                <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-700 inline-block" />
                <span className="font-semibold">Black</span>
              </div>

              <div className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Lichess Synced</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChessHeroVisual;

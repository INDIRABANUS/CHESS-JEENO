/**
 * Shared tournament constants for Chess Jeeno frontend.
 */

export const FORMAT_LABELS = {
  SWISS: 'Swiss System',
  ROUND_ROBIN: 'Round Robin',
  KNOCKOUT: 'Single Elimination',
};

export const STATUS_BADGES = {
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  REGISTRATION: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  READY_CHECK: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
  COUNTDOWN: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
  RUNNING: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  FINISHED: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  COMPLETED: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  CANCELLED: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
};

export const PRESET_TIME_CONTROLS = [
  { label: '1+0', name: 'Bullet', clockLimit: 60, increment: 0 },
  { label: '3+0', name: 'Blitz', clockLimit: 180, increment: 0 },
  { label: '3+2', name: 'Blitz', clockLimit: 180, increment: 2 },
  { label: '5+0', name: 'Blitz', clockLimit: 300, increment: 0 },
  { label: '5+3', name: 'Blitz', clockLimit: 300, increment: 3 },
  { label: '10+0', name: 'Rapid', clockLimit: 600, increment: 0 },
  { label: '10+5', name: 'Rapid', clockLimit: 600, increment: 5 },
  { label: '30+0', name: 'Classical', clockLimit: 1800, increment: 0 },
  { label: '60+30', name: 'Classical', clockLimit: 3600, increment: 30 },
];

/**
 * Formatting utilities for Chess Jeeno frontend.
 */

/**
 * Format a chess tournament time control into a human-readable string.
 * e.g., (300, 0) => '5m', (300, 3) => '5m + 3s', (90, 0) => '1m 30s'
 *
 * @param {number} clockLimit - Clock limit in seconds
 * @param {number} increment - Increment in seconds
 * @returns {string} Formatted time control string or 'N/A'
 */
export const formatTimeControl = (clockLimit, increment) => {
  if (!clockLimit) return 'N/A';
  const mins = Math.floor(clockLimit / 60);
  const secs = clockLimit % 60;
  let baseStr = '';
  if (mins > 0 && secs === 0) {
    baseStr = `${mins}m`;
  } else if (mins > 0) {
    baseStr = `${mins}m ${secs}s`;
  } else {
    baseStr = `${secs}s`;
  }
  return increment > 0 ? `${baseStr} + ${increment}s` : baseStr;
};

/**
 * Format an ISO date string into a localized readable date/time string.
 *
 * @param {string|Date} dateString - Date string to format
 * @returns {string} Formatted date string or 'Not scheduled'
 */
export const formatDate = (dateString) => {
  if (!dateString) return 'Not scheduled';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return 'Not scheduled';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

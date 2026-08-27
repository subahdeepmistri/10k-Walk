// Formatting utilities for time, distance, pace, etc.

/**
 * Format duration from milliseconds to HH:MM:SS
 */
export function formatDuration(ms) {
  if (!ms || ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Format duration for display (e.g., "1h 23m")
 */
export function formatDurationShort(ms) {
  if (!ms || ms <= 0) return '0m';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Format distance in meters to km with appropriate precision
 */
export function formatDistance(meters, unit = 'km') {
  if (!meters || meters <= 0) return '0.00';
  if (unit === 'mi') {
    return (meters / 1609.344).toFixed(2);
  }
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return (meters / 1000).toFixed(2);
}

/**
 * Format distance as a short label
 */
export function formatDistanceLabel(meters, unit = 'km') {
  if (unit === 'mi') return 'mi';
  if (meters < 1000) return 'm';
  return 'km';
}

/**
 * Format pace (min/km)
 */
export function formatPace(paceMinPerKm) {
  if (!paceMinPerKm || paceMinPerKm <= 0 || paceMinPerKm > 60) return '--:--';
  const minutes = Math.floor(paceMinPerKm);
  const seconds = Math.round((paceMinPerKm - minutes) * 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Format speed in km/h
 */
export function formatSpeed(speedMs) {
  if (!speedMs || speedMs <= 0) return '0.0';
  return (speedMs * 3.6).toFixed(1);
}

/**
 * Format number with commas
 */
export function formatNumber(num) {
  if (!num) return '0';
  return Math.round(num).toLocaleString();
}

/**
 * Get local date string in YYYY-MM-DD format (respects user's timezone).
 * Critical for correct "daily" protocol attribution, streaks, and rings.
 * Never use UTC-based toISOString().split for day boundaries.
 */
export function getLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Format date to human readable
 */
export function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const today = getLocalDateString(now);
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(now.getDate() - 1);
  const yesterday = getLocalDateString(yesterdayDate);

  if (dateString === today) return 'Today';
  if (dateString === yesterday) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format time (e.g., "2:30 PM")
 */
export function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Get pace zone color
 */
export function getPaceZone(paceMinPerKm) {
  if (paceMinPerKm <= 6) return { label: 'Fast', color: '#EF4444' };
  if (paceMinPerKm <= 8) return { label: 'Brisk', color: '#F59E0B' };
  if (paceMinPerKm <= 10) return { label: 'Moderate', color: '#10B981' };
  if (paceMinPerKm <= 14) return { label: 'Easy', color: '#06B6D4' };
  return { label: 'Leisure', color: '#8B5CF6' };
}

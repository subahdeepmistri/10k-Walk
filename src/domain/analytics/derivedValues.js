const METRICS = Object.freeze(['steps', 'distance', 'duration', 'calories']);
const MAX_DERIVED_VALUE = Number.MAX_SAFE_INTEGER;

function safeNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  return Math.min(value, MAX_DERIVED_VALUE);
}

function safeProgress(value) {
  return Math.min(1, Math.max(0, safeNumber(value)));
}

export function aggregateWalks(walks = []) {
  const totals = { steps: 0, distance: 0, duration: 0, calories: 0, walks: 0 };
  if (!Array.isArray(walks)) return totals;

  for (const walk of walks) {
    if (!walk || typeof walk !== 'object') continue;
    totals.steps = Math.min(MAX_DERIVED_VALUE, totals.steps + safeNumber(walk.steps));
    totals.distance = Math.min(MAX_DERIVED_VALUE, totals.distance + safeNumber(walk.distance));
    totals.duration = Math.min(MAX_DERIVED_VALUE, totals.duration + safeNumber(walk.duration));
    totals.calories = Math.min(MAX_DERIVED_VALUE, totals.calories + safeNumber(walk.calories));
    totals.walks = Math.min(MAX_DERIVED_VALUE, totals.walks + 1);
  }
  return totals;
}

export function calculateGoalProgress(totals, goals) {
  const progress = {};
  for (const metric of METRICS) {
    const value = safeNumber(totals?.[metric]);
    const goal = safeNumber(goals?.[metric]);
    progress[metric] = goal > 0 ? Math.min(1, Math.max(0, value / goal)) : 0;
  }
  return progress;
}

export function calculateOverallProgress(progress) {
  const values = METRICS.map((metric) => safeProgress(progress?.[metric]));
  return Math.min(1, Math.max(0, values.reduce((sum, value) => sum + value, 0) / METRICS.length));
}

export function countCompletedGoals(progress) {
  return METRICS.filter((metric) => safeProgress(progress?.[metric]) >= 1).length;
}

export function createDailyGoalSnapshot(walks, goals) {
  const totals = aggregateWalks(walks);
  const progress = calculateGoalProgress(totals, goals);
  return {
    totals,
    progress,
    overallProgress: calculateOverallProgress(progress),
    completedGoals: countCompletedGoals(progress),
  };
}

export { METRICS };

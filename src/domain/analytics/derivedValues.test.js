import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateWalks,
  calculateGoalProgress,
  calculateOverallProgress,
  countCompletedGoals,
  createDailyGoalSnapshot,
} from './derivedValues.js';

test('aggregateWalks ignores malformed metric values without producing NaN', () => {
  const result = aggregateWalks([
    { steps: 100, distance: 500, duration: 60_000, calories: 20 },
    { steps: Number.NaN, distance: 'bad', duration: Infinity, calories: null },
    null,
  ]);
  assert.deepEqual(result, {
    steps: 100,
    distance: 500,
    duration: 60_000,
    calories: 20,
    walks: 2,
  });
  assert.ok(Object.values(result).every((value) => Number.isFinite(value)));
});

test('goal progress guards zero goals and clamps values', () => {
  const result = calculateGoalProgress(
    { steps: 12_000, distance: -10, duration: 30_000, calories: 100 },
    { steps: 10_000, distance: 0, duration: 0, calories: 50 },
  );
  assert.deepEqual(result, { steps: 1, distance: 0, duration: 0, calories: 1 });
});

test('overall progress and completed goals are finite and bounded', () => {
  const progress = { steps: 1, distance: 0.5, duration: 1, calories: 2 };
  assert.equal(calculateOverallProgress(progress), 0.875);
  assert.equal(countCompletedGoals(progress), 3);
  assert.ok(calculateOverallProgress({ steps: NaN }) >= 0);
  assert.ok(calculateOverallProgress({ steps: NaN }) <= 1);
});

test('daily snapshot provides one consistent derived result', () => {
  const snapshot = createDailyGoalSnapshot(
    [{ steps: 5_000, distance: 2_500, duration: 1_500_000, calories: 150 }],
    { steps: 10_000, distance: 5_000, duration: 45 * 60_000, calories: 300 },
  );
  assert.equal(snapshot.totals.steps, 5_000);
  assert.equal(snapshot.progress.steps, 0.5);
  assert.equal(snapshot.progress.distance, 0.5);
  assert.equal(snapshot.progress.duration, 1_500_000 / (45 * 60_000));
  assert.equal(snapshot.progress.calories, 0.5);
  assert.equal(snapshot.overallProgress, (0.5 + 0.5 + (1_500_000 / (45 * 60_000)) + 0.5) / 4);
  assert.equal(snapshot.completedGoals, 0);
});

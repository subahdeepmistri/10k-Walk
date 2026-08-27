// dataStore — single source of truth for walks, settings, and derived values.

import { create } from 'zustand';
import { initializeLocalStorageDataLayer } from '../../infrastructure/storage/index.js';
import { db as dexieDb } from '../../lib/db.js';
import { DEFAULT_SETTINGS } from '../../utils/constants.js';
import { getLocalDateString } from '../../utils/formatters.js';
import {
  aggregateWalks,
  calculateGoalProgress,
  calculateOverallProgress,
  countCompletedGoals,
} from '../../domain/analytics/derivedValues.js';
import {
  calculateStreak,
  getWeeklyActivity as computeWeeklyActivity,
  calculatePersonalRecords,
  getChartData as computeChartData,
} from '../../lib/analytics.js';

let adapter = null;

const useDataStore = create(() => ({
  walks: [],
  settings: { ...DEFAULT_SETTINGS },
  status: 'loading',       // 'loading' | 'ready' | 'error' | 'degraded'
  storageStatus: null,     // 'available' | 'unavailable' | 'memory'
  isLoaded: false,
  issues: [],
}));

function shallowSettingsEqual(a, b) {
  if (a === b) return true;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

function hydrate(document) {
  const settings = { ...DEFAULT_SETTINGS, ...(document.settings || {}) };
  const prev = useDataStore.getState();

  // Avoid triggering subscribers when nothing actually changed
  if (
    shallowSettingsEqual(prev.settings, settings) &&
    prev.walks === document.walks
  ) {
    return;
  }

  useDataStore.setState({
    walks: document.walks,
    settings,
    isLoaded: true,
  });
}

export async function initDataStore() {
  try {
    const result = await initializeLocalStorageDataLayer({
      database: dexieDb,
    });

    adapter = result.adapter;
    hydrate(result.document);

    useDataStore.setState({
      status: result.writeBlocked ? 'degraded' : 'ready',
      storageStatus: result.storageStatus,
      issues: result.issues || [],
    });

    // Subscribe to external changes (cross-tab sync)
    adapter.subscribe((event) => {
      if (event.document) {
        hydrate(event.document);
      }
      if (event.error) {
        console.warn('Storage subscription error:', event.error);
      }
    });

  } catch (error) {
    console.error('Failed to initialize data store:', error);
    useDataStore.setState({ status: 'error', isLoaded: true });
  }
}

export function getTodayWalks() {
  const { walks } = useDataStore.getState();
  const today = getLocalDateString();
  return walks.filter((w) => w.date === today);
}

export function getTodaySnapshot(settingsOverride) {
  const { settings: storeSettings, walks } = useDataStore.getState();
  const settings = settingsOverride || storeSettings;
  const today = getLocalDateString();
  const todayWalks = walks.filter((w) => w.date === today);
  if (todayWalks.length === 0) {
    return {
      totals: { steps: 0, distance: 0, duration: 0, calories: 0, walks: 0 },
      progress: { steps: 0, distance: 0, duration: 0, calories: 0 },
      overallProgress: 0,
      completedGoals: 0,
    };
  }
  const totals = aggregateWalks(todayWalks);
  const goals = {
    steps: settings.dailyStepGoal,
    distance: settings.dailyDistanceGoal,
    duration: (settings.dailyDurationGoal || 45) * 60_000, // minutes → ms
    calories: settings.dailyCaloriesGoal,
  };
  const progress = calculateGoalProgress(totals, goals);
  return {
    totals,
    progress,
    overallProgress: calculateOverallProgress(progress),
    completedGoals: countCompletedGoals(progress),
  };
}

export function getStreak() {
  return calculateStreak(useDataStore.getState().walks);
}

export function getWeeklyActivity() {
  return computeWeeklyActivity(useDataStore.getState().walks);
}

export function getPersonalRecords() {
  return calculatePersonalRecords(useDataStore.getState().walks);
}

export function getChartData(period = 'week') {
  return computeChartData(useDataStore.getState().walks, period);
}

export function getWalks() {
  return useDataStore.getState().walks;
}

export function getWalkById(id) {
  const numId = typeof id === 'string' ? Number(id) : id;
  const { walks } = useDataStore.getState();
  return walks.find((w) => w.id === numId || w.id === id) || null;
}

export async function saveWalk(walkData) {
  if (!adapter) throw new Error('Data store not initialized');

  const now = Date.now();
  const walk = {
    ...walkData,
    id: walkData.id || `walk-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    date:
      walkData.date ||
      (walkData.startTime
        ? getLocalDateString(new Date(walkData.startTime))
        : getLocalDateString()),
    createdAt: walkData.createdAt ?? now,
    updatedAt: now,
  };

  await adapter.update((draft) => {
    draft.walks.push(walk);
    return draft;
  });

  return walk.id;
}

export async function deleteWalk(walkId) {
  if (!adapter) throw new Error('Data store not initialized');

  await adapter.update((draft) => {
    draft.walks = draft.walks.filter((w) => w.id !== walkId);
    return draft;
  });
}

export async function updateSetting(key, value) {
  if (!adapter) throw new Error('Data store not initialized');

  await adapter.update((draft) => {
    draft.settings[key] = value;
    return draft;
  });
}

export async function clearAll() {
  if (!adapter) throw new Error('Data store not initialized');

  await adapter.clearAll();
}

export async function importData(payload, { mode = 'merge' } = {}) {
  if (!adapter) throw new Error('Data store not initialized');

  let incoming;
  try {
    incoming = typeof payload === 'string' ? JSON.parse(payload) : payload;
  } catch {
    throw new Error('Invalid import data: not valid JSON');
  }
  return adapter.import(incoming, { mode });
}

export async function exportData() {
  if (!adapter) throw new Error('Data store not initialized');

  return adapter.export();
}

export default useDataStore;

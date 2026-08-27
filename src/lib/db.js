// IndexedDB setup using Dexie.js for offline-first walk storage

import Dexie from 'dexie';
import { getLocalDateString } from '../utils/formatters';

export const db = new Dexie('WalkTrackerDB');

db.version(1).stores({
  // Note: full objects are stored (points, elevationGain/Loss, maxSpeed, average*, altitudePoints, syncedWithCloud etc.);
  // the listed fields are only for Dexie indexes/queries. All system outputs from trackingStore.getWalkData are persisted.
  walks: '++id, date, startTime, endTime, distance, duration, steps, calories',
  settings: 'key',
});

/**
 * Save a completed walk to IndexedDB.
 * Date is attributed using the LOCAL start time of the walk (user's day).
 * This ensures correct daily progress rings, streaks, and "today" aggregates
 * regardless of UTC timezone or midnight crossing.
 */
export async function saveWalk(walkData) {
  const start = walkData.startTime ? new Date(walkData.startTime) : new Date();
  return await db.walks.add({
    ...walkData,
    date: getLocalDateString(start),
    createdAt: Date.now(),
  });
}

/**
 * Get all walks, optionally filtered by date range
 */
export async function getWalks(startDate, endDate) {
  let query = db.walks.orderBy('startTime').reverse();
  if (startDate && endDate) {
    query = db.walks
      .where('date')
      .between(startDate, endDate, true, true)
      .reverse();
  }
  return await query.toArray();
}

/**
 * Get a single walk by ID
 */
export async function getWalkById(id) {
  return await db.walks.get(id);
}

/**
 * Delete a walk by ID
 */
export async function deleteWalk(id) {
  return await db.walks.delete(id);
}

/**
 * Get today's walks (using local date for correct daily protocol)
 */
export async function getTodayWalks() {
  const today = getLocalDateString();
  return await db.walks.where('date').equals(today).toArray();
}

/**
 * Get walks for a specific date range (for analytics)
 */
export async function getWalksByDateRange(startDate, endDate) {
  return await db.walks
    .where('date')
    .between(startDate, endDate, true, true)
    .toArray();
}

/**
 * Save user setting
 */
export async function saveSetting(key, value) {
  return await db.settings.put({ key, value });
}

/**
 * Get user setting
 */
export async function getSetting(key) {
  const result = await db.settings.get(key);
  return result?.value;
}

/**
 * Get all settings
 */
export async function getAllSettings() {
  const settings = await db.settings.toArray();
  return settings.reduce((acc, { key, value }) => {
    acc[key] = value;
    return acc;
  }, {});
}

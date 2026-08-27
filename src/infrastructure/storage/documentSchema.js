import { DEFAULT_SETTINGS } from '../../utils/constants.js';
import { getLocalDateString } from '../../utils/formatters.js';
import { safeParse, safeStringify, toQuarantineValue } from './serialization.js';
import { StorageValidationError } from './storageErrors.js';

export const CURRENT_SCHEMA_VERSION = 1;
export const DATA_KEY = 'walktracker:data';
export const RECOVERY_KEY = 'walktracker:recovery';

export const DEFAULT_PERSISTED_SETTINGS = Object.freeze({
  ...DEFAULT_SETTINGS,
  onboardingComplete: false,
  unlockedAchievements: [],
  xp: 0,
});

const NUMERIC_WALK_FIELDS = [
  'distance',
  'steps',
  'calories',
  'averageSpeed',
  'averagePace',
  'maxSpeed',
  'elevationGain',
  'elevationLoss',
];

const SETTING_RULES = {
  weightKg: { min: 30, max: 250 },
  heightCm: { min: 100, max: 220 },
  dailyStepGoal: { min: 1000 },
  dailyDistanceGoal: { min: 500 },
  dailyDurationGoal: { min: 5 },
  dailyCaloriesGoal: { min: 50 },
  autoPauseSpeed: { min: 0.1, max: 2 },
  gpsAccuracyThreshold: { min: 5, max: 100 },
};

export const PERSISTED_SETTING_KEYS = Object.freeze(Object.keys(DEFAULT_PERSISTED_SETTINGS));

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function finiteNonNegative(value, field, fatal) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    fatal.push(`${field} must be a finite non-negative number.`);
    return null;
  }
  return value;
}

function validEpoch(value, field, fatal) {
  const result = finiteNonNegative(value, field, fatal);
  if (result === null) return null;
  if (!Number.isSafeInteger(result) || !Number.isFinite(new Date(result).getTime())) {
    fatal.push(`${field} must be a safe integer timestamp.`);
    return null;
  }
  return result;
}

function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function validPoint(raw, index, fatal) {
  const pointIssues = [];
  if (!isPlainObject(raw)) {
    pointIssues.push(`points[${index}] must be an object.`);
    fatal.push(...pointIssues);
    return null;
  }

  const lat = typeof raw.lat === 'number' && Number.isFinite(raw.lat) ? raw.lat : null;
  const lng = typeof raw.lng === 'number' && Number.isFinite(raw.lng) ? raw.lng : null;
  const timestamp = validEpoch(raw.timestamp, `points[${index}].timestamp`, pointIssues);

  if (lat === null || lat < -90 || lat > 90) pointIssues.push(`points[${index}].lat is invalid.`);
  if (lng === null || lng < -180 || lng > 180) pointIssues.push(`points[${index}].lng is invalid.`);

  const point = { lat, lng, timestamp };
  for (const field of ['accuracy', 'speed', 'altitude']) {
    if (raw[field] === undefined || raw[field] === null) continue;
    if (typeof raw[field] !== 'number' || !Number.isFinite(raw[field])) {
      pointIssues.push(`points[${index}].${field} must be finite when present.`);
    } else if ((field === 'accuracy' || field === 'speed') && raw[field] < 0) {
      pointIssues.push(`points[${index}].${field} must be non-negative.`);
    } else {
      point[field] = raw[field];
    }
  }
  fatal.push(...pointIssues);
  return pointIssues.length ? null : point;
}

function validAltitudePoint(raw, index, fatal) {
  const pointIssues = [];
  if (!isPlainObject(raw)) {
    pointIssues.push(`altitudePoints[${index}] must be an object.`);
    fatal.push(...pointIssues);
    return null;
  }
  const distance = finiteNonNegative(raw.distance, `altitudePoints[${index}].distance`, pointIssues);
  const altitude = typeof raw.altitude === 'number' && Number.isFinite(raw.altitude)
    ? raw.altitude
    : null;
  if (altitude === null) pointIssues.push(`altitudePoints[${index}].altitude must be finite.`);
  fatal.push(...pointIssues);
  return pointIssues.length || distance === null || altitude === null ? null : { distance, altitude };
}

export function createEmptyDocument(now = Date.now()) {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    revision: 0,
    updatedAt: now,
    settings: {
      ...DEFAULT_PERSISTED_SETTINGS,
      unlockedAchievements: [],
    },
    walks: [],
    quarantine: [],
    migration: {
      legacyIndexedDbImported: false,
      legacyImportedAt: null,
    },
  };
}

export function validateSettings(raw, { allowDefaults = true } = {}) {
  const fatal = [];
  const warnings = [];
  const unknown = [];
  const validInput = isPlainObject(raw);
  const source = validInput ? raw : {};
  const settings = allowDefaults
    ? { ...DEFAULT_PERSISTED_SETTINGS, unlockedAchievements: [] }
    : {};
  if (!validInput) {
    const issue = 'settings must be an object.';
    if (allowDefaults) warnings.push(issue);
    else fatal.push(issue);
  }

  for (const [key, defaultValue] of Object.entries(DEFAULT_PERSISTED_SETTINGS)) {
    if (!(key in source)) continue;
    const value = source[key];
    if (typeof defaultValue === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        fatal.push(`${key} must be finite.`);
        continue;
      }
      const rule = SETTING_RULES[key];
      const invalidMinimum = rule?.min !== undefined && value < rule.min;
      const invalidMaximum = rule?.max !== undefined && value > rule.max;
      if (invalidMinimum) fatal.push(`${key} is below its minimum.`);
      if (invalidMaximum) fatal.push(`${key} is above its maximum.`);
      if (invalidMinimum || invalidMaximum) continue;
      settings[key] = value;
    } else if (key === 'unit' && value !== 'km' && value !== 'mi') {
      fatal.push('unit must be km or mi.');
    } else if (key === 'theme' && value !== 'dark' && value !== 'light') {
      fatal.push('theme must be dark or light.');
    } else if (key === 'unlockedAchievements') {
      if (!Array.isArray(value) || value.some((id) => typeof id !== 'string' || !id.trim())) {
        fatal.push('unlockedAchievements must be an array of non-empty strings.');
      } else {
        settings[key] = [...new Set(value)];
      }
    } else if (typeof value !== typeof defaultValue) {
      fatal.push(`${key} has the wrong type.`);
    } else {
      settings[key] = value;
    }
  }

  for (const key of Object.keys(source)) {
    if (!PERSISTED_SETTING_KEYS.includes(key)) {
      unknown.push({ key, value: source[key] });
      warnings.push(`Unrecognized setting '${key}' was quarantined.`);
    }
  }

  return {
    value: settings,
    fatal,
    warnings,
    unknown,
    invalidInput: !validInput,
    issues: [...fatal, ...warnings],
  };
}

export function validateWalk(raw, {
  fallbackId,
  now = Date.now(),
  repairInvalidNested = true,
  strictRequired = false,
} = {}) {
  const fatal = [];
  const warnings = [];
  if (!isPlainObject(raw)) {
    return {
      value: null,
      fatal: ['walk must be an object.'],
      warnings: [],
      unknown: [],
      repairs: [],
      issues: ['walk must be an object.'],
    };
  }

  const id = typeof raw.id === 'string' && raw.id.trim()
    ? raw.id.trim()
    : typeof fallbackId === 'string' && fallbackId.trim()
      ? fallbackId.trim()
      : null;
  if (!id || id.length > 200) fatal.push('walk.id is required and must be at most 200 characters.');

  const startTime = raw.startTime === undefined
    ? null
    : validEpoch(raw.startTime, 'startTime', fatal);
  if (startTime === null && raw.startTime === undefined) fatal.push('startTime is required.');

  let duration = raw.duration;
  let endTime = raw.endTime;
  if (duration === undefined && typeof endTime === 'number' && Number.isFinite(endTime) && startTime !== null) {
    duration = endTime - startTime;
    warnings.push('duration was derived from startTime and endTime.');
  }
  if (endTime === undefined && typeof duration === 'number' && Number.isFinite(duration) && startTime !== null) {
    endTime = startTime + duration;
    warnings.push('endTime was derived from startTime and duration.');
  }
  endTime = validEpoch(endTime, 'endTime', fatal);
  duration = finiteNonNegative(duration, 'duration', fatal);
  if (startTime !== null && endTime !== null && endTime < startTime) fatal.push('endTime cannot precede startTime.');

  const value = { id };
  const repairs = [];
  for (const field of NUMERIC_WALK_FIELDS) {
    if (raw[field] === undefined) {
      value[field] = 0;
      if (strictRequired) fatal.push(`${field} is required.`);
      else warnings.push(`${field} was missing and defaulted to zero.`);
    } else {
      value[field] = finiteNonNegative(raw[field], field, fatal);
    }
  }
  value.startTime = startTime;
  value.endTime = endTime;
  value.duration = duration;

  const expectedDate = startTime === null ? null : getLocalDateString(new Date(startTime));
  if (!isValidDateString(raw.date)) {
    if (expectedDate) {
      value.date = expectedDate;
      if (repairInvalidNested) warnings.push('date was missing or invalid and was derived from startTime.');
      else fatal.push('date must be a valid local YYYY-MM-DD string.');
    } else {
      fatal.push('date is required when startTime is unavailable.');
    }
  } else if (expectedDate && raw.date !== expectedDate) {
    value.date = expectedDate;
    if (repairInvalidNested) warnings.push('date was normalized to the local date of startTime.');
    else fatal.push('date must match the local date of startTime.');
  } else {
    value.date = raw.date;
  }

  if (raw.points === undefined) {
    value.points = [];
    warnings.push('points was missing and defaulted to an empty array.');
  } else if (!Array.isArray(raw.points)) {
    fatal.push('points must be an array.');
    value.points = [];
  } else {
    const pointFatal = [];
    value.points = raw.points.map((point, index) => {
      const before = pointFatal.length;
      const validated = validPoint(point, index, pointFatal);
      if (!validated) {
        repairs.push({
          original: toQuarantineValue(point),
          reason: pointFatal.slice(before).join('; ') || 'invalid GPS point',
          index,
          kind: 'point',
        });
      }
      return validated;
    }).filter(Boolean);
    if (pointFatal.length && repairInvalidNested) warnings.push(`${pointFatal.length} invalid GPS point issue(s) were omitted.`);
    else fatal.push(...pointFatal);
  }

  if (raw.altitudePoints === undefined) {
    value.altitudePoints = [];
    warnings.push('altitudePoints was missing and defaulted to an empty array.');
  } else if (!Array.isArray(raw.altitudePoints)) {
    fatal.push('altitudePoints must be an array.');
    value.altitudePoints = [];
  } else {
    const altitudeFatal = [];
    value.altitudePoints = raw.altitudePoints.map((point, index) => {
      const before = altitudeFatal.length;
      const validated = validAltitudePoint(point, index, altitudeFatal);
      if (!validated) {
        repairs.push({
          original: toQuarantineValue(point),
          reason: altitudeFatal.slice(before).join('; ') || 'invalid altitude point',
          index,
          kind: 'altitudePoint',
        });
      }
      return validated;
    }).filter(Boolean);
    if (altitudeFatal.length && repairInvalidNested) warnings.push(`${altitudeFatal.length} invalid altitude point issue(s) were omitted.`);
    else fatal.push(...altitudeFatal);
  }

  const createdAtInput = raw.createdAt === undefined ? startTime ?? now : raw.createdAt;
  const updatedAtInput = raw.updatedAt === undefined ? createdAtInput ?? now : raw.updatedAt;
  value.createdAt = validEpoch(createdAtInput, 'createdAt', fatal);
  value.updatedAt = validEpoch(updatedAtInput, 'updatedAt', fatal);
  if (value.createdAt !== null && value.updatedAt !== null && value.updatedAt < value.createdAt) {
    fatal.push('updatedAt cannot precede createdAt.');
  }

  const knownFields = new Set([
    'id', 'date', 'startTime', 'endTime', 'distance', 'duration', 'steps',
    'calories', 'averageSpeed', 'averagePace', 'maxSpeed', 'elevationGain',
    'elevationLoss', 'points', 'altitudePoints', 'createdAt', 'updatedAt',
  ]);
  const unknown = Object.entries(raw)
    .filter(([key]) => !knownFields.has(key))
    .map(([key, unknownValue]) => ({ key, value: unknownValue }));
  if (unknown.length) warnings.push(`${unknown.length} unrecognized walk field(s) were quarantined.`);

  const issues = [...fatal, ...warnings];
  return {
    value: fatal.length ? null : value,
    fatal,
    warnings,
    unknown,
    repairs,
    issues,
  };
}

export function validateDocument(raw, {
  now = Date.now(),
  quarantineInvalid = true,
  strictUnknown = false,
} = {}) {
  const fatal = [];
  const warnings = [];
  if (!isPlainObject(raw)) {
    return { value: null, fatal: ['document must be an object.'], warnings: [], issues: ['document must be an object.'] };
  }

  if (raw.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    fatal.push(`unsupported schemaVersion: ${raw.schemaVersion}`);
  }
  const revision = Number.isSafeInteger(raw.revision) && raw.revision >= 0 ? raw.revision : null;
  if (revision === null) fatal.push('revision must be a non-negative safe integer.');
  const updatedAt = raw.updatedAt === undefined ? now : validEpoch(raw.updatedAt, 'updatedAt', fatal);

  const settingsResult = validateSettings(raw.settings);
  if (settingsResult.fatal.length && !quarantineInvalid) {
    fatal.push(...settingsResult.fatal.map((issue) => `settings.${issue}`));
  } else if (settingsResult.fatal.length) {
    warnings.push(...settingsResult.fatal.map((issue) => `settings.${issue}`));
  }
  warnings.push(...settingsResult.warnings.map((issue) => `settings.${issue}`));
  if (strictUnknown && settingsResult.unknown.length) {
    fatal.push(...settingsResult.unknown.map(({ key }) => `settings contains unrecognized key '${key}'.`));
  }

  if (!Array.isArray(raw.walks)) {
    fatal.push('walks must be an array.');
  }

  const walks = [];
  const seenIds = new Set();
  const quarantine = Array.isArray(raw.quarantine)
    ? raw.quarantine.filter((item) => isPlainObject(item))
    : [];
  if (settingsResult.invalidInput && raw.settings !== undefined) {
    if (!quarantineInvalid) {
      fatal.push('settings must be an object.');
    } else {
      quarantine.push({
        original: toQuarantineValue(raw.settings),
        reason: 'settings must be an object',
        detectedAt: now,
      });
      warnings.push('Invalid settings were quarantined and defaults were used.');
    }
  }
  if (Array.isArray(raw.quarantine)) {
    for (const item of raw.quarantine) {
      if (!isPlainObject(item)) {
        quarantine.push({
          original: toQuarantineValue(item),
          reason: 'invalid quarantine entry',
          detectedAt: now,
        });
        warnings.push('An invalid quarantine entry was preserved.');
      }
    }
  }

  for (const unknown of settingsResult.unknown) {
    quarantine.push({
      original: toQuarantineValue({ key: unknown.key, value: unknown.value }),
      reason: 'unrecognized setting',
      detectedAt: now,
    });
  }

  if (Array.isArray(raw.walks)) {
    raw.walks.forEach((walk, index) => {
      const result = validateWalk(walk, {
        now,
        repairInvalidNested: quarantineInvalid,
        strictRequired: !quarantineInvalid,
      });
      if (!result.value) {
        if (!quarantineInvalid) {
          fatal.push(...result.fatal.map((issue) => `walk[${index}].${issue}`));
          return;
        }
        warnings.push(`walk[${index}] was quarantined: ${result.fatal.join('; ') || 'invalid walk'}`);
        quarantine.push({
          original: toQuarantineValue(walk),
          reason: result.fatal.join('; ') || 'invalid walk',
          detectedAt: now,
          index,
        });
        return;
      }
      if (seenIds.has(result.value.id)) {
        if (!quarantineInvalid) {
          fatal.push(`walk[${index}] duplicates ID '${result.value.id}'.`);
          return;
        }
        warnings.push(`walk[${index}] was quarantined because its ID is duplicated.`);
        quarantine.push({ original: toQuarantineValue(walk), reason: 'duplicate walk id', detectedAt: now, index });
        return;
      }
      seenIds.add(result.value.id);
      walks.push(result.value);
      warnings.push(...result.warnings.map((issue) => `walk[${index}].${issue}`));
      if (strictUnknown && result.unknown.length) {
        fatal.push(...result.unknown.map(({ key }) => `walk[${index}] contains unrecognized field '${key}'.`));
      }
      for (const repair of result.repairs) {
        quarantine.push({
          original: repair.original,
          reason: repair.reason,
          detectedAt: now,
          walkId: result.value.id,
          index: repair.index,
          kind: repair.kind,
        });
      }
      for (const unknown of result.unknown) {
        quarantine.push({
          original: toQuarantineValue({ walkId: result.value.id, key: unknown.key, value: unknown.value }),
          reason: 'unrecognized walk field',
          detectedAt: now,
          index,
        });
      }
    });
  }

  if (settingsResult.fatal.length && quarantineInvalid) {
    quarantine.push({
      original: toQuarantineValue(raw.settings),
      reason: settingsResult.fatal.join('; '),
      detectedAt: now,
    });
  }

  if (!Array.isArray(raw.quarantine)) warnings.push('quarantine was missing and defaulted to an empty array.');
  const migration = isPlainObject(raw.migration) ? raw.migration : {};
  if (raw.migration !== undefined && !isPlainObject(raw.migration)) {
    warnings.push('migration metadata was invalid and was reset.');
  }

  const knownRootFields = new Set([
    'schemaVersion', 'revision', 'updatedAt', 'settings', 'walks', 'quarantine', 'migration',
  ]);
  for (const [key, unknownValue] of Object.entries(raw)) {
    if (knownRootFields.has(key)) continue;
    if (strictUnknown) fatal.push(`document contains unrecognized field '${key}'.`);
    quarantine.push({
      original: toQuarantineValue({ key, value: unknownValue }),
      reason: 'unrecognized document field',
      detectedAt: now,
    });
    warnings.push(`Unrecognized document field '${key}' was quarantined.`);
  }

  if (isPlainObject(raw.migration)) {
    for (const [key, unknownValue] of Object.entries(raw.migration)) {
      if (key === 'legacyIndexedDbImported' || key === 'legacyImportedAt') continue;
      if (strictUnknown) fatal.push(`migration contains unrecognized field '${key}'.`);
      quarantine.push({
        original: toQuarantineValue({ key, value: unknownValue }),
        reason: 'unrecognized migration field',
        detectedAt: now,
      });
      warnings.push(`Unrecognized migration field '${key}' was quarantined.`);
    }
  }

  const value = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    revision: revision ?? 0,
    updatedAt: updatedAt ?? now,
    settings: settingsResult.value,
    walks,
    quarantine,
    migration: {
      legacyIndexedDbImported: migration.legacyIndexedDbImported === true,
      legacyImportedAt: migration.legacyImportedAt ?? null,
    },
  };

  return {
    value: fatal.length ? null : value,
    fatal,
    warnings,
    issues: [...fatal, ...warnings],
  };
}

export function cloneDocument(document) {
  try {
    return safeParse(safeStringify(document));
  } catch (error) {
    if (error instanceof StorageValidationError) throw error;
    throw new StorageValidationError('Document could not be cloned safely.', { cause: error });
  }
}

export function createWalkRecord(raw, { now = () => Date.now(), idFactory } = {}) {
  const timestamp = now();
  const factory = idFactory || (() => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    const random = typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function'
      ? crypto.getRandomValues(new Uint32Array(3)).join('-')
      : Math.random().toString(36).slice(2);
    return `walk-${timestamp.toString(36)}-${random}`;
  });
  const startTime = raw?.startTime;
  const date = raw?.date || (
    typeof startTime === 'number' && Number.isFinite(startTime)
      ? getLocalDateString(new Date(startTime))
      : raw?.date
  );
  const result = validateWalk({
    ...raw,
    id: raw?.id || factory(),
    date,
    createdAt: raw?.createdAt ?? timestamp,
    updatedAt: raw?.updatedAt ?? timestamp,
  }, {
    now: timestamp,
    repairInvalidNested: false,
    strictRequired: true,
  });
  if (!result.value || result.fatal.length) {
    throw new StorageValidationError('Walk failed validation.', { issues: result.issues });
  }
  return { walk: result.value, warnings: result.warnings, unknown: result.unknown };
}

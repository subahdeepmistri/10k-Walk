import { CURRENT_SCHEMA_VERSION, createEmptyDocument } from './documentSchema.js';
import { StorageValidationError } from './storageErrors.js';

const migrations = {
  // Version 1 is the first localStorage document format. Future migrations are
  // added as N -> N + 1 functions and never mutate the caller's object.
};

function cloneMigrationInput(value, seen = new Set()) {
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) throw new StorageValidationError('Stored data contains a circular reference.');

  if (Array.isArray(value)) {
    seen.add(value);
    const result = value.map((item) => cloneMigrationInput(item, seen));
    seen.delete(value);
    return result;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;

  seen.add(value);
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    result[key] = cloneMigrationInput(child, seen);
  }
  seen.delete(value);
  return result;
}

export function migrateDocument(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new StorageValidationError('Stored document is not an object.');
  }

  const version = Number.isInteger(raw.schemaVersion) ? raw.schemaVersion : 0;
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new StorageValidationError(`Stored schema version ${version} is newer than ${CURRENT_SCHEMA_VERSION}.`);
  }

  let document = cloneMigrationInput(raw);
  if (version === 0) {
    const empty = createEmptyDocument(now);
    document = {
      ...empty,
      ...document,
      schemaVersion: 1,
      settings: { ...empty.settings, ...(document.settings || {}) },
      walks: Array.isArray(document.walks) ? document.walks : [],
      quarantine: Array.isArray(document.quarantine) ? document.quarantine : [],
      migration: { ...empty.migration, ...(document.migration || {}) },
    };
  }

  while (document.schemaVersion < CURRENT_SCHEMA_VERSION) {
    const migrate = migrations[document.schemaVersion];
    if (typeof migrate !== 'function') {
      throw new StorageValidationError(`No migration exists for schema ${document.schemaVersion}.`);
    }
    document = migrate(document);
  }
  return document;
}

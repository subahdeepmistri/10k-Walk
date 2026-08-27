import { createWalkRecord } from './documentSchema.js';
import { readLegacyIndexedDb, mergeLegacyData } from './legacyIndexedDbImporter.js';
import { createLocalStorageAdapter } from './localStorageAdapter.js';

export {
  CURRENT_SCHEMA_VERSION,
  DATA_KEY,
  RECOVERY_KEY,
  createEmptyDocument,
  createWalkRecord,
  validateDocument,
  validateSettings,
  validateWalk,
} from './documentSchema.js';
export { readLegacyIndexedDb, mergeLegacyData } from './legacyIndexedDbImporter.js';
export { createLocalStorageAdapter, mergeDocuments } from './localStorageAdapter.js';
export { safeParse, safeStringify, toQuarantineValue } from './serialization.js';
export * from './storageErrors.js';

export async function initializeLocalStorageDataLayer({ database, adapterOptions } = {}) {
  const adapter = createLocalStorageAdapter(adapterOptions);
  const loaded = await adapter.load();
  if (loaded.document.migration.legacyIndexedDbImported) {
    return { adapter, ...loaded, migration: 'already-imported' };
  }

  let legacy;
  try {
    legacy = await readLegacyIndexedDb({ database });
  } catch (error) {
    return {
      adapter,
      ...loaded,
      migration: 'failed',
      error,
    };
  }
  if (!legacy.available) {
    return { adapter, ...loaded, migration: 'not-available' };
  }

  const merged = mergeLegacyData(loaded.document, legacy, adapterOptions?.now?.() ?? Date.now());
  const saved = loaded.writeBlocked
    ? await adapter.import(merged, { mode: 'replace' })
    : await adapter.save(merged, { expectedRevision: loaded.document.revision });
  return {
    adapter,
    document: saved.document,
    status: saved.status,
    storageStatus: loaded.storageStatus,
    issues: loaded.issues,
    error: null,
    migration: 'imported',
  };
}

export function prepareWalkForStorage(walk, options) {
  return createWalkRecord(walk, options);
}

import {
  CURRENT_SCHEMA_VERSION,
  DATA_KEY,
  RECOVERY_KEY,
  PERSISTED_SETTING_KEYS,
  cloneDocument,
  createEmptyDocument,
  validateDocument,
  validateSettings,
} from './documentSchema.js';
import { migrateDocument } from './migrations.js';
import { safeParse, safeStringify } from './serialization.js';
import {
  StorageConflictError,
  StorageQuotaError,
  StorageUnavailableError,
  StorageValidationError,
} from './storageErrors.js';

function isQuotaError(error) {
  return error?.name === 'QuotaExceededError' || error?.code === 22;
}

function isUnavailableError(error) {
  return error?.name === 'SecurityError'
    || error?.name === 'InvalidStateError'
    || error?.name === 'NotAllowedError'
    || error?.name === 'NotSupportedError'
    || error?.code === 18;
}

function defaultStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage || null;
  } catch {
    return null;
  }
}

function defaultEvents() {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return null;
  return window;
}

function mergeDocuments(current, incoming) {
  const walks = new Map(current.walks.map((walk) => [walk.id, walk]));
  for (const walk of incoming.walks) {
    const existing = walks.get(walk.id);
    if (!existing || walk.updatedAt >= existing.updatedAt) walks.set(walk.id, walk);
  }
  return {
    ...current,
    // A merge import adds history without unexpectedly resetting local preferences.
    settings: current.settings,
    walks: [...walks.values()],
    quarantine: [...current.quarantine, ...incoming.quarantine],
    migration: { ...current.migration, ...incoming.migration },
  };
}

export function createLocalStorageAdapter({
  storage = defaultStorage(),
  events = defaultEvents(),
  now = () => Date.now(),
  debounceMs = 250,
} = {}) {
  let persistentStorage = storage;
  let memoryDocument = null;
  let storageStatus = persistentStorage ? 'available' : 'unavailable';
  const listeners = new Set();
  let pendingSettingsTimer = null;
  let pendingSettings = null;
  let pendingSettingsWaiters = [];

  function notify(document, meta = {}) {
    for (const listener of listeners) {
      try {
        listener({ document: cloneDocument(document), ...meta });
      } catch {
        // Observers must not change the outcome of an already committed write.
      }
    }
  }

  function readRaw(key) {
    if (!persistentStorage) return null;
    try {
      return persistentStorage.getItem(key);
    } catch (error) {
      persistentStorage = null;
      storageStatus = 'unavailable';
      throw new StorageUnavailableError(undefined, { cause: error });
    }
  }

  function parseDocument(serialized, source) {
    const parsed = safeParse(serialized);
    const migrated = migrateDocument(parsed, now());
    const result = validateDocument(migrated, { now: now(), quarantineInvalid: true });
    if (!result.value) {
      throw new StorageValidationError(`Could not validate ${source}.`, { issues: result.issues });
    }
    return { document: result.value, issues: result.issues };
  }

  function readDocument() {
    if (!persistentStorage) {
      if (memoryDocument) return { document: cloneDocument(memoryDocument), status: 'memory' };
      const fresh = createEmptyDocument(now());
      memoryDocument = fresh;
      return { document: cloneDocument(fresh), status: 'unavailable', writeBlocked: false };
    }

    let active;
    try {
      active = readRaw(DATA_KEY);
    } catch (error) {
      const fallback = memoryDocument ? cloneDocument(memoryDocument) : createEmptyDocument(now());
      return { document: fallback, status: 'unavailable', error, writeBlocked: false };
    }

    if (active === null) {
      const fresh = createEmptyDocument(now());
      memoryDocument = fresh;
      return { document: cloneDocument(fresh), status: 'fresh', writeBlocked: false };
    }

    try {
      const parsed = parseDocument(active, DATA_KEY);
      memoryDocument = parsed.document;
      return {
        document: cloneDocument(parsed.document),
        status: parsed.issues.length ? 'degraded' : 'loaded',
        issues: parsed.issues,
        activeSerialized: active,
        writeBlocked: false,
      };
    } catch (error) {
      try {
        const recoveryRaw = readRaw(RECOVERY_KEY);
        if (recoveryRaw !== null) {
          const recovery = parseDocument(recoveryRaw, RECOVERY_KEY);
          memoryDocument = recovery.document;
          return {
            document: cloneDocument(recovery.document),
            status: 'recovered',
            error,
            issues: recovery.issues,
            recoveredFrom: RECOVERY_KEY,
            writeBlocked: true,
          };
        }
      } catch {
        // The original active error is the actionable failure.
      }
      const fallback = createEmptyDocument(now());
      memoryDocument = fallback;
      return { document: fallback, status: 'degraded', error, writeBlocked: true };
    }
  }

  function writeDocument(next, expectedRevision, { recovery = 'previous' } = {}) {
    const currentResult = readDocument();
    const current = currentResult.document;
    if (currentResult.writeBlocked) {
      throw new StorageValidationError('Active storage must be recovered or replaced explicitly before writing.');
    }
    if (expectedRevision !== undefined && expectedRevision !== current.revision) {
      throw new StorageConflictError(undefined, {
        expectedRevision,
        actualRevision: current.revision,
      });
    }

    const validation = validateDocument(next, {
      now: now(),
      quarantineInvalid: false,
      strictUnknown: true,
    });
    if (!validation.value || validation.fatal.length) {
      throw new StorageValidationError('Document failed validation.', { issues: validation.issues });
    }

    const candidate = {
      ...validation.value,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      revision: current.revision + 1,
      updatedAt: now(),
    };
    const serialized = safeStringify(candidate);
    safeParse(serialized);

    if (!persistentStorage) {
      memoryDocument = candidate;
      notify(candidate, { source: 'memory' });
      return { document: cloneDocument(candidate), status: 'saved', persisted: false };
    }

    try {
      const previous = readRaw(DATA_KEY);
      const activeChanged = currentResult.activeSerialized === undefined
        ? previous !== null
        : previous !== currentResult.activeSerialized;
      if (activeChanged) {
        let actualRevision = current.revision + 1;
        try {
          actualRevision = previous === null
            ? current.revision + 1
            : parseDocument(previous, DATA_KEY).document.revision;
        } catch {
          // Keep the best available revision when the competing value is corrupt.
        }
        throw new StorageConflictError('Another tab changed the data before this write.', {
          expectedRevision: current.revision,
          actualRevision,
        });
      }
      const recoveryPayload = recovery === 'candidate' ? serialized : previous;
      if (recoveryPayload !== null) persistentStorage.setItem(RECOVERY_KEY, recoveryPayload);
      else persistentStorage.removeItem(RECOVERY_KEY);
      persistentStorage.setItem(DATA_KEY, serialized);
      const committed = readRaw(DATA_KEY);
      if (committed !== serialized) {
        let actualRevision = current.revision + 1;
        try {
          actualRevision = parseDocument(committed, DATA_KEY).document.revision;
        } catch {
          // Keep the best available revision when the competing value is corrupt.
        }
        throw new StorageConflictError('Another tab changed the data during this write.', {
          expectedRevision: candidate.revision,
          actualRevision,
        });
      }
      const verified = parseDocument(committed, DATA_KEY);
      if (verified.document.revision !== candidate.revision) {
        throw new StorageValidationError('Storage read-back revision did not match the commit.');
      }
      memoryDocument = verified.document;
      notify(verified.document, { source: 'local' });
      return { document: cloneDocument(verified.document), status: 'saved', persisted: true };
    } catch (error) {
      if (isQuotaError(error)) throw new StorageQuotaError(undefined, { cause: error });
      if (isUnavailableError(error)) {
        persistentStorage = null;
        storageStatus = 'unavailable';
        memoryDocument = candidate;
        notify(candidate, { source: 'memory' });
        return {
          document: cloneDocument(candidate),
          status: 'memory',
          persisted: false,
          error: new StorageUnavailableError(undefined, { cause: error }),
        };
      }
      throw error;
    }
  }

  async function update(mutator, { expectedRevision } = {}) {
    if (typeof mutator !== 'function') throw new StorageValidationError('update requires a function.');
    const currentResult = readDocument();
    if (currentResult.writeBlocked) {
      throw new StorageValidationError('Active storage must be recovered or replaced explicitly before updating.');
    }
    const baseRevision = currentResult.document.revision;
    if (expectedRevision !== undefined && expectedRevision !== baseRevision) {
      throw new StorageConflictError(undefined, {
        expectedRevision,
        actualRevision: baseRevision,
      });
    }
    const draft = cloneDocument(currentResult.document);
    const result = await mutator(draft);
    const next = result === undefined ? draft : result;
    return writeDocument(next, baseRevision);
  }

  async function clearAll({ expectedRevision } = {}) {
    const currentResult = readDocument();
    if (currentResult.writeBlocked) {
      throw new StorageValidationError('Active storage must be recovered or replaced explicitly before clearing.');
    }
    const baseRevision = currentResult.document.revision;
    if (expectedRevision !== undefined && expectedRevision !== baseRevision) {
      throw new StorageConflictError(undefined, {
        expectedRevision,
        actualRevision: baseRevision,
      });
    }
    const empty = createEmptyDocument(now());
    empty.revision = baseRevision;
    empty.migration = {
      legacyIndexedDbImported: true,
      legacyImportedAt: currentResult.document.migration.legacyImportedAt,
    };
    return writeDocument(empty, baseRevision, { recovery: 'candidate' });
  }

  async function commitPendingSettings() {
    if (!pendingSettings) return null;
    const settingsToSave = pendingSettings;
    const waiters = pendingSettingsWaiters;
    pendingSettings = null;
    pendingSettingsWaiters = [];
    pendingSettingsTimer = null;
    try {
      const result = await update((draft) => {
        const validation = validateSettings({ ...draft.settings, ...settingsToSave });
        if (validation.fatal.length) {
          throw new StorageValidationError('Setting failed validation.', { issues: validation.issues });
        }
        draft.settings = validation.value;
        for (const unknown of validation.unknown) {
          draft.quarantine.push({
            original: { key: unknown.key, value: unknown.value },
            reason: 'unrecognized setting',
            detectedAt: now(),
          });
        }
        return draft;
      });
      for (const waiter of waiters) waiter.resolve(result);
      return result;
    } catch (error) {
      pendingSettings = { ...settingsToSave, ...(pendingSettings || {}) };
      for (const waiter of waiters) waiter.reject(error);
      throw error;
    }
  }

  const adapter = {
    async load() {
      const result = readDocument();
      return {
        document: cloneDocument(result.document),
        status: result.status,
        issues: result.issues || [],
        error: result.error || null,
        storageStatus,
        writeBlocked: result.writeBlocked === true,
      };
    },

    async save(document, { expectedRevision } = {}) {
      const candidate = cloneDocument(document);
      const revision = expectedRevision ?? candidate?.revision;
      if (!Number.isSafeInteger(revision) || revision < 0) {
        throw new StorageValidationError('save requires a document revision or expectedRevision.');
      }
      return writeDocument(candidate, revision);
    },

    update,

    clearAll,

    async remove(collection, id, { expectedRevision } = {}) {
      if (collection !== 'walks' || typeof id !== 'string' || !id) {
        throw new StorageValidationError('Only a walk can be removed by ID.');
      }
      return update((draft) => {
        draft.walks = draft.walks.filter((walk) => walk.id !== id);
        return draft;
      }, { expectedRevision });
    },

    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      const handleStorage = (event) => {
        if (event.key !== DATA_KEY) return;
        if (!event.newValue) {
          try {
            listener({ document: null, source: 'external', error: new StorageUnavailableError('Active storage was removed in another tab.') });
          } catch {
            // A subscriber cannot affect other tabs or the storage adapter.
          }
          return;
        }
        try {
          const parsed = parseDocument(event.newValue, DATA_KEY);
          if (!memoryDocument || parsed.document.revision > memoryDocument.revision) {
            memoryDocument = parsed.document;
            try {
              listener({ document: cloneDocument(parsed.document), source: 'external', issues: parsed.issues });
            } catch {
              // A subscriber cannot affect other tabs or the storage adapter.
            }
          }
        } catch (error) {
          try {
            listener({ document: null, source: 'external', error });
          } catch {
            // A subscriber cannot affect other tabs or the storage adapter.
          }
        }
      };
      events?.addEventListener?.('storage', handleStorage);
      return () => {
        listeners.delete(listener);
        events?.removeEventListener?.('storage', handleStorage);
      };
    },

    async export() {
      const result = readDocument();
      return {
        serialized: safeStringify(result.document),
        document: cloneDocument(result.document),
        status: result.status,
      };
    },

    async import(payload, { mode = 'merge' } = {}) {
      if (mode !== 'merge' && mode !== 'replace') {
        throw new StorageValidationError('Import mode must be merge or replace.');
      }
      const incoming = typeof payload === 'string' ? safeParse(payload) : payload;
      const migrated = migrateDocument(incoming, now());
      const validation = validateDocument(migrated, { now: now(), quarantineInvalid: true });
      if (!validation.value || validation.fatal.length) {
        throw new StorageValidationError('Import failed validation.', { issues: validation.issues });
      }

      const currentResult = readDocument();
      if (mode === 'replace' && currentResult.writeBlocked) {
        const replacement = {
          ...validation.value,
          revision: 1,
          updatedAt: now(),
        };
        const serialized = safeStringify(replacement);
        if (!persistentStorage) {
          memoryDocument = replacement;
          notify(replacement, { source: 'memory' });
          return { document: cloneDocument(replacement), status: 'saved', persisted: false };
        }
        try {
          persistentStorage.setItem(RECOVERY_KEY, serialized);
          persistentStorage.setItem(DATA_KEY, serialized);
          const committed = readRaw(DATA_KEY);
          const verified = parseDocument(committed, DATA_KEY);
          memoryDocument = verified.document;
          notify(verified.document, { source: 'local' });
          return { document: cloneDocument(verified.document), status: 'saved', persisted: true };
        } catch (error) {
          if (isQuotaError(error)) throw new StorageQuotaError(undefined, { cause: error });
          if (isUnavailableError(error)) {
            persistentStorage = null;
            storageStatus = 'unavailable';
            memoryDocument = replacement;
            notify(replacement, { source: 'memory' });
            return {
              document: cloneDocument(replacement),
              status: 'memory',
              persisted: false,
              error: new StorageUnavailableError(undefined, { cause: error }),
            };
          }
          throw error;
        }
      }

      if (currentResult.writeBlocked) {
        throw new StorageValidationError('Use replace import to recover corrupted active storage.');
      }
      const next = mode === 'replace'
        ? validation.value
        : mergeDocuments(currentResult.document, validation.value);
      return writeDocument(next, currentResult.document.revision, {
        recovery: mode === 'replace' ? 'candidate' : 'previous',
      });
    },

    async saveSetting(key, value, { debounce = false } = {}) {
      if (!PERSISTED_SETTING_KEYS.includes(key)) {
        throw new StorageValidationError(`Unknown setting '${key}'.`);
      }
      if (!debounce) {
        await adapter.flush();
        return update((draft) => {
          const validation = validateSettings({ ...draft.settings, [key]: value });
          if (validation.fatal.length) {
            throw new StorageValidationError('Setting failed validation.', { issues: validation.issues });
          }
          draft.settings = validation.value;
          return draft;
        });
      }

      pendingSettings = { ...(pendingSettings || {}), [key]: value };
      clearTimeout(pendingSettingsTimer);
      pendingSettingsTimer = setTimeout(() => {
        commitPendingSettings().catch(() => {});
      }, debounceMs);
      return new Promise((resolve, reject) => {
        pendingSettingsWaiters.push({ resolve, reject });
      });
    },

    async flush() {
      if (!pendingSettings) {
        clearTimeout(pendingSettingsTimer);
        pendingSettingsTimer = null;
        return null;
      }
      clearTimeout(pendingSettingsTimer);
      pendingSettingsTimer = null;
      return commitPendingSettings();
    },
  };

  return adapter;
}

export { mergeDocuments };

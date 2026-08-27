import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DATA_KEY,
  RECOVERY_KEY,
  createEmptyDocument,
  createLocalStorageAdapter,
  createWalkRecord,
  initializeLocalStorageDataLayer,
  mergeLegacyData,
  readLegacyIndexedDb,
  safeParse,
  safeStringify,
  StorageConflictError,
  StorageQuotaError,
  StorageValidationError,
  validateDocument,
} from './index.js';

const FIXED_NOW = 1_750_000_000_000;

class MemoryStorage {
  constructor() {
    this.values = new Map();
    this.failure = null;
  }

  getItem(key) {
    this.#throwIfConfigured('getItem', key);
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.#throwIfConfigured('setItem', key);
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.#throwIfConfigured('removeItem', key);
    this.values.delete(key);
  }

  failOnce(method, key, error) {
    this.failure = { method, key, error };
  }

  #throwIfConfigured(method, key) {
    if (this.failure?.method === method && this.failure?.key === key) {
      const error = this.failure.error;
      this.failure = null;
      throw error;
    }
  }
}

class MemoryEvents {
  constructor() {
    this.listeners = new Set();
  }

  addEventListener(type, listener) {
    if (type === 'storage') this.listeners.add(listener);
  }

  removeEventListener(type, listener) {
    if (type === 'storage') this.listeners.delete(listener);
  }

  dispatch(event) {
    for (const listener of this.listeners) listener(event);
  }
}

function validWalk(overrides = {}) {
  return {
    id: 'walk-1',
    date: '2025-06-15',
    startTime: 1_750_000_000_000,
    endTime: 1_750_001_800_000,
    distance: 2_000,
    duration: 1_800_000,
    steps: 2_500,
    calories: 120,
    averageSpeed: 1.11,
    averagePace: 15,
    maxSpeed: 2,
    elevationGain: 15,
    elevationLoss: 10,
    points: [
      { lat: 22.5726, lng: 88.3639, timestamp: 1_750_000_000_000, accuracy: 8 },
      { lat: 22.573, lng: 88.3642, timestamp: 1_750_000_010_000, accuracy: 7 },
    ],
    altitudePoints: [{ distance: 0, altitude: 10 }, { distance: 2_000, altitude: 15 }],
    createdAt: 1_750_001_800_000,
    updatedAt: 1_750_001_800_000,
    ...overrides,
  };
}

function adapterWith(storage = new MemoryStorage(), events = new MemoryEvents()) {
  return {
    storage,
    events,
    adapter: createLocalStorageAdapter({ storage, events, now: () => FIXED_NOW, debounceMs: 10 }),
  };
}

test('fresh load returns an explicit empty document', async () => {
  const { adapter } = adapterWith();
  const result = await adapter.load();
  assert.equal(result.status, 'fresh');
  assert.equal(result.document.revision, 0);
  assert.deepEqual(result.document.walks, []);
  assert.equal(result.document.settings.dailyStepGoal, 10_000);
});

test('write validates, increments revision, and commits one active document', async () => {
  const { adapter, storage } = adapterWith();
  const fresh = (await adapter.load()).document;
  fresh.walks.push(validWalk());
  const result = await adapter.save(fresh, { expectedRevision: 0 });

  assert.equal(result.persisted, true);
  assert.equal(result.document.revision, 1);
  assert.equal(safeParse(storage.getItem(DATA_KEY)).walks[0].distance, 2_000);
  assert.equal(storage.getItem(RECOVERY_KEY), null);
});

test('ordinary writes reject malformed walks instead of dropping or zeroing them', async () => {
  const { adapter, storage } = adapterWith();
  const fresh = (await adapter.load()).document;
  fresh.walks.push(validWalk({ distance: Number.NaN }));

  await assert.rejects(
    () => adapter.save(fresh, { expectedRevision: 0 }),
    (error) => error instanceof StorageValidationError && error.issues.some((issue) => issue.includes('distance')),
  );
  assert.equal(storage.getItem(DATA_KEY), null);
});

test('loads valid siblings and quarantines a corrupt stored walk', async () => {
  const storage = new MemoryStorage();
  const document = createEmptyDocument(FIXED_NOW);
  document.walks = [validWalk(), validWalk({ id: 'bad', distance: 'broken' })];
  storage.setItem(DATA_KEY, JSON.stringify(document));

  const { adapter } = adapterWith(storage);
  const result = await adapter.load();
  assert.equal(result.status, 'degraded');
  assert.equal(result.document.walks.length, 1);
  assert.equal(result.document.walks[0].id, 'walk-1');
  assert.equal(result.document.quarantine.length, 1);
  assert.match(result.document.quarantine[0].reason, /distance/);
});

test('quarantines invalid nested points while preserving the valid walk', async () => {
  const storage = new MemoryStorage();
  const document = createEmptyDocument(FIXED_NOW);
  document.walks = [validWalk({
    points: [
      validWalk().points[0],
      { lat: 999, lng: 88, timestamp: FIXED_NOW },
    ],
  })];
  storage.setItem(DATA_KEY, JSON.stringify(document));

  const result = await adapterWith(storage).adapter.load();
  assert.equal(result.document.walks.length, 1);
  assert.equal(result.document.walks[0].points.length, 1);
  assert.equal(result.document.quarantine.length, 1);
  assert.equal(result.document.quarantine[0].kind, 'point');
});

test('preserves unknown root and walk fields in quarantine', async () => {
  const storage = new MemoryStorage();
  const document = createEmptyDocument(FIXED_NOW);
  document.futureRoot = { enabled: true };
  document.walks = [validWalk({ futureMetric: 42 })];
  storage.setItem(DATA_KEY, JSON.stringify(document));

  const result = await adapterWith(storage).adapter.load();
  assert.equal(result.document.walks.length, 1);
  assert.equal(result.document.quarantine.length, 2);
  assert.ok(result.document.quarantine.some((item) => item.reason === 'unrecognized document field'));
  assert.ok(result.document.quarantine.some((item) => item.reason === 'unrecognized walk field'));
});

test('recovers from the last known-good document when active JSON is corrupt', async () => {
  const storage = new MemoryStorage();
  const recovery = createEmptyDocument(FIXED_NOW);
  recovery.revision = 4;
  recovery.walks = [validWalk()];
  storage.setItem(DATA_KEY, '{broken');
  storage.setItem(RECOVERY_KEY, JSON.stringify(recovery));

  const result = await adapterWith(storage).adapter.load();
  assert.equal(result.status, 'recovered');
  assert.equal(result.writeBlocked, true);
  assert.equal(result.document.revision, 4);
  assert.equal(result.document.walks.length, 1);
  assert.equal(storage.getItem(DATA_KEY), '{broken');
});

test('replace import explicitly repairs corrupt active storage', async () => {
  const storage = new MemoryStorage();
  storage.setItem(DATA_KEY, '{broken');
  const { adapter } = adapterWith(storage);
  const replacement = createEmptyDocument(FIXED_NOW);
  replacement.walks = [validWalk()];

  const result = await adapter.import(replacement, { mode: 'replace' });
  assert.equal(result.persisted, true);
  assert.equal(result.document.revision, 1);
  assert.equal(safeParse(storage.getItem(DATA_KEY)).walks.length, 1);
  assert.equal(safeParse(storage.getItem(RECOVERY_KEY)).walks.length, 1);
});

test('stale revisions fail without overwriting newer data', async () => {
  const { adapter, storage } = adapterWith();
  const first = await adapter.update((draft) => {
    draft.settings.theme = 'light';
  });
  const committed = storage.getItem(DATA_KEY);

  await assert.rejects(
    () => adapter.update((draft) => {
      draft.settings.unit = 'mi';
    }, { expectedRevision: 0 }),
    (error) => error instanceof StorageConflictError
      && error.expectedRevision === 0
      && error.actualRevision === 1,
  );
  assert.equal(storage.getItem(DATA_KEY), committed);
  assert.equal(first.document.settings.theme, 'light');
});

test('save uses the candidate revision when expectedRevision is omitted', async () => {
  const { adapter, storage } = adapterWith();
  const stale = (await adapter.load()).document;
  await adapter.update((draft) => {
    draft.settings.theme = 'light';
  });
  const active = storage.getItem(DATA_KEY);
  stale.settings.unit = 'mi';

  await assert.rejects(() => adapter.save(stale), StorageConflictError);
  assert.equal(storage.getItem(DATA_KEY), active);
});

test('a throwing subscriber cannot change a committed write result', async () => {
  const { adapter } = adapterWith();
  adapter.subscribe(() => {
    throw new Error('observer failed');
  });
  const result = await adapter.update((draft) => {
    draft.settings.theme = 'light';
  });
  assert.equal(result.persisted, true);
  assert.equal(result.document.revision, 1);
});

test('cross-tab subscriber accepts only newer validated revisions', async () => {
  const storage = new MemoryStorage();
  const events = new MemoryEvents();
  const { adapter } = adapterWith(storage, events);
  const received = [];
  const unsubscribe = adapter.subscribe((event) => received.push(event));

  const document = createEmptyDocument(FIXED_NOW);
  document.revision = 2;
  const serialized = JSON.stringify(document);
  events.dispatch({ key: DATA_KEY, newValue: serialized });
  events.dispatch({ key: DATA_KEY, newValue: JSON.stringify({ ...document, revision: 1 }) });

  assert.equal(received.length, 1);
  assert.equal(received[0].source, 'external');
  assert.equal(received[0].document.revision, 2);
  unsubscribe();
});

test('quota failure leaves the active document unchanged', async () => {
  const { adapter, storage } = adapterWith();
  const first = await adapter.update((draft) => {
    draft.settings.theme = 'light';
  });
  const active = storage.getItem(DATA_KEY);
  const quotaError = new Error('full');
  quotaError.name = 'QuotaExceededError';
  storage.failOnce('setItem', DATA_KEY, quotaError);

  await assert.rejects(
    () => adapter.update((draft) => {
      draft.settings.unit = 'mi';
    }, { expectedRevision: first.document.revision }),
    StorageQuotaError,
  );
  assert.equal(storage.getItem(DATA_KEY), active);
});

test('unavailable storage degrades to honest in-memory persistence', async () => {
  const storage = new MemoryStorage();
  const securityError = new Error('blocked');
  securityError.name = 'SecurityError';
  storage.failOnce('getItem', DATA_KEY, securityError);
  const { adapter } = adapterWith(storage);

  const initial = await adapter.load();
  assert.equal(initial.status, 'unavailable');
  const saved = await adapter.update((draft) => {
    draft.settings.theme = 'light';
  });
  assert.equal(saved.persisted, false);
  assert.equal(saved.document.settings.theme, 'light');
  assert.equal((await adapter.load()).status, 'memory');
});

test('debounced settings coalesce and flush all pending fields', async () => {
  const { adapter } = adapterWith();
  const weightPromise = adapter.saveSetting('weightKg', 80, { debounce: true });
  const unitPromise = adapter.saveSetting('unit', 'mi', { debounce: true });
  const flushed = await adapter.flush();
  const [weightResult, unitResult] = await Promise.all([weightPromise, unitPromise]);

  assert.equal(flushed.document.revision, 1);
  assert.equal(weightResult.document.settings.weightKg, 80);
  assert.equal(unitResult.document.settings.unit, 'mi');
});

test('export/import round-trip preserves valid data', async () => {
  const source = adapterWith();
  await source.adapter.update((draft) => {
    draft.walks.push(validWalk());
    draft.settings.theme = 'light';
  });
  const exported = await source.adapter.export();

  const target = adapterWith();
  const imported = await target.adapter.import(exported.serialized, { mode: 'replace' });
  assert.equal(imported.document.walks.length, 1);
  assert.equal(imported.document.settings.theme, 'light');
  assert.equal(imported.document.walks[0].id, 'walk-1');
});

test('safe serialization rejects unsupported values and circular structures', () => {
  assert.throws(() => safeStringify({ value: Number.POSITIVE_INFINITY }), StorageValidationError);
  const circular = {};
  circular.self = circular;
  assert.throws(() => safeStringify(circular), StorageValidationError);
});

test('createWalkRecord supplies a stable ID and rejects non-finite output', () => {
  const result = createWalkRecord({
    ...validWalk(),
    id: undefined,
    createdAt: undefined,
    updatedAt: undefined,
  }, {
    now: () => FIXED_NOW,
    idFactory: () => 'stable-id',
  });
  assert.equal(result.walk.id, 'stable-id');
  assert.equal(result.walk.createdAt, FIXED_NOW);

  assert.throws(
    () => createWalkRecord(validWalk({ calories: Number.NaN })),
    StorageValidationError,
  );
});

test('legacy importer is read-only, deterministic, idempotent, and quarantines bad rows', async () => {
  const sourceWalks = [
    { ...validWalk(), id: 7, syncedWithCloud: true },
    { ...validWalk(), id: 8, distance: 'bad' },
  ];
  const sourceSettings = [{ key: 'unit', value: 'mi' }, { key: 'xp', value: 100 }];
  const before = JSON.stringify({ sourceWalks, sourceSettings });
  const database = {
    walks: { toArray: async () => sourceWalks },
    settings: { toArray: async () => sourceSettings },
  };

  const legacy = await readLegacyIndexedDb({ database });
  assert.equal(legacy.walks.length, 1);
  assert.equal(legacy.walks[0].id, 'legacy-7');
  assert.equal(legacy.settings.unit, 'mi');
  assert.ok(legacy.quarantine.length >= 1);
  assert.equal(JSON.stringify({ sourceWalks, sourceSettings }), before);

  const empty = createEmptyDocument(FIXED_NOW);
  const once = mergeLegacyData(empty, legacy, FIXED_NOW);
  const twice = mergeLegacyData(once, legacy, FIXED_NOW + 1);
  assert.equal(twice.walks.length, 1);
});

test('initializer copies legacy records and marks migration complete', async () => {
  const storage = new MemoryStorage();
  const database = {
    walks: { toArray: async () => [{ ...validWalk(), id: 3 }] },
    settings: { toArray: async () => [{ key: 'theme', value: 'light' }] },
  };
  const initialized = await initializeLocalStorageDataLayer({
    database,
    adapterOptions: { storage, events: new MemoryEvents(), now: () => FIXED_NOW },
  });

  assert.equal(initialized.migration, 'imported');
  assert.equal(initialized.document.walks[0].id, 'legacy-3');
  assert.equal(initialized.document.settings.theme, 'light');
  assert.equal(initialized.document.migration.legacyIndexedDbImported, true);
});

test('future schemas fail honestly instead of being downgraded', () => {
  const document = createEmptyDocument(FIXED_NOW);
  document.schemaVersion = 999;
  const validation = validateDocument(document);
  assert.equal(validation.value, null);
  assert.match(validation.fatal[0], /unsupported schemaVersion/);
});

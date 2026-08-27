# Phase 4 Data-Layer Specification - WalkTracker

## Status

This document specifies and records the isolated Phase 4 persistence implementation. It is not wired into the existing pages yet. Feature integration belongs to the later refactor phase.

The governing choice is browser `localStorage` only. There is no backend, remote database, hosted authentication, or cloud-sync runtime in this layer.

## Public API

`src/infrastructure/storage/index.js` exports the storage primitives and the factory:

```js
const storage = createLocalStorageAdapter(options);

await storage.load();
await storage.save(document, { expectedRevision });
await storage.update(mutator, { expectedRevision });
await storage.remove('walks', id, { expectedRevision });
const unsubscribe = storage.subscribe(listener);
await storage.export();
await storage.import(payload, { mode: 'merge' | 'replace' });
```

The adapter also exposes `saveSetting(key, value, { debounce })` and `flush()` as convenience methods for the settings facade. They are not alternate persistence paths.

Every operation returns an explicit result or throws one of the typed `StorageError` subclasses:

| Code | Meaning | UI consequence |
|------|---------|----------------|
| `unavailable` | Browser storage is blocked or inaccessible | Show that the session is memory-only |
| `quota` | The browser rejected a write because storage is full | Keep the old document; offer export and retry |
| `conflict` | Expected revision is stale | Reload the newer snapshot before retrying |
| `invalid` | Candidate or imported data violates the contract | Do not commit it; show the validation/recovery action |

## Storage Keys and Document

Only `localStorageAdapter.js` accesses the browser storage API. It owns exactly two keys:

- `walktracker:data`: active document
- `walktracker:recovery`: last-known-good recovery payload

The active document shape is:

```js
{
  schemaVersion: 1,
  revision: 0,
  updatedAt: 0,
  settings: {
    weightKg: 70,
    heightCm: 170,
    dailyStepGoal: 10000,
    dailyDistanceGoal: 5000,
    dailyDurationGoal: 45,
    dailyCaloriesGoal: 300,
    unit: 'km',
    theme: 'dark',
    autoPause: true,
    autoPauseSpeed: 0.3,
    gpsAccuracyThreshold: 30,
    voiceFeedback: false,
    onboardingComplete: false,
    unlockedAchievements: [],
    xp: 0
  },
  walks: [],
  quarantine: [],
  migration: {
    legacyIndexedDbImported: false,
    legacyImportedAt: null
  }
}
```

Derived values such as today's totals, streaks, records, and chart data are deliberately absent. They must be recalculated from `walks` by domain functions so a stale aggregate cannot become a second source of truth. `src/domain/analytics/derivedValues.js` provides the guarded aggregate/goal-progress pipeline for Phase 6 feature integration.

Walk IDs are stable strings generated with `crypto.randomUUID()` when available. The legacy importer maps old numeric IDs to `legacy-{id}` and includes the source identity so repeated migration cannot create duplicates.

## Read Pipeline

1. Read the active string inside a guarded operation.
2. Parse with `safeParse`; malformed JSON never reaches a component.
3. Apply sequential migrations in `migrations.js`; future versions must add an explicit `N -> N + 1` function.
4. Validate the document shape, settings, timestamps, numbers, GPS points, and IDs.
5. Keep valid walk siblings; copy invalid rows to `quarantine` in a JSON-safe representation.
6. Return a status of `fresh`, `loaded`, `degraded`, `recovered`, `memory`, or `unavailable`.

An active document with quarantined rows is usable and reports `degraded`. If the active payload cannot be parsed or validated at document level, the adapter tries `walktracker:recovery`. A recovered document is returned with writes blocked until a deliberate `replace` import repairs the active payload. If neither payload is usable, the adapter returns an explicit degraded empty snapshot; it does not silently overwrite the broken active value.

## Write Pipeline

1. Read the current document and its revision.
2. Require the caller's expected revision. `save()` defaults to the candidate document's own revision, preventing an omitted option from becoming an implicit overwrite.
3. Clone the candidate and apply the mutation.
4. Validate strictly. Invalid numeric values, malformed required timestamps, invalid settings, invalid nested points, circular structures, functions, symbols, `undefined`, `NaN`, and infinities are rejected.
5. Increment the revision and set `updatedAt`.
6. Run safe serialization and a parse round-trip before committing.
7. Copy the previous active payload to the recovery key.
8. Replace the active key with one serialized document.
9. Read back and validate the committed revision.
10. Notify subscribers. Observer exceptions are isolated from the committed write.

There is no claim of a multi-key transaction: `localStorage` does not provide one. The single active document gives one coherent commit boundary; the recovery key is a best-effort previous snapshot. If a storage operation fails, the previous active value is never intentionally removed and the error remains visible to the caller.

Completed walks must use an immediate update/commit before navigation. Debouncing is limited to rapid settings edits. `flush()` is available for page lifecycle handlers.

## Cross-Tab Protocol

Each successful active-key write causes the browser's `storage` event in other same-origin tabs. Subscribers:

- accept only a valid document with a revision newer than their in-memory snapshot;
- replace their snapshot with the validated document;
- report an external removal or malformed event explicitly;
- never let a listener exception alter the source tab's write result.

Writers compare revisions immediately before commit. A stale writer receives `StorageConflictError`; it cannot silently replace a newer document. This is cooperative cross-tab consistency, not a distributed lock.

## Import and Export

Export serializes the current validated document, including schema version, settings, walks, quarantine metadata, and migration state. It is suitable for a user-controlled backup and bug reproduction.

Import accepts either the serialized JSON string or an object. It runs the same migration and validation pipeline as normal reads:

- `merge` keeps the current document and replaces a duplicate walk only when the incoming `updatedAt` is newer;
- `replace` intentionally replaces the complete dataset after explicit user action;
- a corrupt active document can be repaired only with `replace` import;
- invalid imported rows are quarantined rather than contributing false metric values;
- the result reports the committed document and revision.

## Legacy IndexedDB Import

`legacyIndexedDbImporter.js` is the only compatibility boundary for the current Dexie database. It accepts a database-like object so tests do not need a browser database. In production, the composition root may pass the legacy `WalkTrackerDB` instance during startup.

The importer:

1. Reads `walks.toArray()` and `settings.toArray()`.
2. Never calls `clear`, `delete`, `put`, or `update` on the legacy database.
3. Converts numeric IDs to deterministic string IDs.
4. Validates every walk and setting.
5. Quarantines unreadable rows and repair metadata.
6. Merges only missing legacy walks into the new document.
7. Marks `legacyIndexedDbImported` only after the new document commits and reads back.

The project owner confirmed there are no Firebase-only records to recover. Firebase code is therefore not imported or replaced in this phase; its later removal is a separate refactor step and does not delete any remote collection.

## Validation Policy

Read validation is repair-oriented for recoverable legacy omissions:

- missing optional metrics become explicit zero defaults and produce a warning;
- missing route arrays become empty arrays and produce a warning;
- an invalid date can be derived from a valid `startTime` on read;
- invalid individual GPS/altitude points are omitted and reported;
- invalid identity, timestamps, ordering, numeric values, or container types quarantine the entire walk.

Write validation is strict. A new candidate cannot rely on repair to hide malformed user-generated data. This distinction prevents corrupted historical input from crashing the UI while ensuring new writes never manufacture a plausible-looking zero.

## Test Coverage

`src/infrastructure/storage/storage.test.js` uses Node's built-in test runner and a fake in-memory storage/event implementation. It covers:

- fresh empty state;
- valid write, revision increment, and read-back;
- strict rejection of `NaN` and invalid candidates;
- valid sibling loading with corrupt-row quarantine;
- unknown-field quarantine without data loss;
- active-payload recovery;
- explicit replace import repair;
- stale revision conflict with unchanged active data;
- newer-only cross-tab event handling;
- quota failure preserving the active value;
- blocked storage degrading to memory-only status;
- debounced settings coalescing and flush;
- export/import round-trip;
- circular and non-finite serialization rejection;
- stable ID creation;
- read-only, deterministic, idempotent legacy import;
- initializer migration completion;
- future-schema rejection.

The derived-value tests additionally cover malformed arithmetic inputs, zero goals, clamping above 100%, and one consistent daily snapshot.

Run the suite with `npm test`. Run `npx eslint src/infrastructure/storage --ext .js` for the isolated lint check.

## Known Limits

- `localStorage` quota is browser-dependent and synchronous; the adapter measures/handles failure but does not promise unlimited route history.
- A tab can still be closed between application-level operations; completed-walk commits happen before navigation, but no browser API can guarantee recovery after power loss during a storage write.
- Cross-tab revision checks prevent normal stale overwrites but do not provide a distributed lock.
- Legacy Firebase data is explicitly out of scope after the owner's confirmation that no remote-only data exists.
- Existing UI still uses Dexie/Firebase and has not been migrated. This Phase 4 layer is not yet the application's active source of truth.

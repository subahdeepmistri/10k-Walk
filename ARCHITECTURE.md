# System Architecture Document - WalkTracker

## 1. Decision Summary

WalkTracker remains a static React application. It has no backend, hosted authentication, remote database, or application API. All user records are persisted in browser `localStorage` through one adapter. This is a hard product constraint, not a recommendation.

The current implementation conflicts with that target: `src/lib/db.js` uses Dexie/IndexedDB, while `src/stores/authStore.js`, `src/lib/firebase.js`, and `src/lib/cloudSync.js` implement Firebase authentication and Firestore synchronization. These files are legacy migration inputs, not components of the target runtime. Existing local records must be copied forward before Dexie is removed. Remote records must not be deleted; removal of cloud behavior is gated on establishing whether any user has remote-only data.

## 2. Recommended Stack

| Concern | Technology | Reason |
|---------|------------|--------|
| Application | React 19, React Router, Vite 8 | Preserve the existing runnable stack |
| UI state | Zustand 5 | Appropriate for the live tracking session and app status |
| Durable data | Browser `localStorage` behind one adapter | Required boundary, native cross-tab events, replaceable contract |
| Maps | React Leaflet and OpenStreetMap | Preserve current route visualization |
| Charts | Recharts | Preserve current analytics rendering |
| Styling | Tailwind CSS 4 and CSS custom properties | Preserve the current visual system |
| Offline shell | vite-plugin-pwa | Static assets and map-tile caching only |
| Backend, database, auth | None | Explicitly outside scope |

The storage interface is asynchronous even though `localStorage` is synchronous. This prevents feature code from depending on the implementation detail and lets a future API adapter satisfy the same contract.

## 3. Target Layers

```text
src/
|-- app/                         # Composition root, routes, startup, global error boundary
|   |-- App.jsx
|   |-- main.jsx
|   |-- routes.jsx
|   `-- bootstrap.js
|-- domain/                      # Pure JavaScript; no React or browser globals
|   |-- models/                  # Walk, settings, storage-document invariants
|   |-- tracking/                # GPS smoothing, distance, pace, calories, steps
|   |-- analytics/               # Aggregates, streak, weekly activity, records, charts
|   `-- achievements/            # Badge rules and level calculation
|-- infrastructure/              # Browser and legacy adapters
|   |-- storage/
|   |   |-- storagePort.js       # load/save/update/remove/subscribe/export/import contract
|   |   |-- localStorageAdapter.js # Sole direct localStorage access
|   |   |-- documentSchema.js    # Current schema, validation, defaults
|   |   |-- migrations.js        # Sequential document migrations
|   |   |-- serialization.js     # Safe stringify/parse and unsupported-value checks
|   |   |-- recovery.js          # Last-known-good document and quarantine handling
|   |   `-- legacyIndexedDbImporter.js # Read-only one-time Dexie import
|   |-- geolocation/             # Geolocation API adapter
|   `-- wakeLock/                # Wake Lock API adapter
|-- features/                    # Vertical UI slices
|   |-- dashboard/               # Home page, activity view model, dashboard components
|   |-- tracking/                # Track page, session store, map and controls
|   |-- history/                 # Stats, history list, summary, share
|   |-- achievements/            # Achievement page and view model
|   |-- settings/                # Preferences, goals, data ownership controls
|   `-- onboarding/              # First-run flow
|-- shared/
|   |-- components/              # Card, ProgressRing, navigation, status/error UI
|   |-- formatting/              # Display-only formatters
|   |-- hooks/                   # Reusable React/browser integration hooks
|   `-- constants/               # Navigation and display constants
`-- index.css
```

This structure is deliberately smaller than a full enterprise clean-architecture template. Plain objects and functions are sufficient; separate entity classes, DTO classes, mapper classes, and interface classes would add ceremony without improving this JavaScript application.

## 4. Dependency Rules

| Layer | May import | Must not import |
|-------|------------|-----------------|
| `domain` | Other domain modules | React, Zustand, `window`, `localStorage`, Leaflet, Recharts |
| `infrastructure` | Domain validation and models | Feature components or feature stores |
| `shared` | Domain values and other shared modules | Feature modules, storage implementation |
| `features` | Domain, shared, infrastructure public ports | `window.localStorage`, legacy Dexie/Firebase files, other feature internals |
| `app` | Public entry points from all layers | Private implementation modules when a public entry point exists |

Only `src/infrastructure/storage/localStorageAdapter.js` may call `localStorage.getItem`, `setItem`, or `removeItem`. The legacy IndexedDB importer may access IndexedDB only for the one-time non-destructive migration. Components never know which persistence technology is active.

## 5. State Ownership

| Data | Authoritative source | In-memory representation |
|------|----------------------|--------------------------|
| Completed walks | Versioned storage document | Read model in feature stores/hooks |
| Settings, goals, XP, unlocked badges | Versioned storage document | `userStore` snapshot |
| Current tracking session | Tracking Zustand store | Not durable until a walk save succeeds |
| Today totals, streak, records, charts | Domain functions over completed walks | Derived on read; never persisted as competing truth |
| Loading/error/save status | Feature/application stores | Ephemeral UI state |
| Route | React Router | URL |

The tracking store must not become a second durable database. The Home and Track pages must consume one shared `aggregateWalks` function rather than duplicate reducers. The rendered timer and saved duration must use the same elapsed-time calculation.

## 6. Storage Contract

The application-facing port exposes:

```js
load()
save(document, { expectedRevision })
update(mutator, { expectedRevision })
remove(kind, id, { expectedRevision })
subscribe(listener)
export()
import(payload, options)
```

All methods return promises and result objects. Expected failures such as unavailable storage, quota exhaustion, stale revisions, validation failures, or partial import are represented explicitly rather than swallowed.

### 6.1 Stored Document

```js
{
  schemaVersion: 1,
  revision: 0,
  updatedAt: 0,
  settings: { /* validated settings */ },
  walks: [ /* validated walk records with stable string UUIDs */ ],
  quarantine: [ /* original value, reason, detectedAt */ ],
  migration: {
    legacyIndexedDbImported: false,
    legacyImportedAt: null
  }
}
```

Storage keys:

| Key | Purpose |
|-----|---------|
| `walktracker:data` | Active, validated document |
| `walktracker:recovery` | Previous last-known-good active payload |

No feature-specific key is allowed. A single document gives settings and walks one revision and prevents readers from observing mismatched partial snapshots.

### 6.2 Commit Protocol

1. Read and validate the active document.
2. Verify `expectedRevision` when supplied.
3. Apply the mutation to a clone.
4. Increment `revision` and update `updatedAt`.
5. Validate every field and record.
6. Reject `undefined`, non-finite numbers, functions, symbols, and circular structures.
7. Serialize and parse the candidate back before touching active storage.
8. Preserve the previous active payload in `walktracker:recovery`.
9. Commit the candidate with one `setItem` call.
10. Read back and verify the committed revision.

There is no true multi-key transaction in `localStorage`; the architecture does not claim otherwise. The single active-document write is indivisible at the API level, and the recovery payload protects against malformed candidate generation. If `setItem` throws, the prior active document remains authoritative and the UI reports that the new data was not saved.

Debouncing applies to rapid settings edits, not completed-walk commits. A completed walk is committed immediately before navigation to its summary. Pending debounced settings writes expose `flush()` and are flushed on `visibilitychange`, `pagehide`, and cleanup where possible.

### 6.3 Validation and Recovery

Storage is untrusted input. Every normal load, migration, and import uses the same validation pipeline. Recoverable omissions receive documented defaults. An item whose identity or essential timestamps cannot be recovered is copied verbatim into `quarantine`; valid siblings remain available.

If the active payload cannot be parsed, the adapter validates `walktracker:recovery`. If recovery succeeds, it returns that snapshot with a recovery status and does not silently erase the bad active payload. If neither is readable, it returns an explicit empty document plus an error status; the UI must distinguish this from a normal first run.

### 6.4 Cross-Tab Consistency

Each write uses an expected revision. A stale writer receives a conflict result and may reload then retry its mutation. Other tabs subscribe to the `storage` event for `walktracker:data`, validate the new document, and replace their snapshots only when its revision is newer. The source tab updates itself from the successful save result because browsers do not emit a `storage` event back to the writer.

This prevents silent last-writer overwrite under normal cooperative use. It cannot provide distributed locking or multi-device guarantees, which require a server.

### 6.5 IDs

New walks use `crypto.randomUUID()`. If unavailable, the adapter uses a tested random fallback that includes time and cryptographic random bytes where the browser exposes them. IDs are generated once and preserved across reload, export, and import. Legacy numeric IDs are deterministically mapped and recorded so migration is idempotent.

## 7. Legacy Migration

The current app stores real data in Dexie's `WalkTrackerDB`, so switching adapters without migration would violate the no-data-loss requirement.

The one-time importer:

1. Runs only when the new document says `legacyIndexedDbImported: false`.
2. Reads legacy walks and settings without modifying or clearing IndexedDB.
3. Validates each value and maps numeric IDs to stable string IDs.
4. Merges by mapped ID and content fingerprint so retrying cannot duplicate walks.
5. Quarantines unreadable legacy records with source metadata.
6. Commits the complete new document.
7. Marks migration complete only after read-back verification.
8. Leaves the legacy database untouched for rollback.

The existing Firebase integration creates an additional unknown: cloud records may exist that are not present in IndexedDB. The target architecture removes Firebase, but implementation must first determine whether remote-only records exist or obtain explicit approval for a one-time read-only export. No remote collection is deleted by this project.

## 8. Data Flows

### 8.1 Completed Walk

```text
GPS adapter -> tracking use case -> tracking session store
            -> create validated Walk -> repository.update()
            -> localStorage adapter commit/read-back
            -> save success -> summary route
            -> repository snapshot -> analytics -> pixels
```

Navigation to the summary occurs only after the commit succeeds. On failure, the walk remains in the live store and the UI offers Retry and Export Session; it is not reset.

### 8.2 Dashboard

```text
repository.load()
  -> validated completed walks + settings + storage status
  -> aggregateWalks / calculateStreak / getWeeklyActivity / calculateLevel
  -> dashboard view model
  -> ActivityRing / StreakDisplay / recent list
```

Every metric is derived from the same validated snapshot. Formatting changes representation only; it never changes arithmetic.

### 8.3 Settings

```text
input -> validate field -> optimistic userStore update
      -> debounced repository.update(expectedRevision)
      -> committed: show Saved on this device
      -> failed/conflict: retain explicit unsaved state and offer retry
```

## 9. Backend, Database, API, and Authentication

There is no backend, remote database, API, or authentication in the target application. Static hosting serves immutable application assets only. OpenStreetMap tile requests are third-party map resources, not an application backend and do not carry walk records.

The asynchronous storage port is the forward-compatibility plan. A future API adapter could implement the same methods, but adding it would require server-side identity, authorization, conflict rules, privacy review, migration, and user consent. It is explicitly not implemented or scaffolded now.

## 10. Security and Privacy

- Data is protected only by browser origin isolation and device/browser-profile security.
- `localStorage` is not encryption or authentication; the UI must not claim that it is.
- Exported JSON is user-readable and must include a plain privacy warning.
- Imports are untrusted and receive size, shape, schema, and value validation.
- No Firebase credentials, account UI, or remote sync status exists in the target runtime.
- Client-side roles and authorization are out of scope because they would be UI conventions, not security.

## 11. Deployment and Monitoring

The app builds with `npm run build` and deploys as static assets over HTTPS. The PWA service worker caches the application shell and map tiles only; it does not own user-data writes.

Client-side operational signals include a global error boundary, feature error states, storage availability, active schema version, revision, last successful save time, quarantine count, and optional `navigator.storage.estimate()` output. No remote telemetry is required by this architecture.

## 12. Scalability and Rejected Alternatives

`localStorage` is intentionally accepted despite its small, browser-dependent quota and synchronous API because it is a hard constraint. To limit its cost, the app stores one serialized document, avoids persisted duplicate aggregates, validates route-point retention, and measures document size before commit. Very large GPS histories may eventually exceed practical limits; export/archival and route downsampling must be considered before that threshold, based on measurement in Phase 7.

Rejected alternatives:

- **Keep Dexie/IndexedDB:** technically better for large histories, but violates the explicit localStorage-only requirement.
- **Keep Firebase as optional sync:** violates the no-backend constraint and creates an account/security scope the project rejected.
- **Add service/repository classes for every function:** unnecessary ceremony in a small JavaScript app; plain functions and explicit ports are easier to test.
- **Persist dashboard aggregates:** faster reads but creates competing sources of truth and stale metrics; derive them from validated walks instead.
- **Use one key per walk:** increases partial-update and cross-key consistency problems; one revisioned document provides a coherent snapshot.

## 13. Honest Limitations

Without a server, WalkTracker cannot guarantee multi-device backup, recovery after device loss or site-data deletion, real identity, authorization, shared data, push-driven sync, or protection from someone with browser-profile access. Export is the only durable user-controlled backup. These limitations must be stated plainly in the product and UI documentation.

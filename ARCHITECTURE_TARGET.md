# Phase 3 Target Architecture - WalkTracker

## Status and Scope

This document is a design deliverable for Phase 3. It does not implement the refactor and does not change application behavior. Phase 6.1 may execute this design only after approval.

The target is governed by the project's non-negotiable constraint: no backend, no hosted authentication, no remote database, and no application API. Durable application data is stored through one versioned `localStorage` adapter. The existing Dexie and Firebase code is treated as legacy migration input and is not part of the target runtime.

## 1. Current-to-Target Boundary

The current code has these verified boundary violations:

| Current location | Current behavior | Target boundary |
|------------------|------------------|-----------------|
| `src/lib/db.js:3-100` | Creates a Dexie database and exposes raw persistence functions | Replaced behind the storage port; retained temporarily only for read-only legacy import |
| `src/pages/Home.jsx:21` | Page imports `getTodayWalks()` and `getWalks()` directly | Dashboard feature calls an application repository/use-case API |
| `src/pages/Track.jsx:35` | Tracking page imports `saveWalk()` and `getTodayWalks()` directly | Tracking feature calls save/load ports, never a storage adapter |
| `src/pages/Stats.jsx:15` | History page imports `getWalks()` and `deleteWalk()` directly | History feature calls its feature repository facade |
| `src/pages/WalkSummary.jsx:14,19` | Summary imports raw read functions from `db.js` | Summary feature receives a validated walk read model |
| `src/pages/Settings.jsx:12,26` | Settings imports `db` and clears tables directly | Settings feature calls the clear operation exposed by the storage/application port |
| `src/stores/userStore.js:5` | Store imports `saveSetting()` and `getAllSettings()` from Dexie layer | Store calls a settings facade; persistence status is explicit |
| `src/stores/authStore.js:2-5` | Firebase auth starts/stops cloud sync | Removed from target runtime after legacy-data decision gate |
| `src/lib/cloudSync.js:1-104` | Reads/writes Firestore and mutates local Dexie records | Not migrated into the target runtime; no replacement sync feature |
| `src/stores/trackingStore.js:5-6` | Zustand store owns domain calculations and live state together | Domain calculations move to pure modules; store owns session orchestration only |

These are observations from the current source. Whether a user has Firebase records absent from local Dexie is not knowable from this repository and must be resolved before removing the legacy Firebase path.

## 2. New Folder Structure

```text
src/
|-- app/                                      # Composition root and application lifecycle
|   |-- App.jsx                               # Route shell and global providers
|   |-- main.jsx                              # React entry point
|   |-- routes.jsx                             # Route declarations
|   |-- bootstrap.js                           # Load/migrate storage before feature render
|   `-- errors/
|       `-- AppErrorBoundary.jsx               # Global last-resort render boundary
|
|-- domain/                                   # Pure rules; no React or browser globals
|   |-- models/
|   |   |-- walk.js                            # Walk shape and field defaults
|   |   |-- settings.js                        # Settings shape and defaults
|   |   `-- storageDocument.js                 # Document invariants
|   |-- tracking/
|   |   |-- gps.js                             # Distance, smoothing, pace, bounds
|   |   |-- metrics.js                         # Steps, calories, elapsed metrics
|   |   `-- session.js                         # Pure session transitions/derivations
|   |-- analytics/
|   |   |-- aggregates.js                      # One aggregateWalks implementation
|   |   |-- streak.js                          # Local-calendar streak rules
|   |   |-- records.js                         # Personal records
|   |   `-- charts.js                          # Chart view data
|   `-- achievements/
|       |-- catalog.js                         # Achievement definitions
|       |-- rules.js                           # Unlock conditions
|       `-- levels.js                          # XP/level calculation
|
|-- infrastructure/                           # Browser-specific implementations
|   |-- storage/
|   |   |-- storagePort.js                     # Public contract and result types
|   |   |-- localStorageAdapter.js             # Only direct localStorage access
|   |   |-- documentSchema.js                  # Current schema and validation
|   |   |-- migrations.js                      # Sequential current-document migrations
|   |   |-- serialization.js                   # Safe parse/stringify preflight
|   |   |-- recovery.js                        # Recovery payload/quarantine
|   |   |-- legacyIndexedDbImporter.js         # Read-only Dexie compatibility import
|   |   `-- storageErrors.js                   # Typed expected failures
|   |-- geolocation/
|   |   `-- browserGeolocation.js               # Geolocation API wrapper
|   `-- wakeLock/
|       `-- browserWakeLock.js                 # Wake Lock API wrapper
|
|-- features/                                 # Feature-level containers and stores
|   |-- dashboard/
|   |   |-- DashboardPage.jsx
|   |   |-- dashboardStore.js
|   |   `-- dashboardViewModel.js
|   |-- tracking/
|   |   |-- TrackingPage.jsx
|   |   |-- trackingStore.js
|   |   |-- trackingUseCases.js
|   |   `-- components/
|   |-- history/
|   |   |-- StatsPage.jsx
|   |   |-- WalkSummaryPage.jsx
|   |   |-- historyStore.js
|   |   `-- components/
|   |-- achievements/
|   |   |-- AchievementsPage.jsx
|   |   `-- achievementsViewModel.js
|   |-- settings/
|   |   |-- SettingsPage.jsx
|   |   |-- settingsStore.js
|   |   `-- settingsUseCases.js
|   `-- onboarding/
|       |-- OnboardingPage.jsx
|       `-- onboardingStore.js
|
|-- shared/                                   # Feature-agnostic presentation helpers
|   |-- components/
|   |   |-- Card.jsx
|   |   |-- ProgressRing.jsx
|   |   |-- BottomNav.jsx
|   |   |-- Button.jsx
|   |   |-- StatusMessage.jsx
|   |   `-- ErrorBoundaryFallback.jsx
|   |-- hooks/
|   |   |-- useGeolocation.js
|   |   |-- useWakeLock.js
|   |   `-- useTheme.js
|   |-- formatting/
|   |   `-- formatters.js
|   `-- constants/
|       `-- appConstants.js
|
`-- index.css                                # Existing design tokens/global styles
```

### Directory rationale

- `app/` owns wiring and startup order, so pages do not construct adapters.
- `domain/` contains calculations that can be tested in Node without a browser or React renderer.
- `infrastructure/storage/` is the only durable-data implementation and the only place allowed to touch storage globals.
- `infrastructure/geolocation/` and `wakeLock/` isolate optional browser APIs from feature logic.
- `features/` owns user-facing workflows and their view models; a feature may consume public ports but not private infrastructure files.
- `shared/` contains reusable UI and display-only helpers without business ownership.

## 3. Clean Architecture Boundaries

### 3.1 Domain

The domain accepts plain values and returns plain values. It owns:

- GPS math and filtering rules
- Session state transitions and elapsed-time calculations
- Numeric guards and derived metrics
- Aggregation, streak, record, chart, achievement, and level rules
- Canonical walk/settings invariants

It must not import React, Zustand, Dexie, Firebase, `window`, `navigator`, `localStorage`, Leaflet, Recharts, or formatting code that exists only for pixels.

### 3.2 Infrastructure

Infrastructure implements browser-facing ports:

- `localStorageAdapter` owns serialization, revision checks, recovery, migrations, and cross-tab events.
- `legacyIndexedDbImporter` is a temporary, read-only compatibility adapter. It is not a general persistence API.
- Browser geolocation and wake-lock adapters translate browser callbacks/errors into plain results.

Infrastructure may import domain validators/models. It must not import feature stores or render components.

### 3.3 Features

Features orchestrate user workflows:

- load a validated snapshot
- call pure domain functions
- update ephemeral Zustand state
- expose loading, error, freshness, and save status to UI

Feature code may import the public storage port and browser adapters through composition, but it must not call `localStorage`, IndexedDB, Firebase, or browser APIs directly. Feature pages should not perform independent arithmetic that duplicates domain services.

### 3.4 Shared Presentation

Shared components receive explicit props. They do not load data, infer loading/error states, or access stores implicitly. A progress component receives a finite, clamped value and an accessible textual value; it never calculates progress from raw records.

### 3.5 App Composition Root

`app/bootstrap.js` constructs the storage adapter, runs capability detection and legacy migration, then exposes the public application services to feature routes. The composition root is the only place that selects implementations. No feature imports `localStorageAdapter.js` directly.

## 4. Public Storage Port

The target port is deliberately small and asynchronous:

```js
// Conceptual contract; implementation is Phase 4 work.
{
  load: () => Promise<LoadResult>,
  save: (document, options) => Promise<WriteResult>,
  update: (mutator, options) => Promise<WriteResult>,
  remove: (collection, id, options) => Promise<WriteResult>,
  subscribe: (listener) => () => void,
  export: () => Promise<ExportResult>,
  import: (payload, options) => Promise<ImportResult>
}
```

`LoadResult` must distinguish `fresh`, `loaded`, `recovered`, `degraded`, and `unavailable`. `WriteResult` must distinguish `saved`, `quota`, `unavailable`, `conflict`, and `invalid`. The UI cannot truthfully display "Saved" from a void return or a swallowed exception.

The adapter owns these keys and no others:

- `walktracker:data`: active serialized document
- `walktracker:recovery`: previous last-known-good serialized document

The document contains `schemaVersion`, monotonic `revision`, settings, walks, quarantine entries, and migration metadata. Derived dashboard totals are never stored.

## 5. Data and Render Flow

### 5.1 Startup

```text
App bootstrap
  -> capability probe for localStorage
  -> read active document
  -> safe parse + validate
  -> if needed, recover from recovery key
  -> if not imported, read legacy IndexedDB without mutation
  -> migrate and commit one validated document
  -> publish application snapshot/status
  -> mount routes
```

The app must not render a normal zero-valued dashboard while startup is unresolved. It renders a loading state, a recoverable-storage warning, or an explicit fresh state.

### 5.2 Tracking

```text
browser geolocation
  -> geolocation adapter
  -> tracking use case
  -> pure session/metric functions
  -> tracking Zustand store (live session only)
  -> stop confirmation
  -> repository.update(add validated walk)
  -> read-back revision verification
  -> summary route
```

The tracking store does not write storage on every GPS point in the MVP. A future crash-recovery journal would require a separate approved feature because it changes persistence behavior and quota requirements.

### 5.3 Dashboard, Stats, and Summary

```text
storage snapshot
  -> validated walks
  -> one domain aggregation/view-model pipeline
  -> feature store snapshot
  -> formatter
  -> semantic UI component
  -> DOM and accessible text
```

Home, Track's base-today display, Stats, and achievement checks all use the same aggregation functions. A page may select a subset for presentation, but may not reimplement the arithmetic.

## 6. Refactoring Strategy

Refactoring and defect fixes remain separate. The following sequence is behavior-preserving by intent; any behavior change discovered during verification becomes a named Phase 1 defect fix and is not hidden in a refactor step.

### Step 0: Freeze and baseline

**Findings prepared:** all; this creates the evidence needed to separate refactors from defect fixes.

- Record current `npm run build` and `npm run lint` results.
- Capture current routes, visible labels, storage keys/tables, and representative fixture output.
- Preserve current source files; do not delete Dexie/Firebase code yet.
- **Verification:** clean worktree diff for the refactor branch; baseline fixture screenshots and JSON output.

### Step 1: Add characterization fixtures

**Findings prepared:** #1-#30; no finding is fixed in this step.

- Create fixtures for an empty install, one valid walk, multiple same-day walks, midnight boundaries, and malformed numeric fields.
- Do not change runtime behavior.
- **Verification:** fixtures describe current outputs; no production imports change.

### Step 2: Extract pure GPS/metric modules

**Findings prepared:** #4, #10, #11, #18, #19.

- Move or re-export functions from `src/lib/gps.js` and `src/lib/calories.js` into `domain/tracking/`.
- Keep compatibility exports temporarily so existing callers behave identically.
- **Verification:** unit tests compare old and new outputs for representative finite inputs; build passes.

### Step 3: Extract pure analytics modules

**Findings prepared:** #1, #3, #13, #21, #23, #29.

- Move or re-export `calculateStreak`, `getWeeklyActivity`, `calculatePersonalRecords`, and `getChartData` into `domain/analytics/`.
- Extract a single `aggregateWalks` implementation from the duplicated Home/Track reducers.
- Do not alter the known streak defect yet; preserve it until the separate defect change.
- **Verification:** characterization tests match current outputs for non-defect cases; build passes.

### Step 4: Extract achievement and level rules

**Findings prepared:** #12 and #20.

- Move definitions/calculations from `src/lib/achievements.js` into `domain/achievements/`.
- Keep the same public outputs.
- **Verification:** all existing achievement IDs and XP values match fixture snapshots.

### Step 5: Introduce the storage port types and errors

**Findings prepared:** #2, #6, #7, #9, #30.

- Add the port contract and typed result/error vocabulary without changing the active adapter.
- **Verification:** compile/build succeeds; no feature imports the new port yet.

### Step 6: Implement the Phase 4 localStorage adapter in isolation

**Findings addressed by the data-layer work:** #2, #6, #7, #9, and #30. User-visible defect behavior remains for Phase 6.2.

- Add schema, validation, serialization, recovery, migrations, revision checks, export/import, and cross-tab subscription.
- Add tests before wiring it into the app.
- **Verification:** storage contract tests pass in a mocked browser environment; current app still uses legacy adapter.

### Step 7: Implement the legacy IndexedDB importer

**Requirements addressed:** non-destructive migration and Finding #6's version-evolution risk.

- Read the current `WalkTrackerDB` schema through a narrowly scoped importer.
- Map numeric IDs and fields without deleting or modifying Dexie data.
- **Verification:** a copied fixture produces the same walk values; repeat import produces no duplicates; source database is byte/record unchanged.

### Step 8: Add bootstrap dual-read migration gate

**Findings prepared:** #2, #6, #9, #24, #26, and #30.

- On startup, choose the new document if present; otherwise import legacy IndexedDB once and commit it.
- Keep legacy modules reachable only through the importer.
- **Verification:** fresh install, legacy install, malformed legacy install, and failed commit each show the correct explicit status.

### Step 9: Move user settings behind a settings facade

**Findings prepared:** #7, #9, #24, and #30.

- Refactor `userStore` to call the new storage port rather than `src/lib/db.js`.
- Preserve its public selectors/actions during this step to avoid a UI behavior change.
- **Verification:** settings load/update/onboarding flows and theme changes remain functional; localStorage document read-back matches.

### Step 10: Move completed-walk reads behind a walk facade

**Findings prepared:** #2, #3, #26, #28, and #29.

- Refactor Home, Stats, Track, and WalkSummary to consume validated read models.
- Remove direct `db.js` imports from those features.
- **Verification:** static search finds no direct persistence import in feature pages; fixture render paths match baseline.

### Step 11: Move completed-walk writes behind the tracking use case

**Findings prepared:** #4, #5, #9, #10, and #11.

- Refactor Track's stop path to commit through the port and navigate only after verified save.
- Preserve the current save threshold temporarily; removing it is the separately named Finding #5 fix.
- **Verification:** successful and failed save tests; no reset before save result; summary receives the saved ID.

### Step 12: Move shared UI and browser adapters

**Findings prepared:** #13, #14, #22, #25, and #28.

- Move existing UI components, hooks, and formatters into `shared/` without changing markup/classes unless required for imports.
- Wrap geolocation and wake-lock calls behind infrastructure adapters.
- **Verification:** route-level screenshots and browser smoke tests match baseline; cleanup behavior remains intact.

### Step 13: Introduce feature page/view-model boundaries

**Findings prepared:** #3, #4, #20, #23, and #24.

- Rename/move pages into feature folders and extract view-model assembly from JSX where it removes duplicated arithmetic.
- Keep route paths and user-visible labels unchanged.
- **Verification:** all route URLs, navigation visibility, and rendered values match characterization fixtures.

### Step 14: Add error boundary composition

**Finding addressed:** #26, without changing the normal render path.

- Add global and feature-level fallback boundaries without changing the normal path.
- **Verification:** injected render error shows a recoverable fallback and does not blank unrelated routes.

### Step 15: Remove legacy runtime dependencies

**Findings addressed or retired:** #8, #16, and #27, subject to the remote-data migration gate.

- Resolve the remote-only Firebase-data gate first.
- Remove Firebase auth/cloud-sync runtime and Dexie runtime after local migration verification and explicit approval.
- Remove compatibility exports only after all feature imports are gone.
- **Verification:** production bundle contains no Firebase/Dexie runtime; no remote data is deleted; local export/import remains valid.

### Step 16: Enforce boundaries

**Findings protected against recurrence:** #2, #3, #6, #7, #8, #9, and #30.

- Add ESLint/import restrictions and a CI check that rejects direct storage-global access outside `infrastructure/storage`.
- **Verification:** intentional violation fixture fails; target tree passes.

## 7. Verification Matrix Per Refactor Step

Every step must pass all applicable checks before the next step:

| Check | Purpose |
|-------|---------|
| `npm run build` | The app remains runnable |
| `npm run lint` | Imports and hook usage remain valid |
| Domain unit tests | Pure calculations did not drift |
| Storage contract tests | Persistence semantics remain explicit |
| Route smoke test | Each page still mounts and navigates |
| Fixture render comparison | Displayed values remain equivalent outside approved defects |
| Static import audit | Layer boundaries are actually enforced |
| Browser console check | No new unhandled errors or rejected promises |

The final refactor comparison must list any intentional output differences and link each one to an approved Finding number. A visual improvement or cleaner code is not permission to change a value.

## 8. Finding-to-Architecture Mapping

| Finding | Target response | Refactor or defect fix? |
|---------|-----------------|-------------------------|
| #1, #29 | Pure streak service with valid-date filtering | Defect fix after extraction |
| #2 | Single read/write validation and quarantine in storage adapter | Data-layer implementation |
| #3 | One `aggregateWalks` domain function | Refactor; outputs must remain equal |
| #4 | One elapsed-time calculation used by live and saved views | Defect fix after extraction |
| #5 | Remove silent short-walk discard or obtain explicit save/discard decision | Defect fix; requires approval of behavior |
| #6, #30 | Versioned document migrations and settings migration registry | Data-layer implementation |
| #7 | Revisioned single-document writes and `storage` subscription | Data-layer implementation |
| #8, #16, #27 | No cloud sync in target; preserve/resolve remote legacy data before removal | Scope/migration gate |
| #9 | Typed unavailable/quota results and honest UI status | Data-layer + UI defect fix |
| #10, #11 | Domain finite-number guards and formatter guards | Defect fix |
| #12 | Clamped level progress in domain | Defect fix |
| #13, #14, #21, #22 | Centralized locale/unit-safe formatting and record rules | Defect fixes |
| #15 | Session auto-pause state distinguishes manual pause | Defect fix |
| #18, #19 | Measure route payload; reduce duplicate persisted derivations if needed | Performance/data decision after measurement |
| #20 | Read fresh achievement snapshot before unlock batch | Defect fix |
| #23, #24, #25, #26, #28 | Remove dead paths, gate onboarding, stabilize hooks, add boundaries, normalize dates | Defect fixes |

## 9. Architectural Improvements

| Improvement | What changes technically | What the user notices |
|-------------|--------------------------|-----------------------|
| One durable source of truth | Completed walks, settings, XP, and migration state share one validated revisioned document | Home, Track, Stats, Summary, and Achievements stop disagreeing about the same record set |
| One aggregation pipeline | Today totals, streaks, records, and chart inputs come from pure domain functions | A value saved in a walk appears consistently in every screen that reports it |
| Honest persistence status | Save results distinguish saved, saving, conflict, quota, unavailable, and invalid | The app never implies a walk landed when it remains only in memory |
| Storage isolation | Components depend on an asynchronous port rather than browser storage details | Future storage replacement does not require redesigning screens or calculations |
| Non-destructive migration | Legacy Dexie data is copied, verified, and left intact | Existing history remains available after the storage transition, with an export/recovery path |
| Explicit cross-tab revisions | Writes compare revisions and subscribers accept only newer validated snapshots | Changes in another tab appear predictably instead of silently overwriting newer edits |
| Pure domain rules | GPS, elapsed time, analytics, and achievements are testable without React | Fewer regressions where a visual refactor changes a number |
| Feature boundaries | Pages assemble view models instead of mixing persistence, arithmetic, and markup | Loading, empty, error, and saved states become consistent across the app |
| Removed backend promise | Firebase account/sync behavior is retired after the migration gate | Settings no longer claims remote backup that the local-only product does not provide |

The rejected alternative is a conventional repository/entity/mapper class stack. It would create more files and indirection but would not improve the guarantees above. The selected approach keeps plain functions, one port, and feature-level orchestration.

## 10. Alternatives Rejected

### Keep Dexie as the primary store

Rejected because it directly conflicts with the explicit `localStorage`-only requirement. It would be technically safer for large route histories, but following a more capable technology than the stated scope is not authorization to change scope.

### Keep Firebase as optional backup

Rejected because optional cloud sync is still a backend, remote database, and authentication surface. The current UI's account/sync controls must not survive as a misleading promise.

### Use one localStorage key per walk

Rejected because independent keys make coherent revisions, clear-all, export, and cross-tab conflict handling harder. One validated document gives readers a consistent snapshot and one commit boundary.

### Persist precomputed dashboard totals

Rejected because totals would become a second source of truth. The cost of deriving them from validated walks is preferable to stale counters.

### Add a general dependency-injection framework

Rejected because the project is a small JavaScript app. A composition root with plain object ports is enough to swap implementations and is easier to understand and test.

## 11. Open Gates Before Phase 4

All gates below were resolved by the project owner on 2026-08-27:

1. **Phase 2 document approval:** **Approved.** The corrected localStorage/no-backend documents supersede the earlier Dexie/Firebase text.
2. **Remote data decision:** **No remote data.** No Firebase-only recovery path is required. The legacy Firebase runtime may be removed without a remote-record migration, but this work will not delete any remote collection.
3. **Short-walk behavior:** **Save every completed walk.** Removing the under-10-meter discard is an approved Finding #5 fix and remains separate from refactoring changes.
4. **Storage-size policy:** **Accept and measure.** Use size checks, quota handling, export, and recovery first; defer route-point downsampling until Phase 7 measurements demonstrate a need.

## 12. Phase 3 Definition of Done

- [x] Target folder tree has a rationale for every boundary.
- [x] Domain, infrastructure, feature, shared, and app import rules are explicit.
- [x] Only one module is allowed to access `localStorage` directly.
- [x] Current Dexie/Firebase conflicts and the non-destructive migration gate are named.
- [x] Refactoring order is specified as independently verifiable steps.
- [x] Every Phase 1 finding is mapped to an architectural response or explicitly marked as a defect fix.
- [x] Rejected alternatives and their reasons are documented.
- [ ] Phase 4 implementation has **not** started; this is intentional.

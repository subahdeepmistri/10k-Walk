# Target Architecture: WalkTracker

## 1. New Folder Structure

```
src/
├── domain/                          # Pure logic — no React, no storage, no DOM
│   ├── analytics/
│   │   ├── derivedValues.js         # EXISTS — safe aggregation, progress, snapshots
│   │   ├── derivedValues.test.js    # EXISTS — unit tests
│   │   ├── streaks.js              # NEW — pure streak calculation (from lib/analytics.js:13-40)
│   │   └── personalRecords.js      # NEW — pure PR calculation (from lib/analytics.js:85-130)
│   └── calculations/
│       ├── gps.js                  # MOVE from lib/gps.js — haversine, smoothing, pace
│       ├── calories.js             # MOVE from lib/calories.js — MET-based estimates
│       └── steps.js               # NEW — extract estimateSteps from calories.js
│
├── infrastructure/                  # External systems — storage, APIs
│   ├── storage/                     # EXISTS — the complete localStorage adapter
│   │   ├── index.js                # EXISTS — public API barrel
│   │   ├── localStorageAdapter.js  # EXISTS — the adapter implementation
│   │   ├── documentSchema.js       # EXISTS — validation
│   │   ├── serialization.js        # EXISTS — safe JSON
│   │   ├── storageErrors.js        # EXISTS — typed errors
│   │   ├── migrations.js           # EXISTS — schema migration
│   │   ├── storagePort.js          # EXISTS — interface contract
│   │   └── legacyIndexedDbImporter.js  # EXISTS — Dexie migration
│   ├── firebase.js                 # MOVE from lib/firebase.js
│   └── cloudSync.js                # MOVE from lib/cloudSync.js
│
├── application/                     # React, Zustand, components — the "wiring" layer
│   ├── stores/
│   │   ├── dataStore.js            # NEW — reactive bridge (the centerpiece)
│   │   ├── trackingStore.js        # EXISTS — live session only
│   │   └── authStore.js            # EXISTS — Firebase auth
│   ├── hooks/
│   │   ├── useGeolocation.js       # EXISTS
│   │   ├── useWakeLock.js          # EXISTS
│   │   └── useTheme.js             # EXISTS
│   ├── pages/                      # EXISTS — route-level components
│   │   ├── Home.jsx
│   │   ├── Track.jsx
│   │   ├── WalkSummary.jsx
│   │   ├── Stats.jsx
│   │   ├── Achievements.jsx
│   │   ├── Settings.jsx
│   │   ├── Onboarding.jsx
│   │   └── SplashScreen.jsx
│   └── components/
│       ├── ui/
│       │   ├── ProgressRing.jsx    # EXISTS
│       │   ├── Card.jsx            # EXISTS
│       │   └── BottomNav.jsx       # EXISTS
│       └── layout/                 # EXISTS (empty)
│
├── shared/                          # Cross-cutting concerns
│   ├── utils/
│   │   ├── constants.js            # EXISTS
│   │   └── formatters.js           # EXISTS
│   └── assets/                     # EXISTS (empty)
│
├── main.jsx                         # EXISTS
├── App.jsx                          # EXISTS
└── index.css                        # EXISTS
```

### Directory Rationale

| Directory | What lives here | What does NOT live here |
|-----------|----------------|------------------------|
| `domain/` | Pure functions: aggregation, streak, PR, GPS math, calorie/step formulas | React, Zustand, storage, DOM APIs |
| `infrastructure/` | Persistence (localStorage adapter), external APIs (Firebase) | React, page logic |
| `application/` | React components, Zustand stores, hooks | Direct `localStorage` calls, direct Dexie calls, pure math |
| `shared/` | Constants, formatters, assets | Business logic, persistence |

---

## 2. Clean Architecture Breakdown

### 2.1 The Three Layers

```
┌─────────────────────────────────────────────────┐
│                 APPLICATION LAYER                │
│  pages/  components/  stores/dataStore.js       │
│  stores/trackingStore.js  hooks/                │
│                                                  │
│  ┌──────────────┐    ┌──────────────────────┐   │
│  │  Home.jsx    │───▶│  dataStore.js        │   │
│  │  Track.jsx   │───▶│    .walks            │   │
│  │  Stats.jsx   │───▶│    .todaySnapshot    │   │
│  │  Achieve.jsx │───▶│    .streak           │   │
│  │  Settings.jsx│───▶│    .updateSetting()  │   │
│  └──────────────┘    └──────────┬───────────┘   │
│                                 │                │
├─────────────────────────────────┼────────────────┤
│         INFRASTRUCTURE LAYER    │                │
│                                 ▼                │
│  ┌──────────────────────────────────────────┐   │
│  │  storage/index.js                        │   │
│  │    .load()  .save()  .update()           │   │
│  │    .remove()  .subscribe()  .import()    │   │
│  │    .export()  .flush()                   │   │
│  └──────────────────────────────────────────┘   │
│  firebase.js  cloudSync.js                      │
│                                                 │
├─────────────────────────────────────────────────┤
│              DOMAIN LAYER                       │
│                                                 │
│  analytics/derivedValues.js                     │
│    aggregateWalks()  calculateGoalProgress()    │
│    calculateOverallProgress()                   │
│    countCompletedGoals()                        │
│    createDailyGoalSnapshot()                    │
│  analytics/streaks.js                           │
│    calculateStreak()                            │
│  analytics/personalRecords.js                   │
│    calculatePersonalRecords()                   │
│  calculations/gps.js                            │
│    haversineDistance()  smoothGPSPoint()         │
│  calculations/calories.js                       │
│    calculateCalories()  estimateSteps()         │
└─────────────────────────────────────────────────┘
```

### 2.2 Import Rules

| Source Layer | May Import From | Must NOT Import From |
|-------------|-----------------|---------------------|
| `domain/` | Nothing (self-contained) | `application/`, `infrastructure/`, `react`, `zustand`, `dexie` |
| `infrastructure/` | `domain/` (for validation logic) | `application/`, `react`, `zustand` |
| `application/` | `domain/`, `infrastructure/`, `shared/` | Direct `localStorage`, direct `Dexie`, raw DOM manipulation |
| `shared/` | Nothing (constants and formatters only) | `domain/`, `infrastructure/`, `application/` |

### 2.3 The `dataStore` — Detailed Design

The `dataStore.js` is the single most important new file. It replaces the role currently played by `lib/db.js` + `lib/analytics.js` + `userStore.js` for read operations.

```
dataStore.js
│
├── INITIALIZATION
│   ├── Calls initializeLocalStorageDataLayer({ database: dexieDb })
│   ├── Runs legacy Dexie migration (first launch only)
│   ├── Loads document from adapter
│   ├── Populates walks[], settings{}, status
│   └── Subscribes to adapter events for cross-tab updates
│
├── REACTIVE STATE (Zustand)
│   ├── walks: Walk[]              ← all walks, kept in sync via subscription
│   ├── settings: Settings         ← all settings, kept in sync via subscription
│   ├── status: 'loading'|'ready'|'error'|'degraded'
│   ├── storageStatus: 'available'|'unavailable'|'memory'
│   ├── issues: string[]           ← validation warnings from load
│   │
│   ├── DERIVED (computed from walks + settings):
│   ├── todayWalks: Walk[]         ← walks.filter(w => w.date === today)
│   ├── todaySnapshot:             ← createDailyGoalSnapshot(todayWalks, settings)
│   │     .totals                  ← { steps, distance, duration, calories, walks }
│   │     .progress                ← { steps: 0-1, distance: 0-1, ... }
│   │     .overallProgress         ← 0-1
│   │     .completedGoals          ← 0-4
│   ├── streak: number             ← calculateStreak(walks)
│   ├── weeklyActivity: Array      ← getWeeklyActivity(walks)
│   ├── personalRecords: object    ← calculatePersonalRecords(walks)
│   ├── chartData: Array           ← getChartData(walks, period)
│   └── recentWalks: Walk[]        ← walks.slice(0, 5)
│
├── ACTIONS
│   ├── saveWalk(walkData)         ← adapter.update() → adds walk to document
│   ├── deleteWalk(id)             ← adapter.remove() → removes walk from document
│   ├── updateSetting(key, value)  ← adapter.saveSetting() (debounced)
│   ├── importData(json, mode)     ← adapter.import()
│   ├── exportData()               ← adapter.export()
│   └── clearAll()                 ← adapter.clearAll()
│
└── LIFECYCLE
    ├── initialize()               ← called once in App.jsx useEffect
    └── destroy()                  ← unsubscribes from adapter
```

### 2.4 What dataStore Replaces

| Current Code | What It Does | Replaced By |
|-------------|-------------|-------------|
| `lib/db.js` (all exports) | Dexie CRUD | `dataStore` actions delegate to adapter |
| `userStore.js` (settings) | Settings load/save | `dataStore.settings` + `dataStore.updateSetting()` |
| `Home.jsx:52-61` (reduce) | Today's stats | `dataStore.todaySnapshot.totals` |
| `Home.jsx:28-31` (progress) | Ring percentages | `dataStore.todaySnapshot.progress` |
| `Track.jsx:91-97` (reduce) | Base today stats | `dataStore.todaySnapshot.totals` |
| `Stats.jsx:123-130` (reduce) | Filtered totals | `aggregateWalks(filteredWalks)` from derivedValues.js |
| `analytics.js` (streak) | Streak calculation | `dataStore.streak` |
| `analytics.js` (weekly) | Weekly activity | `dataStore.weeklyActivity` |
| `analytics.js` (PRs) | Personal records | `dataStore.personalRecords` |
| `analytics.js` (chart) | Chart data | `dataStore.chartData` |
| `analytics.js:95-103` (reduce) | PR daily grouping | Stays in `personalRecords.js` (domain layer) |

### 2.5 What dataStore Does NOT Replace

| Code | Why It Stays |
|------|-------------|
| `trackingStore.js` | Live session state is ephemeral by design — it's only relevant during an active walk |
| `authStore.js` | Firebase auth state is managed by Firebase SDK, not our persistence layer |
| `lib/gps.js` → `domain/calculations/gps.js` | Pure math, no persistence involvement |
| `lib/calories.js` → `domain/calculations/calories.js` | Pure math, no persistence involvement |
| `achievements.js` → stays in `lib/` | Achievement definitions and condition functions are used by WalkSummary and Achievements page — they could move to domain but the effort is not justified since they have no persistence or React dependency |
| `formatters.js` → `shared/utils/formatters.js` | Pure formatting, no state |

---

## 3. Refactoring Strategy

### 3.1 Order of Operations

The refactoring is sequenced so that each step is independently verifiable and leaves the app in a working state.

```
STEP 1: Create domain/calculations/ (move gps.js, calories.js)
         │  No behaviour change. Pure file moves.
         │  Verification: app runs identically, tests pass
         │
STEP 2: Create domain/analytics/ (extract streaks.js, personalRecords.js)
         │  No behaviour change. Pure extraction.
         │  Verification: streak and PR values unchanged
         │
STEP 3: Connect infrastructure/storage/ (initialize adapter, run migration)
         │  FIRST behaviour change: data now lives in localStorage
         │  Verification: all existing walks appear, Dexie data preserved
         │  Finding addressed: #1
         │
STEP 4: Create stores/dataStore.js (reactive bridge)
         │  New central state source. Not yet consumed by pages.
         │  Verification: dataStore initializes, walks load, subscription fires
         │
STEP 5: Switch userStore to read from dataStore
         │  Settings now come from dataStore instead of direct Dexie
         │  Verification: settings changes persist and are reflected immediately
         │  Finding addressed: settings dual-source-of-truth
         │
STEP 6: Replace Home.jsx inline aggregation with dataStore
         │  FIRST page migration
         │  Verification: Home rings show correct values, stale data bug fixed
         │  Findings addressed: #1, #2, #5, #10
         │
STEP 7: Replace Track.jsx base-today with dataStore
         │  Verification: live daily progress still works
         │  Finding addressed: #1
         │
STEP 8: Replace Stats.jsx aggregation with derivedValues.js
         │  Verification: totals match, no NaN
         │  Findings addressed: #1, #5
         │
STEP 9: Fix MapPin import in Stats.jsx
         │  Verification: personal records render
         │  Finding addressed: #3
         │
STEP 10: Fix calculateStreak mutation
         │  Verification: streak unchanged, no side effects
         │  Finding addressed: #4
         │
STEP 11: Remove fake "Synced" badge
         │  Verification: no "Synced" when Firebase unconfigured
         │  Finding addressed: #8
         │
STEP 12: Add tracking checkpointing
         │  Verification: tab close → recovery prompt
         │  Finding addressed: crash resilience
         │
STEP 13: Apply trust and honesty rules
         │  Verification: empty states, save confirmation, aria attributes
         │
STEP 14: Add data import
         │  Verification: export → import round-trip
         │
STEP 15: Remove lib/db.js, lib/analytics.js (now unused)
         │  Cleanup. No behaviour change.
         │  Verification: app runs, no broken imports
```

### 3.2 Which Findings Each Step Addresses

| Step | Findings Fixed | Nature |
|------|---------------|--------|
| 1 | — | Refactor (file move) |
| 2 | — | Refactor (extraction) |
| 3 | #1 | Architecture (connect storage layer) |
| 4 | #5, #10 | Architecture (reactive bridge) |
| 5 | dual-source-of-truth | Refactor (settings consolidation) |
| 6 | #1, #2, #5, #10 | Bug fix + refactor |
| 7 | #1 | Bug fix |
| 8 | #1, #5 | Bug fix + refactor |
| 9 | #3 | Bug fix (1-line) |
| 10 | #4 | Bug fix |
| 11 | #8 | Bug fix |
| 12 | crash resilience | Feature |
| 13 | trust rules | Feature |
| 14 | data import | Feature |
| 15 | — | Cleanup |

### 3.3 Verification Protocol

After each step:

1. **Build check:** `npm run build` completes without errors
2. **Type check:** If TypeScript were present, `tsc --noEmit`; without it, ESLint `npm run lint`
3. **Test check:** `npm test` passes (existing tests in derivedValues.test.js and storage.test.js)
4. **Manual check:** Open app in browser, navigate all pages, verify no visual regressions
5. **Data check:** If step touches persistence, verify existing data is preserved

---

## 4. Architectural Improvements

### 4.1 What Gets Better

| Before | After | How the User Notices |
|--------|-------|---------------------|
| NaN can reach the DOM from corrupt data | All aggregation uses `safeNumber()` from derivedValues.js | Daily rings always show valid percentages, never "NaN%" |
| One corrupt walk breaks all totals | Quarantine system isolates bad records | Other walks display correctly, bad record silently excluded |
| Home shows stale data after a walk | dataStore subscription fires on every write | Rings update immediately when you return from a walk |
| 5 independent reduce blocks can disagree | One `aggregateWalks()` call | Home rings, Stats totals, and Track progress always agree |
| Settings exist in two stores that can diverge | Single source of truth in dataStore | Weight/height/goals always consistent across all screens |
| Two tabs can overwrite each other's data | Storage adapter handles cross-tab sync | Changes in one tab appear in the other |
| No validation on reads | `validateWalk()` runs on every load | Corrupt data never reaches render path |
| Closing a tab during a walk loses all data | Checkpointing to localStorage every 30s | Recovery prompt on next launch |
| "Synced" badge shown when sync is non-functional | Badge gated behind actual Firebase config | Honest status display |
| Cloud sync UI promises features that don't exist | Either remove the section or make it clearly optional | No false promises |

### 4.2 What Does NOT Change

The following are explicitly preserved:

- **All page routes and navigation** — same 8 routes, same URL structure
- **Visual design** — same tokens, glassmorphism, gradients, animations
- **Tracking algorithm** — same GPS smoothing, calorie/step formulas
- **Achievement system** — same 14 badges, same XP/level math
- **Map implementation** — same Leaflet + OpenStreetMap
- **Chart implementation** — same Recharts bar chart
- **Bottom navigation** — same 5-tab layout
- **Onboarding flow** — same 3 slides + setup

### 4.3 Cost of the Refactoring

| Area | Cost | Justification |
|------|------|--------------|
| New file: `dataStore.js` | ~200-300 lines | Replaces ~150 lines spread across 5 files; net new ~100 lines |
| New file: `streaks.js` | ~30 lines | Extracted from analytics.js; pure move |
| New file: `personalRecords.js` | ~50 lines | Extracted from analytics.js; pure move |
| New file: `steps.js` | ~10 lines | Extracted from calories.js; pure move |
| File moves (gps.js, calories.js, firebase.js, cloudSync.js) | 0 new lines | Path changes only |
| Page modifications | ~50 lines changed per page (5 pages) | Replace inline reduce with dataStore reads |
| `lib/db.js` removal | -80 lines | Dead code after migration |
| `lib/analytics.js` removal | -180 lines | Dead code after extraction |
| **Net change** | ~+200 lines | Mostly the dataStore; everything else is reorganization |

### 4.4 Migration Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Dexie → localStorage migration loses data | Low | Migration never deletes Dexie data; `legacyIndexedDbImported` flag prevents re-run |
| dataStore subscription causes infinite render loop | Low | Zustand selectors prevent unnecessary re-renders; subscription only fires on actual document changes |
| Performance regression from validation on every read | Low | Validation runs once at startup, not per-frame; walks are validated once and cached |
| Cross-tab subscription fires for own writes | Low | Adapter uses revision comparison; own writes are already applied to in-memory state |
| Tracking checkpoint data conflicts with completed walk | Low | Checkpoint is cleared on `stopTracking()` and `resetTracking()` |

### 4.5 Forward Compatibility

The architecture is designed so that a backend could be dropped in later:

1. **The storage adapter interface** (`storagePort.js`) is already API-agnostic. A REST API implementation could replace `localStorageAdapter.js` without touching any feature code.
2. **The dataStore** consumes the adapter through its public interface. It doesn't know or care whether the backend is localStorage, IndexedDB, or a server.
3. **The domain layer** is completely independent of persistence. `aggregateWalks()` works on any array of walk objects, regardless of where they came from.
4. **Schema versioning** allows the document shape to evolve. Future versions add migrations without discarding existing data.

The cost of adding a backend later: write a new adapter (~300 lines implementing the storage port), swap the import in dataStore, and add auth middleware. No page, component, or domain code changes.

---

## 5. File-Level Change Map

### Files that MOVE (path changes only)

| From | To |
|------|-----|
| `src/lib/gps.js` | `src/domain/calculations/gps.js` |
| `src/lib/calories.js` | `src/domain/calculations/calories.js` |
| `src/lib/firebase.js` | `src/infrastructure/firebase.js` |
| `src/lib/cloudSync.js` | `src/infrastructure/cloudSync.js` |

### Files that are NEW

| Path | Purpose | Size Estimate |
|------|---------|--------------|
| `src/domain/analytics/streaks.js` | Pure streak calculation | ~30 lines |
| `src/domain/analytics/personalRecords.js` | Pure PR calculation | ~50 lines |
| `src/domain/calculations/steps.js` | Step estimation (extracted from calories.js) | ~10 lines |
| `src/application/stores/dataStore.js` | Reactive bridge to storage layer | ~250 lines |

### Files that are MODIFIED

| Path | Change | Findings |
|------|--------|----------|
| `src/App.jsx` | Initialize dataStore instead of loading settings directly | — |
| `src/stores/userStore.js` | Read from dataStore instead of Dexie; remove `loadSettings()` | dual-source |
| `src/pages/Home.jsx` | Replace inline reduce with `dataStore.todaySnapshot` | #1, #2, #5, #10 |
| `src/pages/Track.jsx` | Replace base-today reduce with `dataStore.todaySnapshot` | #1 |
| `src/pages/Stats.jsx` | Replace inline reduce with `aggregateWalks()`; add MapPin import | #1, #3, #5 |
| `src/pages/WalkSummary.jsx` | Update imports for moved files | — |
| `src/pages/Settings.jsx` | Remove fake "Synced" badge; add import button | #8 |
| `src/pages/Achievements.jsx` | Update imports for moved files | — |
| `src/stores/authStore.js` | Update import path for firebase.js | — |
| `src/hooks/useTheme.js` | No change needed (uses userStore which is updated) | — |

### Files that are DELETED

| Path | Reason |
|------|--------|
| `src/lib/db.js` | Replaced by infrastructure/storage adapter |
| `src/lib/analytics.js` | Replaced by domain/analytics/ modules + dataStore |
| `src/lib/calories.js` | Moved to domain/calculations/calories.js |
| `src/lib/gps.js` | Moved to domain/calculations/gps.js |
| `src/lib/firebase.js` | Moved to infrastructure/firebase.js |
| `src/lib/cloudSync.js` | Moved to infrastructure/cloudSync.js |
| `src/lib/achievements.js` | Could move to domain/ but low value — keeps in lib/ for now |

**Note on `lib/achievements.js`:** This file defines the 14 achievement conditions, the level calculation, and the unlock checker. It has no persistence or React dependencies — it's technically domain logic. However, it's only consumed by `WalkSummary.jsx` and `Achievements.jsx`, and moving it would require updating two import paths for minimal architectural benefit. The recommendation is to leave it in `lib/` for now and move it to `domain/gamification/` in a future cleanup pass if more gamification features are added.

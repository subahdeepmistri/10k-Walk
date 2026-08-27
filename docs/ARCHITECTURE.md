# System Architecture Document: WalkTracker

## 1. Overview

WalkTracker is a React 19 single-page application built with Vite, using Zustand for state management, Dexie for IndexedDB persistence, Leaflet for maps, Recharts for charts, Framer Motion for animations, and Tailwind CSS 4 for styling. There is no backend — all data lives on the client.

The architecture has two layers that matter: the **feature layer** (pages, stores, components, utilities) and the **persistence layer** (currently Dexie, with an unused localStorage adapter). The core architectural decision ahead is whether and how to connect the unused persistence layer.

## 2. Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | React | 19.2.4 | UI rendering |
| Build | Vite | 8.0.4 | Dev server, bundling |
| Styling | Tailwind CSS | 4.2.2 | Utility-first CSS |
| State | Zustand | 5.0.12 | Client state management |
| Persistence | Dexie | 4.4.2 | IndexedDB wrapper |
| Maps | Leaflet + react-leaflet | 1.9.4 / 5.0.0 | GPS map display |
| Charts | Recharts | 3.8.1 | Bar/area charts |
| Animation | Framer Motion | 12.38.0 | UI transitions |
| Icons | Lucide React | 1.8.0 | Icon library |
| PWA | vite-plugin-pwa | 1.2.0 | Service worker (configured but optional) |
| Auth | Firebase | 12.12.0 | Optional Google sign-in |

## 3. Current Architecture (As-Is)

```
src/
  main.jsx              # Entry point, BrowserRouter
  App.jsx               # Routes, theme, auth init
  index.css             # Design tokens, glassmorphism, animations
  pages/                # 8 route-level components
    SplashScreen.jsx    # Logo animation, routing decision
    Onboarding.jsx      # 3 slides + initial setup
    Home.jsx            # Dashboard with Activity Rings
    Track.jsx           # Live GPS tracking with map
    WalkSummary.jsx     # Post-walk stats and map
    Stats.jsx           # Charts + walk history log
    Achievements.jsx    # Badge grid and level
    Settings.jsx        # Profile, goals, preferences
  components/ui/        # 3 reusable components
    ProgressRing.jsx    # SVG animated ring
    Card.jsx            # Card wrapper (3 variants)
    BottomNav.jsx       # Tab navigation
  stores/               # 3 Zustand stores
    trackingStore.js    # Live session (ephemeral)
    userStore.js        # Settings + XP (from Dexie)
    authStore.js        # Firebase auth state
  lib/                  # 7 utility modules
    db.js               # Dexie setup + CRUD
    gps.js              # Haversine, smoothing, pace
    calories.js         # MET-based calorie estimate
    analytics.js        # Streak, PRs, chart data
    achievements.js     # Badge definitions, level calc
    cloudSync.js        # Firebase Firestore sync
    firebase.js         # Firebase init (placeholder)
  hooks/                # 3 custom hooks
    useGeolocation.js   # GPS watchPosition
    useWakeLock.js      # Screen wake lock
    useTheme.js         # Dark/light toggle
  utils/                # 2 utility modules
    constants.js        # Default settings, states, nav
    formatters.js       # Duration, distance, pace formatting
  infrastructure/       # UNUSED
    storage/            # Complete localStorage persistence layer
  domain/               # UNUSED
    analytics/          # Safe aggregation functions
```

### 3.1 Data Flow (Current)

```
[GPS Sensor] → trackingStore (Zustand, in-memory)
                    ↓ addPoint()
              metrics computed in addPoint()
                    ↓ getWalkData()
              saveWalk() → Dexie.walks
                    ↓
              Dexie.walks → Home (reduce + format → rings)
              Dexie.walks → Stats (reduce + format → charts, log)
              Dexie.walks → WalkSummary (direct render)
              Dexie.walks → Achievements (check conditions)
              Dexie.walks → Analytics (streak, PRs, chart data)

              Dexie.settings → userStore (Zustand, cached)
                    ↓
              userStore → All components (goals, theme, profile)
```

### 3.2 Key Architectural Weaknesses

1. **No centralized aggregation.** Each page independently queries Dexie and runs its own reduce. Aggregation logic is duplicated 5 times with inconsistent NaN guards. (Finding #5)
2. **No validation on read.** Dexie records are trusted as-is. Corrupt data flows directly into UI. (Finding #7)
3. **Two persistence layers, one connected.** The `infrastructure/storage/` layer has validation, quarantine, cross-tab sync, and atomic writes — none of which the active code uses. (Finding #1)
4. **No reactive updates.** Pages query Dexie on mount only. Navigation back to Home after a walk shows stale data. (Finding #10)
5. **Live tracking state is ephemeral.** A tab close or crash during a walk loses all GPS data. (PRD proposed feature)

## 4. Target Architecture (To-Be)

The refactored architecture separates concerns into three layers with strict import rules:

```
Domain Layer (pure logic, no React, no storage)
  ├── analytics/derivedValues.js    ← SAFE aggregation, progress, snapshots
  ├── analytics/streaks.js          ← Pure streak calculation
  ├── analytics/personalRecords.js  ← Pure PR calculation
  └── calculations/calories.js      ← MET-based estimates
  └── calculations/steps.js         ← Stride-based estimates
  └── calculations/gps.js           ← Haversine, smoothing

Infrastructure Layer (storage, external APIs)
  ├── storage/                      ← Connect the existing adapter
  │   ├── index.js                  ← Public API (load, save, update, subscribe)
  │   ├── localStorageAdapter.js    ← The adapter (already built)
  │   ├── documentSchema.js         ← Validation (already built)
  │   └── legacyIndexedDbImporter.js ← Migration (already built)
  └── firebase.js                   ← Optional cloud sync

Application Layer (React, Zustand, components)
  ├── stores/
  │   ├── trackingStore.js          ← Live session only
  │   ├── dataStore.js              ← NEW: reactive bridge to storage layer
  │   └── authStore.js              ← Firebase auth
  ├── pages/                        ← Route-level components
  ├── components/                   ← Reusable UI
  └── hooks/                        ← React hooks
```

### 4.1 Import Rules

| Layer | May Import | Must NOT Import |
|-------|-----------|-----------------|
| Domain | Nothing (pure functions) | React, Zustand, storage, DOM |
| Infrastructure | Domain (for validation) | React, Zustand, components |
| Application | Domain, Infrastructure | Direct localStorage, direct Dexie |

### 4.2 The `dataStore` — Reactive Bridge

The key new piece is `dataStore.js`: a Zustand store that wraps the storage adapter and exposes reactive state.

```
dataStore (Zustand)
  ├── .walks          ← from storage adapter, updated via subscribe()
  ├── .settings       ← from storage adapter, updated via subscribe()
  ├── .todaySnapshot  ← derived from walks via derivedValues.js
  ├── .streak         ← derived from walks via streaks.js
  ├── .personalRecords ← derived from walks via personalRecords.js
  ├── .chartData      ← derived from walks via derivedValues.js
  ├── .saveWalk()     ← delegates to storage adapter
  ├── .updateSetting() ← delegates to storage adapter
  └── .status         ← 'loading' | 'ready' | 'error' | 'degraded'
```

This eliminates:
- **Finding #5:** One aggregation path, not five
- **Finding #10:** Reactive updates when walks change
- **Finding #1:** Safe aggregation via derivedValues.js
- **Finding #7:** Validation via storage adapter

### 4.3 What Gets Better

| Current Problem | After Refactor |
|----------------|----------------|
| 5 duplicate reduce blocks with inconsistent NaN guards | One `aggregateWalks()` call from derivedValues.js |
| NaN can reach the DOM | `safeNumber()` and `safeProgress()` in derivedValues.js |
| No validation on Dexie reads | `validateWalk()` applied on every read |
| Corrupt records break aggregation | Quarantine system isolates bad records |
| Home shows stale data after walk | Reactive subscription via dataStore |
| No cross-tab consistency | Storage event listener in adapter |
| No recovery from corrupt storage | Recovery document + quarantine |
| Live tracking data lost on crash | Periodic checkpointing to storage |

## 5. Storage Layer Contract

The storage adapter must implement this interface (from `storagePort.js`):

```typescript
interface StoragePort {
  load(): Promise<{ document, status, issues, writeBlocked }>
  save(document, { expectedRevision }): Promise<{ document, status }>
  update(mutator, { expectedRevision }): Promise<{ document, status }>
  remove(collection, id, { expectedRevision }): Promise<{ document, status }>
  clearAll({ expectedRevision }): Promise<{ document, status }>
  subscribe(listener): () => void  // returns unsubscribe
  export(): Promise<{ serialized, document, status }>
  import(payload, { mode }): Promise<{ document, status }>
}
```

This interface is backend-agnostic. A future implementation could wrap a REST API, a different IndexedDB schema, or a server-backed database. Feature code (pages, stores, components) never touches `localStorage` or `Dexie` directly — it goes through `dataStore` which goes through the adapter.

## 6. Migration Strategy

The existing Dexie data must be migrated to the localStorage adapter format without losing any records.

**Step 1:** The `legacyIndexedDbImporter.js` reads all walks and settings from Dexie, validates each record, and quarantines invalid ones.

**Step 2:** `mergeLegacyData()` combines the legacy records with any existing localStorage document (initially empty on first run).

**Step 3:** The merged document is saved to localStorage via the adapter's `save()`.

**Step 4:** A flag (`migration.legacyIndexedDbImported`) prevents re-running the migration.

**Step 5:** After migration, feature code is switched from Dexie to the dataStore. Dexie remains as a read-only fallback for one release cycle, then is removed.

**Rollback:** If the migration produces unexpected results, the flag can be reset and the app falls back to Dexie. The original Dexie data is never deleted.

## 7. Forward Compatibility

| Concern | How Handled |
|---------|------------|
| Schema versioning | `schemaVersion` field in document; `migrateDocument()` handles v0→v1, future versions add N→N+1 migrations |
| Unknown fields | Quarantined, not discarded — preserved for future migration |
| Corrupt records | Quarantined per-record, rest of data remains usable |
| New settings | `DEFAULT_PERSISTED_SETTINGS` provides defaults; unknown keys quarantined |
| Future backend | Storage adapter interface is API-agnostic; swap implementation, no feature code changes |

## 8. What Is NOT Changing

- The React framework (stays React 19)
- The styling approach (stays Tailwind CSS 4)
- The map library (stays Leaflet)
- The chart library (stays Recharts)
- The animation library (stays Framer Motion)
- The existing page structure and routes
- The visual design (tokens, glassmorphism, gradients)
- The tracking algorithm (GPS smoothing, calorie/step estimation)

## 9. Deployment

The app builds to static files via Vite. Deployment options:

- **Static hosting** (Netlify, Vercel, GitHub Pages): simplest, recommended
- **PWA**: service worker is configured via `vite-plugin-pwa` but not currently active
- **Self-hosted**: `vite build` produces a `dist/` folder that can be served from any HTTP server

No server-side code is required. No environment variables are needed for core functionality (Firebase keys are optional).

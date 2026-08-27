# Graph Report - Walk tracking   (2026-08-27)

## Corpus Check
- 63 files · ~54,310 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 313 nodes · 696 edges · 13 communities (10 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- DataStore & App Pages
- Storage Document Schema
- ESLint Config
- Architecture & Findings
- External Dependencies
- DataStore Implementation
- UI Components & GPS
- Firebase & Cloud Sync
- Storage Test Utilities
- Storage Event Tests
- Storage Port Interface

## God Nodes (most connected - your core abstractions)
1. `useUserStore` - 21 edges
2. `WalkSummary()` - 17 edges
3. `Track()` - 15 edges
4. `getLocalDateString()` - 15 edges
5. `validateWalk()` - 14 edges
6. `createLocalStorageAdapter()` - 13 edges
7. `writeDocument()` - 13 edges
8. `Home()` - 13 edges
9. `Stats()` - 13 edges
10. `validateDocument()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `saveWalk()` --calls--> `getLocalDateString()`  [EXTRACTED]
  src/lib/db.js → src/utils/formatters.js
- `getTodayWalks()` --calls--> `getLocalDateString()`  [EXTRACTED]
  src/lib/db.js → src/utils/formatters.js
- `App()` --calls--> `initDataStore()`  [EXTRACTED]
  src/App.jsx → src/application/stores/dataStore.js
- `App()` --calls--> `useAuthStore`  [EXTRACTED]
  src/App.jsx → src/stores/authStore.js
- `initDataStore()` --calls--> `initializeLocalStorageDataLayer()`  [EXTRACTED]
  src/application/stores/dataStore.js → src/infrastructure/storage/index.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Three-Layer Architecture** — dataStore, storageAdapter, domainLayer, applicationLayer [INFERRED]
- **NaN Safety Fix Chain** — finding1, finding2, finding5, derivedValues, dataStore [INFERRED]
- **Data-Dependent Features** — activityRings, streakTracker, weeklyChart, personalRecords, walkSummary [INFERRED]

## Communities (13 total, 3 thin omitted)

### Community 0 - "DataStore & App Pages"
Cohesion: 0.09
Nodes (41): App(), clearAll(), deleteWalk(), getChartData(), getPersonalRecords(), getRecentWalks(), getStreak(), getTodayWalks() (+33 more)

### Community 1 - "Storage Document Schema"
Cohesion: 0.09
Nodes (48): cloneDocument(), createEmptyDocument(), createWalkRecord(), CURRENT_SCHEMA_VERSION, DATA_KEY, DEFAULT_PERSISTED_SETTINGS, finiteNonNegative(), isPlainObject() (+40 more)

### Community 2 - "ESLint Config"
Cohesion: 0.06
Nodes (35): eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, devDependencies, eslint, @eslint/js (+27 more)

### Community 3 - "Architecture & Findings"
Cohesion: 0.07
Nodes (35): Achievement System, Activity Rings (Home Dashboard), Application Layer, Cross-Tab Sync, Data Export/Import, dataStore (reactive bridge), Deferred Items, derivedValues.js (Safe Aggregation) (+27 more)

### Community 4 - "External Dependencies"
Cohesion: 0.07
Nodes (29): dexie, dexie-react-hooks, firebase, framer-motion, html-to-image, leaflet, lucide-react, dependencies (+21 more)

### Community 5 - "DataStore Implementation"
Cohesion: 0.20
Nodes (18): getTodaySnapshot(), hydrate(), initDataStore(), shallowSettingsEqual(), useDataStore, aggregateWalks(), calculateGoalProgress(), calculateOverallProgress() (+10 more)

### Community 6 - "UI Components & GPS"
Cohesion: 0.17
Nodes (13): BottomNav(), icons, calculateCalories(), estimateSteps(), calculatePace(), calculateSpeed(), calculateTotalDistance(), haversineDistance() (+5 more)

### Community 7 - "Firebase & Cloud Sync"
Cohesion: 0.15
Nodes (8): performSync(), startCloudSync(), stopCloudSync(), firebaseConfig, db, getTodayWalks(), saveWalk(), useAuthStore

## Knowledge Gaps
- **44 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+39 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `initializeLocalStorageDataLayer()` connect `Storage Document Schema` to `DataStore Implementation`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `dependencies` connect `External Dependencies` to `ESLint Config`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `getLocalDateString()` connect `DataStore Implementation` to `DataStore & App Pages`, `Storage Document Schema`, `Firebase & Cloud Sync`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _44 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DataStore & App Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.08955223880597014 - nodes in this community are weakly interconnected._
- **Should `Storage Document Schema` be split into smaller, more focused modules?**
  _Cohesion score 0.08990384615384615 - nodes in this community are weakly interconnected._
- **Should `ESLint Config` be split into smaller, more focused modules?**
  _Cohesion score 0.05555555555555555 - nodes in this community are weakly interconnected._
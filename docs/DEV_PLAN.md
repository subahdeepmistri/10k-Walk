# Development Plan: WalkTracker

## 1. Guiding Principles

1. **Each step leaves the app runnable.** No step breaks the build or prevents the user from completing a walk.
2. **Fix data integrity before UI.** A beautiful ring over broken data is still broken.
3. **Refactors are behaviour-preserving.** Same inputs → same observable outputs.
4. **Bug fixes are isolated.** Each fix is a separate change from each refactor and from each feature.
5. **The existing infrastructure layer is the highest-leverage asset.** Connecting it resolves findings #1, #2, #4, #5, #7, #8, #10 simultaneously.

## 2. Phase Mapping

This plan maps to the implementation phases in the master prompt:

| This Plan | Master Phase | Description |
|-----------|-------------|-------------|
| Steps 1-3 | Phase 3 | Target architecture design (folder structure, layer boundaries, refactoring strategy) |
| Steps 4-5 | Phase 4 | Storage layer: connect the existing adapter, migrate Dexie data |
| Steps 6-8 | Phase 5 | UI components: reuse existing, build missing, apply trust rules |
| Steps 9-14 | Phase 6 | Implementation: refactor, fix findings, build features |
| Step 15 | Phase 7 | Performance optimization |
| Step 16 | Phase 8 | Verification |

## 3. Step-by-Step Plan

### Step 1: Design the target folder structure (Phase 3)

**Goal:** Define the clean architecture layout with import rules.

**Deliverables:**
- New folder tree with one-line rationale per directory
- Layer diagram with import direction arrows
- List of which files move where

**Does not change:** Any runtime behaviour. This is documentation only.

**Verification:** The folder tree is reviewed and approved.

---

### Step 2: Define the refactoring strategy (Phase 3)

**Goal:** Sequence the refactoring so each step is verifiable.

**Order of operations:**
1. Create `src/domain/` modules (pure functions, no external deps)
2. Create `src/infrastructure/storage/` connection point
3. Create `src/stores/dataStore.js` (reactive bridge)
4. Switch pages from Dexie/lib/db.js to dataStore
5. Remove direct Dexie imports from pages

**Verification:** After each sub-step, the app runs identically.

---

### Step 3: Connect the storage layer (Phase 4 — Step 1)

**Goal:** Initialize the localStorage adapter, run the legacy Dexie migration, and verify data is preserved.

**Changes:**
- Modify `src/App.jsx` to call `initializeLocalStorageDataLayer()` on startup, passing the Dexie `db` instance
- Store the adapter instance in a module-level variable (or React context)
- After migration completes, log the result (imported / already-imported / not-available)
- Verify: all existing walks appear in the new document

**Finding addressed:** #1 (infrastructure layer connected), #7 (validation on read now active)

**Verification:** Load app with existing Dexie data → walks appear correctly. Check `walktracker:data` in localStorage → document contains all walks with valid schema.

---

### Step 4: Create `dataStore.js` — the reactive bridge (Phase 4 — Step 2)

**Goal:** A Zustand store that wraps the storage adapter and provides reactive state to all pages.

**Changes:**
- Create `src/stores/dataStore.js` with:
  - `walks: []` — all walks, updated via adapter subscription
  - `settings: {}` — all settings, updated via adapter subscription
  - `todayWalks: []` — today's walks, derived from `walks`
  - `status: 'loading' | 'ready' | 'error' | 'degraded'`
  - `todaySnapshot` — computed via `createDailyGoalSnapshot()` from derivedValues.js
  - `streak` — computed via `calculateStreak()`
  - `weeklyActivity` — computed via `getWeeklyActivity()`
  - `personalRecords` — computed via `calculatePersonalRecords()`
  - `chartData` — computed via `getChartData()`
  - `saveWalk(walk)` — delegates to adapter
  - `updateSetting(key, value)` — debounced, delegates to adapter
  - `deleteWalk(id)` — delegates to adapter
- Subscribe to adapter events to keep walks/settings in sync
- On startup, load document and populate state

**Finding addressed:** #5 (single aggregation path), #10 (reactive updates), #1 (safe aggregation)

**Verification:** Save a walk → Home rings update immediately without page refresh. Open two tabs → changes in one appear in the other.

---

### Step 5: Migrate `userStore.js` to use `dataStore` (Phase 4 — Step 3)

**Goal:** Eliminate the dual-source-of-truth problem for settings.

**Changes:**
- Modify `src/stores/userStore.js` to read settings from `dataStore` instead of independently loading from Dexie
- `updateSetting()` delegates to `dataStore.updateSetting()`
- Remove the `loadSettings()` function — dataStore handles initialization
- Keep `isLoaded` state tied to dataStore.status

**Finding addressed:** Settings dual-source-of-truth

**Verification:** Change a setting in Settings page → it takes effect immediately on Home.

---

### Step 6: Replace inline aggregation with derivedValues.js (Phase 5 — Step 1)

**Goal:** Eliminate all 5 duplicate reduce blocks.

**Changes:**
- `Home.jsx:52-61` → replace with `dataStore.todaySnapshot.totals`
- `Home.jsx:28-31` → replace with `dataStore.todaySnapshot.progress`
- `Track.jsx:91-97` → replace with `dataStore.todaySnapshot` (base values)
- `Stats.jsx:123-130` → replace with `aggregateWalks(filteredWalks)`
- `analytics.js:95-103` → keep (used by calculatePersonalRecords, which stays in analytics.js)
- `analytics.js:163-169` → keep (used by getChartData)

**Finding addressed:** #5 (duplicate aggregation), #1 (NaN-safe via derivedValues.js), #2 (clamped progress via safeProgress)

**Verification:** Walk complete → Home rings match exactly. Stats totals match exactly. No NaN in DOM.

---

### Step 7: Add missing `MapPin` import to Stats.jsx (Phase 6 — Finding #3)

**Goal:** Fix the runtime crash.

**Changes:**
- Add `MapPin` to the lucide-react import at `src/pages/Stats.jsx:6`

**Finding addressed:** #3

**Verification:** Navigate to Stats with >0 walks → "All-Time Bests" section renders without error.

---

### Step 8: Fix `calculateStreak` mutation (Phase 6 — Finding #4)

**Goal:** Make streak calculation pure.

**Changes:**
- In `src/lib/analytics.js:13-40`, replace `today.setDate(today.getDate() - 1)` with creation of a new Date per iteration: `new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)`

**Finding addressed:** #4

**Verification:** Call `calculateStreak()` twice with same walks → same result. Walk Mon-Wed, verify streak is 3.

---

### Step 9: Remove fake "Synced" badge (Phase 6 — Finding #8)

**Goal:** Stop lying to the user about cloud sync status.

**Changes:**
- In `src/pages/Settings.jsx:64-67`, replace the "Synced" badge with a conditional: show "Synced" only if Firebase is actually configured and connected; otherwise show nothing (or "Local only")
- In `src/lib/firebase.js`, export a `isConfigured` flag that checks if API key is still the placeholder

**Finding addressed:** #8

**Verification:** Without Firebase config, Settings shows no "Synced" badge.

---

### Step 10: Fix Home data staleness (Phase 6 — Finding #10)

**Goal:** Home re-queries when the user returns from a walk.

**Changes:**
- Since `dataStore` is reactive (Step 4), Home already re-renders when `walks` changes
- Verify that the subscription fires after `saveWalk()` completes
- If not, add a manual refresh trigger in Home's `useEffect` that re-reads from dataStore

**Finding addressed:** #10

**Verification:** Complete a walk → navigate to Home → rings show new data immediately.

---

### Step 11: Fix Stats chart period selector (Phase 6 — Finding #9)

**Goal:** Allow 7-day and 30-day chart views.

**Changes:**
- Add a "Last 7 days" / "Last 30 days" toggle to the Stats Overview tab
- Call `getChartData(walks, selectedPeriod)` instead of hardcoded `'week'`

**Finding addressed:** #9

**Verification:** Toggle to 30 days → chart shows 30 bars.

---

### Step 12: Add tracking checkpointing (PRD proposed feature)

**Goal:** Protect in-progress walk data from tab close / crash.

**Changes:**
- In `trackingStore.js`, add `checkpointTracking()` that serializes `{points, rawPoints, startTime, pausedTime, distance, steps, calories, ...}` to `localStorage` under a key like `walktracker:checkpoint`
- Call `checkpointTracking()` every 30 seconds during tracking (via setInterval in Track.jsx)
- On `startTracking()`, check for existing checkpoint and offer recovery
- On `stopTracking()` or `resetTracking()`, clear the checkpoint
- On crash recovery: show a prompt "You have an unfinished walk. Recover?" with distance/time summary

**Finding addressed:** PRD proposed feature (crash resilience)

**Verification:** Start a walk, close the tab, reopen → recovery prompt appears with correct distance/time.

---

### Step 13: Apply trust and honesty rules (Phase 5 — Step 2)

**Goal:** Implement the empty states, error states, and save confirmation from the UI/UX doc.

**Changes:**
- Add "Saved ✓" indicator on WalkSummary after successful save
- Add "Updated just now" / "Updated Xm ago" below Home rings
- Verify empty states match UI/UX doc for all screens
- Add `aria-valuenow` / `aria-valuemin` / `aria-valuemax` to ProgressRing
- Add `aria-live="polite"` to dynamically updated stat values

**Finding addressed:** Trust and honesty rules from UI/UX doc

**Verification:** Screen reader announces progress ring values. Save confirmation visible after walk.

---

### Step 14: Add data import to Settings (PRD proposed feature)

**Goal:** Complement the existing export feature.

**Changes:**
- Add an "Import" button in the Settings Data section
- Use `<input type="file" accept=".json">` to pick a file
- Call `adapter.import(fileContent, { mode: 'merge' })` for normal import
- Show result: "Imported N walks, M settings, Q quarantined"

**Finding addressed:** PRD proposed feature (data import)

**Verification:** Export from one browser, import into another → walks appear.

---

### Step 15: Performance optimization (Phase 7)

**Goal:** Identify and fix performance bottlenecks.

**Focus areas:**
1. GPS point accumulation in trackingStore — downsample after smoothing
2. `calculateStreak` O(n) with Date objects — optimize with Set-based approach
3. Home `loadData` — potentially expensive with many walks (getWalks loads all)
4. Recharts rendering — verify no unnecessary re-renders
5. Memory leaks — verify all intervals, subscriptions, and watchers are cleaned up

**Measurement:** Profile before and after. State what improved.

---

### Step 16: Verification (Phase 8)

**Goal:** Prove the original complaint is fixed.

**Checklist:**
- Every item in the render-path map from Phase 0 now traces to real stored data
- Every Phase 1 edge case re-tested (empty storage, corrupt storage, old-version data, quota exceeded, two tabs, refresh mid-write, midnight rollover)
- Definition of Done from this document, item by item
- No behaviour changed except approved defect fixes
- Accessibility pass at mobile, tablet, desktop widths
- Known gaps documented honestly

---

## 4. Definition of Done

The refactor is complete when ALL of these are true:

| # | Criterion | Verified By |
|---|-----------|------------|
| D-1 | Every displayed numeric value traces to stored data through validated aggregation | Phase 8 render-path audit |
| D-2 | No `NaN`, `Infinity`, or `undefined` renders in the DOM under any data condition | DOM inspection with corrupt data |
| D-3 | Corrupt walk records are quarantined without affecting other records | Corrupt one record, verify others display |
| D-4 | Fresh install shows empty state, not error state | Clear all data, reload |
| D-5 | Walk data persists across browser sessions | Save walk, close browser, reopen |
| D-6 | All 14 achievements unlock at correct thresholds | Test each achievement condition |
| D-7 | Activity Rings reflect the sum of today's walks, not cached data | Complete walk, navigate Home, verify rings |
| D-8 | Export produces valid JSON that can be re-imported | Export → import → verify walks match |
| D-9 | The app works without Firebase configuration | Remove Firebase keys, verify all features work |
| D-10 | No backend is required | Run app entirely offline |
| D-11 | In-progress walks survive tab close | Start walk, close tab, reopen, recover |
| D-12 | Two tabs open simultaneously stay in sync | Make changes in both tabs, verify consistency |
| D-13 | Home data refreshes when returning from a walk | Complete walk → navigate Home → rings updated |
| D-14 | All interactive elements are keyboard accessible | Tab through all screens |
| D-15 | The app runs at 60fps during tracking | Profile during active GPS tracking |

## 5. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Migration loses data | Low | High | Migration never deletes original Dexie data; flag prevents re-run |
| Storage adapter has undiscovered bugs | Medium | Medium | Existing test suite covers 18 scenarios; add integration tests |
| Reactive subscription causes render loops | Medium | Medium | Use Zustand selectors; verify with React DevTools |
| Checkpointing causes storage quota issues | Low | Low | Checkpoint is ~10KB per walk; quota is 5-10MB |
| Performance regression from additional validation | Low | Low | Validation runs once on load, not per-frame |

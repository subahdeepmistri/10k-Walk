# Software Requirements Specification — WalkTracker

## 1. Functional Requirements

### 1.1 Tracking (FR-TRK)

| ID | Requirement | Testable Condition |
|----|-------------|-------------------|
| FR-TRK-01 | Start tracking creates new session with empty points, zeroed metrics, `status = TRACKING` | `trackingStore.status === 'tracking'` after Start; `points.length === 0` |
| FR-TRK-02 | Each valid GPS point updates distance, pace, speed, elevation, steps, calories | After `addPoint()`, `distance > prevDistance`; `currentPace` finite; `steps ≥ prevSteps` |
| FR-TRK-03 | Segment distance filter rejects jumps >100m and <0.5m | Synthetic points 200m apart → `distance` unchanged |
| FR-TRK-04 | 3-point moving average smoothing applied to lat/lng | Three collinear points → middle point unchanged; noisy middle → smoothed toward neighbors |
| FR-TRK-05 | Auto-pause triggers after 3.5s below speed threshold (default 0.3 m/s) | Mock GPS speed 0.1 m/s for 4s → `status === 'paused'` |
| FR-TRK-06 | Manual pause/resume/stop transitions state correctly | Pause → `status='paused'`; Resume → `status='tracking'`; Stop → `status='stopped'` |
| FR-TRK-07 | `getWalkData()` returns complete walk object with all metrics | Keys: `points, startTime, endTime, distance, duration, steps, calories, averageSpeed, averagePace, maxSpeed, elevationGain, elevationLoss, altitudePoints` all present, finite numbers |
| FR-TRK-08 | Elapsed time during tracking derived from single source (store) | `Track` timer display matches `getWalkData().duration` within 1s at stop |

### 1.2 Persistence (FR-PER)

| ID | Requirement | Testable Condition |
|----|-------------|-------------------|
| FR-PER-01 | `saveWalk()` updates the versioned `localStorage` document with local date, stable ID, `createdAt`, and `updatedAt` | `storage.load().walks.find(walk => walk.id === id)` returns an object whose `date` equals `getLocalDateString(startTime)` |
| FR-PER-02 | All numeric fields coercible to finite numbers on read | `validateWalk(raw)` returns object with `distance: number`, `steps: number`, etc.; no `NaN`/`Infinity` |
| FR-PER-03 | A malformed walk is isolated without preventing valid records from loading | `load()` returns every valid walk and records the malformed item in `quarantine` with its original value and reason |
| FR-PER-04 | `QuotaExceededError` caught, user notified, export offered | Fill storage → `saveWalk()` → toast "Storage full. Export your data?" + Export button works |
| FR-PER-05 | `SecurityError` (private mode) caught, session continues in memory | Private Safari → Start walk → Stop → Summary shows data; reload → data gone (expected) |
| FR-PER-06 | Cross-tab settings sync via `storage` event | Tab A: change unit to mi → Tab B: `userStore.unit === 'mi'` within 1s without reload |
| FR-PER-07 | The stored document has an integer `schemaVersion` and sequential migration registry | Loading a fixture at version N applies every migration through the current version and writes no downgrade |
| FR-PER-08 | Settings migration map handles renamed keys | `loadSettings()` with old key `dailyGoal` → maps to `dailyStepGoal` |
| FR-PER-09 | Existing records in the current `WalkTrackerDB` IndexedDB database are imported non-destructively on first compatible load | With a legacy fixture present, all valid walks/settings appear in the new document and the IndexedDB source remains unchanged |
| FR-PER-10 | A failed migration never replaces the last readable document | Force a migration error → active key remains readable and recovery metadata reports the failure |

### 1.3 Dashboard (FR-HOM)

| ID | Requirement | Testable Condition |
|----|-------------|-------------------|
| FR-HOM-01 | Four rings show progress = `todayStats.metric / goal` clamped 0–1 | `stepProgress === Math.min(1, todayStats.steps / dailyStepGoal)` |
| FR-HOM-02 | Ring center value = formatted `todayStats.metric` | `formatNumber(todayStats.steps)` matches ring center text |
| FR-HOM-03 | Streak = consecutive local-date walks (yesterday continuation allowed) | Walks on Mon, Tue, Thu → streak=0; Mon, Tue, Wed → streak=3; Tue only (today Wed) → streak=1 |
| FR-HOM-04 | Weekly activity: 7 items, `hasWalked` true iff walk exists for that local date | `getWeeklyActivity(walks).every(d => d.hasWalked === walks.some(w => w.date === d.date))` |
| FR-HOM-05 | Level/XP ring progress = `(xp - totalXpForLevel) / xpForNextLevel` clamped 0–1 | `level.progress ≥ 0 && level.progress ≤ 1` |
| FR-HOM-06 | Recent walks list shows ≤5 most recent by `startTime` desc | `recentWalks.length ≤ 5`; `recentWalks[i].startTime ≥ recentWalks[i+1].startTime` |

### 1.4 Statistics (FR-STA)

| ID | Requirement | Testable Condition |
|----|-------------|-------------------|
| FR-STA-01 | 7-day chart data has 7 entries, one per local date, zeros for missing days | `chartData.length === 7`; `chartData.every(d => d.date === getLocalDateString(...))` |
| FR-STA-02 | Personal records: longest single walk distance, longest duration, most steps, fastest pace (≥1km, ≥3 min/km) | `prs.longestSingleWalk === Math.max(...walks.map(w => w.distance))` for walks ≥1000m |
| FR-STA-03 | History log groups by `date`, filterable week/month/all | `groupedWalks[date].every(w => w.date === date)`; filter reduces entries correctly |
| FR-STA-04 | Export produces valid JSON importable to a fresh install | `JSON.parse(exported)` validates and `importData(parsed)` restores all valid walks and settings |

### 1.5 Walk Summary (FR-SUM)

| ID | Requirement | Testable Condition |
|----|-------------|-------------------|
| FR-SUM-01 | Map shows route polyline + start (green) / end (red) markers | `routePath.length > 1` → `<Polyline>` + two `<CircleMarker>` rendered |
| FR-SUM-02 | Elevation chart renders iff `altitudePoints.length > 2` | `walk.altitudePoints?.length > 2` ↔ `<AreaChart>` present |
| FR-SUM-03 | New achievements detected and unlocked with XP | `checkAchievements(stats, walk, unlocked)` returns newly unlocked; `unlockAchievement` called for each |
| FR-SUM-04 | Share exports PNG via `html-to-image` | `handleShare()` → `toPng()` called with `#walk-summary-card`; blob created |

### 1.6 Achievements (FR-ACH)

| ID | Requirement | Testable Condition |
|----|-------------|-------------------|
| FR-ACH-01 | 14 achievements defined, each with unique id, condition, xp | `ACHIEVEMENTS.length === 14`; `new Set(ACHIEVEMENTS.map(a => a.id)).size === 14` |
| FR-ACH-02 | Level formula: L1=0, L2=100, L3=300, L4=600... (L_n = 100 × triangular(n-1)) | `calculateLevel(0).level === 1`; `calculateLevel(100).level === 2`; `calculateLevel(300).level === 3` |
| FR-ACH-03 | Overall progress ring = `unlockedCount / 14` | `progress === unlockedAchievements.length / 14` |

### 1.7 Settings (FR-SET)

| ID | Requirement | Testable Condition |
|----|-------------|-------------------|
| FR-SET-01 | Inline editors update the UI optimistically and confirm persistence | Change weight → `userStore.weightKg` updates → `storage.load().settings.weightKg` matches and save status becomes `saved` |
| FR-SET-02 | Distance goal input shows value in current unit, stores in meters | Unit=mi, input 3.1 → stored `≈ 4989` meters |
| FR-SET-03 | Theme toggle updates `data-theme` on `<html>` | Toggle → `document.documentElement.dataset.theme` flips |
| FR-SET-04 | Clear All Data requires explicit confirmation and replaces the active document with a valid empty document | Confirm clear → `storage.load()` returns empty walks, default settings, incremented revision, and no parse error |

### 1.8 Storage Interface and Ownership (FR-STO)

| ID | Requirement | Testable Condition |
|----|-------------|-------------------|
| FR-STO-01 | Feature code uses only `load`, `save`, `update`, `remove`, `subscribe`, `export`, and `import`; only the adapter accesses `window.localStorage` | Static search finds `localStorage` only in `src/infrastructure/storage/` and its tests |
| FR-STO-02 | Every successful write increments a monotonic document `revision` | Two sequential writes produce revisions N+1 and N+2 |
| FR-STO-03 | A tab reacts to committed writes from another tab | Tab A writes revision N+1 → Tab B subscription receives it and renders the same records within 1 second |
| FR-STO-04 | A write based on a stale revision does not silently overwrite newer data | Attempt save with expected N while active revision is N+1 → conflict result; newer document remains active |
| FR-STO-05 | Export and import use the same validation and migration pipeline as normal reads | Import old-version fixture → migrations run; invalid entries are quarantined; valid entries load |
| FR-STO-06 | No account, authentication, cloud sync, remote database, or application API is required or presented as available | App bundle contains no Firebase runtime dependency and UI has no account/sync controls |

## 2. Non-Functional Requirements

### 2.1 Performance (NFR-PERF)

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-PERF-01 | Track screen frame rate during active tracking | ≥55 fps on 5-year-old phone (Snapdragon 765 / A13 class) |
| NFR-PERF-02 | Cold start to interactive (Home) | <3s on 3G / <1.5s on WiFi |
| NFR-PERF-03 | `getWalks()` for 1000 walks | <200ms |
| NFR-PERF-04 | Memory during 2-hour walk | <50 MB heap growth |

### 2.2 Reliability (NFR-REL)

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-REL-01 | No unhandled promise rejection in production | 0 in Sentry/logs over 30 days |
| NFR-REL-02 | Data survival across app updates | 100% of walks readable after `npm version patch && deploy` |
| NFR-REL-03 | Graceful degradation: private mode, quota full, no GPS | Feature works with reduced capability; never blank screen |

### 2.3 Accessibility (NFR-A11Y)

| ID | Requirement | Test |
|----|-------------|------|
| NFR-A11Y-01 | All interactive elements keyboard reachable | Tab through every screen; no traps |
| NFR-A11Y-02 | Live values announced (`aria-live="polite"`) | Timer, ring progresses, streak changes announced |
| NFR-A11Y-03 | Color contrast ≥4.5:1 for text, ≥3:1 for UI | axe-core scan passes |
| NFR-A11Y-04 | No information conveyed by color alone | Rings have % text; pace zones have labels |

### 2.4 Security (NFR-SEC)

| ID | Requirement | Note |
|----|-------------|------|
| NFR-SEC-01 | No secrets or credentials are stored in the client bundle or storage document | Static scan finds no application secrets; exports contain only declared user data and metadata |
| NFR-SEC-02 | The app makes no claim that local data is access-controlled from someone with browser-profile access | Privacy notice states that browser-profile and device security protect local records |
| NFR-SEC-03 | All authorization and roles are explicitly out of scope | SRS and UI contain no enforceable role or permission requirements; no client-side gating is described as security |

## 3. Data Requirements

### 3.1 Walk Record (Stored inside the versioned `localStorage` document)

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `id` | string | Yes | Non-empty stable UUID; unique within `walks` |
| `date` | string (YYYY-MM-DD) | Yes | Matches `getLocalDateString(startTime)` |
| `startTime` | number (ms epoch) | Yes | Finite, ≤ now + 1 day |
| `endTime` | number (ms epoch) | Yes | ≥ startTime |
| `distance` | number (meters) | Yes | Finite, ≥ 0 |
| `duration` | number (ms) | Yes | Finite, ≥ 0 |
| `steps` | number | Yes | Finite, ≥ 0 |
| `calories` | number | Yes | Finite, ≥ 0 |
| `averageSpeed` | number (m/s) | Yes | Finite, ≥ 0 |
| `averagePace` | number (min/km) | Yes | Finite, ≥ 0 |
| `maxSpeed` | number (m/s) | Yes | Finite, ≥ 0 |
| `elevationGain` | number (m) | Yes | Finite, ≥ 0 |
| `elevationLoss` | number (m) | Yes | Finite, ≥ 0 |
| `points` | array<{lat, lng, timestamp, accuracy?, speed?, altitude?}> | No | If present, array of objects |
| `altitudePoints` | array<{distance, altitude}> | No | If present, array of objects |
| `createdAt` | number (ms epoch) | Yes | Finite |
| `updatedAt` | number (ms epoch) | Yes | Finite, ≥ createdAt |

### 3.2 Settings (Stored inside the same versioned document)

| Key | Type | Default | Validation |
|-----|------|---------|------------|
| `weightKg` | number | 70 | 30–250 |
| `heightCm` | number | 170 | 100–220 |
| `dailyStepGoal` | number | 10000 | ≥ 1000 |
| `dailyDistanceGoal` | number (meters) | 5000 | ≥ 500 |
| `dailyDurationGoal` | number (minutes) | 45 | ≥ 5 |
| `dailyCaloriesGoal` | number | 300 | ≥ 50 |
| `unit` | 'km' \| 'mi' | 'km' | Enum |
| `theme` | 'dark' \| 'light' | 'dark' | Enum |
| `autoPause` | boolean | true | Boolean |
| `autoPauseSpeed` | number (m/s) | 0.3 | 0.1–2.0 |
| `gpsAccuracyThreshold` | number (m) | 30 | 5–100 |
| `voiceFeedback` | boolean | false | Boolean |
| `onboardingComplete` | boolean | false | Boolean |
| `unlockedAchievements` | string[] | [] | Array of valid achievement IDs |
| `xp` | number | 0 | Finite, ≥ 0 |

### 3.3 Derived Values (Not Stored, Computed On-Demand)

- Today's aggregates: `aggregateWalks(getTodayWalks())`
- Streak: `calculateStreak(getWalks())`
- Weekly activity: `getWeeklyActivity(getWalks())`
- Level/XP: `calculateLevel(xp)`
- Personal records: `calculatePersonalRecords(getWalks())`
- Chart data: `getChartData(getWalks(), 'week')`

## 4. Validation Rules

1. **On write** (`saveWalk`, `saveSetting`): Reject `NaN`, `Infinity`, `undefined`, circular references, and invalid numeric types. Only a named migration may coerce a numeric string whose conversion is finite and lossless.
2. **On read** (`getWalks`, `getTodayWalks`, `getWalkById`): Every record passed through `validateWalk()` / `validateSetting()` before returning.
3. **Quarantine**: Invalid records are copied verbatim into the document's `quarantine` collection with reason and timestamp; UI shows "X records could not be loaded" with recovery/export actions.
4. **Serialization preflight**: The persistence layer rejects unsupported values and circular structures before constructing a write candidate.
5. **Commit safety**: A candidate is serialized and parsed back successfully before the active key is replaced; the previous active payload remains as last-known-good recovery data until the commit succeeds.

## 5. Error Handling

| Scenario | Behavior |
|----------|----------|
| GPS permission denied | Track shows "Location permission required" with button to open settings |
| GPS timeout (10s) | Toast "GPS signal weak. Walking anyway?"; tracking continues with last known position |
| `localStorage` quota exceeded | Failed status + Export action; unsaved walk remains in memory for retry during the session |
| `localStorage` unavailable or throws | In-memory session only; persistent banner "This session is not being saved" |
| Stale cross-tab write | Conflict status; reload/merge from the newer revision before retrying |
| Corrupted walk loaded | Isolated; banner shown; other walks unaffected |

## 6. Edge Cases (Explicitly Tested)

| Case | Expected |
|------|----------|
| First run, empty storage | Home shows zeros, streak 0, "No walks yet" card, Start Walk button works |
| Storage cleared mid-session | Next `loadSettings()` loads defaults; tracking session continues in memory |
| Corrupt JSON import | Invalid records skipped; valid ones imported; summary toast "Imported 47 of 50 walks" |
| Walk spans midnight (start 23:50, end 00:10) | `date` = local date of `startTime`; streak counts for start date |
| Two tabs open, Tab A saves walk | Tab B Home rings update within 1s via `storage` event |
| Dataset approaches browser quota | Write either commits wholly or fails without replacing the last-known-good document; user can export |
| Rapid start/stop (10 times) | 10 walk records created; no duplicate IDs; all readable |
| `NaN` in `walk.distance` from old version | The malformed walk is quarantined with its original value; it does not contribute a false zero to totals |

## 7. Acceptance Criteria Traceability

Each FR/NFR above maps to Phase 1 findings:
- FR-PER-02,03 → Finding 2 (validation)
- FR-TRK-08 → Finding 4 (elapsed time)
- FR-TRK-05 → Finding 15 (auto-pause)
- FR-PER-04,05 → Finding 9 (quota/storage errors)
- FR-PER-06 → Finding 7 (cross-tab)
- FR-PER-07,08 → Finding 6,30 (versioning/migration)
- FR-PER-09,10 → non-destructive migration requirement and Finding 6
- FR-STO-01 through FR-STO-05 → Findings 2,7,9 and the Phase 4 storage contract
- FR-STO-06 → no-backend/localStorage-only constraint; replaces current Firebase behavior
- FR-HOM-03 → Finding 1,29 (streak bug, missing date)
- FR-STA-02 → Finding 21 (PR pace formula)
- NFR-REL-03 → Finding 26 (error boundaries)
- NFR-A11Y-02 → Trust rules (Phase 2.4)

---

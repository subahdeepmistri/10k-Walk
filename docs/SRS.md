# Software Requirements Specification: WalkTracker

## 1. Introduction

This document specifies the functional and non-functional requirements for WalkTracker, a client-side-only walking tracker web application. Requirements are individually testable and traceable to Phase 1 findings where applicable.

**Note on security and authorization:** This application has no backend. All "auth" and "permission" requirements are UI-level gating only — they prevent accidental actions, not malicious ones. A determined user with browser DevTools can bypass any client-side restriction. This is stated explicitly per requirement where applicable.

---

## 2. Functional Requirements

### 2.1 GPS Walk Tracking

| ID | Requirement | Finding | Test |
|----|------------|---------|------|
| FR-001 | The app MUST request GPS permission when the user taps "Start Walking" and MUST NOT begin tracking until permission is granted or position is obtained | | Start walk, verify permission dialog appears, verify tracking starts after grant |
| FR-002 | The app MUST display a real-time map with the user's current position and route polyline during tracking | | Start walk, move, verify map updates |
| FR-003 | The app MUST record GPS points with latitude, longitude, timestamp, accuracy, speed, and altitude when available | | Start walk, check stored walk record contains point array |
| FR-004 | The app MUST apply GPS smoothing (moving average, window size 3) to reduce noise | | Compare smoothed vs raw positions |
| FR-005 | The app MUST filter GPS segments >100m to prevent distance inflation from GPS jumps | | Simulate GPS jump, verify distance not affected |
| FR-006 | The app MUST calculate distance using haversine formula between consecutive smoothed points | | Walk known distance, compare to GPS distance |
| FR-007 | The app MUST exclude paused time from active duration and distance calculations | | Pause for 30s, resume, verify duration excludes pause |
| FR-008 | The app MUST support auto-pause when speed drops below a configurable threshold (default 0.3 m/s) for more than 3.5 seconds | | Walk slowly, verify auto-pause triggers |
| FR-009 | The app MUST NOT save walks shorter than 10 meters | | Walk <10m, stop, verify no save occurs |
| FR-010 | The app MUST request a Wake Lock to prevent screen sleeping during tracking | | Start walk, verify screen stays on (on supported devices) |

### 2.2 Walk Data Persistence

| ID | Requirement | Finding | Test |
|----|------------|---------|------|
| FR-100 | The app MUST save completed walks to IndexedDB via Dexie with all fields from getWalkData() plus local date and createdAt | | Complete walk, verify Dexie record contains all fields |
| FR-101 | The app MUST assign a date to each walk using the LOCAL start time (YYYY-MM-DD format), not UTC | | Walk across midnight, verify date matches local day of start |
| FR-102 | The app MUST validate walk data on read using validateWalk() — fields must be correct types, finite, non-negative where expected | #7 | Corrupt a walk record in Dexie, verify app quarantines it and displays remaining walks |
| FR-103 | The app MUST quarantine corrupt walk records instead of dropping them silently | #7 | Add a walk with `steps: NaN`, verify it's quarantined and other walks display correctly |
| FR-104 | The app MUST NOT let a single corrupt walk record affect aggregation of other walks | #1 | Corrupt one walk's `distance` to NaN, verify daily totals for other walks are unaffected |
| FR-105 | The app MUST recover from corrupt active storage using a recovery document | | Corrupt the active storage key, verify recovery from backup |
| FR-106 | The app MUST handle localStorage quota exceeded errors gracefully and inform the user | | Fill storage to quota, attempt save, verify error message |
| FR-107 | The app MUST handle unavailable storage (private browsing, security restrictions) by degrading to in-memory persistence | | Disable storage, verify app functions with "unsaved" indicator |
| FR-108 | The app MUST NOT silently lose data on any storage failure | | Simulate storage write failure, verify user is notified |

### 2.3 Derived Values and Aggregation

| ID | Requirement | Finding | Test |
|----|------------|---------|------|
| FR-200 | All daily aggregates (steps, distance, duration, calories) MUST be computed using safe numeric coercion that converts NaN, undefined, null, Infinity, and negative values to 0 | #1, #5 | Store a walk with `steps: NaN`, verify daily total is 0, not NaN |
| FR-201 | Progress percentages MUST be clamped to [0, 1] before display | #2 | Set goal to 0, verify progress shows 0%, not Infinity |
| FR-202 | The `overallProgress` value MUST NOT be NaN even when individual progress values are NaN | #2 | Corrupt a walk, verify overall progress is a finite number |
| FR-203 | Goal progress MUST handle zero goals by returning 0 progress (not dividing by zero) | #2 | Set dailyStepGoal to 0, verify progress ring shows 0% |
| FR-204 | Step estimation MUST use the formula: distance / (height * 0.00415) | | Walk known distance with known height, verify step count |
| FR-205 | Calorie estimation MUST use MET values based on speed brackets (2.0 to 6.0 MET) | | Walk at different speeds, verify calorie output varies |
| FR-206 | All aggregation MUST use the aggregateWalks() function from derivedValues.js, not inline reduce() | #5 | Verify no inline `walk.steps \|\| 0` patterns remain in Home, Track, Stats, or analytics.js |

### 2.4 Activity Rings and Daily Goals

| ID | Requirement | Finding | Test |
|----|------------|---------|------|
| FR-300 | The Home dashboard MUST display four progress rings: steps, distance, active minutes, calories | | Load Home, verify 4 rings render |
| FR-301 | Each ring's progress MUST equal (today's total / goal), clamped to [0, 1] | #1, #2 | Log a walk, verify ring progress updates |
| FR-302 | The "closed rings" count MUST equal the number of rings with progress >= 1.0 | #2 | Meet one goal exactly, verify count increments |
| FR-303 | The "overall progress" pill MUST show the average of four ring progress values, clamped to [0, 1] | #2 | Meet all goals, verify shows 100% |
| FR-304 | Changing a goal in Settings MUST immediately affect ring progress on next Home render | | Change step goal from 10000 to 5000, navigate Home, verify ring shows higher % |
| FR-305 | Home data MUST refresh when the user navigates back after completing a walk | #10 | Complete walk, go to summary, press Done, verify Home shows new data |
| FR-306 | Default goals MUST be: 10,000 steps, 5,000 meters, 45 minutes, 300 calories | | Fresh install, verify default goal values |

### 2.5 Walk Summary

| ID | Requirement | Finding | Test |
|----|------------|---------|------|
| FR-400 | After saving a walk, the app MUST navigate to the walk summary screen showing the walk ID | | Complete walk, verify URL is /walk-summary/:id |
| FR-401 | The summary MUST display: distance, duration, pace, steps, calories, avg speed, max speed, elevation gain, elevation loss | | Complete walk, verify all metrics display |
| FR-402 | The summary MUST display the route on a map with start/end markers | | Complete walk with GPS, verify map shows route |
| FR-403 | The summary MUST display an elevation chart when altitude data has >2 points | | Walk with elevation, verify chart renders |
| FR-404 | The summary MUST check for newly unlocked achievements and display them | | Complete first walk, verify "First Steps" badge appears |
| FR-405 | Achievement checks MUST compute totalWalks, todaySteps, totalDistance, totalCalories, and streak from all stored walks | | Complete walk, verify achievement stats are correct |
| FR-406 | The summary MUST provide a share/export button that generates a PNG image of the summary card | | Complete walk, tap share, verify image is generated |

### 2.6 Streak and Analytics

| ID | Requirement | Finding | Test |
|----|------------|---------|------|
| FR-500 | The streak MUST count consecutive days with at least one walk, ending at today or yesterday | | Walk Mon-Wed, verify streak is 3 |
| FR-501 | The streak MUST remain alive if the user hasn't walked today but walked yesterday | | Walk yesterday only, verify streak is 1 |
| FR-502 | The streak MUST reset to 0 if the most recent walk is before yesterday | | Walk 3 days ago, verify streak is 0 |
| FR-503 | The weekly activity display MUST show the last 7 days with correct walk/no-walk indicators | | Walk on specific days, verify circle indicators match |
| FR-504 | calculateStreak() MUST NOT mutate any input parameters | #4 | Call twice with same walks array, verify second call returns same result |
| FR-505 | Personal records MUST correctly identify: longest daily distance, longest daily duration, most daily steps, most daily calories, longest single walk, fastest pace (walks >1km only) | | Create walks with known values, verify PRs |

### 2.7 Charts and History

| ID | Requirement | Finding | Test |
|----|------------|---------|------|
| FR-600 | The Stats page MUST display a bar chart of the last 7 days with selectable metric | | Navigate to Stats, verify chart renders |
| FR-601 | The chart metric selector MUST support: distance, steps, duration, calories | | Switch metrics, verify chart updates |
| FR-602 | The walk log MUST group walks by date and display time, distance, duration, steps for each | | Verify log shows correct groupings |
| FR-603 | The walk log MUST support filters: All Time, This Week, This Month | #9 | Apply each filter, verify correct walks shown |
| FR-604 | The log filter for "This Week" and "This Month" MUST correctly handle DST transitions | #9 | Test near DST boundary, verify correct day count |
| FR-605 | Deleting a walk MUST remove it from Dexie and update the displayed list immediately | | Delete a walk, verify it disappears from log |
| FR-606 | The summary totals card MUST show correct aggregated values for the current filter | | Apply filter, verify totals match visible walks |

### 2.8 Achievements

| ID | Requirement | Finding | Test |
|----|------------|---------|------|
| FR-700 | The app MUST define 14 achievements with correct thresholds and XP values | | Verify each achievement's condition function |
| FR-701 | Achievements MUST be checked after each walk save and displayed on the walk summary | | Complete walk meeting a threshold, verify badge appears |
| FR-702 | Already-unlocked achievements MUST NOT be re-checked or re-displayed | | Complete multiple walks, verify no duplicate badges |
| FR-703 | XP MUST accumulate correctly: level N requires N*100 XP to advance | | Earn XP, verify level calculation |
| FR-704 | The Achievements page MUST display all 14 badges with locked/unlocked state | | Navigate to Achievements, verify grid renders |

### 2.9 Settings

| ID | Requirement | Finding | Test |
|----|------------|---------|------|
| FR-800 | Settings MUST persist to IndexedDB via Dexie on every change | | Change weight, reload, verify value persists |
| FR-801 | Weight input MUST accept values between 30-250 kg | | Enter 29, verify rejected; enter 251, verify rejected |
| FR-802 | Height input MUST accept values between 100-220 cm | | Enter 99, verify rejected; enter 221, verify rejected |
| FR-803 | Step goal MUST accept values >= 1000 | | Enter 500, verify rejected; enter 1000, verify accepted |
| FR-804 | Theme toggle MUST switch between dark and light modes | | Toggle theme, verify CSS variables change |
| FR-805 | Unit toggle MUST switch between km and mi | | Switch to mi, verify distance displays in miles |
| FR-806 | Auto-pause toggle MUST enable/disable the auto-pause feature | | Toggle off, verify tracking doesn't auto-pause |
| FR-807 | "Clear All Data" MUST delete all walks and settings and reload the page | | Clear data, verify empty state on reload |

### 2.10 Data Export and Import

| ID | Requirement | Finding | Test |
|----|------------|---------|------|
| FR-900 | The Stats page MUST provide a JSON export of all walks | | Export, verify file contains all walk records |
| FR-901 | The exported JSON MUST be valid and re-importable | #11 | Export, import into fresh app, verify walks appear |
| FR-902 | Import with mode "merge" MUST add walks that don't exist locally and skip duplicates | | Import file with one new walk and one duplicate, verify result |
| FR-903 | Import with mode "replace" MUST replace all local data with the imported data | | Import with replace, verify only imported walks exist |

---

## 3. Non-Functional Requirements

### 3.1 Performance

| ID | Requirement | Test |
|----|------------|------|
| NFR-001 | Home page MUST render within 200ms with 100 stored walks | Add 100 walks, measure Home render time |
| NFR-002 | Walk save MUST complete within 500ms | Time saveWalk() call with full GPS data |
| NFR-003 | GPS point processing (smooth + aggregate) MUST complete within 50ms per point | Time addPoint() with simulated position |
| NFR-004 | The app MUST NOT cause memory leaks from uncleaned watchers, intervals, or subscriptions | Profile with DevTools, verify no growing detached DOM |

### 3.2 Reliability

| ID | Requirement | Finding | Test |
|----|------------|---------|------|
| NFR-100 | The app MUST remain functional with corrupted walk records — at most one bad row is quarantined, rest display correctly | #7 | Inject corrupt walk, verify other walks render |
| NFR-101 | The app MUST survive browser refresh without data loss | | Start walk, refresh, verify walk is preserved |
| NFR-102 | The app MUST handle concurrent tab writes without data corruption | #8 | Open two tabs, make changes in both, verify no data loss |
| NFR-103 | The app MUST degrade gracefully when localStorage is unavailable — function in memory, inform user | #7 | Disable localStorage, verify app works |

### 3.3 Accessibility

| ID | Requirement | Test |
|----|------------|------|
| NFR-200 | All interactive elements MUST be keyboard operable | Tab through all buttons/links, verify focus visible |
| NFR-201 | Progress rings MUST expose their percentage to assistive technology via aria-valuenow | Inspect DOM, verify aria attributes |
| NFR-202 | All images and icons MUST have appropriate alt text or aria-label | Audit with screen reader |
| NFR-203 | Color contrast MUST meet WCAG 2.1 AA (4.5:1 for text, 3:1 for large text) | Check with contrast analyzer |
| NFR-204 | Touch targets MUST be at least 44x44px | Measure tap targets |
| NFR-205 | Status messages (streak, goal completion) MUST use aria-live for dynamic updates | Verify aria-live regions |

### 3.4 Data Integrity

| ID | Requirement | Finding | Test |
|----|------------|---------|------|
| NFR-300 | Every stored walk MUST have a unique, non-colliding ID | #11 | Add 1000 walks, verify no duplicate IDs |
| NFR-301 | Walk IDs MUST survive app restart | | Save walk, restart app, verify ID unchanged |
| NFR-302 | No walk data MUST be silently discarded on save failure | #8 | Simulate write failure, verify data is retained |
| NFR-303 | Settings changes MUST be atomic — partial writes MUST NOT occur | | Change two settings rapidly, verify both persist |

### 3.5 Security (Client-Side Only)

| ID | Requirement | Test |
|----|------------|------|
| NFR-400 | All user data MUST remain on the client — no data is sent to any server without explicit user action (export, cloud sync) | Network tab audit |
| NFR-401 | Firebase cloud sync MUST be optional — the app MUST function fully without Firebase configuration | Remove Firebase config, verify app works |
| NFR-402 | The "Synced" badge MUST NOT display when Firebase is not configured | #8 | Check Settings without Firebase keys, verify no "Synced" badge |
| NFR-403 | Exported data MUST contain only walk records and settings — no internal IDs, timestamps, or quarantine data | Export, inspect JSON, verify no internal fields |

---

## 4. Data Requirements

### 4.1 Walk Record Schema

```javascript
{
  id: string,              // Unique identifier (UUID or legacy-N)
  date: string,            // Local date YYYY-MM-DD
  startTime: number,       // Epoch milliseconds
  endTime: number,         // Epoch milliseconds
  distance: number,        // Meters, finite, non-negative
  duration: number,        // Milliseconds of active time, finite, non-negative
  steps: number,           // Estimated step count, finite, non-negative
  calories: number,        // Estimated kcal, finite, non-negative
  averageSpeed: number,    // m/s, finite, non-negative
  averagePace: number,     // min/km, finite, non-negative
  maxSpeed: number,        // m/s, finite, non-negative
  elevationGain: number,   // Meters, finite, non-negative
  elevationLoss: number,   // Meters, finite, non-negative
  points: Array<{          // GPS track points
    lat: number,           // -90 to 90
    lng: number,           // -180 to 180
    timestamp: number,     // Epoch milliseconds
    accuracy?: number,     // Meters, non-negative
    speed?: number,        // m/s, non-negative
    altitude?: number,     // Meters
  }>,
  altitudePoints: Array<{  // For elevation chart
    distance: number,      // Meters from start
    altitude: number,      // Meters above sea level
  }>,
  createdAt: number,       // Epoch milliseconds
  updatedAt: number,       // Epoch milliseconds
}
```

### 4.2 Settings Schema

```javascript
{
  weightKg: number,        // 30-250, default 70
  heightCm: number,        // 100-220, default 170
  dailyStepGoal: number,   // >= 1000, default 10000
  dailyDistanceGoal: number, // >= 500 (meters), default 5000
  dailyDurationGoal: number, // >= 5 (minutes), default 45
  dailyCaloriesGoal: number, // >= 50, default 300
  unit: 'km' | 'mi',      // default 'km'
  theme: 'dark' | 'light', // default 'dark'
  autoPause: boolean,      // default true
  autoPauseSpeed: number,  // 0.1-2 m/s, default 0.3
  gpsAccuracyThreshold: number, // 5-100 meters, default 30
  voiceFeedback: boolean,  // default false
  onboardingComplete: boolean, // default false
  unlockedAchievements: string[], // default []
  xp: number,              // default 0
}
```

---

## 5. Interface Requirements

### 5.1 Browser APIs

| API | Usage | Fallback |
|-----|-------|----------|
| Geolocation | GPS tracking | Show error message, disable tracking |
| IndexedDB (Dexie) | Walk and settings storage | The app cannot function without storage |
| localStorage | Recovery document | In-memory if unavailable |
| Wake Lock | Keep screen on during tracking | Tracking works without it, screen may sleep |
| Storage event | Cross-tab sync | Single-tab mode |

### 5.2 External Services

| Service | Usage | Required? |
|---------|-------|-----------|
| Firebase Auth | Google sign-in | No — app works without it |
| Firebase Firestore | Cloud sync | No — app works without it |
| OpenStreetMap tiles | Map display | Yes — maps won't render without network |

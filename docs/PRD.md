# Product Requirements Document: WalkTracker

## 1. Problem

People who walk for exercise or transit need a simple, trustworthy way to track their walks, see their progress toward daily goals, and stay motivated over time. Existing fitness apps are either bloated (requiring accounts, subscriptions, or social features) or too minimal (logging distance without context). WalkTracker fills the gap: a private, offline-first walking tracker that shows real data clearly and builds habits through streaks and achievements.

The core problem this audit addresses: the UI does not always reflect the true output of the system. Progress indicators, counters, and summaries can show stale, partial, or wrong values because aggregation logic is duplicated, NaN can leak from corrupt records, and two persistence layers exist but only one is connected.

## 2. Target Users

**Primary:** Adults who walk regularly (daily commuters, fitness walkers, people following a "10,000 steps" goal) and want a simple, private tracker that works offline on their phone.

**Secondary:** Users who want basic gamification (streaks, achievements, levels) to maintain walking motivation.

**Not targeted:** Runners, cyclists, hikers needing terrain/elevation analysis, social fitness users, or users who need cross-device sync without manual backup.

## 3. Goals

1. **Trustworthiness.** Every number the UI displays must be traceable to real stored data with no gaps. A user looking at their daily rings must be able to trust that the numbers are correct.
2. **Simplicity.** The app must do one thing well: track walks and show progress. No accounts required, no servers, no subscription.
3. **Privacy.** All data stays on the device. No telemetry, no analytics, no ads.
4. **Reliability.** Data must survive browser crashes, tab closures, and storage errors. A user who walks for 45 minutes must never lose that data silently.
5. **Motivation.** Streaks, achievements, and daily goal rings should encourage consistent walking without feeling manipulative.

## 4. Core Features (MVP)

| Feature | Description |
|---------|-------------|
| **GPS Walk Tracking** | Real-time GPS tracking with map display, route polyline, live metrics (distance, pace, steps, calories, elevation) |
| **Activity Rings** | Four daily goals (steps, distance, active minutes, calories) displayed as progress rings on the Home dashboard |
| **Walk History** | Complete log of all walks with date, time, distance, duration, steps, calories |
| **Streak Tracking** | Current consecutive-day walking streak with weekly activity visualization |
| **Achievements** | Badge system with XP and leveling (14 defined achievements) |
| **Personal Records** | All-time bests for distance, duration, steps, and pace |
| **Charts** | Last-7-days bar chart with metric selection (distance/steps/time/calories) |
| **Walk Summary** | Post-walk screen with route map, full stats, elevation chart, achievement notifications |
| **Settings** | Profile (weight, height), goals, units (km/mi), theme (dark/light), auto-pause |
| **Data Export** | JSON export of all walk data from Stats page |

## 5. Proposed Features (Require Approval)

| Feature | Justification | Tradeoff |
|---------|---------------|----------|
| **Live tracking crash recovery** | A 45-minute walk lost to a browser crash is the single highest-impact UX failure. Periodic checkpointing to localStorage with recovery prompt on next launch. | Adds ~30 lines of code and a periodic write during tracking. Negligible performance cost. |
| **Data import** | Complement to export. Allows restoring from backup. The infrastructure layer already has `import()` with merge/replace modes. | Small effort since the code exists. |
| **Firestore cloud sync** | Backup across devices. The UI already shows a "Synced" badge (currently non-functional). | Requires Firebase configuration by the user. Should be optional and clearly labeled. |
| **30-day chart view** | The `getChartData()` function already supports `'month'` period. Just needs a UI toggle. | Trivial effort. |
| **Walk deletion confirmation** | Current `confirm()` dialog is functional but unstyled. A custom modal matches the design system. | Small effort, improved consistency. |

## 6. User Stories

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-01 | As a user, I tap "Start Walking" and the app begins GPS tracking immediately | GPS permission requested, map shows current location, timer starts |
| US-02 | As a user, I see my live distance, pace, and steps update in real time during a walk | Values update at least every GPS fix, no NaN or blank values |
| US-03 | As a user, I pause and resume a walk without losing data | Paused time excluded from active duration, GPS points not recorded while paused |
| US-04 | As a user, I finish a walk and see a summary with all stats | Summary shows distance, duration, pace, steps, calories, speed, elevation, route map |
| US-05 | As a user, I return to the dashboard and my Activity Rings reflect today's walks | Rings show accurate percentage, values match the sum of today's saved walks |
| US-06 | As a user, I see my current walking streak | Streak count is correct, weekly activity circles match stored walk dates |
| US-07 | As a user, I view my walk history with charts | Last 7 days chart renders, personal records are correct, walk log shows all walks |
| US-08 | As a user, I earn achievements when I hit milestones | Badges unlock at correct thresholds, XP is added, level progress updates |
| US-09 | As a user, I can change my daily goals and see rings update | Changing a goal immediately affects the ring percentage on next Home render |
| US-10 | As a user, I export my data as a JSON file | Exported file contains all walks and settings, can be re-imported |
| US-11 | As a user, I lose my browser tab during a walk and recover my data on next launch | Recovery prompt appears, incomplete walk is saved or discarded based on user choice |

## 7. Success Metrics

| Metric | Target | How Measured |
|--------|--------|-------------|
| Displayed values match stored data | 100% | Phase 8 verification audit |
| No NaN/Infinity in DOM | 0 instances | Automated check or manual DOM inspection |
| Walk data survives tab close | Recovery prompt appears | Manual test: start walk, close tab, reopen |
| All Phase 1 findings resolved | 12/12 | Code review |
| Page load (Home) with 100 walks | < 200ms | Performance measurement |

## 8. Assumptions

- The user has a modern browser with Geolocation API support
- The user has a phone or browser that supports localStorage and IndexedDB
- Firebase cloud sync is optional and may remain unconfigured
- The user is the sole user of the device (no multi-user support)
- Walk data is personal and not shared (no social features)

## 9. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| GPS accuracy varies by device/environment | Inaccurate distance/pace | GPS smoothing, accuracy threshold, segment filtering |
| localStorage quota exceeded | Data loss | Graceful degradation, warn user, prioritize walk data over settings |
| Browser kills background tab during tracking | Lost walk data | Wake Lock API, periodic checkpointing (proposed feature) |
| IndexedDB data corruption | Wrong displayed values | Validation on read (Finding #7), quarantine corrupt records |
| No server-side backup | Data lost if device is wiped | Export/import feature, optional cloud sync |

## 10. Out of Scope

- Running/cycling/hiking-specific features
- Heart rate monitoring
- Social features (sharing, leaderboards, challenges)
- Nutrition integration
- Apple Health / Google Fit sync
- Multi-device real-time sync
- Backend API or database
- User accounts (beyond optional Firebase auth)

## 11. Acceptance Criteria

1. Every displayed numeric value traces to a stored walk record through a validated aggregation path
2. No `NaN`, `Infinity`, or `undefined` renders in the DOM under any data condition
3. Corrupt walk records are quarantined without affecting other records
4. Fresh install shows empty state, not error state
5. Walk data persists across browser sessions
6. All 14 achievements unlock at correct thresholds
7. Activity Rings reflect the sum of today's walks, not cached or stale data
8. Export produces valid JSON that can be re-imported
9. The app works without Firebase configuration (cloud sync gracefully absent)
10. No backend is required — the app is fully functional offline

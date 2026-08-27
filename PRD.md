# Product Requirements Document — WalkTracker

## 1. Problem Statement

People who walk for health, fitness, or pleasure lack a trustworthy, privacy-first tool that accurately captures their walks and reflects their real effort in a way they can believe. Existing apps either require accounts, sync to opaque clouds, show placeholder numbers, or lose data when storage fills. WalkTracker solves this: a local-first, offline-capable walk tracker where every number on screen is verifiably derived from the user's own GPS data, stored on their device, and never invented.

## 2. Target Users

- **Primary**: Daily walkers (health, commute, dog walking) who want accurate distance, pace, and calorie estimates without a wearable.
- **Secondary**: Fitness enthusiasts tracking streaks, personal records, and weekly trends.
- **Tertiary**: Privacy-conscious users who reject cloud-mandatory apps.

All users share one constraint: they trust only what they can see working on their own phone.

## 3. Goals

| Goal | Success Metric |
|------|----------------|
| **Trustworthy data** | Zero discrepancy between live tracking, saved summary, and dashboard aggregates for 100% of user sessions |
| **Zero data loss** | No walk discarded without explicit user consent; graceful degradation on storage pressure |
| **Offline-first** | Full functionality (tracking, history, stats, achievements) without network |
| **Privacy** | All records remain in the browser; no account, server, database, or cloud sync |
| **Accessible** | WCAG 2.1 AA compliance; screen-reader announcements for live values |
| **Performant** | At least 55fps during 1Hz GPS updates on a representative 5-year-old phone; interactive within 3 seconds on the agreed test profile |

## 4. Core Features (MVP Scope)

### 4.1 Live Tracking
- GPS-based distance, pace, speed, elevation gain/loss
- Real-time map with route polyline
- Auto-pause (configurable speed threshold)
- Wake lock to keep screen on
- Manual pause/resume/stop
- Live daily-progress overlay (today's rings updated with current session)

### 4.2 Walk Persistence
- Versioned `localStorage` document managed through one storage repository
- Walk record: points, timestamps, distance, duration, steps, calories, elevation profile, average/max pace & speed
- One-time, non-destructive import of records left in the current legacy IndexedDB database
- JSON export and import for user-controlled backup and recovery
- Minimum save threshold: **removed** — every walk saved, user decides what matters

### 4.3 Dashboard (Home)
- Four activity rings: Steps, Distance, Active Time, Calories — each shows live progress toward daily goal
- Streak counter (consecutive days with ≥1 walk) + 7-day visual
- Level/XP ring (gamification)
- Quick totals + recent walks list (tap → summary)

### 4.4 Statistics & History
- 7-day bar chart (metric selector: distance/steps/time/calories)
- Personal records (longest walk, longest time, most steps, fastest pace)
- Full history log grouped by date, filterable (week/month/all)
- JSON export (backup/portability)

### 4.5 Walk Summary
- Route map with start/end markers
- Elevation profile chart
- All metrics (primary + secondary)
- New achievement badges with XP rewards
- Shareable image export (html-to-image)

### 4.6 Achievements
- 14 badges (distance, steps, streak, total distance, calories, time-of-day)
- Level progression (XP curve)
- Overall completion ring

### 4.7 Settings
- Profile: weight, height (used for step/calorie estimates)
- Goals: daily steps, distance, active minutes, calories
- Preferences: units (km/mi), theme (dark/light), auto-pause toggle
- Data: export, import, storage-health status, and guarded clear-all

### 4.8 Data Ownership and Recovery
- The app does not transmit walks or settings to a backend
- Export includes schema version, export timestamp, settings, walks, and quarantined-record metadata
- Import validates every item and reports imported, skipped, duplicate, and quarantined counts
- Cross-tab updates use the browser `storage` event and revision checks

## 5. User Stories

| ID | Story | Acceptance |
|----|-------|------------|
| US-01 | As a walker, I want to start a walk with one tap and see my route live on a map | Track screen shows map, polyline updates per GPS point, timer runs |
| US-02 | As a walker, I want my walk saved automatically when I stop | Walk appears in History, dashboard rings update, summary screen opens |
| US-03 | As a walker, I want to see today's progress toward my goals at a glance | Home shows 4 rings with correct %; values match sum of saved walks + live session |
| US-04 | As a walker, I want my streak to reflect reality | Streak increments only on consecutive local-date walks; survives midnight, timezone changes |
| US-05 | As a walker, I want to review past walks with maps and stats | Stats log shows all walks grouped by date; tap opens summary with map + elevation |
| US-06 | As a walker, I want to export my data | Settings → Export produces valid JSON importable to another device |
| US-07 | As a privacy-conscious user, I want my records to remain on my device | Network inspection shows no walk or settings payload sent to an application backend |
| US-08 | As a user with limited storage, I want the app to not crash | QuotaExceededError caught; toast shown; export offered before any data loss |
| US-09 | As a screen-reader user, I want live values announced | Activity rings, timer, progress bars have `aria-live` regions |

## 6. Assumptions

- Browser supports `localStorage` and the Geolocation API; Wake Lock is progressive enhancement
- GPS accuracy ±10–30m typical; smoothing reduces jitter
- Calorie/step estimates are approximations (MET + stride length) — labeled as estimates
- No backend, hosted authentication, remote database, or application API exists
- One local data owner per browser profile

## 7. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `localStorage` corruption / quota exceeded | Medium | High | Guarded parse, read/write validation, last-known-good snapshot, export before clear |
| GPS drift inflates distance | High | Medium | 0.5–100m segment filter; 3-point smoothing; user can delete |
| Two tabs overwrite one another | Medium | High | Monotonic document revision, compare-before-write, `storage` event subscription |
| Browser blocks or evicts storage | Medium | High | Capability probe, honest persistence status, in-memory fallback, user-controlled export |
| Battery drain from GPS | High | Medium | Auto-pause; configurable accuracy threshold; wake lock only while tracking |

## 8. Out of Scope (Post-MVP)

- Heart rate / sensor integration
- Social features (friends, leaderboards)
- Route planning / GPX import
- Voice feedback during walk
- Apple Watch / Wear OS companion
- Accounts, hosted authentication, cloud backup, and multi-device sync
- Any server, remote database, or application API
- Advanced analytics (VO2 max, training load)

## 9. Acceptance Criteria (Definition of Done for MVP)

1. **Data integrity**: Every walk written to the versioned `localStorage` document passes validation; malformed records are quarantined without taking down valid history
2. **Dashboard accuracy**: Home rings = sum of `getTodayWalks()` + live session (if tracking); streak = `calculateStreak(allWalks)`; both match WalkSummary
3. **No silent loss**: No walk discarded without user action; 10m threshold removed
4. **Offline works**: Full tracking → save → summary → history without network
5. **Data ownership**: Export/import round-trip preserves all valid records and settings; the app sends none of them to an application backend
6. **Accessibility**: axe-core passes; `aria-live` on timer, rings, progress bars
7. **Performance**: Track screen 60fps at 1Hz GPS; cold start <3s on 3G
8. **Error boundaries**: No single component error crashes entire page
9. **Migration ready**: Schema migrations are sequential and tested; current IndexedDB records are copied into `localStorage` without deleting the originals
10. **Cross-tab**: Settings change in one tab reflects in other within 1s

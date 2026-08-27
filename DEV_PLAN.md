# Development Plan — WalkTracker

## 1. Priorities & Principles

| Principle | Application |
|-----------|-------------|
| **Data integrity first** | Fix persistence/validation before any UI polish |
| **Working at every step** | Each phase leaves app runnable; no "big bang" merges |
| **Behaviour-preserving refactors** | Phase 3 moves code; Phase 6.1 executes; tests verify no observable change |
| **Defects before features** | Phase 1 findings fixed in Phase 6.2 before Phase 6.3 approved features |
| **Explicit approval gates** | No code written before Phase 2/3/4 docs approved |

## 2. Milestones

| Milestone | Target | Deliverable |
|-----------|--------|-------------|
| **M0** | Phase 0–3 complete | Architecture docs approved |
| **M1** | Phase 4 complete | Data layer implemented + tested |
| **M2** | Phase 5 complete | Component library documented |
| **M3** | Phase 6.1 complete | Refactored codebase (clean architecture) |
| **M4** | Phase 6.2 complete | All Phase 1 findings fixed |
| **M5** | Phase 6.3 complete | Approved features shipped |
| **M6** | Phase 7 complete | Performance baseline + optimizations |
| **M7** | Phase 8 complete | Verification report + sign-off |

## 3. Phase 3 — Target Architecture (Design Only)

**Output**: `ARCHITECTURE_TARGET.md` with:
- New folder tree (as defined in ARCHITECTURE.md Section 2.1)
- Layer boundaries + import rules
- Refactoring sequence (20+ atomic steps)
- Verification checklist per step

**Approved by the project owner on 2026-08-27.** The corrected localStorage/no-backend documents supersede the earlier recommendations; there is no remote Firebase data to recover; every completed walk will be saved, including walks under 10 meters; localStorage capacity is accepted and will be measured before route downsampling.

## 4. Phase 4 — Data Layer Implementation

### 4.1 Scope (New Files)

```text
src/
|-- domain/                        # Pure tracking, analytics, and achievement logic
|-- infrastructure/storage/
|   |-- storagePort.js             # Public asynchronous contract
|   |-- localStorageAdapter.js     # Sole direct localStorage access
|   |-- documentSchema.js          # Defaults and read/write validation
|   |-- migrations.js              # Sequential schema migrations
|   |-- serialization.js           # Safe parse/stringify and preflight
|   |-- recovery.js                # Last-known-good and quarantine handling
|   `-- legacyIndexedDbImporter.js # Read-only non-destructive Dexie migration
|-- infrastructure/geolocation/
|-- infrastructure/wakeLock/
|-- features/                      # Dashboard, tracking, history, achievements, settings, onboarding
|-- shared/                        # UI, formatting, reusable hooks, constants
`-- app/                           # Bootstrap, routes, composition root
```

### 4.2 Key Behaviors to Implement

| Feature | Spec Reference |
|---------|----------------|
| Versioned single-document schema with sequential migrations | ARCHITECTURE.md §6.1 |
| Validation on read + write | ARCHITECTURE.md §4.2 |
| Immediate walk commits and debounced settings writes with flush | ARCHITECTURE.md §6.2 |
| Quota/StorageError handling + export offer | ARCHITECTURE.md §4.4 |
| Cross-tab sync via `storage` event | ARCHITECTURE.md §3.3 |
| Stable UUIDs (crypto.randomUUID) | ARCHITECTURE.md §4.2 |
| Derived values guarded (no NaN) | Phase 1 Findings #10, #11 |
| Recovery: last-known-good payload and per-record quarantine | ARCHITECTURE.md §6.3 |
| Clean storage interface | ARCHITECTURE.md §6 |
| Non-destructive IndexedDB import | ARCHITECTURE.md §7 |
| Export/Import JSON | ARCHITECTURE.md §6 |

### 4.3 Testing Requirements (Must Pass Before M1)

| Test | Description |
|------|-------------|
| **Unit: validators** | `validateWalk` handles NaN, Infinity, missing fields, wrong types, circular refs |
| **Unit: analytics** | `calculateStreak` passes all edge cases (today/yesterday/gaps/midnight) |
| **Unit: mappers** | Round-trip Domain → DTO → Domain preserves data |
| **Integration: localStorage** | load → save → update → remove → export → import works through the port |
| **Integration: migration** | Old document fixtures migrate sequentially; legacy IndexedDB copies without source deletion |
| **Integration: quota** | Simulated QuotaExceededError → export offered, no crash |
| **Integration: private mode** | SecurityError caught → in-memory session works |
| **Integration: cross-tab** | Two tabs: settings change in A → B updates within 1s |
| **Integration: cross-tab conflict** | Stale expected revision fails without overwriting the newer document |
| **E2E: tracking session** | Start → add points → stop → save → summary → home rings update |

## 5. Phase 5 — Component Library

### 5.1 Scope (New/Refactored Files)

```
src/presentation/components/
├── ui/
│   ├── Button.jsx
│   ├── Card.jsx
│   ├── ProgressRing.jsx
│   ├── Input.jsx
│   ├── Toggle.jsx
│   ├── Badge.jsx
│   ├── Tooltip.jsx
│   ├── Modal.jsx
│   └── index.js
├── tracking/
│   ├── MapView.jsx
│   ├── MetricsPanel.jsx
│   ├── ControlButtons.jsx
│   └── AutoPauseIndicator.jsx
├── dashboard/
│   ├── ActivityRing.jsx
│   ├── StreakDisplay.jsx
│   ├── LevelRing.jsx
│   ├── QuickStat.jsx
│   └── WalkListItem.jsx
├── stats/
│   ├── MetricSelector.jsx
│   ├── BarChart.jsx
│   ├── PRCard.jsx
│   ├── LogGroup.jsx
│   └── FilterTabs.jsx
├── summary/
│   ├── RouteMap.jsx
│   ├── StatRow.jsx
│   ├── ElevationChart.jsx
│   ├── AchievementBadge.jsx
│   └── ShareButton.jsx
└── index.js
```

### 5.2 Documentation (Per Component)

Each component gets a `README.md` in its folder:
- Props table (TypeScript-style JSDoc)
- Variants & states
- Usage example (with empty/error states)
- Accessibility notes
- Testing checklist

### 5.3 Storybook (Optional but Recommended)

If time permits: `npm run storybook` with all components in all states.

## 6. Phase 6 — Implementation

### 6.1 Refactor Execution (Phase 3 → Code)

**Sequence** (each step verified by running app + E2E checks):

| Step | Action | Verification |
|------|--------|--------------|
| 1 | Create `src/domain/` + move pure logic (analytics, calories, gps, achievements, formatters) | `npm run build` passes; all imports resolve |
| 2 | Create the storage port, schema, validators, migrations, serialization, and localStorage adapter | Contract and corrupt-data tests pass |
| 3 | Add the read-only legacy IndexedDB importer | Fixture copies into localStorage and legacy source remains unchanged |
| 4 | Create infrastructure public entry points | No feature imports an adapter implementation directly |
| 5 | Add cross-tab subscriptions and revision conflict handling | Two-tab integration test passes |
| 6 | Add export/import and recovery behavior | Round-trip and recovery fixtures pass |
| 7 | Refactor `userStore` → thin facade over SettingsRepository | Settings persist/load work; cross-tab sync works |
| 8 | Refactor `trackingStore` → uses domain services + WalkRepository.save | Tracking works; walk saved; summary opens |
| 9 | Remove account/cloud-sync UI and runtime after the remote-only-data migration gate is resolved | No Firebase import in production graph; no remote data deleted |
| 10 | Update pages to use new component library | Visual parity; no console errors |
| 11 | Remove old `src/lib/`, `src/stores/` (archive) | `git diff` shows only moves + thin facades |
| 12 | Run full E2E: tracking → save → home → stats → summary | All flows work; no regressions |

**Rollback plan**: Each step committed separately; `git revert` if verification fails.

### 6.2 Bug Fixes (Phase 1 Findings — Priority Order)

| Phase 6.2 Sub-Phase | Findings | Est. Effort |
|---------------------|----------|-------------|
| **A: Critical Integrity** | #2 (validation), #9 (quota), #26 (error boundaries) | 3 days |
| **B: User-Visible Bugs** | #1 (streak), #5 (10m discard), #4 (timer desync), #10/#11 (NaN pace) | 2 days |
| **C: Architecture** | #6 (versioning), #3 (dedupe), #7 (cross-tab), #18 (points cap) | 2 days |
| **C: Legacy Cloud Removal** | #8, #16, #27 become migration evidence; remove the conflicting runtime only after remote-only data is addressed | 1 day plus migration decision |
| **D: Polish** | #12, #13, #14, #15, #21, #22, #24, #25, #28, #29, #30 | 2 days |

**Each fix**: Separate commit, references finding number, manual test steps documented.

### 6.3 Approved Features (Phase 2.1 PRD — Only If Approved)

| Feature | PRD Reference | Dependencies |
|---------|---------------|--------------|
| Export/Import JSON | US-06 | Data layer export/import |
| Data-health and backup UI | US-06, FR-STO-05 | Storage port export/import and recovery status |
| Walk edit (rename/delete) | FR-SET-04 | WalkRepository.update |
| GPX export | Out of scope (post-MVP) | — |
| Voice feedback | Out of scope | — |

**Note**: Features only built after explicit approval in Phase 2.1 review.

## 7. Phase 7 — Performance

### 7.1 Baseline Measurement (Before Optimizations)

| Metric | Tool | Target |
|--------|------|--------|
| Track screen FPS (1Hz GPS) | Chrome DevTools Performance | ≥55 fps |
| Cold start (TTI) | Lighthouse / WebPageTest | <3s 3G |
| `getWalks()` 1000 walks | `performance.mark` | <200ms |
| Bundle size (gz) | `vite build --mode analyze` | <200 KB |
| Memory growth (2hr walk) | DevTools Memory | <50 MB |

### 7.2 Optimization Targets (If Needed)

| Area | Technique | Trigger |
|------|-----------|---------|
| Track re-renders | `shallow` selector in Zustand; memoize MetricsPanel | FPS <55 |
| Points array | Cap at 5000; downsample older points | Memory >50MB |
| Chart render | Virtualize LogGroup; lazy-load Recharts | Stats slow |
| Map tiles | Cache OSM tiles via Workbox | Offline map |
| Bundle | Code-split pages (lazy `import()`) | Bundle >250KB |

**Rule**: No speculative memoization. Measure → identify → optimize → re-measure.

## 8. Phase 8 — Verification

### 8.1 Render-Path Audit (Phase 0 Map)

For each UI value in Phase 0's render-path map:
- Trace: stored data → repository → store → component → formatter → DOM
- Compare: UI value vs independent calculation from the exported validated storage document
- Document: ✓ Match / ✗ Mismatch (with root cause)

### 8.2 Edge Case Re-Test (Phase 1 List)

| Case | Test Method | Pass Criteria |
|------|-------------|---------------|
| Empty storage | Remove WalkTracker localStorage keys → reload | Home shows first-run empty state, no errors |
| Corrupt storage | Inject bad record via DevTools → reload | Record quarantined, banner shown, other walks load |
| Old-version data | Load old document and IndexedDB fixtures → migrate | Current schema loads; legacy sources remain intact |
| Quota exceeded | Fill storage → save walk | Toast + export link works |
| Storage disabled | Private Safari / iframe | In-memory session, banner shown |
| Two tabs | Open two tabs → change settings | Tab B updates within 1s |
| Refresh mid-write | Stop walk → reload before navigate | Walk either saved or not; no partial |
| Midnight rollover | Start 23:55 → stop 00:10 | `date` = start date; streak correct |
| Large dataset | Seed 10k walks → load Home/Stats | <500ms Home, <1s Stats |

### 8.3 Definition of Done Checklist (Phase 2.5)

- [ ] All Phase 1 findings fixed (verified)
- [ ] Data layer passes all integration tests
- [ ] Component library documented + accessible
- [ ] Refactor complete — no behavioural changes except approved fixes
- [ ] Performance targets met
- [ ] Accessibility audit (axe-core) passes
- [ ] Responsive test at 3 breakpoints passes
- [ ] No Firebase/backend runtime or account/sync UI remains after the migration gate
- [ ] Export/Import round-trip works
- [ ] No console errors in production build

### 8.4 Residual Risk Documentation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Browser blocks or evicts localStorage | Medium | High | In-memory fallback documented; user warned; export supported |
| GPS accuracy variance | High | Medium | 0.5–100m filter; user can delete |
| Remote-only legacy Firebase records | Unknown | High | Resolve before removing legacy runtime; never delete remote data |
| Bundle size creep | Medium | Low | CI budget check; code-split |
| localStorage quota for long GPS histories | Medium | High | Measure size, reduce persisted duplication, export/archive before limits |

## 9. Tooling & CI

```yaml
# .github/workflows/ci.yml
- lint: eslint + prettier
- typecheck: tsc --noEmit (if TS) / eslint
- test: vitest (unit) + playwright (e2e)
- build: vite build
- bundle-size: check < 200KB gz
- accessibility: axe-core in e2e
```

## 10. Definition of Done (Project Level)

The project is **done** when:
1. All Phase 8 verification items pass
2. No known data integrity issues
3. User can track → save → view → export → import without surprises
4. Codebase follows clean architecture (enforced by ESLint)
5. Component library is reusable and documented
6. Residual risks documented and accepted

---

*Plan sequenced so each step leaves a working app. Data integrity fixed before UI. Refactor separated from bug fixes. Features opt-in only.*

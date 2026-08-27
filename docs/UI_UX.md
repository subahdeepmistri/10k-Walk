# UI/UX Document: WalkTracker

## 1. Visual Direction: "Calm Confidence"

The interface should feel like a premium instrument panel — precise, readable at a glance, and trustworthy. The user is looking at their own health data; every number must feel earned, not decorative. The design language is dark-first with soft glassmorphism, generous spacing, and high-contrast data typography.

**Intent in one sentence:** A clear, calm, confident interface that makes the user trust their numbers.

### 1.1 Type Scale

| Token | Size | Weight | Letter-spacing | Use |
|-------|------|--------|---------------|-----|
| `text-display` | 28px (26px ≤380w, 32px ≥480w) | 800 | -0.02em | Page titles |
| `text-title` | 21px (19px ≤380w, 22px ≥480w) | 700 | -0.01em | Section headers |
| `text-body` | 15px | 400 | 0 | Body copy |
| `text-label` | 11px | 600 | 1.3px uppercase | Category labels |
| `text-small` | 13px (12px ≤380w) | 400 | 0 | Secondary text, metadata |
| `text-stat` | 24px (inline in rings) | 800 | -0.02em | Big numbers in progress rings |
| `text-stat-lg` | 17px (inline in cards) | 800 | -0.01em | Stat values in cards |

Font families: `Outfit` for headings and stats, `Inter` for body text.

**Hard minimum:** No text below 12px. This is a phone-first app; smaller text is unreadable.

### 1.2 Colour Palette

**Dark mode (default):**

| Token | Hex | Role |
|-------|-----|------|
| `--bg` | `#050810` | Page background |
| `--surface` | `#0C1021` | Elevated surfaces |
| `--card` | `#121832` | Card backgrounds |
| `--border` | `#1E2A4A` | Dividers, borders |
| `--text` | `#F1F5F9` | Primary text |
| `--text-secondary` | `#8896B8` | Secondary text |
| `--primary` | `#6366F1` | Primary action, active ring |
| `--primary-light` | `#818CF8` | Hover, secondary primary |
| `--primary-dark` | `#4F46E5` | Pressed state |
| `--secondary` | `#8B5CF6` | Accent gradient endpoint |
| `--accent` | `#06B6D4` | Secondary accent (distance) |
| `--success` | `#10B981` | Goal completed, streak |
| `--warning` | `#F59E0B` | Pause, calories ring |
| `--error` | `#EF4444` | Stop, delete |

**Light mode:**

| Token | Hex | Role |
|-------|-----|------|
| `--bg` | `#F4F6FB` | Page background |
| `--surface` | `#FFFFFF` | Elevated surfaces |
| `--card` | `#FFFFFF` | Card backgrounds |
| `--border` | `#E2E8F0` | Dividers, borders |
| `--text` | `#0F172A` | Primary text |
| `--text-secondary` | `#64748B` | Secondary text |

**Ring colours (per metric):**

| Metric | Gradient/Solid | Completed |
|--------|---------------|-----------|
| Steps | `#6366F1 → #8B5CF6 → #A78BFA` | `#10B981` |
| Distance | `#06B6D4` solid | `#10B981` |
| Active time | `#10B981` solid | `#10B981` |
| Calories | `#F59E0B` solid | `#10B981` |

### 1.3 Spacing Scale

| Token | Value |
|-------|-------|
| `--space-xs` | 4px |
| `--space-sm` | 8px |
| `--space-md` | 12px |
| `--space-lg` | 16px |
| `--space-xl` | 24px |
| `--space-2xl` | 32px |

Page padding: `20px` (12px on ≤380w). Content max-width: `480px` centered.

### 1.4 Radii

| Token | Value | Use |
|-------|-------|-----|
| `--radius-sm` | 10px | Small buttons, inputs |
| `--radius-md` | 14px | Modals, zoom controls |
| `--radius-lg` | 20px | Cards (default) |
| `--radius-xl` | 28px | Large cards, action buttons |
| `--radius-full` | 9999px | Pills, badges, avatars |

### 1.5 Elevation

| Level | Shadow | Use |
|-------|--------|-----|
| Flat | none | Background elements |
| Card | `0 8px 32px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)` | Default cards |
| Card hover | `0 12px 40px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.2)` | Hovered cards |
| Glass | `blur(28px) saturate(200%)`, border `rgba(255,255,255,0.08)` | Overlays, map panels |
| Button | `0 8px 40px rgba(99,102,241,0.35)` | Primary CTA glow |

### 1.6 Motion

| Property | Duration | Easing | Use |
|----------|----------|--------|-----|
| Page transitions | 300ms | ease-out | Route changes |
| Ring fill | 1100ms | ease-out | Progress ring animation |
| Card tap | 150ms | ease | Scale 0.985 on press |
| Modal entrance | 300ms | spring (stiffness 400, damping 28) | Bottom sheet |
| Nav active | 200ms | spring (stiffness 400, damping 28) | Active background |

No animation should imply work that isn't happening. No fake loading spinners. No placeholder numbers animated into real ones.

---

## 2. Trust and Honesty Rules

This is the most important section. The entire audit exists because displayed values couldn't be trusted. These rules make that impossible.

### 2.1 Value Provenance

Every displayed numeric value must be traceable to its source. The UI distinguishes:

| State | How Shown | Example |
|-------|----------|---------|
| **Computed from data** | Normal display with value and unit | `5.23 km` |
| **Zero (real)** | Same as computed — `0` is a valid value | `0 steps` |
| **No data yet** | Explicit empty state, not `0` | "No walks today — start one to see your rings" |
| **Failed to load** | Error state with retry option | "Could not load walk data. Tap to retry." |
| **Still loading** | Skeleton or spinner, never a number | Shimmer placeholder |
| **Partial data** | Label indicates incompleteness | "3 walks recorded (1 excluded — see Activity)" |
| **Corrupt record** | Quarantined, not shown | "1 walk excluded due to data error" |

**The rule:** `0` means zero. `—` means unknown. An empty ring means no data. These are never interchangeable.

### 2.2 Displayed Value Integrity

1. **No `NaN` in the DOM.** Every aggregation path uses `safeNumber()` which converts NaN/undefined/null/Infinity/negative to 0. Every progress value uses `safeProgress()` which clamps to [0, 1].

2. **No hardcoded or placeholder numbers.** Every number comes from stored data. If data can't be computed, the UI says so honestly.

3. **No misleading animations.** A ring doesn't animate from 0 to a fake value on load. It animates from 0 to the real computed value. If the value is 0, the ring stays empty.

4. **Save confirmation.** After a walk is saved, the user sees a subtle "Saved ✓" indicator (text, not a toast) on the walk summary. If the save failed, they see "Not saved — tap to retry" with a clear explanation.

5. **Fresh vs stale data.** The Home dashboard shows a subtle "Updated just now" or "Updated 2m ago" timestamp below the rings. Data older than 5 minutes shows a small refresh icon that the user can tap.

### 2.3 Empty States

| Screen | Empty State | Copy |
|--------|------------|------|
| Home (no walks) | Large icon + title + CTA | "No walks yet — your first walk will update the rings" / "Start your first walk" button |
| Home (no today walks) | Rings at 0% with explicit labels | Rings show "0" values, "Walk today to begin your streak" |
| Stats (no walks) | Icon + title + description | "No data yet — start your first walk to unlock insights" |
| Achievements (no unlocks) | All badges shown locked | Badges at 40% opacity with lock icon |
| WalkSummary (loading) | Spinner | Centered spinner, no skeleton |
| WalkSummary (not found) | Error state | "Walk not found" with back button |

### 2.4 Error States

| Error | UI Treatment |
|-------|-------------|
| GPS permission denied | "Location access is needed to track your walks. Enable it in your browser settings." with a "Try again" button |
| GPS signal lost | "GPS signal lost — tracking paused. Move to an open area." |
| Storage unavailable | "Your browser storage is unavailable. Data will be kept in memory until you reload." |
| Storage full | "Storage is full. Please export and delete old walks to free space." |
| Walk save failed | "Could not save this walk. Your progress was tracked but not persisted." with "Try again" and "Go home" buttons |
| Corrupt record found | Not shown to user directly. Aggregation silently excludes it. |

### 2.5 Accessibility Requirements

| Requirement | Implementation |
|-------------|---------------|
| Keyboard navigation | All buttons and links are focusable with visible focus ring (`2px solid var(--color-primary), offset 2px`) |
| Touch targets | Minimum 44×44px for all interactive elements |
| Screen reader support | `aria-valuenow`, `aria-valuemin`, `aria-valuemax` on progress rings; `aria-live="polite"` on dynamically updated values |
| Colour independence | Status is never conveyed by colour alone — always with text or icon |
| Contrast | All text meets WCAG 2.1 AA (4.5:1 for normal text, 3:1 for large text) |
| Reduced motion | Respect `prefers-reduced-motion` — disable ring animations, page transitions |

---

## 3. Screen-by-Screen Design

### 3.1 Home Dashboard

**Layout:** Single scroll column, max-width 480px, centered.

**Sections (top to bottom):**
1. Greeting + "Dashboard" title + Level badge (top right)
2. "TODAY" label + "Activity Rings" title + "Edit goals" link
3. 2×2 grid of progress rings (Steps, Distance, Active, Calories)
4. Status pill: "N/4 closed · N% of daily goals"
5. Subtitle: "Real GPS • step & calorie estimates • active time"
6. Streak card with weekly activity circles
7. "Start Walking" CTA button (full width, gradient, glow shadow)
8. Quick totals row (Distance, Calories, Duration)
9. Level card with progress bar
10. Recent walks list (max 3) with "See all" link

**Empty state:** When no walks exist, the rings section shows the rings at 0% with their goal labels, and the Recent section shows the empty state card with CTA.

**Stale data indicator:** Below the status pill, show "Updated just now" or "Updated Xm ago" in 11px secondary text.

### 3.2 Track (Live Tracking)

**Layout:** Full-screen map with overlay panels.

**Elements:**
1. Map: full viewport, OpenStreetMap tiles, route polyline, start marker (green), current position marker (purple), tracking pulse ring
2. Top bar: Back button (idle) or Status pill ("Tracking" / "Paused") + Follow toggle
3. Metrics panel (bottom): Glass background, rounded top corners
   - Timer (large, centered)
   - Pace zone indicator
   - Daily goals progress (4 mini bars)
   - Metrics grid (3×2: Distance, Pace, Steps, Calories, Speed, Elevation)
   - Controls: Pause/Resume + Stop
4. Collapsed indicator: When panel is collapsed, show distance + time in a glass pill

**Stop confirmation:** Bottom sheet modal — "Finish Walk?" with distance/time summary, "Continue" and "Finish Walk" buttons.

**Live daily progress:** Shows base (prior today walks) + current session values, so the user sees their rings growing in real time.

### 3.3 Walk Summary

**Layout:** Scrollable, with map header.

**Sections:**
1. Map with route, start/end markers, fit bounds
2. Overlay gradient (map → content transition)
3. Back button (absolute, top left)
4. "Walk Complete! 🎉" title + date/time
5. Primary stats grid (3×1: Distance, Duration, Pace)
6. Secondary stats card (2×3 grid: Steps, Calories, Avg Speed, Max Speed, Elev. Gain, Elev. Loss)
7. Elevation chart (conditional, >2 altitude points)
8. New achievements card (conditional)
9. Action buttons: Share + Done

**Achievement celebration:** When new badges are unlocked, they appear with a spring animation and a subtle primary-coloured border glow.

### 3.4 Stats

**Layout:** Scrollable with sticky tab bar.

**Tabs:** "Overview" | "History Log"

**Overview tab:**
1. Header: "Statistics" + walk count
2. Bar chart (last 7 days) with metric selector dropdown
3. "All-Time Bests" grid (2×2: Furthest Walk, Longest Time, Most Steps, Top Pace)

**History Log tab:**
1. Filter pills: All Time | This Week | This Month
2. Summary totals card (4 metrics in a row)
3. Walks grouped by date, each with time, distance, duration, steps, delete button

**Empty state:** Full-page card with icon and CTA.

### 3.5 Achievements

**Layout:** Scrollable.

**Sections:**
1. Header: "Achievements" + unlocked count
2. Level card with ProgressRing + XP bar
3. Overall progress card with completion percentage
4. Badge grid (2 columns): All 14 achievements with locked/unlocked state

**Badge states:**
- Locked: 40% opacity, lock icon, no glow
- Unlocked: Full opacity, green checkmark, subtle glow ring

### 3.6 Settings

**Layout:** Scrollable, grouped sections.

**Sections:**
1. Account & Sync (Google sign-in / user info / logout)
2. Profile (Weight, Height) — inline number inputs
3. Goals (Steps, Distance, Active Minutes, Calories) — inline number inputs with unit-aware display
4. Preferences (Theme toggle, Units toggle, Auto-Pause toggle)
5. Data (Clear All Data button, destructive red)
6. About (App icon, version, tagline)

### 3.7 Onboarding

**Layout:** Full-screen slides with bottom controls.

**Slides:** 3 intro slides (Track, Explore, Earn) with animated icons, then Quick Setup (weight, height, step goal).

**Controls:** Dot indicators, Next/Get Started button, Skip link.

### 3.8 SplashScreen

**Layout:** Centered animated logo.

**Duration:** 2.2 seconds, then auto-navigate to Home or Onboarding.

---

## 4. Responsive Behaviour

| Breakpoint | Behaviour |
|-----------|-----------|
| ≤380px | Reduced type scale (26px display, 19px title), tighter padding |
| 381-479px | Default type scale, 20px padding |
| ≥480px | Larger type scale (32px display, 22px title), content capped at 480px |

The app is designed for phones first. On tablets and desktops, it renders as a narrow centered column — it does not stretch to fill the viewport. This is intentional: a walking tracker should feel like a phone app, not a dashboard.

---

## 5. Component Inventory

| Component | Variants | Key Props |
|-----------|----------|-----------|
| `ProgressRing` | — | `progress`, `size`, `strokeWidth`, `color`, `children` |
| `Card` | `elevated`, `glass`, `flat` | `variant`, `glow`, `onClick`, `children` |
| `BottomNav` | — | Auto-hides on /track and /walk-summary |
| `MetricItem` | — | `icon`, `label`, `value`, `suffix`, `color` |
| `StatRow` | — | `icon`, `label`, `value`, `color` |
| `SectionLabel` | — | `label` (Settings only) |

These are the only reusable components. All other UI is inline in page components. This is appropriate for an app of this size — over-componentizing would add indirection without value.

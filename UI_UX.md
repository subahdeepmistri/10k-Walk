# UI/UX Document — WalkTracker

## 1. Visual Direction

**Intent**: A calm, trustworthy, data-honest interface that feels like a well-crafted instrument — not a gamified toy. Every pixel serves the user's ability to read their own effort at a glance. Dark-first, high contrast, generous spacing, no chartjunk.

## 2. Design Tokens

### 2.1 Type Scale (CSS Variables)

```css
:root {
  /* Font families */
  --font-heading: 'Outfit', sans-serif;    /* Geometric, distinctive, readable at small sizes */
  --font-body: 'Inter', sans-serif;         /* UI workhorse, excellent metrics */
  --font-mono: 'JetBrains Mono', monospace; /* Tabular numbers for metrics */
  
  /* Scale (mobile-first, fluid via clamp) */
  --text-display: clamp(26px, 5vw, 32px);      /* Page titles */
  --text-title: clamp(19px, 3.5vw, 22px);       /* Section headers */
  --text-body: 15px;                            /* Body copy */
  --text-label: 11px;                           /* Uppercase labels */
  --text-small: 13px;                           /* Secondary info (hard min) */
  --text-tiny: 12px;                            /* Absolute floor */
  
  /* Weights */
  --weight-normal: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
  --weight-extrabold: 800;
}
```

**Justification**: Outfit for headlines gives personality without sacrificing legibility; Inter for body is the gold standard for UI density. JetBrains Mono ensures tabular numbers align in rings and metrics. 13px minimum prevents "tiny text" on small phones.

### 2.2 Color Palette (Dark-First, Semantic Roles)

```css
[data-theme="dark"] {
  /* Surfaces */
  --bg: #050810;           /* Deep near-black — reduces eye strain, OLED-friendly */
  --surface: #0C1021;      /* Cards, modals */
  --card: #121832;         /* Elevated cards */
  --border: #1E2A4A;       /* Subtle boundaries */
  
  /* Text */
  --text: #F1F5F9;         /* Primary — near-white, not pure (less glare) */
  --text-secondary: #8896B8; /* Secondary — muted but readable */
  --text-muted: #5A6585;   /* Tertiary — labels, placeholders */
  
  /* Semantic */
  --color-primary: #6366F1;      /* Indigo — brand, primary actions, tracking */
  --color-primary-light: #818CF8;/* Lighter indigo — focus, active nav */
  --color-primary-dark: #4F46E5; /* Pressed state */
  --color-success: #10B981;      /* Emerald — complete rings, streak, elevation gain */
  --color-success-light: #34D399;
  --color-warning: #F59E0B;      /* Amber — calories, pause, in-progress */
  --color-error: #EF4444;        /* Red — stop, delete, critical */
  --color-accent: #06B6D4;       /* Cyan — distance, speed, secondary actions */
  
  /* Ring gradients (per-metric identity) */
  --ring-steps: linear-gradient(135deg, #6366F1, #8B5CF6, #A78BFA);
  --ring-distance: linear-gradient(135deg, #06B6D4, #22D3EE, #67E8F9);
  --ring-duration: linear-gradient(135deg, #10B981, #34D399, #6EE7B7);
  --ring-calories: linear-gradient(135deg, #F59E0B, #FBBF24, #FDE047);
}

[data-theme="light"] {
  --bg: #F4F6FB;
  --surface: #FFFFFF;
  --card: #FFFFFF;
  --border: #E2E8F0;
  --text: #0F172A;
  --text-secondary: #64748B;
  --text-muted: #94A3B8;
  /* Semantic colors same hues, adjusted for light bg */
  --color-primary: #4F46E5;
  --color-primary-light: #6366F1;
  --color-success: #059669;
  --color-warning: #D97706;
  --color-error: #DC2626;
  --color-accent: #0891B2;
}
```

**Justification**: Dark-first because walkers often check phones outdoors (glare reduction) and at night. Semantic colors assigned to metrics consistently: Steps=Indigo (rhythm), Distance=Cyan (space), Duration=Emerald (time), Calories=Amber (energy). Gradients on rings add depth without clutter.

### 2.3 Spacing Scale

```css
:root {
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;
  --space-2xl: 32px;
  --space-3xl: 48px;
  
  /* Component-specific */
  --card-padding: 20px;      /* Generous internal padding */
  --screen-padding: 20px;    /* Mobile safe-area aware */
  --nav-height: 72px;        /* Bottom nav */
}
```

### 2.4 Radius & Elevation

```css
:root {
  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 20px;
  --radius-xl: 28px;
  --radius-full: 9999px;
  
  /* Shadows (layered for depth) */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.35);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.2);
  --shadow-glow: 0 8px 40px rgba(99,102,241,0.35), 0 0 80px rgba(99,102,241,0.08);
}
```

### 2.5 Motion

```css
:root {
  --duration-fast: 150ms;
  --duration-base: 250ms;
  --duration-slow: 400ms;
  
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
}
```

**Reduced motion**: `@media (prefers-reduced-motion: reduce)` disables all non-essential animation; progress rings animate via CSS `transition` only.

## 3. Screen Architecture & Navigation

### 3.1 Navigation Map

```
┌─────────────────────────────────────┐
│           SPLASH                    │
│    (load settings, auth check)      │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│         ONBOARDING (if needed)      │
│  Profile → Goals → Units → Done     │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│            HOME (Dashboard)         │
│  Rings • Streak • Level • Recent    │
│  [Track] [Stats] [Achieve] [Settings]│
└──────────────┬──────────────────────┘
               ▼
    ┌──────────┼──────────┐
    ▼          ▼          ▼
┌───────┐ ┌────────┐ ┌──────────┐
│ TRACK │ │ STATS  │ │ACHIEVEMTS│
│ Live  │ │Charts  │ │ Badges   │
│ GPS   │ │History │ │ Level/XP │
└───┬───┘ └────┬───┘ └────┬─────┘
    │          │          │
    ▼          ▼          ▼
┌─────────────────────────────────────┐
│       WALK SUMMARY (modal push)     │
│  Map • Stats • Elevation • Share    │
└─────────────────────────────────────┘
```

### 3.2 Bottom Navigation

- **5 items**: Home, Track, Stats, Achievements, Settings
- **Hidden on**: `/track` (full-screen focus), `/walk-summary` (modal context)
- **Active state**: Indigo background pill + indigo icon/label + subtle glow
- **Animation**: Framer Motion `layoutId` shared element transition
- **Touch targets**: 44×44px minimum (WCAG)

## 4. Component Library

### 4.1 Core Components

| Component | Variants | States | Props |
|-----------|----------|--------|-------|
| **Button** | Primary, Secondary, Ghost, Destructive | Default, Hover, Active, Disabled, Loading | `size`, `fullWidth`, `icon`, `iconPosition` |
| **Card** | Elevated, Glass, Flat | Default, Hover, Active, Glow | `variant`, `glow`, `onClick` |
| **ProgressRing** | — | Animated (0→value), Static | `progress` (0-1), `size`, `strokeWidth`, `color`, `bgColor`, `children` |
| **Input** | Number, Text, Select | Default, Focus, Error, Disabled | `label`, `unit`, `min`, `max`, `step`, `error` |
| **Toggle** | Switch, Segmented | On, Off, Disabled | `checked`, `onChange`, `label` |
| **Badge** | Default, Success, Warning, Error | — | `variant`, `dot` |
| **Tooltip** | — | Hover, Focus | `content`, `position` |
| **Modal** | BottomSheet, Centered | Open, Closing | `open`, `onClose`, `title` |

### 4.2 Tracking-Specific Components

| Component | Responsibility |
|-----------|----------------|
| **MapView** | Leaflet wrapper, handles follow-user, route polyline, markers |
| **MetricsPanel** | Collapsible bottom sheet: timer, live daily progress, 6-metric grid, controls |
| **ControlButtons** | Start/Pause/Resume/Stop with haptic feedback (where supported) |
| **AutoPauseIndicator** | Yellow pulse badge when auto-pause armed |

### 4.3 Dashboard Components

| Component | Responsibility |
|-----------|----------------|
| **ActivityRing** | ProgressRing + center value/goal + icon + % badge |
| **StreakDisplay** | Flame icon + count + 7-day circles (today highlighted) |
| **LevelRing** | ProgressRing + level number + XP bar |
| **QuickStat** | Icon + large value + label (3-col grid) |
| **WalkListItem** | Date/time, distance, duration, steps, chevron → Summary |

### 4.4 Stats Components

| Component | Responsibility |
|-----------|----------------|
| **MetricSelector** | Dropdown: Distance / Steps / Duration / Calories |
| **BarChart** | Recharts wrapper, gradient bars, custom tooltip |
| **PRCard** | Icon + title + value + unit (2×2 grid) |
| **LogGroup** | Date header + list of WalkListItems |
| **FilterTabs** | All / Week / Month segmented control |

### 4.5 Summary Components

| Component | Responsibility |
|-----------|----------------|
| **RouteMap** | Static map, fitBounds, start/end markers |
| **StatRow** | Icon + label + value (2-col grid) |
| **ElevationChart** | AreaChart with gradient fill |
| **AchievementBadge** | Icon + name + description + XP |
| **ShareButton** | html-to-image export → native share / download |

## 5. Key User Flows

### 5.1 First Walk (Happy Path)

1. **Splash** → loads settings, checks auth
2. **Onboarding** (if new): Weight → Height → Goals → Units → Complete
3. **Home**: Empty state card → "Start your first walk" CTA
4. **Track**: GPS acquiring → map centers → **Start** button pulses
5. **Tracking**: Map draws polyline, timer runs, metrics update, daily rings fill live
6. **Stop**: Confirm modal shows distance/time → **Finish Walk**
7. **Summary**: Map, stats, elevation, badges → **Share** or **Done**
8. **Home**: Rings updated, streak = 1, walk in recent list

### 5.2 Daily Goal Completion

- Ring hits 100% → ring stroke becomes solid success green, center shows ✓
- Overall pill: "4/4 closed • 100% of daily goals"
- Streak increments next day if walk logged
- Achievement check runs on Summary; new badges animate in

### 5.3 Settings Changes Apply Immediately

- Unit toggle (km/mi): Home rings, Track metrics, Stats charts all re-render with new formatters
- Goal change: Ring progress recalculates instantly
- Theme toggle: `data-theme` flips, CSS vars swap, no reload
- Weight/height: Next walk's calorie/step estimates use new values

## 6. States (Loading, Empty, Error)

| Screen | Loading | Empty | Error |
|--------|---------|-------|-------|
| **Home** | Skeleton rings (pulse) | "No walks yet" card + CTA | Banner: "Failed to load walks" + Retry |
| **Track** | "Acquiring GPS..." + pulse icon | — | "GPS Error" + "Walking anyway?" |
| **Stats** | Spinner | "No data yet" + CTA | Banner + Retry |
| **Summary** | Spinner over map | — | "Walk not found" → Home |
| **Settings** | — | — | Toast on save failure |

**Trust rule**: Never show placeholder numbers. Loading = skeleton. Empty = explicit "no data". Error = honest message + action.

## 7. Trust & Honesty Rules (Core Requirement)

### 7.1 Provenance & Freshness

| Value | Display | Freshness Indicator |
|-------|---------|---------------------|
| Live tracking metrics | Large timer, 6-metric grid | "Live" badge (pulsing green dot) |
| Daily rings | ProgressRing + center value | Ring animates on update |
| Today's totals (Home) | QuickStat cards | Subtle "Updated just now" text after a validated local snapshot is loaded |
| Walk Summary | All stats | "Saved" badge with timestamp |
| Streak | Flame + count | Recalculates on every Home mount |
| Local save status | Settings and save actions: "Saved on this device" / "Saving" / "Not saved" | Real commit status and timestamp |

### 7.2 Zero vs No Data vs Error

| Meaning | Visual | Screen Reader |
|---------|--------|---------------|
| **Zero** (user walked 0m today) | Rings at 0%, center "0", "of 5km" | "Zero kilometers walked today" |
| **No data yet** (first run) | Empty state card, no rings | "No walks recorded yet" |
| **Failed to load** | Red banner, Retry button | "Failed to load walks. Tap to retry" |
| **Still loading** | Skeleton shimmer | "Loading your walks" |

**Never**: Render `0%` for both "zero" and "no data". Never render `—` for both "no data" and "error".

### 7.3 Save Confirmation

- **Track → Stop**: Modal shows exact distance/time → user confirms
- **Success**: Navigate to Summary (proves data landed)
- **Failure**: Alert with "Export data now" button + "Retry"
- **Private mode**: Banner "Walks not saved in private mode" + "Open in Safari" link

### 7.4 No Fake Progress

- No indeterminate spinners that imply work happening
- Ring animation = real progress value (0→actual)
- Timer = real elapsed time from `Date.now()`
- Auto-pause = real GPS speed threshold
- Save progress reflects only an actual local persistence operation; no network or sync animation is shown

## 8. Responsive Behaviour

| Breakpoint | Layout Changes |
|------------|----------------|
| **<380px** (small phone) | Rings 2×2 at 108px; text-display 26px; card padding 16px |
| **380–480px** (standard phone) | Base design; rings 108px; comfortable |
| **480–768px** (large phone / small tablet) | Rings 120px; text-display 32px; 3-col quick stats |
| **>768px** (tablet/desktop) | Max-width 480px centered; sidebar-like feel; hover states active |

**Map**: Always full-screen on Track. On Summary: 256px height.

## 9. Accessibility (WCAG 2.1 AA)

### 9.1 Semantic HTML

- `<main>`, `<nav>`, `<section>`, `<article>` for landmarks
- `<h1>`–`<h3>` hierarchy on every page
- `<button>` for all actions (never `<div onClick>`)
- `<label>` + `<input>` for all form fields
- `<progress>` for ring progress (hidden, ARIA mirror)

### 9.2 Live Regions

```jsx
// Timer on Track
<div role="timer" aria-live="polite" aria-atomic="true">
  {formatDuration(elapsedTime)}
</div>

// Ring progress changes
<div role="status" aria-live="polite" aria-label={`Steps: ${Math.round(progress*100)}%`}>
  <ProgressRing progress={progress} />
</div>

// Streak change
<div role="status" aria-live="polite" aria-atomic="true">
  {streak} day streak
</div>
```

### 9.3 Focus & Keyboard

- Visible focus ring: `outline: 2px solid var(--color-primary); outline-offset: 2px`
- Tab order matches visual order
- Escape closes modals/sheets
- Arrow keys navigate bottom nav
- Map: keyboard pan/zoom via Leaflet controls

### 9.4 Contrast & Color

- Text: ≥4.5:1 (body), ≥3:1 (large text)
- UI elements: ≥3:1 (borders, icons)
- Rings: color + pattern (stroke-dasharray) + % text — never color alone
- Pace zones: label + color dot

### 9.5 Touch Targets

- Minimum 44×44px (`.touch-target` utility)
- Bottom nav items: 56×56px
- Control buttons: 64×64px (Start), 56×56px (Pause/Stop)

## 10. Dark/Light Mode

- System preference detected on first load (`prefers-color-scheme`)
- User toggle overrides, persisted in settings
- Transition: 250ms cross-fade on `data-theme` change
- Maps: OSM tiles same; Leaflet controls adapt via CSS vars

## 11. Animation Principles

| Principle | Implementation |
|-----------|----------------|
| **Purposeful** | Every animation conveys state change (ring fill, nav transition, modal slide) |
| **Fast** | 150–250ms for UI; 400ms for page transitions |
| **Interruptible** | Framer Motion `whileTap` scale; no forced waits |
| **Respects prefers-reduced-motion** | Disable Framer Motion `animate`; keep CSS `transition` for ring progress |
| **No layout shift** | Reserve space for skeletons; fixed-height containers |

## 12. Edge Case UI

| Scenario | Handling |
|----------|----------|
| **GPS denied** | Full-screen banner with "Open Settings" deep link |
| **GPS weak (accuracy >30m)** | Yellow toast "GPS accuracy low — distance may be approximate" |
| **Battery low** | Pause wake lock, show "Battery saver: screen may dim" |
| **Storage full** | Modal: "Export your walks to free space" + Export button |
| **Private browsing** | Persistent banner "Private mode — walks not saved" |
| **Walk <10m (old threshold)** | **Removed** — all walks saved |
| **Corrupted walk in history** | List shows "Could not load this walk" with "Remove" action |
| **Cross-tab write conflict** | Keep the newer committed revision, reload it, and explain that another tab changed the data |
| **App update available** | PWA toast "New version ready — tap to refresh" |

---

*Design system built for: trustworthy data display, mobile-first ergonomics, accessibility baseline, extensible component library.*

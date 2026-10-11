# ClockIn Design System

Source of truth for the ClockIn UI. It is built on the **Absensi** design system. The token values below are canonical (the original `design-tokens/tokens.json` export is not in this repo; add it under `docs/ui/` if it is recovered). Screens are in `docs/ui/` (index: [`../ui/SCREENS.md`](../ui/SCREENS.md)).

| Surface | Stack | UI layer |
|---|---|---|
| Mobile (employee + approver) | Kotlin Multiplatform + Compose Multiplatform | Material 3, themed with the tokens below |
| Web admin (HR) | Nuxt 4 + Nuxt UI (Tailwind CSS v4) | Nuxt UI components; a few custom components (see §8) |
| Icons (both) | Tabler Icons (outline, stroke 2) | Nuxt: `i-tabler-*` via Iconify. Compose: `ImageVector`s generated from Tabler SVGs |

UI copy is **English**. Dates use `8 Oct 2026` and times are 24-hour (`08:05`). Time zones are shown as WIB/WITA/WIT.

---

## 1. Principles

1. **One primary action per screen.** On mobile Home, the Clock in / Clock out button is the biggest element and sits in the thumb zone, with 16px above the bottom nav.
2. **Status is always visible.** Server time, location status and today's state are shown without opening anything.
3. **Every block has a way out.** Each rejection (outside radius, fake GPS, no face, device not recognized, no permission) explains the cause in neutral language and offers the next step.
4. **Same status colors everywhere.** Mobile and web use the same palette. Status is never shown by color alone: it always has a text label, and an icon on mobile.
5. **Dense but readable web.** Tables are filterable, sortable and exportable. Content lives in cards on a tinted page background.
6. **Destructive actions are deliberate.** Delete and remove actions use a red outline button on the page and a red solid button only inside the confirmation dialog. Deleting a person or record requires typing a confirmation or picking a replacement.

---

## 2. Color tokens

Light is the default. Dark values are defined for every token: dark mode is in scope per the PRD, but only light was mocked.

| Token | Light | Dark | Usage |
|---|---|---|---|
| `brand-50` | `#e6f4f1` | `#12302c` | Selected nav pill, active list row, icon wells, checked choice cards |
| `brand-600` | `#0d6e63` | `#3fbfae` | Primary buttons, links, focus ring, active tab text and underline |
| `brand-700` | `#0a5249` | `#6fd6c8` | Pressed primary, ClockCard slab (mobile Home), sign-in hero panel |
| `on-brand` | `#ffffff` | `#04201c` | Text and icons on brand-600/700 |
| `accent-400` | `#f2a93b` | `#f2a93b` | Highlight only: shift countdown chip, live dot. Never used as text color |
| `ink-fixed` | `#111816` | `#111816` | Text on accent-400 |
| `surface-0` | `#ffffff` | `#161b1a` | Cards, sheets, inputs, sidebar, bottom nav |
| `surface-100` | `#f4f7f6` | `#0c100f` | Page/app background, info callouts, table total rows |
| `surface-200` | `#e8edeb` | `#222928` | Segmented-control track, skeletons, neutral badge fill, avatar fill |
| `border` | `#d3dcd9` | `#2f3937` | **All resting borders**: dividers, card outlines, inputs, selects, secondary buttons, chips, unselected tabs |
| `border-strong` | `#7d8b87` | `#6c7b77` | Unchecked radio/checkbox rings, switch "off" track, dashed "add" buttons |
| `ink` | `#111816` | `#eef3f1` | Primary text |
| `ink-muted` | `#55625e` | `#9fb0ab` | Secondary text, helper text, inactive nav and tab labels |

> **Design decision:** resting input, select, chip and secondary-button borders use `border` (`#d3dcd9`), not `border-strong`. Focus uses a 2px `brand-600` border. Errors use a 2px `absent-600` border.

### Status colors

| Status | Text/icon (600) | Fill (50) | Dark text | Dark fill | Used for |
|---|---|---|---|---|---|
| present | `#1c7a43` | `#e3f4e9` | `#5bd08b` | `#10291a` | On time, Approved, Inside office area, Linked, Active |
| late | `#9a5200` | `#fdf0dc` | `#f5b552` | `#2e2210` | Late, Early leave, Weak GPS, Needs review, Pending device request, rate under 90% |
| leave | `#2858b8` | `#e5edfc` | `#8fb2f2` | `#142038` | Annual/Sick/Special leave, Collective leave, WFH badge |
| absent | `#b3261e` | `#fbe6e4` | `#f28b82` | `#341614` | Absent, Declined, errors, destructive actions, notification count badges |
| neutral | `#111816` on `#e8edeb` | | | | Waiting, Holiday, Inactive, Past |
| brand | `#0a5249` on `#e6f4f1` | | | | Employee tag, Public holiday, WFO badge, role tags |

### Full scales (for Nuxt UI `@theme` and Compose)

Nuxt UI needs every shade from 50 to 950. The anchors come from the tokens; the shades in between were interpolated in OKLab.

| Scale | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| brand | #e6f4f1 | #d0eee9 | #a3e2d8 | #6fd6c8 | #3fbfae | #279588 | **#0d6e63** | #0a5249 | #083d36 | #052924 | #04201c |
| ink (neutral) | #f4f7f6 | #e8edeb | #d3dcd9 | #b9c6c2 | #9fb0ab | #7d8b87 | #55625e | #3b4542 | #222928 | #161b1a | #0c100f |
| present | #e3f4e9 | #d2efdb | #aee5c1 | #88dba6 | #5bd08b | #3ca466 | **#1c7a43** | #1a6137 | #174a2b | #133420 | #10291a |
| late | #fdf0dc | #fce8ca | #fad7a5 | #f8c67f | #f5b552 | #c7822e | **#9a5200** | #79440c | #5a3611 | #3c2911 | #2e2210 |
| leave | #e5edfc | #d3e1fb | #b1caf7 | #8fb2f2 | #6c94df | #4a76cc | **#2858b8** | #234791 | #1d376c | #172849 | #142038 |
| absent | #fbe6e4 | #fbd4d0 | #f8b0a9 | #f28b82 | #de6c62 | #c94c41 | **#b3261e** | #8c241d | #68201a | #451a16 | #341614 |

---

## 3. Typography

Font: **Plus Jakarta Sans** (400, 500, 600, 700), falling back to `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. Numbers that tick or align (clock, times, table figures) use `font-variant-numeric: tabular-nums` (Compose: `fontFeatureSettings = "tnum"`).

| Style | Size / line | Weight | Tracking | Use |
|---|---|---|---|---|
| clock | 48 / 52 | 700 | -1px | Live clock on Home, time on confirmation |
| title-lg | 24 / 30 | 700 | -0.3px | Screen titles, greeting, web page `h1` |
| title | 18 / 24 | 600 | | Card and section titles, modal titles |
| body | 15 / 22 | 400 | | Default text, inputs |
| body-strong | 15 / 22 | 600 | | List row primary line, buttons (web) |
| button-lg (mobile) | 17 / 22 | 700 | | 56px mobile buttons |
| label | 13 / 18 | 600 | | Field labels, table headers |
| caption | 12 / 16 | 500 | | Helper text, timestamps, nav labels, badges |

Additional sizes seen in the designs: 32/38 for stat figures (clock-out summary), 28/34 for KPI tiles, 22/28 for empty-state titles, and 20/26 for editor headers (department, leave type).

---

## 4. Spacing, radius, elevation, sizes

**Spacing** (4px base): 4, 8, 12, 16 (card padding and mobile gutter), 20 (web card padding), 24 (section gap, web grid gap), 32 (web main padding, empty-state padding).

**Radius**

| Token | Value | Mobile | Web |
|---|---|---|---|
| radius-sm | 8px | Inputs, chips, icon buttons | **Buttons, inputs, selects, icon buttons, tabs (segmented items 6px)** |
| radius-md | 14px | Buttons (56px), list cards, stat tiles, segmented track | Cards, modals, toasts |
| radius-lg | 24px | ClockCard, bottom sheets, hero cards | (not used) |
| radius-full | 999px | Badges, avatars, nav active pill | Badges, avatars, count badges |

> Web buttons and inputs **both** use 8px, so a dropdown and a button next to it always match. Underline tabs on web have no pill radius.

**Elevation**

- `shadow-card`: `0 1px 2px rgba(17,24,22,.06), 0 4px 12px rgba(17,24,22,.06)` (dark: `0 1px 2px rgba(0,0,0,.5)`). Used on resting cards.
- `shadow-raised`: `0 8px 24px rgba(13,110,99,.22)` (dark: `0 8px 24px rgba(0,0,0,.6)`). Used on the primary mobile CTA.
- Popovers and menus: `0 8px 24px rgba(17,24,22,.16)` plus a 1px `border`.
- Modal scrim: `rgba(17,24,22,.55)`.

**Sizes**

| Token | Value |
|---|---|
| tap-min | 48px on mobile, 44px minimum on web |
| button-lg (mobile CTA) | 56px |
| web button | 44px (40px small) |
| web input / select | 44px |
| mobile input | 52px |
| mobile bottom nav | 72px including padding (64 + safe area) |
| web sidebar | 232px |
| icon | 24 default, 20–22 in nav, 18 in buttons and rows, 14–16 in badges |

---

## 5. Nuxt UI setup (web admin)

```bash
bun add @nuxt/ui @iconify-json/tabler
bun add @fontsource/plus-jakarta-sans   # or load via @nuxt/fonts
```

`app/assets/css/main.css`

```css
@import "tailwindcss";
@import "@nuxt/ui";

@theme static {
  --font-sans: "Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;

  --color-brand-50:#e6f4f1; --color-brand-100:#d0eee9; --color-brand-200:#a3e2d8; --color-brand-300:#6fd6c8;
  --color-brand-400:#3fbfae; --color-brand-500:#279588; --color-brand-600:#0d6e63; --color-brand-700:#0a5249;
  --color-brand-800:#083d36; --color-brand-900:#052924; --color-brand-950:#04201c;

  --color-ink-50:#f4f7f6; --color-ink-100:#e8edeb; --color-ink-200:#d3dcd9; --color-ink-300:#b9c6c2;
  --color-ink-400:#9fb0ab; --color-ink-500:#7d8b87; --color-ink-600:#55625e; --color-ink-700:#3b4542;
  --color-ink-800:#222928; --color-ink-900:#161b1a; --color-ink-950:#0c100f;

  --color-present-50:#e3f4e9; --color-present-100:#d2efdb; --color-present-200:#aee5c1; --color-present-300:#88dba6;
  --color-present-400:#5bd08b; --color-present-500:#3ca466; --color-present-600:#1c7a43; --color-present-700:#1a6137;
  --color-present-800:#174a2b; --color-present-900:#133420; --color-present-950:#10291a;

  --color-late-50:#fdf0dc; --color-late-100:#fce8ca; --color-late-200:#fad7a5; --color-late-300:#f8c67f;
  --color-late-400:#f5b552; --color-late-500:#c7822e; --color-late-600:#9a5200; --color-late-700:#79440c;
  --color-late-800:#5a3611; --color-late-900:#3c2911; --color-late-950:#2e2210;

  --color-leave-50:#e5edfc; --color-leave-100:#d3e1fb; --color-leave-200:#b1caf7; --color-leave-300:#8fb2f2;
  --color-leave-400:#6c94df; --color-leave-500:#4a76cc; --color-leave-600:#2858b8; --color-leave-700:#234791;
  --color-leave-800:#1d376c; --color-leave-900:#172849; --color-leave-950:#142038;

  --color-absent-50:#fbe6e4; --color-absent-100:#fbd4d0; --color-absent-200:#f8b0a9; --color-absent-300:#f28b82;
  --color-absent-400:#de6c62; --color-absent-500:#c94c41; --color-absent-600:#b3261e; --color-absent-700:#8c241d;
  --color-absent-800:#68201a; --color-absent-900:#451a16; --color-absent-950:#341614;

  --color-accent-400:#f2a93b;
}

/* Our "main" shade is 600 (light) / 400 (dark), not Nuxt UI's default 500/400 */
:root {
  --ui-radius: 0.5rem;                       /* 8px: buttons, inputs, selects */
  --ui-primary: var(--ui-color-primary-600);
  --ui-success: var(--ui-color-success-600);
  --ui-info:    var(--ui-color-info-600);
  --ui-warning: var(--ui-color-warning-600);
  --ui-error:   var(--ui-color-error-600);

  --ui-bg: #ffffff;                          /* surface-0 (cards) */
  --ui-bg-muted: var(--ui-color-neutral-50); /* surface-100 (page) */
  --ui-bg-elevated: var(--ui-color-neutral-100);
  --ui-bg-accented: var(--ui-color-neutral-200);
  --ui-border: var(--ui-color-neutral-200);  /* #d3dcd9 */
  --ui-border-accented: var(--ui-color-neutral-500);
  --ui-text: var(--ui-color-neutral-950);
  --ui-text-highlighted: #111816;
  --ui-text-muted: var(--ui-color-neutral-600); /* #55625e */
  --ui-text-dimmed: var(--ui-color-neutral-500);
}
.dark {
  --ui-primary: var(--ui-color-primary-400);
  --ui-success: var(--ui-color-success-400);
  --ui-info:    var(--ui-color-info-300);
  --ui-warning: var(--ui-color-warning-400);
  --ui-error:   var(--ui-color-error-300);
  --ui-bg: #161b1a;
  --ui-bg-muted: #0c100f;
  --ui-bg-accented: #222928;
  --ui-border: #2f3937;
  --ui-text: #eef3f1;
  --ui-text-highlighted: #eef3f1;
  --ui-text-muted: #9fb0ab;
}
body { background: var(--ui-bg-muted); }
```

`app/app.config.ts`

```ts
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'brand',
      secondary: 'leave',
      success: 'present',
      info: 'leave',
      warning: 'late',
      error: 'absent',
      neutral: 'ink'
    },
    icons: { /* Nuxt UI internal icons → Tabler */
      chevronDown: 'i-tabler-chevron-down',
      check: 'i-tabler-check',
      close: 'i-tabler-x',
      search: 'i-tabler-search',
      loading: 'i-tabler-loader-2'
    }
  }
})
```

Override component defaults in `app.config.ts → ui.<component>` where needed. Typical overrides:

- `button`: default size `lg` → 44px, font 15/600. `outline` + `neutral` must use the `border` color for secondary buttons.
- `input` / `select` / `selectMenu`: 44px, 15px text, `ring-default` (= `--ui-border`), focus `ring-2 ring-primary`.
- `card`: `rounded-[14px]`, `shadow-card`, no ring, body padding 20px.
- `badge`: `rounded-full`, 12/600, `subtle` variant tuned to the 50/600 pairs.
- `tabs`: settings tabs use the `link` variant (underline, no pill). Segmented controls use the `pill` variant on a `bg-elevated` track with a white active item.

### Icons

Use `UIcon` with `name="i-tabler-<name>"`, or the `icon` / `leading-icon` props on components. To bundle offline, list the icons in `icon.clientBundle.icons` or set `scan: true` in `nuxt.config.ts`.

---

## 6. Compose Multiplatform setup (mobile)

```kotlin
object ClockInColors {
    val Brand50 = Color(0xFFE6F4F1); val Brand600 = Color(0xFF0D6E63); val Brand700 = Color(0xFF0A5249)
    val Accent400 = Color(0xFFF2A93B)
    val Surface0 = Color(0xFFFFFFFF); val Surface100 = Color(0xFFF4F7F6); val Surface200 = Color(0xFFE8EDEB)
    val Border = Color(0xFFD3DCD9); val BorderStrong = Color(0xFF7D8B87)
    val Ink = Color(0xFF111816); val InkMuted = Color(0xFF55625E)
}

val LightScheme = lightColorScheme(
    primary = ClockInColors.Brand600, onPrimary = Color.White,
    primaryContainer = ClockInColors.Brand50, onPrimaryContainer = ClockInColors.Brand700,
    secondary = Color(0xFF2858B8), tertiary = ClockInColors.Accent400,
    background = ClockInColors.Surface100, onBackground = ClockInColors.Ink,
    surface = ClockInColors.Surface0, onSurface = ClockInColors.Ink,
    surfaceVariant = ClockInColors.Surface200, onSurfaceVariant = ClockInColors.InkMuted,
    outline = ClockInColors.BorderStrong, outlineVariant = ClockInColors.Border,
    error = Color(0xFFB3261E), errorContainer = Color(0xFFFBE6E4)
)
// DarkScheme: same mapping with the dark token values from §2.

@Immutable data class StatusColor(val fg: Color, val bg: Color)
@Immutable data class StatusColors(val present: StatusColor, val late: StatusColor,
                                   val leave: StatusColor, val absent: StatusColor, val neutral: StatusColor)
val LocalStatusColors = staticCompositionLocalOf { lightStatusColors }

val ClockInShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp), small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(14.dp), large = RoundedCornerShape(24.dp), extraLarge = RoundedCornerShape(24.dp)
)
```

- **Typography:** map clock → `displayMedium` (48/52, W700, -1sp), title-lg → `headlineSmall`, title → `titleLarge`, body → `bodyLarge` (15/22), label → `labelLarge` (13/18 W600), caption → `labelSmall` (12/16 W500). Bundle Plus Jakarta Sans in `composeResources/font`.
- **Icons:** convert the Tabler SVGs you use into `ImageVector`s (for example with Valkyrie or svg2compose), or use a KMP Tabler icon pack if your team has vetted one. Keep stroke 2 and 24dp.
- **Dark mode:** follow the system setting; a manual override goes in Profile later.

---

## 7. Component specs

### Mobile

| Component | Spec | Compose |
|---|---|---|
| Primary CTA | 56h, radius 14, brand-600, 17/700, `shadow-raised`, icon 20 | `Button` with custom height/shape |
| Secondary button | 56h, radius 14, 1px `border`, ink text | `OutlinedButton` |
| Danger button | Outline `absent-600`, or solid in confirm sheets | `OutlinedButton` / `Button(colors=error)` |
| Text field | 52h, radius 8, 1px `border`; focus 2px brand; error 2px absent plus message with x-circle icon | `OutlinedTextField` |
| Select field | Same as text field, chevron-down on the right, opens a bottom sheet picker (M13a) | custom + `ModalBottomSheet` |
| ClockCard | radius 24, brand-700 slab, server time 48px tabular, shift chip on accent-400 | custom |
| Work-mode switch | Segmented: Office / Home (WFH), shown only if both modes are allowed | `SingleChoiceSegmentedButtonRow` (restyled) |
| Location panel | Mini geofence, status line (inside / outside / weak / mock / denied / locating) | custom |
| Status badge | Pill, 12/600, icon 14, 50/600 pair | custom `StatusBadge` |
| Bottom nav | 4 items (Home, History, Requests, Profile); active = brand-50 pill 56×30, brand-600 icon and label; red count badge at the top-right of the icon | `NavigationBar` (custom indicator) |
| Tabs / chips | Segmented track `surface-200` radius 14, active item white radius 10 with shadow. Filter chips use a 1px `border` when inactive | custom |
| Bottom sheet | Top radius 24, drag handle 40×4 `border` color, title 18/600, close 48×48 | `ModalBottomSheet` |
| Calendar (History) | Month grid; day cells tinted by status; legend under the grid | custom |
| Week strip (Home) | Mon–Fri circles with status icon and time | custom |
| Approval chain | Avatars plus a state badge per approver; "Any order" caption | custom |
| Selfie camera | Full-bleed preview, face frame, hint, shutter; front camera only, no gallery | `SelfieCamera` platform interface (CameraX on Android) |

### Web

| Component | Spec | Nuxt UI |
|---|---|---|
| App shell | Sidebar 232 (logo, 8 nav items 44h, active brand-50 pill), main padding 32, gap 24 | `UDashboardGroup`, `UDashboardSidebar`, `UNavigationMenu`, `UDashboardPanel` |
| Sidebar account | Avatar, name, role, selector icon → menu (My employee profile, Change password, Help, Sign out) | `UUser` + `UDropdownMenu` |
| Page header | Optional breadcrumb 13px, `h1` 24/700, subtitle 13 muted, actions on the right | `UDashboardNavbar` or custom header |
| Button | 44h (40 small), radius 8, 15/600, icon 18. Primary solid; secondary outline `border`; danger outline red; danger solid only inside confirm modals | `UButton` (`solid`/`outline`, `color: primary/neutral/error`) |
| Icon button | 36×36, radius 8, 1px border. Edit = neutral; delete = red border and red icon | `UButton square variant="outline"` |
| Input / select | 44h, radius 8, 1px `border`, chevron-down 18 | `UInput`, `USelect`, `USelectMenu`, `UInputNumber` |
| Form field | Label 13/600 above, gap 6, hint 12 muted below; required marked with a red * | `UFormField` |
| Card | White, radius 14, `shadow-card`, padding 20; title 18/600 | `UCard` |
| Table | Header 13/600 muted; rows 14/20 with `border-top`; cell padding 12, first/last 20; chevron or actions in the last column | `UTable` (TanStack) |
| Badge | Pill, 12/600. Variants: present, late, leave, absent, neutral, brand, outline | `UBadge` (`subtle` / `outline`) |
| Underline tabs | 44h, 15/600 muted; active brand-600 700 + 2px inset underline | `UTabs variant="link"` |
| Segmented | Track `surface-200` radius 10, items radius 6, active white with shadow | `UTabs variant="pill"` |
| Switch | 44×26; on = brand-600, off = `border-strong`; label 15/600 plus description 13 muted | `USwitch` |
| Choice cards | Checkbox or radio with title and description; checked = 2px or 1px brand border on brand-50 | `UCheckboxGroup` / `URadioGroup` with `variant="card"` |
| Modal | Width 520–560, radius 14, title 18/600, close 44, footer right-aligned with a top border. Destructive: `alertdialog` with a red icon circle 40 | `UModal` |
| Dropdown menu | 272–320 wide, radius 12, items 44h with icon 18; destructive item red; separator | `UDropdownMenu` |
| Callout | `surface-100` fill, radius 10, info-circle 18, 13/18 muted | `UAlert color="neutral" variant="soft"` |
| Stat tile | Card with figure 24–28/700 and caption 13 muted; optional status icon circle | custom on `UCard` |
| Empty state | Icon circle 72 tinted, title 22/700, body 15 muted max 440, actions | custom (or `UEmpty` if your Nuxt UI version has it) |
| Stepper | Numbered circles 28; done = brand plus check | `UStepper` |
| Pagination | Prev/next 40×40 outline | `UPagination` |
| Progress bar | 96×8, brand (late if under 90%) | `UProgress` |
| Date input | Leading calendar icon | `UInputDate` / `UCalendar` in a popover |
| File upload | CSV drop zone | `UFileUpload` |
| Count badge | Red pill 22h, white 12/700 | `UBadge color="error"` |

---

## 8. Custom components (not in Nuxt UI or Material)

| Component | Where | Notes |
|---|---|---|
| `GeofenceMap` | W06, W10, mobile Home | Map with an office pin, dashed radius circle and the reported position with an accuracy circle. Web: MapLibre GL or Leaflet. Mobile: a static mini-map is fine |
| `WeekdayPicker` | W07a/b/d | Toggle buttons Mon–Sun 52×44; checked = brand solid. Rotation: a Week 1 / Week 2 row plus a "Week 1 starts on" date |
| `DayPills` | W07 table | 7 mini pills (M T W T F S S); work day = brand solid, off day = `surface-200` |
| `ApprovalChainEditor` | W16b | Draggable approver rows (handle, avatar, role, remove), "Add approver", order radio, rules selects |
| `AttendanceStatusBadge` | All | One component mapping status enum → color, label and icon (shared rules, see §9) |
| `ClockCard`, `WorkModeSwitch`, `LocationPanel`, `SelfieCamera`, `HistoryCalendar`, `WeekStrip` | Mobile | See §7 |
| `SelfieThumb` | M08, W10 | 32×40 or 72×88 rounded photo with a placeholder silhouette |
| `ImportReviewTable` | W03b | Row-level error with an inline "fix" select |

---

## 9. Status vocabulary

| Enum | Label | Color | Icon (Tabler) |
|---|---|---|---|
| ON_TIME | On time | present | `check` |
| LATE | Late · 12 min | late | `clock-exclamation` |
| EARLY_LEAVE | Early leave | late | `door-exit` |
| NO_CLOCK_OUT | No clock-out | late | `clock-question` |
| ABSENT | Absent | absent | `x` |
| LEAVE / SICK / SPECIAL | Annual leave / Sick / Special leave | leave | `beach` / `first-aid-kit` / `gift` |
| WFH | WFH | leave (badge) / brand | `smart-home` |
| HOLIDAY | Holiday | neutral | `calendar-event` |
| NEEDS_REVIEW | Needs review | late | `flag` |
| OFFLINE | Waiting to sync | neutral | `cloud-off` |
| Request: PENDING / APPROVED / DECLINED / CANCELLED | Pending · 1 of 3 / Approved / Declined / Cancelled | neutral / present / absent / neutral | `hourglass` / `check` / `x` / `ban` |

---

## 10. Key icons used

`smart-home` (Home tab, WFH), `calendar-event` (History, dates), `file-text` (Requests), `user` (Profile), `clock` (clock in, work hours), `map-pin`, `camera`, `building` (office), `beach`, `gift`, `baby-carriage`, `cash-off`, `stethoscope`, `first-aid-kit`, `clock-plus` (overtime), `pencil` (correction, edit), `trash`, `shield-off`, `user-off`, `user-plus`, `users`, `upload`, `download`, `file-spreadsheet`, `layout-dashboard`, `flag`, `list`, `settings`, `logout`, `key`, `help-circle`, `selector`, `chevron-down/left/right`, `x`, `check`, `circle-check`, `alert-circle`, `alert-triangle`, `info-circle`, `eye`, `bell`, `search`, `plus`, `arrow-forward-up`, `arrow-up-right`, `arrow-down-right`, `lock`, `history`, `refresh`.

---

## 11. Accessibility checklist

- Touch targets at least 48dp on mobile and 44px on web.
- Text contrast meets WCAG AA. Use 600 shades for text on 50 fills and on white; never put `accent-400` text on light surfaces.
- Every icon-only button has an `aria-label` (web) or `contentDescription` (mobile).
- Focus is visible: a 2px brand ring on web; respect system font scaling on mobile.
- Status always includes a text label, never color alone.
- Dialogs: focus trap, Esc to close, `role="alertdialog"` for destructive confirmations.

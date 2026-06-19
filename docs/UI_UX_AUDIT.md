# BusDN UI/UX Audit

Audit date: 2026-06-19  
Branch: `dev`  
Surfaces: React/Vite web application and Expo mobile application

## Scope and method

The audit covered route definitions, shared layouts, reusable controls, page-level
states, responsive classes, accessibility semantics, design tokens, and baseline
build/type checks. The application could not be exercised with authenticated API
data in every role, so data-heavy screen findings are based on source inspection
and existing state implementations.

## Screen inventory

### Public and passenger web

| Route | Screen | Main states |
| --- | --- | --- |
| `/` | Home and route-search hero | Content, booking form |
| `/search` | Route search, route list, live map | Loading, results, no results, map errors |
| `/auth/login`, `/login` | Login and password recovery | Form, validation, loading, error, OTP |
| `/auth/register`, `/register` | Registration | Form, validation, loading, error |
| `/auth/verify-otp` | Registration OTP | Form, resend countdown, success, error |
| `/auth/force-change-password` | Mandatory password change | Form, validation, loading, error |
| `/profile` | Passenger profile and statistics | Skeleton, content, save/upload, error |
| `/priority-profile` | Priority passenger profile | Loading, empty, form, status, error |

### Operations web

| Route | Screen |
| --- | --- |
| `/operations/schedule` | Driver/operations schedule |
| `/bus-assistant/assigned-trips` | Assigned trips |
| `/bus-assistant/shift-schedule` | Shift schedule |
| `/bus-assistant/operation-notifications` | Operation notifications |
| `/bus-assistant/validate-ticket` | QR ticket validation |
| `/bus-assistant/walkin-ticket` | Walk-in ticket creation |
| `/bus-assistant/incident-reports` | Incident reporting |
| `/bus-assistant/shift-revenue` | Shift revenue |
| `/bus-assistant/revenue-summary` | Revenue summary |

### Admin web

| Area | Screens |
| --- | --- |
| Command center | Dashboard |
| Fleet | Active trips, delayed trips, fleet locations |
| Routes | Route control, route creation workflow |
| Accounts and staff | User accounts, staff performance |
| Passenger operations | Priority verification, customer support, lost items, passenger compliance |
| Commercial | Promotions, promotion statistics, revenue reports, fare operations, walk-in tickets |
| Analytics | Route efficiency, congested routes, feedback analytics |
| Safety and maintenance | Incident reports, vehicle issues, maintenance approval |
| Platform | System notifications, system monitoring |

`AutoGenerateShiftPage`, `ShiftManagementPage`, and `RouteWorkflowPage` exist in
source but are not reachable from the current `App.jsx` route tree.

### Mobile

| Route | Screen | Main states |
| --- | --- | --- |
| `/` | Session hydration redirect | Loading, redirect |
| `/auth/login` | Login | Form, loading, error |
| `/auth/register` | Registration | Validation, loading, error |
| `/auth/verify-otp` | OTP verification | Countdown, success, error |
| `/home` | Authenticated home | User summary, placeholder travel tools, logout |

## Navigation and layout inventory

- Public shell: fixed `Header`, page content, large `Footer`.
- Auth shell: public header, image/content split panel, footer.
- Admin shell: desktop sidebar, mobile drawer, top command bar, scrollable content.
- Bus assistant shell: role header, responsive side navigation, content outlet.
- Mobile shell: `SafeAreaView`, keyboard avoidance, optional `ScrollView`.
- No global not-found screen is defined.
- Several admin routes are declared both inside and outside the admin layout.

## Design system inventory

- Primary visual language: deep green, mint surfaces, white cards, low-contrast
  green-gray outlines.
- Fonts: Plus Jakarta Sans for display/headings and Inter for body/labels.
- Web tokens exist in Tailwind, but many screens bypass them with direct Slate,
  Emerald, Rose, and arbitrary color/radius values.
- Mobile mirrors the main palette through `colors.ts`.
- Radius variants in active use include 4, 8, 12, 16, 24, 28, 30, 32 pixels and
  fully rounded controls.
- Buttons, inputs, cards, empty states, and modal shells are mostly page-local on
  web. Mobile has shared `AppButton`, `AppInput`, and `Screen`.
- Dark mode exists as a theme capability but is not consistently implemented
  across white cards, fields, admin pages, modals, and autofill.
- No FAB or bottom navigation component currently exists.

## Priority report

### Critical

| Screen | Problem | Impact | Recommended fix |
| --- | --- | --- | --- |
| Shared web header | Light header uses near-white brand/navigation text on a white background | Primary navigation can become unreadable | Apply mode-aware foreground colors and active states |
| Global routing | No catch-all route | Invalid and stale links render a blank application | Add a branded, accessible not-found screen |

### High

| Screen | Problem | Impact | Recommended fix |
| --- | --- | --- | --- |
| Public/auth header | Navigation is hidden on mobile with no replacement menu | Core routes and language controls are undiscoverable | Add a keyboard-accessible mobile menu |
| Admin routing | Duplicate standalone and nested admin routes create inconsistent shells | Direct navigation may show a different layout/navigation context | Consolidate routes under the admin shell after route regression tests |
| Modals/drawers | Most overlays lack `role="dialog"`, `aria-modal`, labelled titles, Escape handling, and focus management | Keyboard and screen-reader users lose context | Introduce a shared accessible dialog primitive |
| Dark mode | Hard-coded white backgrounds and forced dark input text remain common | Mixed themes and low contrast | Complete semantic token migration before enabling dark mode globally |
| Public/footer navigation | Several links use `href="#"`; admin emergency/notification controls have no completed action | Misleading affordances and unexpected page jumps | Point to real sections/routes or expose a clear unavailable state |
| Mobile home | Main travel tools are placeholders | Auth succeeds into an unfinished destination | Implement route/ticket flows or clearly present a limited beta state |
| Web bundle | Baseline production JS is about 1.4 MB minified | Slower first load on mobile networks | Route-level lazy loading and vendor chunking |

### Medium

| Screen | Problem | Impact | Recommended fix |
| --- | --- | --- | --- |
| Home hero | Fixed 870 px height and very large headings waste space on small phones | Excessive scrolling and cramped booking widget | Use viewport-aware minimum height and responsive type |
| Header/admin top bar | Dense actions compete at tablet widths | Clipping and poor action hierarchy | Keep primary actions visible and move secondary actions into menus |
| Data-heavy admin pages | Tables depend on horizontal scrolling with inconsistent mobile alternatives | Slow scanning on phones | Add compact card/list presentation below tablet width |
| All web screens | Global transition and button scale rules apply to every element | Motion is excessive and can cause layout/performance noise | Limit transitions and honor reduced-motion preferences |
| Forms | Error messages are visually present but often not connected to fields | Screen readers may not announce validation context | Add `aria-invalid`, `aria-describedby`, and live regions |
| Page states | Loading/empty/error treatments vary by page | Users cannot build consistent expectations | Create shared skeleton, empty, error, and retry components |
| Cards/controls | Radius, shadow, padding, and icon sizing vary substantially | Weak visual consistency | Adopt a small set of component-level tokens |
| Mobile forms | Error/success feedback lacks live-region semantics and inputs rely on visual labels | Reduced assistive-technology usability | Add accessibility labels, hints, and live announcements |

### Low

| Screen | Problem | Impact | Recommended fix |
| --- | --- | --- | --- |
| Footer | Copyright year is fixed at 2024 and mixed product naming is used | Product feels stale/inconsistent | Use the current year and one product name |
| Copy | English and Vietnamese are mixed within the same journeys | Higher cognitive load | Complete the existing language dictionary strategy |
| Typography | Similar labels use many one-off font sizes and tracking values | Minor hierarchy inconsistency | Map text to display/title/body/label tokens |
| Icons | Material Symbols and Lucide use inconsistent optical sizes | Minor alignment noise | Define 16/20/24 px icon sizes by control type |

## Task-management-specific review

The product is a transit operations application rather than a general task manager.
There are no task priority/category/completion, calendar task planning, FAB, or
bottom-navigation patterns to evaluate. Equivalent operational workflows do show
priority/status through incident severity, notification priority, trip states,
maintenance status, and compliance risk. Those signals are generally present, but
their badge colors and naming are implemented independently per feature and should
be consolidated into shared semantic status tokens.

## Responsive review

- Small Android/iPhone widths: public navigation is absent; home hero is oversized;
  wide admin tables require horizontal scrolling; 24 px mobile page padding leaves
  limited content width; long email/contact values can crowd mobile metadata rows.
- Large Android/iPhone widths: layouts generally stack correctly, but auth hero
  imagery adds substantial vertical travel before forms on landscape/short screens.
- Tablet: admin top bar and role headers can become dense before desktop breakpoints.
- Modals commonly use viewport max-height and scrolling, but most do not account for
  focus retention or mobile safe-area padding.

## Baseline verification

- Web production build: passed.
- Mobile TypeScript check: passed.
- Web lint: 0 errors, 23 pre-existing warnings.
- Web production bundle warning: main JavaScript chunk exceeds 500 kB.

## Safe implementation scope

The first remediation pass is intentionally limited to shared readability,
navigation, responsive sizing, accessibility, clear unfinished states,
and a not-found fallback. Large table redesigns, full modal infrastructure,
admin-route consolidation, dark-mode completion, and product feature completion
remain follow-up work because they require broader regression coverage.

## Remediation completed

- Corrected shared header contrast in light mode.
- Added public mobile navigation, mobile language access, Escape handling, and
  route-change cleanup.
- Reduced small-screen header crowding and constrained the notifications popover.
- Replaced dead home anchors with real section targets and made unavailable
  actions explicitly disabled.
- Made the home hero, booking panel, and authentication shell more compact on
  small screens.
- Connected booking labels to inputs and forward the selected departure date.
- Added a branded catch-all 404 screen.
- Limited global motion side effects and added reduced-motion support.
- Added semantics and keyboard dismissal to the admin mobile drawer.
- Added labels/states for unfinished admin emergency and notification controls.
- Consolidated the duplicate Fleet Operations and Fleet Location experiences into
  one live API/socket-backed workspace. The legacy location URL remains compatible,
  while the duplicate sidebar entry and conflicting demo KPI/map data were removed.
- Improved mobile shared input/button accessibility, page width behavior, scrolling,
  live error announcements, checkbox semantics, and small-screen home overflow.
- Updated footer copy, product naming, section anchors, and copyright year.

## Verification after remediation

- Web production build: passed (`2191` modules transformed).
- Mobile TypeScript check: passed.
- Web lint: 0 errors and the same 23 pre-existing warnings as baseline.
- `git diff --check`: passed.
- Remaining build warning: the web entry JavaScript chunk is about 1.42 MB minified.

## Version-control note

The repository root `.gitignore` excludes the entire `Mobile/` directory. Mobile
improvements were applied and type-checked in the workspace, but they will not
appear in a normal Git commit unless the project intentionally starts tracking
that module or selected files are force-added.

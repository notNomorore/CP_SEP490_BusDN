# Admin i18n synchronization report

Date: 2026-06-19  
Branch: `dev`

## Existing system audit

- Global language state is provided by `src/shared/hooks/useLanguage.js`.
- The selected language is stored under `localStorage.appLanguage`.
- The hook publishes changes through one module-level subscriber set, so mounted
  consumers update immediately and storage events synchronize browser tabs.
- Before this change, only `AdminCommandLayout.jsx` and
  `DashboardAdminPage.jsx` had local dictionaries. The remaining admin modules
  rendered hard-coded English, hard-coded Vietnamese, or both.

## Files and modules inspected

The scan covered 36 JSX admin screens/components and their visible text sources:

- Admin shell, dashboard, account management, staff performance, shifts.
- Route control and all route workflow steps.
- Fleet operations, active trips, and delayed trips.
- Fare operations.
- Route efficiency, congestion, and feedback analytics.
- Promotions and promotion statistics.
- Revenue and walk-in ticket monitoring.
- Incidents, vehicle issues, replacement vehicle modal, maintenance approval.
- Passenger compliance.
- System notifications and system monitoring.
- Customer support and lost-item administration.
- Priority profile verification.

The scanner inventories JSX text, labels, placeholders, titles, aria labels,
options, empty states, object-driven labels, toast messages, and validation copy.

## Implementation

- Added 49 semantic keys under consistent namespaces:
  - `admin.sidebar.*`
  - `admin.header.*`
  - `admin.navigation.*`
  - `admin.common.*`
- Added a generated catalog containing 1,716 visible admin phrases with English
  and Vietnamese values.
- Added terminology overrides for BusDN-specific phrases such as Fleet Operations,
  walk-in tickets, route monitoring, delay acknowledgement, and fare policies.
- Replaced the admin shell's separate dictionaries and bilingual navigation
  fields with the shared semantic key source.
- Added one admin translation boundary that synchronizes page text, dynamically
  mounted modal content, select options, placeholders, titles, aria labels, status
  values, validation text, and toast DOM.
- Added dynamic translations for pagination, result counts, durations, and common
  backend status values.
- The boundary does not add layout elements and does not alter business state,
  routes, API requests, or styling.

## Files added

- `Frontend/src/shared/i18n/adminMessages.js`
- `Frontend/src/shared/i18n/adminI18n.js`
- `Frontend/src/shared/i18n/adminPhraseTranslations.generated.js`
- `Frontend/src/shared/components/AdminI18nBoundary.jsx`
- `Frontend/src/shared/i18n/adminI18n.test.js`
- `Frontend/scripts/generate-admin-translations.mjs`
- `Frontend/scripts/admin-translation-cache.json`

## Files modified for i18n

- `Frontend/src/features/admin/components/AdminCommandLayout.jsx`
- `Frontend/package.json`

## Verification

- Semantic key parity: 49 English keys and 49 Vietnamese keys; no missing values.
- Generated phrase catalog: 1,716 entries.
- Static Vietnamese phrases missing English translations: 0.
- Translation tests: 4 passed.
- Production build: passed.
- ESLint: 0 errors; 23 pre-existing warnings remain.
- `git diff --check`: passed.

## Remaining untranslated content

No known static admin interface copy is missing from the catalog. The following are
intentionally language-neutral and are not translated:

- Technical abbreviations such as GPS, QR, IP, ETA, IDs, route codes, and currency.
- Email addresses, vehicle plates, account names, passenger names, and API data.
- User-entered free-form content.

Unexpected free-form backend error messages are preserved when no catalog entry
exists so operational detail is not discarded.

## Synchronization confirmation

The sidebar, top header, current page, nested tabs, filters, tables, empty states,
dialogs, validation feedback, status badges, and toasts now read the same global
language state. Switching language updates the mounted admin UI immediately and
the selection persists after refresh through `localStorage.appLanguage`.

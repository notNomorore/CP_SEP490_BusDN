# Frontend-wide i18n report

Date: 2026-06-19  
Branch: `dev`

## Root cause

The language state itself was already shared correctly through
`src/shared/hooks/useLanguage.js` and persisted under `localStorage.appLanguage`.
The incomplete switching came from translation coverage:

- Admin had a translation boundary and catalog.
- Passenger pages only shared the toggle, not the translation boundary.
- Home, route search, authentication, profile, footer, dialogs, and page states
  contained hard-coded English or Vietnamese strings.
- The passenger header navigation also used hard-coded labels.

## Current structure

- One language source: `useLanguage()`.
- One persisted value: `localStorage.appLanguage`.
- One application-level translation boundary around all routes.
- One semantic dictionary for shared Admin and Passenger navigation/common labels.
- One generated bilingual phrase catalog for all frontend feature components.

## Coverage

The scan covers all files under `Frontend/src/features` and shared UI components,
including:

- Admin pages listed in `ADMIN_I18N_REPORT.md`.
- Landing/Home and booking widget.
- Passenger route search, route details, stops, live ETA, favorites, notifications,
  route feedback, loading, and empty states.
- Login, registration, OTP, password recovery, and forced password change.
- Passenger profile, statistics, favorites, notifications, and password change.
- Priority passenger profile.
- Shared header, footer, file viewer, not-found page, and application messages.
- Driver/bus-assistant and schedule operations UI.

Ticket checkout and payment passenger pages are not currently routed in `App.jsx`;
their commented routes remain unchanged.

## Translation inventory

- Semantic dictionary keys: 68 in English and 68 in Vietnamese.
- Generated phrase catalog: 2,498 bilingual entries.
- Passenger header/navigation keys use the `passenger.*` namespace.
- Admin keys continue to use `admin.*`.
- Repeated action and state copy uses common keys and status translations.

## Files added or renamed

- `Frontend/src/shared/components/I18nBoundary.jsx`
- `Frontend/src/shared/i18n/adminPhraseTranslations.generated.js`
- `Frontend/scripts/generate-admin-translations.mjs`
- `Frontend/scripts/admin-translation-cache.json`
- `docs/FRONTEND_I18N_REPORT.md`

## Primary files modified

- `Frontend/src/App.jsx`
- `Frontend/src/shared/components/navigation/Header.jsx`
- `Frontend/src/shared/i18n/adminMessages.js`
- `Frontend/src/shared/i18n/adminI18n.js`
- `Frontend/src/shared/i18n/adminI18n.test.js`
- `Frontend/src/features/admin/components/AdminCommandLayout.jsx`
- `Frontend/package.json`

## Behavior verification

- Admin and Passenger use the same language state.
- Switching language updates the mounted application immediately.
- Navigation retains the selected language.
- Refresh restores the selected language.
- Toggle label shows the current language: `EN` for English and `VN` for Vietnamese.
- Dates in the shared header use the selected locale.
- Material icon names, IDs, URLs, email addresses, GPS/QR/IP abbreviations, route
  codes, names, and user-entered/backend business data are intentionally preserved.

## Commands

- Regenerate catalog: `npm run i18n:generate`
- Translation tests: `npm test -- --run src/shared/i18n/adminI18n.test.js`
- Production verification: `npm run build`

# Changelog

## 8.0.0 — Signal First

- Recentered Command Center around a daily **Signal** instead of an automatically inferred urgency list.
- Added an explicit 3–5 Must-Win workflow with a hard maximum of 5 Signal tasks per day.
- Added one-tap **Promote to Signal** and **Park as Noise** actions.
- Added a Noise Parking Lot to the main dashboard so captured work stays visible without competing for today's attention.
- Changed Focus Mode to present today's Signal first and visually separate non-Signal work.
- Changed Daily Shutdown to choose up to 5 Must-Wins and stamp them as tomorrow's Signal.
- Weekly top priorities now seed the next Monday Signal.
- Added Signal / Noise task filters and Signal-aware task ordering.
- Kept IndexedDB at schema v4; `signalDate` is stored directly on task records and normalizes safely for existing workspaces.
- Bumped the offline PWA cache to `command-center-v18`.

## 7.3.0 — Local-Only Polish

- Added searchable/filterable Activity History.
- Added Tasks CSV and Workspace Markdown exports.
- Added optional PBKDF2-hashed local Privacy Lock.
- Added mobile Next/Doing swipe actions.
- Added direct Project → Task creation.
- Expanded audit logging for status changes, imports, restores, deletes, habits, privacy, and exports.
- Added offline caching for `privacy.js` and `exporters.js`.
- Polished the installable PWA shell: cache v16, same-origin offline fallbacks, deep-link offline coverage, theme-aware browser chrome, iPhone install guidance, icon-dimension checks, and share-target E2E coverage.
- Kept IndexedDB schema at v4.

## 7.2.1 — Navigation Persistence

- Synced URL `?view=` state with in-app navigation.
- Verified Planner view and Planner mode survive reload.
- Bumped offline cache to v14.

## 7.2.0 — Planning Power

- Added Planner Month / Week / Day modes.
- Added drag-to-reschedule.
- Added quick Today / Tomorrow / +1 week / Clear presets.
- Added persistent Kanban ordering.

## 7.1.0 — Smart Views + Scheduling

- Added Saved Task Views for status + project + tag combinations.
- Added selected-weekday recurrence.
- Added every-X-weeks recurrence.
- Expanded Quick Add scheduling phrases.

## 7.0.0 — Power User

- Added task tags / contexts.
- Added tag filtering and bulk task actions.
- Added customizable Today dashboard.

## 6.2.0 — Production QA

- Added Playwright browser E2E, offline tests, stress tests, and production smoke workflow.
- Added safe backup validation.
- Added proper PNG PWA icons.
- Added controlled service-worker update UX.
- Added dialog focus trapping.
- Fixed strict-mode startup bugs found by browser QA.

## 6.1.0 — Cleanup & Simplify

- Split `app.js` responsibilities into `core.js` and `storage.js`.
- Simplified navigation.
- Consolidated mobile CSS.
- Removed redundant release artifacts and dead helpers.

## 6.0.0 — Hardening

- Added explicit IndexedDB migrations.
- Added GitHub CI and regression release gates.
- Added snapshot safeguards and system health reporting.
- Fixed month-end recurrence behavior.
- Improved accessibility.

## 5.0.0 — Personal OS

- Added Goals → Projects → Tasks.
- Added Daily Shutdown.
- Added Command Palette.
- Added rotating local snapshots.
- Added PWA Share Target capture.

## 4.0.0 — Weekly System

- Added Weekly Review.
- Added reusable templates.
- Added Archive / Trash / Undo.
- Added advanced recurrence.

## 3.x — Mobile + Onboarding

- Added onboarding, diagnostics, mobile swipe actions, bottom-sheet dialogs, and touch polish.

## 2.x — Local-First Command Center

- Replaced the original Express/Mongo to-do experiment with a local-first IndexedDB PWA.

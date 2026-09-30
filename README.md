# Command Center

Command Center is a private, local-first personal productivity PWA. User data stays on the device in IndexedDB; there is no account system or cloud database.

## Current release: v6.1 Cleanup & Simplify

v6.1 adds no new product features. It simplifies the app and codebase while preserving all v6 behavior.

### Product structure

Top-level navigation is intentionally smaller:

- Today
- Tasks
- Planner
- Board
- Focus
- Goals
- Projects
- Notes
- Habits
- Review
- Command
- Settings

Templates and Archive/Trash now live under **Tasks**.

Daily Shutdown, Weekly Review, and Analytics now live under one **Review** family.

All existing feature views remain available; they are simply grouped more logically.

## Frontend architecture

The active app is dependency-free browser JavaScript split by responsibility:

- `public/app.js` — UI rendering, dialogs, events, workflow orchestration
- `public/core.js` — pure task normalization, dates, recurrence, Quick Add parsing, goal progress
- `public/storage.js` — IndexedDB schema, migrations, reads/writes, storage constants
- `public/sw.js` — offline app shell
- `public/style.css` — shared layout and responsive styles
- `public/index.html` — application shell

The old database name `command-center-v2` is retained **on purpose**. Renaming it would make existing local data appear missing.

## Local storage model

IndexedDB schema v4 stores:

- tasks
- projects
- notes
- habits
- activity
- templates
- goals
- snapshots
- meta

Explicit migrations upgrade older schemas in place.

Snapshots are capped at 7 rotating recovery points and 4 MB per snapshot. JSON export remains the portable full-backup format.

## PWA

- Offline cache: `command-center-v9`
- Web Share Target support
- Home Screen install support
- Natural device orientation; portrait is no longer forced
- Core application modules are cached for offline use

## Quality gate

The app uses a zero-dependency Node regression suite.

```bash
npm test
npm run check
```

The gate verifies:

- module syntax
- DOM wiring and duplicate IDs
- simplified navigation structure
- IndexedDB migrations
- recurring-task date behavior
- Smart Quick Add parsing
- goal progress rollups
- PWA manifest/share target
- service-worker cache version
- accessibility basics
- CSS brace balance and consolidated mobile layer
- removal of dead/redundant release-era code

Netlify runs `npm run build`, which runs the same release gate before production publish. GitHub Actions runs the gate on pull requests and pushes to `master`.

## Run locally

```bash
npm run dev
```

Then open http://localhost:4000.

## Deploy

Netlify publishes `public`. No secrets, database service, or environment variables are required.

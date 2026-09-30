# Command Center

Command Center is a private, local-first personal productivity web app. It runs as an installable PWA and keeps user data on the device in IndexedDB.

## Current release: v6 hardening

The original Express + MongoDB task-manager experiment has been retired from the active architecture. Command Center now includes:

- Today dashboard
- Inbox / Next / Doing / Done task workflow
- Smart Quick Add
- Planner calendar
- Kanban board
- Focus Mode
- Subtasks and recurring tasks
- Projects and Goals
- Notes and Habits
- Weekly Review
- Daily Shutdown
- Templates
- Archive / Trash / Undo
- Automatic rotating local recovery snapshots
- JSON export / import
- Command Palette
- PWA share capture
- Offline support

## Local storage model

IndexedDB database: `command-center-v2`

Schema v4 stores:

- tasks
- projects
- notes
- habits
- activity
- templates
- goals
- snapshots
- meta

The v4 migration is explicit and upgrades earlier schemas without replacing the database.

Snapshots are capped at 7 rotating recovery points and 4 MB per snapshot. JSON export remains the portable full backup format.

## Quality gate

The app uses a zero-dependency Node regression suite.

```bash
npm test
npm run check
```

`npm run check` validates JavaScript syntax and runs regression coverage for:

- DOM wiring and duplicate IDs
- IndexedDB schema migrations
- recurring-task date behavior
- Smart Quick Add recurrence parsing
- goal progress rollups
- PWA manifest/share target
- service-worker cache version
- accessibility basics

Netlify runs `npm run build`, which now runs the same release gate before production publish. GitHub Actions runs the release gate on pull requests and pushes to `master`.

## Run locally

```bash
npm run dev
```

Then open http://localhost:4000.

## Deploy

Netlify publishes the `public` directory. No cloud database, secrets, or environment variables are required.

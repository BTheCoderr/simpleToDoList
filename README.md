# Command Center

A private, local-first personal productivity workspace rebuilt from the original task-manager experiment.

## v2

The old Express + MongoDB + JWT architecture is retired from the active branch. The app opens directly into a personal workspace and stores user-created data on the device.

### Features

- Today dashboard with priorities, overdue work, weekly completion and active projects
- Inbox / Next / Doing / Done task workflow
- Priorities, due dates, projects and recurring daily/weekly tasks
- Projects with progress calculated from their tasks
- Notes with pinning
- Daily habit tracking and streaks
- Global search
- Productivity analytics
- Light / dark themes
- JSON export and import
- Offline app shell via service worker

### Storage

- IndexedDB: tasks, projects, notes, habits and activity
- localStorage: theme and current view
- JSON: backup and restore

There is no account system and no cloud database in this version. Data does not automatically sync between devices.

## Run

npm run dev

Open http://localhost:4000.

## Deploy

Netlify is configured to publish the static public directory. No secrets, database, or environment variables are required.

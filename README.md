# Command Center

<!-- repo-intro:start -->
**Project snapshot:** Command Center is a private, local-first productivity PWA that grew from a simple to-do app into a personal operating system with planning, focus, goals, habits, review workflows, recovery tools, privacy controls, and browser QA.

**What it demonstrates:** JavaScript · IndexedDB · PWA/offline · Playwright · local-first product architecture · progressive enhancement.
<!-- repo-intro:end -->

Command Center keeps user data on the device in IndexedDB. There is no account system or cloud database.

## Current code release: v7.3 Local-Only Polish

v7.3 finishes the local-only product layer without changing IndexedDB schema v4.

### v7.3 highlights

- **Activity History** — a searchable/filterable local audit trail for meaningful task, project, goal, review, backup, privacy, and export events.
- **Human-readable exports** — full JSON recovery backup plus Tasks CSV and Workspace Markdown.
- **Optional Privacy Lock** — a local convenience lock using PBKDF2 + SHA-256 with a random salt. It hides the UI on a fresh session but does **not** encrypt IndexedDB.
- **Mobile task stages** — the existing swipe action row now supports fast moves to Next and Doing in addition to Edit, Done, and Delete.
- **Goal → Project → Task flow** — create projects directly from goals and tasks directly from project cards.
- **Offline cache v15** — privacy and export modules are part of the offline app shell.

Production deployment is intentionally deferred while Netlify build credits are unavailable. GitHub remains the source of truth and every change is tested before merge.

## Product structure

Top-level navigation stays intentionally small:

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

Templates and Archive/Trash live under **Tasks**.

Daily Shutdown, Weekly Review, Analytics, and Activity History live under **Review**.

### Planning and execution

- Tasks with Inbox / Next / Doing / Done states
- Smart Quick Add
- Tags / contexts
- Saved Task Views
- Multi-select bulk actions
- Month / Week / Day Planner
- Drag-to-reschedule
- Quick reschedule presets
- Persistent Kanban ordering
- Focus Mode
- Subtasks
- Daily, weekday, weekly, monthly, every-X-days, every-X-weeks, selected-weekday, and after-completion recurrence

### Outcomes and reflection

- Goals → Projects → Tasks hierarchy
- Notes
- Habits
- Customizable Today dashboard
- Daily Shutdown
- Weekly Review
- Analytics
- Activity History

### Recovery and privacy

- Rotating local snapshots
- Full JSON backup/import with validation
- Tasks CSV export
- Workspace Markdown export
- Archive / Trash / Undo
- Optional local Privacy Lock
- PWA offline support and controlled update activation

## Frontend architecture

The app stays dependency-light and browser-native:

- `public/app.js` — UI rendering, dialogs, events, workflow orchestration
- `public/core.js` — task normalization, dates, recurrence, Quick Add parsing, goal progress
- `public/storage.js` — IndexedDB schema, migrations, reads/writes, storage constants
- `public/backup.js` — backup compatibility and import validation
- `public/privacy.js` — local privacy-code derivation/verification
- `public/exporters.js` — CSV and Markdown generation
- `public/sw.js` — offline app shell and controlled update activation
- `public/style.css` — shared responsive styles
- `public/index.html` — application shell

The IndexedDB database name `command-center-v2` is retained **on purpose** so existing local data remains visible.

## Local storage model

IndexedDB schema **v4** stores:

- tasks
- projects
- notes
- habits
- activity
- templates
- goals
- snapshots
- meta

UI preferences, Saved Views, Today layout, Planner mode, and Privacy Lock metadata use localStorage/sessionStorage.

Snapshots keep up to 7 rotating recovery points and cap each local snapshot at 4 MB. JSON import is capped at 8 MB and validates backup version, stores, and record shapes **before** local data is replaced.

## PWA

- Offline cache: `command-center-v15`
- 180×180 Apple touch icon
- 192×192 and 512×512 PNG icons
- Dedicated maskable icon
- Web Share Target support
- Home Screen install support
- Natural device orientation
- Controlled “New version ready → Reload” service-worker update flow

## Quality gates

Every pull request and push to `master` runs:

1. **Regression gate** — syntax, DOM wiring, migrations, recurrence, Quick Add, backup safety, PWA metadata, CSS structure, exports, privacy wiring, and dead-code checks.
2. **Playwright Chromium E2E** — real browser workflows for CRUD, recurring tasks, Planner, Board, Focus, Goals, Review, History, recovery, exports, privacy lock, offline use, 5,000-task stress, accessibility, and mobile layout.

Production smoke remains a **manual** workflow while Netlify deployment is deferred.

## Commands

```bash
npm test
npm run check
npm run e2e
npm run dev
```

Local server: http://localhost:4000

## Deploy

Netlify publishes `public`. The application itself requires no secrets, cloud database, or environment variables.

See [CHANGELOG.md](./CHANGELOG.md) for release history.

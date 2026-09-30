# Command Center

<p align="center">
  <img src="public/icon-512.png" alt="Command Center app icon" width="150" />
</p>

<p align="center"><strong>A private, local-first productivity PWA built to plan, focus, review, and keep moving without an account or cloud database.</strong></p>

[![CI](https://github.com/BTheCoderr/simpleToDoList/actions/workflows/ci.yml/badge.svg)](https://github.com/BTheCoderr/simpleToDoList/actions/workflows/ci.yml)
![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8?logo=pwa&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-Browser--native-F7DF1E?logo=javascript&logoColor=000)
![IndexedDB](https://img.shields.io/badge/Storage-IndexedDB-2563EB)
![Playwright](https://img.shields.io/badge/QA-Playwright-2EAD33?logo=playwright&logoColor=white)

**Live app:** https://command-center-local.netlify.app

<!-- repo-intro:start -->
**Project snapshot:** Command Center is a private, local-first personal productivity system that evolved from a simple to-do list into an installable PWA with planning, focus, goals, habits, review workflows, recovery tools, privacy controls, exports, and browser QA.

**Current product:** v7.3 · browser-native JavaScript · IndexedDB schema v4 · installable/offline PWA · no account service · no cloud database.

**What it demonstrates:** JavaScript · IndexedDB · PWA/offline architecture · Playwright E2E · local-first product design · progressive enhancement · release hardening.
<!-- repo-intro:end -->

<!-- portfolio-refresh:start -->
## Product experience

Command Center is built around a simple loop: **capture → plan → focus → review**.

### Capture + organize

- Inbox / Next / Doing / Done task workflow
- Smart Quick Add with dates, priorities, projects, tags, and recurring rules
- Saved Task Views and filters
- Multi-select bulk actions
- Projects, Goals, Notes, and Habits
- Subtasks and recurring tasks

### Plan + execute

- Month / Week / Day Planner
- Drag-to-reschedule
- Quick Today / Tomorrow / +1 week actions
- Persistent Kanban ordering
- Focus Mode with selectable work sessions
- Goal → Project → Task hierarchy
- Customizable Today dashboard

### Review + recover

- Daily Shutdown
- Weekly Review
- Analytics
- searchable Activity History
- Archive / Trash / Undo
- rotating local snapshots
- validated JSON backup/import
- Tasks CSV export
- Workspace Markdown export

### Privacy + offline

- all primary workspace data stays in IndexedDB on the device
- no account system and no cloud database
- optional PBKDF2-based local privacy lock
- installable standalone PWA
- offline app shell and offline deep-link support
- controlled service-worker update activation
- Web Share Target capture
- iPhone Add to Home Screen guidance
- theme-aware browser/app chrome
<!-- portfolio-refresh:end -->

## Architecture

```text
Browser / Installed PWA
        │
        ├── UI + workflows ─────► public/app.js
        ├── task logic ─────────► public/core.js
        ├── persistence ────────► IndexedDB via public/storage.js
        ├── backup validation ──► public/backup.js
        ├── local privacy ──────► public/privacy.js
        ├── exports ────────────► public/exporters.js
        └── offline shell ──────► public/sw.js
```

The application deliberately stays dependency-light and browser-native. The IndexedDB database name `command-center-v2` is retained on purpose so existing local data remains visible while the schema evolves.

## Tech stack

| Layer | Technology |
| --- | --- |
| UI | HTML + CSS + browser-native JavaScript |
| Local data | IndexedDB schema v4 |
| Preferences | localStorage / sessionStorage |
| Offline / install | Web App Manifest + Service Worker |
| Privacy | Web Crypto PBKDF2 + SHA-256 |
| Exports | JSON, CSV, Markdown |
| QA | Node regression suite + Playwright Chromium E2E |
| Hosting | Netlify |

## PWA

Command Center is a real installable Progressive Web App, not just a mobile-shaped website.

- `display: standalone`
- 180×180 Apple touch icon
- 192×192 and 512×512 PNG icons
- 512×512 maskable icon
- offline cache `command-center-v16`
- offline navigation/deep-link fallback
- Web Share Target
- browser install prompt where supported
- iPhone Safari Add to Home Screen guidance
- natural device orientation
- theme-aware app chrome
- controlled **New version ready → Reload** update flow

## Local storage model

IndexedDB stores:

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

Snapshots keep up to 7 rotating recovery points and cap each snapshot at 4 MB. JSON import is capped at 8 MB and validates backup version, stores, and record shapes before local data is replaced.

## Quality gates

GitHub CI runs two release gates:

1. **Regression checks** — syntax, DOM wiring, migrations, recurrence, Quick Add, backup safety, PWA metadata, CSS structure, exports, privacy wiring, and dead-code checks.
2. **Playwright Chromium E2E** — real browser workflows for CRUD, Planner, Board, Focus, Goals, Review, History, recovery, exports, privacy lock, offline use, PWA behavior, 5,000-task stress, accessibility, and responsive layouts down to 320px.

Deployment is deliberately separate from GitHub changes. A green CI run or repo update is **not** treated as permission to publish a new Netlify production build.

## Repository guide

- [CHANGELOG.md](./CHANGELOG.md) — release history
- [public/index.html](./public/index.html) — application shell
- [public/app.js](./public/app.js) — UI and workflow orchestration
- [public/core.js](./public/core.js) — task/date/recurrence logic
- [public/storage.js](./public/storage.js) — IndexedDB schema and migrations
- [public/sw.js](./public/sw.js) — PWA offline/update behavior
- [tests/e2e.spec.mjs](./tests/e2e.spec.mjs) — main browser QA
- [tests/pwa.e2e.spec.mjs](./tests/pwa.e2e.spec.mjs) — install/offline/PWA QA
- [tests/responsive.e2e.spec.mjs](./tests/responsive.e2e.spec.mjs) — mobile overflow coverage
- [.github/workflows/ci.yml](./.github/workflows/ci.yml) — automated quality gates

## Local setup

```bash
npm install
npm run dev
```

Then open:

```text
http://localhost:4000
```

Run the quality gates with:

```bash
npm test
npm run check
npm run e2e
```

## Release status

`master` is the source of truth for the current v7.3 code. Production can intentionally lag behind `master` while changes are being accumulated and tested before an approved Netlify deploy.

The product is designed to remain local-first: no server, account system, database service, API key, or environment variable is required for the core application.

# Command Center

<!-- repo-intro:start -->
**Project snapshot:** Command Center is a local-first productivity PWA that turns a once-simple to-do project into a full personal operating system with planning, focus, goals, habits, review workflows, backups, and browser QA.

**What it demonstrates:** JavaScript · IndexedDB · PWA/offline · Playwright · local-first product architecture.
<!-- repo-intro:end -->

Command Center is a private, local-first personal productivity PWA. User data stays on the device in IndexedDB; there is no account system or cloud database.

## Next release: v7.1 Smart Views + Scheduling

v7.1 builds on the power-user release with Saved Task Views and richer recurring schedules. It remains fully local, keeps IndexedDB schema v4, and does not add a backend.

### Production QA

The release now has two quality layers:

- **Fast regression gate** — syntax, DOM wiring, migrations, recurrence, Quick Add, backups, PWA metadata, CSS structure, and dependency/dead-code checks.
- **Playwright browser QA** — real Chromium workflows covering task CRUD, Trash/restore, refresh persistence, recurring tasks, Planner, Board, Focus, Goals, Review, snapshots, export/import rejection, offline reload, 500/1,000/5,000-task stress, modal focus, and mobile large-text layout.

Every pull request and push to `master` runs regression + browser E2E. While Netlify deploy credits are deferred, the live production smoke is manual and waits for v7.1 before testing `https://command-center-local.netlify.app`.

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

Daily Shutdown, Weekly Review, and Analytics live under one **Review** family.

### v7 power-user workflows

- **Tags / contexts** — add reusable task tags such as `#calls`, `#errands`, or `#computer`. Quick Add still resolves a matching hashtag to a project, while extra/unmatched hashtags become task tags.
- **Bulk task actions** — filter a task list, select visible tasks, and update status, priority, project, or due date together; Archive and Trash work on the selected set too.
- **Custom Today dashboard** — hide/show and reorder Today's priorities, Habits, Projects, and Quick inbox. Layout preferences stay in localStorage and do not affect the IndexedDB schema.

### v7.1 smart views + scheduling

- **Saved Views** — save the current Tasks status, project, and tag filters locally, then restore the exact combination from a one-tap chip.
- **Specific weekday recurrence** — schedule a repeating task for one or more weekdays such as Monday / Wednesday / Friday.
- **Every X weeks** — use recurring intervals such as every 2 or 3 weeks.
- **Smarter Quick Add** — understands natural recurrence phrases including `every 2 weeks`, `every Tuesday`, and `every Monday, Wednesday and Friday`.

### v7.1 smart views + scheduling

- **Saved Task Views** — save the current status + project + tag filter combination under a name, then reopen it in one tap. Saved views live in localStorage.
- **Selected weekday recurrence** — repeat on explicit days such as Mon/Wed/Fri.
- **Every X weeks** — recurring tasks can now run every 2, 3, 4, etc. weeks.
- **Quick Add scheduling** — phrases such as `Sprint review every 2 weeks` and `Gym every Mon/Wed/Fri` are parsed locally.



## Frontend architecture

- `public/app.js` — UI rendering, dialogs, events, workflow orchestration
- `public/core.js` — pure task normalization, dates, recurrence, Quick Add parsing, goal progress
- `public/storage.js` — IndexedDB schema, migrations, reads/writes, storage constants
- `public/backup.js` — backup compatibility and import safety validation
- `public/sw.js` — offline app shell and controlled update activation
- `public/style.css` — shared layout and responsive styles
- `public/index.html` — application shell

The IndexedDB name `command-center-v2` is retained **on purpose**. Renaming it would make existing local data appear missing.

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

Snapshots are capped at 7 rotating recovery points and 4 MB per snapshot. JSON import is capped at 8 MB and validates backup version, required stores, and record shape **before** any local data is cleared.

## PWA

- Offline cache: `command-center-v12`
- 180×180 Apple touch icon
- 192×192 and 512×512 PNG install icons
- Dedicated 512×512 maskable icon
- Web Share Target support
- Home Screen install support
- Natural device orientation
- Controlled update UX: a waiting service worker shows **New version ready → Reload** instead of silently replacing the active app
- Core application modules and install icons are cached for offline use

## Accessibility

The hardened app includes explicit modal focus trapping and returns focus to the control that opened a dialog. Existing skip navigation, reduced-motion support, focus-visible states, live status regions, and mobile touch targets remain in place. Browser QA also checks large-text/mobile overflow behavior.

## Quality commands

```bash
npm test
npm run check
npm run e2e
```

To smoke-test production directly:

```bash
PLAYWRIGHT_BASE_URL=https://command-center-local.netlify.app \
  npx playwright test tests/production.spec.mjs
```

## Run locally

```bash
npm run dev
```

Then open http://localhost:4000.

## Deploy

Netlify publishes `public`. No secrets, cloud database, or environment variables are required for the application itself.

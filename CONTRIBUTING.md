# Contributing to Command Center

Command Center is a private, local-first productivity PWA built around a simple loop: **capture → plan → focus → review**.

## Product scope

Changes should improve personal productivity, reliability, accessibility, recovery, or the local-first experience without adding unnecessary account, cloud, or backend complexity.

The default product boundary is intentional:

- no required account
- no cloud database
- no server dependency for core workflows
- local data remains usable offline

## Before opening a pull request

```bash
npm ci
npm run check
npm run e2e
```

Test the product surface you changed. Mobile or layout work should be checked at narrow phone widths as well as desktop.

## Data safety

Preserve the IndexedDB migration path and the existing database name unless a deliberate migration plan says otherwise.

Any import, restore, reset, archive, trash, or migration change must avoid silent local-data loss.

The Privacy Lock is a convenience lock, not storage encryption; product copy should continue to say so clearly.

## PWA changes

For manifest, service-worker, install, Share Target, icon, or offline changes:

- keep installability intact
- preserve offline startup after a successful first load
- test deep-link navigation offline
- do not return HTML as a fallback for missing non-navigation assets
- preserve the controlled **New version ready → Reload** update flow

## Pull requests

Keep changes focused enough to review. Explain:

- what changed
- why it changed
- how it was verified
- whether local data, PWA behavior, or responsive layout could be affected

## Deployment

A GitHub commit, merge, or green CI run is **not** permission to deploy Command Center to Netlify.

Production publication is a separate, explicit release step.

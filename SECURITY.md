# Security Policy

## Supported version

Security fixes target the current `master` branch and the production release when a production deployment is active.

## Reporting a vulnerability

Please do **not** open a public GitHub issue for a vulnerability that could expose private local workspace data, browser storage, imported backups, or an exploitable app-shell/service-worker path.

Prefer GitHub private vulnerability reporting / Security Advisories when available. Otherwise, contact the repository owner privately through GitHub before publishing exploit details.

Include:

- affected browser / OS and app version
- reproduction steps
- expected vs. actual behavior
- impact
- screenshots or logs with personal workspace data removed

## Local-first security model

Command Center intentionally has no account service, cloud database, or server-side application API for its core product.

Primary workspace data is stored in the browser with IndexedDB. Preferences and local UI state use localStorage/sessionStorage.

The optional Privacy Lock is a **convenience screen lock**, not encryption of IndexedDB. Anyone with sufficient access to the browser profile or device storage may still be able to inspect local data.

## Security-sensitive changes

Changes touching any of the following should receive extra review and browser testing:

- IndexedDB migrations or destructive writes
- JSON import / restore validation
- service-worker caching and update activation
- HTML rendering of user-entered content
- backup/export handling
- Privacy Lock and Web Crypto usage
- Share Target capture
- offline navigation fallbacks

Do not weaken backup validation, escape user content unsafely, or silently delete local data during migrations.

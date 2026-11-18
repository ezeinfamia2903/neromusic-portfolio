# SQLite migrations sample

This module provides versioned, repeatable schema migrations for a small SQLite application. It creates a migration registry, checks the registry against the known migration list, and applies pending changes atomically under an immediate transaction. A failure rolls back schema changes and their version records.

File-backed databases use WAL mode, a bounded busy timeout, and foreign-key enforcement. The example database is in memory; tests use isolated temporary files.

## Usage

```js
const { applyMigrations, openDatabase } = require('./index');

const db = openDatabase('application.sqlite');
const appliedVersions = applyMigrations(db);
```

Calling `applyMigrations` again safely returns an empty list when all registered migrations are already applied.

## Design notes

- Applied versions are read after acquiring an immediate write lock, so concurrent processes serialize before deciding which migrations to run.
- Each migration's schema changes and version record participate in one atomic transaction.
- Unknown stored versions and duplicate migration definitions are rejected explicitly.
- File-backed databases use WAL and foreign-key enforcement.

## What I would improve

- Add an optional migration validation or dry-run command.
- Support explicit migration checksums to detect edits to previously applied migrations.
- Add configurable transaction boundaries for unusually large migration sets.

## Tests and running

The sample has **6 automated tests** covering idempotence, concurrent connections, WAL settings, rollback, duplicate versions, and unknown stored versions.

From the repository root, install dependencies, run the tests, and run the demo with:

```sh
npm ci
node --test samples/sqlite-migrations/index.test.js
node samples/sqlite-migrations/demo.js
```

Run all sample tests and demos with `npm test` and `npm run demo`.

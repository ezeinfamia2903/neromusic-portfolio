# SQLite migrations sample

This module provides versioned, idempotent schema migrations for a small SQLite application. It creates a migration registry, checks the registry against the known migration list, and applies each pending change in its own transaction. A failure rolls back both the schema change and its version record.

File-backed databases use WAL mode, a bounded busy timeout, and foreign-key enforcement. The example database is in memory; the tests use an isolated temporary file to verify WAL behavior.

Run from the repository root:

```sh
node samples/sqlite-migrations/demo.js
node --test samples/sqlite-migrations/*.test.js
```

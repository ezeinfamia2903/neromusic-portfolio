# SQLite state reconciler sample

This module compares enabled, non-expired desired resources stored in SQLite with an adapter's current resources. It applies new or changed configuration, removes resources that are no longer desired, retries adapter failures with bounded exponential backoff, and can run on a non-overlapping interval.

The database is the durable source of desired state. The adapter is the boundary to an independently managed runtime; repeated reconciliation makes interrupted operations safe to retry. Failures are returned per resource, and the periodic runner exposes unexpected cycle errors through `onError`.

Run from the repository root:

```sh
node samples/state-reconciler/demo.js
node --test samples/state-reconciler/*.test.js
```

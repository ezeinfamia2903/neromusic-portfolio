# SQLite state reconciler sample

This module compares enabled, non-expired desired resources stored in SQLite with an adapter's current resources. It applies new or changed configuration, removes resources that are no longer desired, retries adapter failures with bounded exponential backoff, and can run on a non-overlapping interval.

## Usage

```js
const { createReconciler } = require('./index');

const reconciler = createReconciler({ db, adapter });
const result = await reconciler.reconcileOnce();
console.log(result);
```

Initialize the desired-resource store and provide an adapter with `list`, `apply`, and `remove` methods before reconciling.

## Design notes

- SQLite is the durable source of desired state; the adapter represents independently managed runtime state.
- Repeating reconciliation safely retries work after partial failures and process restarts.
- Per-resource failures are returned in the result, while unexpected cycle errors are exposed by the periodic runner.
- The periodic runner prevents overlapping reconciliation cycles.

## What I would improve

- Add optional parallel execution with a configurable concurrency limit.
- Support adapter-specific retry classification and jittered backoff.
- Persist a compact reconciliation history for operational inspection.

## Tests and running

The sample has **6 automated tests** covering creation, configuration changes, removal and expiration, retry exhaustion and recovery, periodic reconciliation, and input validation.

From the repository root, run the tests and demo with:

```sh
node --test samples/state-reconciler/*.test.js
node samples/state-reconciler/demo.js
```

Run all sample tests and demos with `npm test` and `npm run demo`.

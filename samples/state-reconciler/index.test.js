// @ts-check
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const {
  createDesiredResourceStore,
  createReconciler,
  setDesiredResource,
} = require('./index');

/**
 * @param {Record<string, unknown>[]} [initial]
 */
function setup(initial = []) {
  const db = new Database(':memory:');
  createDesiredResourceStore(db);
  /** @type {Map<string, { id: string, config: Record<string, unknown> }>} */
  const applied = new Map(
    initial.map((resource) => [
      resource.id,
      { id: resource.id, config: resource.config },
    ]),
  );
  const adapter = {
    async list() {
      return [...applied.values()];
    },
    async apply(resource) {
      applied.set(resource.id, { id: resource.id, config: resource.config });
    },
    async remove(id) {
      applied.delete(id);
    },
  };
  return { db, applied, adapter };
}

test('creates desired resources and updates changed configuration', async () => {
  const { db, applied, adapter } = setup();
  try {
    setDesiredResource(db, { id: 'alpha', config: { size: 2 } });
    const reconciler = createReconciler({ db, adapter });

    assert.deepEqual(await reconciler.reconcileOnce(), {
      created: ['alpha'],
      updated: [],
      removed: [],
      failures: [],
    });
    setDesiredResource(db, { id: 'alpha', config: { size: 4 } });
    assert.deepEqual(await reconciler.reconcileOnce(), {
      created: [],
      updated: ['alpha'],
      removed: [],
      failures: [],
    });
    assert.deepEqual(applied.get('alpha').config, { size: 4 });
  } finally {
    db.close();
  }
});

test('removes disabled and expired applied resources', async () => {
  const { db, applied, adapter } = setup([
    { id: 'disabled', config: {} },
    { id: 'expired', config: {} },
    { id: 'unknown', config: {} },
  ]);
  try {
    setDesiredResource(db, { id: 'disabled', enabled: false });
    setDesiredResource(db, { id: 'expired', expiresAt: 50 });
    const reconciler = createReconciler({ db, adapter, now: () => 50 });

    const result = await reconciler.reconcileOnce();
    assert.deepEqual(result.removed, ['disabled', 'expired', 'unknown']);
    assert.equal(applied.size, 0);
  } finally {
    db.close();
  }
});

test('reports exhausted retries and converges on a later pass', async () => {
  const { db, applied, adapter } = setup();
  try {
    setDesiredResource(db, { id: 'temporary', config: { ready: true } });
    let attempts = 0;
    adapter.apply = async (resource) => {
      attempts += 1;
      if (attempts <= 2) throw new Error('adapter unavailable');
      applied.set(resource.id, { id: resource.id, config: resource.config });
    };
    const reconciler = createReconciler({
      db,
      adapter,
      maxAttempts: 2,
      wait: async () => {},
    });

    const failed = await reconciler.reconcileOnce();
    assert.equal(failed.failures.length, 1);
    assert.equal(failed.failures[0].attempts, 2);
    assert.equal(applied.size, 0);

    const recovered = await reconciler.reconcileOnce();
    assert.deepEqual(recovered.created, ['temporary']);
    assert.equal(applied.size, 1);
  } finally {
    db.close();
  }
});

test('periodically retries an inconsistent state and stops cleanly', async () => {
  const { db, applied, adapter } = setup();
  try {
    setDesiredResource(db, { id: 'kept', config: { active: true } });
    let fail = true;
    adapter.apply = async (resource) => {
      if (fail) throw new Error('temporary failure');
      applied.set(resource.id, { id: resource.id, config: resource.config });
    };

    const cycle = new Promise((resolve, reject) => {
      let completed = 0;
      const reconciler = createReconciler({
        db,
        adapter,
        maxAttempts: 1,
        initialDelayMs: 0,
      });
      const runner = reconciler.start({
        intervalMs: 5,
        onResult(result) {
          completed += 1;
          if (completed === 1) {
            assert.equal(result.failures.length, 1);
            fail = false;
          } else {
            runner.stop();
            resolve(result);
          }
        },
        onError: reject,
      });
    });

    const result = await cycle;
    assert.deepEqual(result.created, ['kept']);
    assert.equal(applied.has('kept'), true);
  } finally {
    db.close();
  }
});

test('rejects invalid desired resources', () => {
  const { db } = setup();
  try {
    assert.throws(() => setDesiredResource(db, { id: ' ' }), TypeError);
    assert.throws(
      () => setDesiredResource(db, { id: 'x', expiresAt: -1 }),
      TypeError,
    );
  } finally {
    db.close();
  }
});

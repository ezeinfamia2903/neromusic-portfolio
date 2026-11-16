// @ts-check
'use strict';

const Database = require('better-sqlite3');
const {
  createDesiredResourceStore,
  createReconciler,
  setDesiredResource,
} = require('./index');

async function main() {
  const db = new Database(':memory:');
  createDesiredResourceStore(db);
  setDesiredResource(db, {
    id: 'reporting-worker',
    config: { region: 'demo' },
  });

  /** @type {Map<string, { id: string, config: Record<string, unknown> }>} */
  const applied = new Map();
  const reconciler = createReconciler({
    db,
    adapter: {
      async list() {
        return [...applied.values()];
      },
      async apply(resource) {
        applied.set(resource.id, { id: resource.id, config: resource.config });
      },
      async remove(id) {
        applied.delete(id);
      },
    },
    maxAttempts: 1,
  });

  try {
    const result = await reconciler.reconcileOnce();
    console.log(
      JSON.stringify({ result, applied: [...applied.values()] }, null, 2),
    );
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// @ts-check
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Worker } = require('node:worker_threads');
const { applyMigrations, openDatabase } = require('./index');

test('applies registered migrations once and records their versions', () => {
  const db = openDatabase();
  try {
    assert.deepEqual(applyMigrations(db), [1, 2]);
    assert.deepEqual(applyMigrations(db), []);
    const versions = /** @type {Array<{ version: number }>} */ (
      db.prepare('SELECT version FROM schema_migrations ORDER BY version').all()
    );
    assert.deepEqual(
      versions.map((row) => row.version),
      [1, 2],
    );
    const index = /** @type {{ name: string } | undefined} */ (
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?",
        )
        .get('idx_settings_value')
    );
    assert.equal(index?.name, 'idx_settings_value');
  } finally {
    db.close();
  }
});

test('uses WAL for file-backed databases', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'showcase-db-'));
  const filename = path.join(directory, 'sample.sqlite');
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const db = openDatabase(filename);
  try {
    assert.equal(db.pragma('journal_mode', { simple: true }), 'wal');
    assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
  } finally {
    db.close();
  }
});

test('serializes migrations from two connections to the same file', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'showcase-race-'));
  const filename = path.join(directory, 'shared.sqlite');
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const initializer = openDatabase(filename);
  initializer.close();

  const workerSource = `
    const { parentPort, workerData } = require('node:worker_threads');
    const { applyMigrations, openDatabase } = require(workerData.modulePath);
    const db = openDatabase(workerData.filename);
    parentPort.postMessage({ ready: true });
    parentPort.once('message', () => {
      try {
        parentPort.postMessage({ applied: applyMigrations(db) });
      } catch (error) {
        parentPort.postMessage({ error: error.message });
      } finally {
        db.close();
      }
    });
  `;
  const runners = Array.from({ length: 2 }, () => {
    const worker = new Worker(workerSource, {
      eval: true,
      workerData: { filename, modulePath: require.resolve('./index') },
    });
    let markReady = () => {};
    /** @type {(value: number[]) => void} */
    let resolveApplied = () => {};
    /** @type {(reason: Error) => void} */
    let rejectApplied = () => {};
    const ready = new Promise((resolve) => {
      markReady = () => resolve(undefined);
    });
    const applied = new Promise((resolve, reject) => {
      resolveApplied = resolve;
      rejectApplied = reject;
    });
    worker.on('message', (message) => {
      if (message.ready) {
        markReady();
      } else if (message.error) {
        rejectApplied(new Error(message.error));
      } else {
        resolveApplied(message.applied);
      }
    });
    worker.once('error', rejectApplied);
    return { worker, ready, applied };
  });

  try {
    await Promise.all(runners.map((runner) => runner.ready));
    for (const runner of runners) runner.worker.postMessage('start');
    const results = await Promise.all(runners.map((runner) => runner.applied));
    assert.deepEqual(
      results.flat().sort((left, right) => left - right),
      [1, 2],
    );
    assert.deepEqual(results.filter((result) => result.length === 0).length, 1);
  } finally {
    await Promise.all(runners.map((runner) => runner.worker.terminate()));
  }
});

test('rolls back a failed migration without recording its version', () => {
  const db = openDatabase();
  try {
    assert.throws(
      () =>
        applyMigrations(db, [
          {
            version: 1,
            name: 'fails part way through',
            up(database) {
              database.exec('CREATE TABLE temporary_data (value TEXT)');
              throw new Error('simulated migration failure');
            },
          },
        ]),
      /simulated migration failure/,
    );
    const table = /** @type {{ name: string } | undefined} */ (
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        )
        .get('temporary_data')
    );
    assert.equal(table, undefined);
    const migrationCount = /** @type {{ count: number }} */ (
      db.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get()
    );
    assert.equal(migrationCount.count, 0);
  } finally {
    db.close();
  }
});

test('rejects duplicate migration versions', () => {
  const db = openDatabase();
  try {
    assert.throws(
      () =>
        applyMigrations(db, [
          { version: 1, name: 'one', up() {} },
          { version: 1, name: 'duplicate', up() {} },
        ]),
      TypeError,
    );
  } finally {
    db.close();
  }
});

test('rejects database versions absent from the migration registry', () => {
  const db = openDatabase();
  try {
    db.exec(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
    `);
    db.prepare('INSERT INTO schema_migrations VALUES (?, ?, ?)').run(
      7,
      'unknown',
      'today',
    );
    assert.throws(
      () => applyMigrations(db),
      /unregistered migration version 7/,
    );
  } finally {
    db.close();
  }
});

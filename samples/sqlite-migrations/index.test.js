// @ts-check
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { applyMigrations, openDatabase } = require('./index');

test('applies registered migrations once and records their versions', () => {
  const db = openDatabase();
  try {
    assert.deepEqual(applyMigrations(db), [1, 2]);
    assert.deepEqual(applyMigrations(db), []);
    assert.deepEqual(
      db
        .prepare('SELECT version FROM schema_migrations ORDER BY version')
        .all()
        .map((row) => row.version),
      [1, 2],
    );
    assert.equal(
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?",
        )
        .get('idx_settings_value').name,
      'idx_settings_value',
    );
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
    assert.equal(
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        )
        .get('temporary_data'),
      undefined,
    );
    assert.equal(
      db.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get().count,
      0,
    );
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

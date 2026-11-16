// @ts-check
'use strict';

const Database = require('better-sqlite3');

/**
 * @typedef {{
 *   version: number,
 *   name: string,
 *   up: (db: import('better-sqlite3').Database) => void
 * }} Migration
 */

/** @type {Migration[]} */
const DEFAULT_MIGRATIONS = [
  {
    version: 1,
    name: 'create settings table',
    up(db) {
      db.exec(`
        CREATE TABLE settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `);
    },
  },
  {
    version: 2,
    name: 'index setting values',
    up(db) {
      db.exec('CREATE INDEX idx_settings_value ON settings (value)');
    },
  },
];

/**
 * Open a database with safe connection defaults and WAL for file-backed stores.
 *
 * @param {string} [filename]
 */
function openDatabase(filename = ':memory:') {
  const db = new Database(filename);
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  if (filename !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }
  return db;
}

/**
 * Apply all unapplied migrations atomically under an immediate write lock.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {Migration[]} [migrations]
 * @param {() => string} [timestamp]
 * @returns {number[]} newly applied versions
 */
function applyMigrations(
  db,
  migrations = DEFAULT_MIGRATIONS,
  timestamp = () => new Date().toISOString(),
) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('db must be a better-sqlite3 database');
  }
  if (!Array.isArray(migrations)) {
    throw new TypeError('migrations must be an array');
  }

  const ordered = [...migrations].sort(
    (left, right) => left.version - right.version,
  );
  const versions = new Set();
  for (const migration of ordered) {
    if (
      !Number.isSafeInteger(migration.version) ||
      migration.version < 1 ||
      typeof migration.name !== 'string' ||
      typeof migration.up !== 'function' ||
      versions.has(migration.version)
    ) {
      throw new TypeError(
        'Each migration needs a unique positive version, name, and up function',
      );
    }
    versions.add(migration.version);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);

  const recordMigration = db.prepare(`
    INSERT INTO schema_migrations (version, name, applied_at)
    VALUES (?, ?, ?)
  `);

  return db
    .transaction(() => {
      const appliedRows = /** @type {Array<{ version: number }>} */ (
        db.prepare('SELECT version FROM schema_migrations').all()
      );
      const appliedVersions = new Set(appliedRows.map((row) => row.version));
      const unknownVersion = [...appliedVersions].find(
        (version) => !versions.has(version),
      );
      if (unknownVersion !== undefined) {
        throw new Error(
          `Database contains unregistered migration version ${unknownVersion}`,
        );
      }

      /** @type {number[]} */
      const appliedNow = [];
      for (const migration of ordered) {
        if (appliedVersions.has(migration.version)) continue;
        migration.up(db);
        recordMigration.run(migration.version, migration.name, timestamp());
        appliedNow.push(migration.version);
      }
      return appliedNow;
    })
    .immediate();
}

module.exports = {
  applyMigrations,
  DEFAULT_MIGRATIONS,
  openDatabase,
};

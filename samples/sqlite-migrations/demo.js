// @ts-check
'use strict';

const { applyMigrations, openDatabase } = require('./index');

const db = openDatabase();
try {
  const applied = applyMigrations(db);
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(
    'mode',
    'demo',
  );
  const settings = db.prepare('SELECT key, value FROM settings').all();
  console.log(JSON.stringify({ applied, settings }, null, 2));
} finally {
  db.close();
}

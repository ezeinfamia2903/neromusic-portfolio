// @ts-check
'use strict';

const { applyMigrations, openDatabase } = require('./index');

const db = openDatabase();
try {
  const applied = applyMigrations(db);
  const repeated = applyMigrations(db);
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(
    'mode',
    'demo',
  );
  const settings = db.prepare('SELECT key, value FROM settings').all();
  console.log(`First run: ${JSON.stringify(applied)}`);
  console.log(`Second run: ${JSON.stringify(repeated)}`);
  console.log(JSON.stringify({ settings }, null, 2));
} finally {
  db.close();
}

// @ts-check
'use strict';

const { isDeepStrictEqual } = require('node:util');

class ReconcileRetriesExhaustedError extends Error {
  /**
   * @param {number} attempts
   * @param {unknown} cause
   */
  constructor(attempts, cause) {
    super(`Operation failed after ${attempts} attempt(s)`, { cause });
    this.name = 'ReconcileRetriesExhaustedError';
    this.attempts = attempts;
  }
}

/**
 * @typedef {{
 *   id: string,
 *   config: Record<string, unknown>,
 *   expiresAt: number | null
 * }} DesiredResource
 */

/**
 * @typedef {{
 *   id: string,
 *   config: Record<string, unknown>
 * }} AppliedResource
 */

/**
 * @typedef {{
 *   list: () => Promise<AppliedResource[]>,
 *   apply: (resource: DesiredResource) => Promise<void>,
 *   remove: (id: string) => Promise<void>
 * }} ResourceAdapter
 */

/**
 * @typedef {{
 *   operation: 'apply' | 'remove',
 *   id: string,
 *   attempts: number,
 *   error: unknown
 * }} ReconcileFailure
 */

/**
 * Create the durable desired-state table used by this sample.
 *
 * @param {import('better-sqlite3').Database} db
 */
function createDesiredResourceStore(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS desired_resources (
      id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
      expires_at INTEGER,
      config TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_desired_resources_enabled_expiry
      ON desired_resources (enabled, expires_at);
  `);
}

/**
 * @typedef {{
 *   id: string,
 *   enabled?: boolean,
 *   expiresAt?: number | null,
 *   config?: Record<string, unknown>
 * }} DesiredResourceInput
 */

/**
 * Upsert one desired resource. Omitted fields keep their stored values on
 * update and use the documented defaults on insert. A null expiration means
 * that it does not expire.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {DesiredResourceInput} resource
 */
function setDesiredResource(db, resource) {
  if (!resource || typeof resource !== 'object' || Array.isArray(resource)) {
    throw new TypeError('resource must be an object');
  }
  const { id } = resource;
  if (typeof id !== 'string' || id.trim() === '') {
    throw new TypeError('resource id must be a non-empty string');
  }

  const hasEnabled = resource.enabled !== undefined;
  const hasExpiresAt = resource.expiresAt !== undefined;
  const hasConfig = resource.config !== undefined;

  const enabled = hasEnabled ? resource.enabled : true;
  const expiresAt = hasExpiresAt ? (resource.expiresAt ?? null) : null;
  const config = hasConfig ? resource.config : {};

  if (hasEnabled && typeof enabled !== 'boolean') {
    throw new TypeError('enabled must be a boolean');
  }
  if (
    expiresAt !== null &&
    (!Number.isSafeInteger(expiresAt) || expiresAt < 0)
  ) {
    throw new TypeError('expiresAt must be a non-negative integer or null');
  }
  if (!config || Array.isArray(config) || typeof config !== 'object') {
    throw new TypeError('config must be an object');
  }

  db.prepare(
    `
    INSERT INTO desired_resources (id, enabled, expires_at, config)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      enabled = CASE WHEN ? = 1 THEN excluded.enabled ELSE desired_resources.enabled END,
      expires_at = CASE WHEN ? = 1 THEN excluded.expires_at ELSE desired_resources.expires_at END,
      config = CASE WHEN ? = 1 THEN excluded.config ELSE desired_resources.config END
  `,
  ).run(
    id.trim(),
    enabled ? 1 : 0,
    expiresAt,
    JSON.stringify(config),
    hasEnabled ? 1 : 0,
    hasExpiresAt ? 1 : 0,
    hasConfig ? 1 : 0,
  );
}

/**
 * Read enabled resources whose expiration is still in the future.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {number} now
 * @returns {DesiredResource[]}
 */
function readDesiredResources(db, now) {
  const rows =
    /** @type {Array<{ id: string, expires_at: number | null, config: string }>} */ (
      db
        .prepare(
          `
    SELECT id, expires_at, config
    FROM desired_resources
    WHERE enabled = 1 AND (expires_at IS NULL OR expires_at > ?)
    ORDER BY id
  `,
        )
        .all(now)
    );
  return rows.map((row) => ({
    id: row.id,
    config: JSON.parse(row.config),
    expiresAt: row.expires_at,
  }));
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {unknown} left
 * @param {unknown} right
 * @returns {boolean}
 */
function sameConfig(left, right) {
  return isDeepStrictEqual(left, right);
}

/**
 * @param {() => Promise<void>} operation
 * @param {{ maxAttempts: number, initialDelayMs: number, wait: (ms: number) => Promise<void> }} options
 * @returns {Promise<{ attempts: number }>}
 */
async function retry(operation, { maxAttempts, initialDelayMs, wait }) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await operation();
      return { attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await wait(initialDelayMs * 2 ** (attempt - 1));
      }
    }
  }
  throw new ReconcileRetriesExhaustedError(maxAttempts, lastError);
}

/**
 * Create a periodic desired-state reconciler.
 *
 * @param {{
 *   db: import('better-sqlite3').Database,
 *   adapter: ResourceAdapter,
 *   now?: () => number,
 *   maxAttempts?: number,
 *   initialDelayMs?: number,
 *   wait?: (ms: number) => Promise<void>
 * }} options
 */
function createReconciler({
  db,
  adapter,
  now = Date.now,
  maxAttempts = 3,
  initialDelayMs = 25,
  wait = delay,
}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('db must be a better-sqlite3 database');
  }
  if (
    !adapter ||
    typeof adapter.list !== 'function' ||
    typeof adapter.apply !== 'function' ||
    typeof adapter.remove !== 'function'
  ) {
    throw new TypeError('adapter must implement list, apply, and remove');
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError('maxAttempts must be a positive integer');
  }
  if (!Number.isInteger(initialDelayMs) || initialDelayMs < 0) {
    throw new RangeError('initialDelayMs must be a non-negative integer');
  }
  if (typeof wait !== 'function') {
    throw new TypeError('wait must be a function');
  }

  /**
   * @returns {Promise<{
   *   created: string[],
   *   updated: string[],
   *   removed: string[],
   *   failures: ReconcileFailure[]
   * }>}
   */
  async function reconcileOnce() {
    const desired = readDesiredResources(db, now());
    const actual = await adapter.list();
    if (!Array.isArray(actual)) {
      throw new TypeError('adapter.list must return an array');
    }

    const desiredById = new Map(
      desired.map((resource) => [resource.id, resource]),
    );
    const actualById = new Map();
    for (const resource of actual) {
      if (!resource || typeof resource.id !== 'string' || !resource.id) {
        throw new TypeError('Each applied resource must have a non-empty id');
      }
      actualById.set(resource.id, resource);
    }

    /** @type {string[]} */
    const created = [];
    /** @type {string[]} */
    const updated = [];
    /** @type {string[]} */
    const removed = [];
    /** @type {ReconcileFailure[]} */
    const failures = [];

    for (const resource of actualById.values()) {
      if (desiredById.has(resource.id)) continue;
      try {
        await retry(() => adapter.remove(resource.id), {
          maxAttempts,
          initialDelayMs,
          wait,
        });
        removed.push(resource.id);
      } catch (error) {
        if (!(error instanceof ReconcileRetriesExhaustedError)) throw error;
        failures.push({
          operation: 'remove',
          id: resource.id,
          attempts: error.attempts,
          error: error.cause,
        });
      }
    }

    for (const resource of desired) {
      const current = actualById.get(resource.id);
      if (current && sameConfig(current.config, resource.config)) continue;
      try {
        await retry(() => adapter.apply(resource), {
          maxAttempts,
          initialDelayMs,
          wait,
        });
        (current ? updated : created).push(resource.id);
      } catch (error) {
        if (!(error instanceof ReconcileRetriesExhaustedError)) throw error;
        failures.push({
          operation: 'apply',
          id: resource.id,
          attempts: error.attempts,
          error: error.cause,
        });
      }
    }

    return { created, updated, removed, failures };
  }

  /**
   * Start non-overlapping periodic reconciliation.
   *
   * @param {{
   *   intervalMs?: number,
   *   onResult?: (result: Awaited<ReturnType<typeof reconcileOnce>>) => void,
   *   onError?: (error: unknown) => void
   * }} [options]
   * @returns {{ stop: () => void }}
   */
  function start({
    intervalMs = 5_000,
    onResult = () => {},
    onError = console.error,
  } = {}) {
    if (!Number.isInteger(intervalMs) || intervalMs < 1) {
      throw new RangeError('intervalMs must be a positive integer');
    }
    if (typeof onResult !== 'function' || typeof onError !== 'function') {
      throw new TypeError('onResult and onError must be functions');
    }

    let stopped = false;
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let timer;
    const schedule = () => {
      if (!stopped) timer = setTimeout(tick, intervalMs);
    };
    const tick = async () => {
      if (stopped) return;
      try {
        const result = await reconcileOnce();
        onResult(result);
      } catch (error) {
        onError(error);
      } finally {
        schedule();
      }
    };

    void tick();
    return {
      stop() {
        stopped = true;
        clearTimeout(timer);
      },
    };
  }

  return { reconcileOnce, start };
}

module.exports = {
  createDesiredResourceStore,
  createReconciler,
  readDesiredResources,
  setDesiredResource,
};

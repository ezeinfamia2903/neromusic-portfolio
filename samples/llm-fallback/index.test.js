// @ts-check
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createFallbackClient,
  FallbackExhaustedError,
  OperationAbortedError,
  ProviderFailedError,
  ProviderTimeoutError,
} = require('./index');

test('uses the next provider when the first one fails', async () => {
  const client = createFallbackClient({
    providers: [
      {
        name: 'down',
        async generate() {
          throw new Error('unavailable');
        },
      },
      {
        name: 'ready',
        async generate() {
          return 'accepted';
        },
      },
    ],
    retries: 0,
  });

  assert.equal(await client.generate('request'), 'accepted');
});

test('retries a provider with exponential delays before succeeding', async () => {
  let calls = 0;
  /** @type {number[]} */
  const delays = [];
  const client = createFallbackClient({
    providers: [
      {
        name: 'flaky',
        async generate() {
          calls += 1;
          if (calls < 3) throw new Error('temporary');
          return 'recovered';
        },
      },
    ],
    retries: 2,
    baseDelayMs: 7,
    wait: async (ms) => {
      delays.push(ms);
    },
  });

  assert.equal(await client.generate('request'), 'recovered');
  assert.equal(calls, 3);
  assert.deepEqual(delays, [7, 14]);
});

test('times out a hung provider and falls back', async () => {
  const client = createFallbackClient({
    providers: [
      { name: 'hung', generate: () => new Promise(() => {}) },
      {
        name: 'ready',
        async generate() {
          return 'fallback';
        },
      },
    ],
    timeoutMs: 10,
    retries: 0,
  });

  assert.equal(await client.generate('request'), 'fallback');
});

test('reports typed failures when providers are unavailable', async () => {
  const client = createFallbackClient({
    providers: [
      {
        name: 'first',
        async generate() {
          throw new Error('offline');
        },
      },
      {
        name: 'second',
        async generate() {
          throw new Error('offline');
        },
      },
    ],
    retries: 1,
    wait: async () => {},
  });

  await assert.rejects(client.generate('request'), (error) => {
    assert.ok(error instanceof FallbackExhaustedError);
    assert.equal(error.failures.length, 2);
    assert.ok(error.failures[0] instanceof ProviderFailedError);
    assert.equal(error.failures[0].attempts, 2);
    return true;
  });
});

test('preserves the timeout error as the final provider cause', async () => {
  const client = createFallbackClient({
    providers: [{ name: 'hung', generate: () => new Promise(() => {}) }],
    timeoutMs: 5,
    retries: 0,
  });

  await assert.rejects(client.generate('request'), (error) => {
    assert.ok(error instanceof FallbackExhaustedError);
    assert.ok(error.failures[0].cause instanceof ProviderTimeoutError);
    return true;
  });
});

test('stops immediately when the caller aborts', async () => {
  const controller = new AbortController();
  const client = createFallbackClient({
    providers: [
      {
        name: 'waiting',
        generate: (_input, { signal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener(
              'abort',
              () => reject(new Error('aborted')),
              { once: true },
            );
          }),
      },
      {
        name: 'must-not-run',
        async generate() {
          return 'unexpected';
        },
      },
    ],
    timeoutMs: 500,
    retries: 1,
  });
  const result = client.generate('request', { signal: controller.signal });
  controller.abort();

  await assert.rejects(result, OperationAbortedError);
});

test('rejects invalid provider configuration', () => {
  assert.throws(
    () => createFallbackClient({ providers: [], retries: -1 }),
    RangeError,
  );
  assert.throws(
    () =>
      createFallbackClient({
        providers: [
          {
            name: 'duplicate',
            async generate() {
              return 'a';
            },
          },
          {
            name: 'duplicate',
            async generate() {
              return 'b';
            },
          },
        ],
      }),
    TypeError,
  );
});

// @ts-check
'use strict';

/**
 * @typedef {{
 *   name: string,
 *   generate: (input: string, options: { signal: AbortSignal }) => Promise<string>
 * }} Provider
 */

class ProviderTimeoutError extends Error {
  /**
   * @param {string} providerName
   * @param {number} timeoutMs
   */
  constructor(providerName, timeoutMs) {
    super(`Provider "${providerName}" exceeded ${timeoutMs} ms`);
    this.name = 'ProviderTimeoutError';
    this.providerName = providerName;
    this.timeoutMs = timeoutMs;
  }
}

class ProviderFailedError extends Error {
  /**
   * @param {string} providerName
   * @param {number} attempts
   * @param {unknown} cause
   */
  constructor(providerName, attempts, cause) {
    super(`Provider "${providerName}" failed after ${attempts} attempt(s)`, {
      cause,
    });
    this.name = 'ProviderFailedError';
    this.providerName = providerName;
    this.attempts = attempts;
  }
}

class FallbackExhaustedError extends Error {
  /**
   * @param {ProviderFailedError[]} failures
   */
  constructor(failures) {
    super(`All ${failures.length} provider(s) failed`, {
      cause: failures.at(-1),
    });
    this.name = 'FallbackExhaustedError';
    this.failures = failures;
  }
}

class OperationAbortedError extends Error {
  constructor() {
    super('Provider fallback was aborted');
    this.name = 'AbortError';
  }
}

/**
 * @param {unknown} signal
 * @returns {signal is AbortSignal}
 */
function isAbortSignal(signal) {
  return Boolean(
    signal &&
    typeof signal === 'object' &&
    'aborted' in signal &&
    'addEventListener' in signal &&
    typeof signal.addEventListener === 'function',
  );
}

/**
 * @param {AbortSignal | undefined} signal
 */
function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw new OperationAbortedError();
  }
}

/**
 * @param {number} ms
 * @param {AbortSignal | undefined} signal
 * @returns {Promise<void>}
 */
function wait(ms, signal) {
  throwIfAborted(signal);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(new OperationAbortedError());
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Call one provider with a hard timeout and propagate caller cancellation.
 *
 * @param {Provider} provider
 * @param {string} input
 * @param {number} timeoutMs
 * @param {AbortSignal | undefined} parentSignal
 * @returns {Promise<string>}
 */
function callWithTimeout(provider, input, timeoutMs, parentSignal) {
  throwIfAborted(parentSignal);

  const controller = new AbortController();
  let timer;
  let onAbort;

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ProviderTimeoutError(provider.name, timeoutMs));
    }, timeoutMs);

    onAbort = () => {
      controller.abort();
      reject(new OperationAbortedError());
    };
    parentSignal?.addEventListener('abort', onAbort, { once: true });
  });

  return Promise.race([
    Promise.resolve().then(() =>
      provider.generate(input, { signal: controller.signal }),
    ),
    timeout,
  ])
    .then((result) => {
      if (typeof result !== 'string') {
        throw new TypeError(`Provider "${provider.name}" must return a string`);
      }
      return result;
    })
    .finally(() => {
      clearTimeout(timer);
      parentSignal?.removeEventListener('abort', onAbort);
    });
}

/**
 * Creates a provider cascade with bounded retries and exponential backoff.
 *
 * @param {{
 *   providers: Provider[],
 *   timeoutMs?: number,
 *   retries?: number,
 *   baseDelayMs?: number,
 *   wait?: (ms: number, signal?: AbortSignal) => Promise<void>
 * }} options
 */
function createFallbackClient({
  providers,
  timeoutMs = 2_000,
  retries = 1,
  baseDelayMs = 100,
  wait: waitForRetry = wait,
}) {
  if (!Array.isArray(providers)) {
    throw new TypeError('providers must be an array');
  }
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    !Number.isInteger(retries) ||
    retries < 0 ||
    !Number.isInteger(baseDelayMs) ||
    baseDelayMs < 0
  ) {
    throw new RangeError('Timeout, retries, or backoff settings are invalid');
  }
  const names = new Set();
  for (const provider of providers) {
    if (
      !provider ||
      typeof provider.name !== 'string' ||
      !provider.name.trim() ||
      typeof provider.generate !== 'function' ||
      names.has(provider.name)
    ) {
      throw new TypeError(
        'Each provider needs a unique name and generate function',
      );
    }
    names.add(provider.name);
  }
  if (typeof waitForRetry !== 'function') {
    throw new TypeError('wait must be a function');
  }

  return {
    /**
     * @param {string} input
     * @param {{ signal?: AbortSignal }} [options]
     * @returns {Promise<string>}
     */
    async generate(input, { signal } = {}) {
      if (typeof input !== 'string') {
        throw new TypeError('input must be a string');
      }
      if (signal !== undefined && !isAbortSignal(signal)) {
        throw new TypeError('signal must be an AbortSignal');
      }
      throwIfAborted(signal);

      /** @type {ProviderFailedError[]} */
      const failures = [];

      for (const provider of providers) {
        let lastError;
        const totalAttempts = retries + 1;

        for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
          throwIfAborted(signal);
          try {
            return await callWithTimeout(provider, input, timeoutMs, signal);
          } catch (error) {
            if (error instanceof OperationAbortedError) {
              throw error;
            }
            lastError = error;
            if (attempt < totalAttempts) {
              await waitForRetry(baseDelayMs * 2 ** (attempt - 1), signal);
            }
          }
        }

        failures.push(
          new ProviderFailedError(provider.name, totalAttempts, lastError),
        );
      }

      throw new FallbackExhaustedError(failures);
    },
  };
}

module.exports = {
  createFallbackClient,
  FallbackExhaustedError,
  OperationAbortedError,
  ProviderFailedError,
  ProviderTimeoutError,
};

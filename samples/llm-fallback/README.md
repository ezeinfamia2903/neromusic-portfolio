# Provider fallback sample

This standalone module demonstrates a generic provider cascade. It tries configured adapters in order, applies a timeout to each call, retries failures with exponential backoff, and returns typed errors after the cascade is exhausted. Demo providers are simulated and require no network access.

## Usage

```js
const { createFallbackClient } = require('./index');

const client = createFallbackClient({ providers, onAttempt: console.log });
const response = await client.generate('example input');
```

Provide adapters with unique names and an asynchronous `generate` method. Pass an `AbortSignal` to cancel an operation.

## Design notes

- Each provider call is time-bounded so an unresponsive adapter does not block the cascade indefinitely.
- Retry count and exponential delay are bounded by caller configuration.
- Typed errors preserve the failing provider and its last cause.
- The optional `onAttempt` callback makes success and fallback decisions observable without coupling the module to a logger.

## What I would improve

- Add jitter and a configurable maximum delay to the backoff strategy.
- Let adapters classify errors as retryable or permanent.
- Add circuit-breaker behavior for providers with repeated outages.

## Tests and running

The sample has **8 automated tests** covering fallback, retries, timeout, cancellation, provider errors, invalid configuration, and an empty provider list.

From the repository root, run the tests and demo with:

```sh
node --test samples/llm-fallback/*.test.js
node samples/llm-fallback/demo.js
```

Run all sample tests and demos with `npm test` and `npm run demo`.

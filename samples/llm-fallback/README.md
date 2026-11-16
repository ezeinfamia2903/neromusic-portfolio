# Provider fallback sample

This module demonstrates a generic provider cascade: it tries configured adapters in order, applies a timeout to each call, retries transient failures with exponential backoff, and returns typed errors after the cascade is exhausted. Providers in the demo are simulated and require no network access or credentials.

The bounded retry policy makes individual failures visible and prevents a slow adapter from blocking the whole operation. The caller can also cancel the operation with an `AbortSignal`.

Run from the repository root:

```sh
node samples/llm-fallback/demo.js
node --test samples/llm-fallback/*.test.js
```

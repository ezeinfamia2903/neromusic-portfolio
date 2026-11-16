// @ts-check
'use strict';

const { createFallbackClient } = require('./index');

const client = createFallbackClient({
  providers: [
    {
      name: 'primary-demo',
      async generate(input) {
        throw new Error(`Simulated outage for "${input}"`);
      },
    },
    {
      name: 'backup-demo',
      async generate(input) {
        return `Demo response: ${input}`;
      },
    },
  ],
  retries: 0,
  onAttempt({ provider, ok, error }) {
    if (ok) {
      console.log(`${provider} responded`);
    } else {
      console.log(
        `${provider} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },
});

client
  .generate('show a safe fallback')
  .then((result) => console.log(result))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

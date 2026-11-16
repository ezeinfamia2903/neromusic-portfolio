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
});

client
  .generate('show a safe fallback')
  .then((result) => console.log(result))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

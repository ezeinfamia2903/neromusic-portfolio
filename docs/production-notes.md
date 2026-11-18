# Production notes

## Deployment model

NeroMusic runs 24/7 on an Ubuntu VPS and the same codebase also runs on Windows. The Ubuntu deployment uses `systemd`. A reverse proxy publishes the audio service through either Caddy or Cloudflare Tunnel; these are alternatives, not a requirement to run both.

The audio service, operational metrics, and admin panel are separate runtime interfaces. The panel and metrics are local-only by default. Hosted deployments publish the HTTPS audio path required by the product.

## Operations and observability

- Structured event logs report startup, room lifecycle, playback, and connection state.
- The main process periodically checks the audio service health endpoint and attempts recovery after health failures.
- Local metrics report streaming state and process/cache counters.
- The room manager periodically reconciles persisted client settings with active room connections, including retries and expiration handling.
- Graceful shutdown closes room connections and stops owned services.

## Practical lessons

- Treat OS-specific executables as deployment configuration, not as separate application implementations.
- Keep externally reachable audio separate from local-only administration and metrics.
- Reconcile desired persisted state with runtime state after panel changes and process restarts.
- Keep the core playback path independent from optional AI and third-party provider availability.
- Verify system dependencies and environment settings on each host; identical application source does not install Chrome/Chromium, media tools, or proxy services automatically.

## Validation

Validated through manual functional tests in real rooms; the automated tests in this repository cover the sample modules.

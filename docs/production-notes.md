# Production notes

## Deployment model

The project owner reports operating NeroMusic 24/7 on an Ubuntu VPS and also running the same codebase on Windows. The source documents an Ubuntu deployment managed by `systemd`. A reverse proxy publishes the audio service through either Caddy or Cloudflare Tunnel; these are alternatives, not a requirement to run both.

The audio service, operational metrics, and admin panel are separate runtime interfaces. The panel and metrics are configured for local access by default. Hosted deployments should keep them private and publish only the HTTPS audio path required by the product.

## Operations and observability

- Structured event logs report startup, room lifecycle, playback, and connection state.
- The main process periodically checks the audio service health endpoint and attempts recovery after health failures.
- Local metrics report streaming state and process/cache counters.
- The room manager periodically reconciles persisted client settings with active room connections, including retries and expiration handling.
- Graceful shutdown closes room connections and stops owned services.

## Practical lessons

- Treat OS-specific executables as deployment configuration, not as separate application implementations.
- Keep externally reachable audio separate from local-only administration and metrics.
- Reconcile desired persisted state with runtime state after both panel changes and process restarts.
- Keep the core playback path independent from optional AI and third-party provider availability.
- Verify system dependencies and environment settings on each host; identical application source does not install Chrome/Chromium, `yt-dlp`, `ffmpeg`, or proxy services automatically.

## Validation and known limits

The product was validated with manual functional tests in real rooms. This showcase does not claim an automated test suite for the product. Automated tests in this repository exercise only the independent generic samples.

The deployment notes records Windows-side checks and explicitly notes that a full Ubuntu startup was not verified in that guide. The project owner reports Ubuntu VPS operation; detailed measurements and deployment dates should be added only when independently confirmed.


## Production data to add

- Concurrent rooms, customers, and users: [COMPLETAR: verified counts and measurement window].
- Production start date: [COMPLETAR: date].
- Availability or uptime: [COMPLETAR: monitoring source and measurement window].
- Hosting details suitable for publication: [COMPLETAR: high-level, non-sensitive description].

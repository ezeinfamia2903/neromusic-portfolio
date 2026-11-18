# NeroMusic

[![CI](https://github.com/ezeinfamia2903/neromusic-portfolio/actions/workflows/ci.yml/badge.svg)](https://github.com/ezeinfamia2903/neromusic-portfolio/actions/workflows/ci.yml)

Demo video: [DEMO_VIDEO_URL]

NeroMusic is a private, multi-tenant music service for IMVU rooms, with per-room playback, administration, and optional bilingual conversation.

Public showcase: architecture docs and generic samples with tests. The product source code is private.

**Created by Ezequiel Núñez.** NeroMusic is an independent project and is not affiliated with, endorsed by, or sponsored by IMVU.

## What it does

- Accepts chat commands to search for and play requested tracks.
- Keeps playback queues and player state independent for each configured room.
- Streams audio to a room's radio through an HTTP audio service.
- Provides a separate control panel for client and room settings.
- Offers optional Spanish/English AI conversation, independently configurable per room.

## Architecture at a glance

```mermaid
flowchart LR
    U[Room participants] <-->|Room activity and replies| R[Real-time connection]
    L[Headless-browser login] --> R
    R --> C[Command handling]
    C --> Q[Per-room queue]
    Q --> A[Audio streaming]
    A --> S[Room radio]

    P[Admin panel] --> D[(SQLite)]
    D --> M[Room lifecycle manager]
    M --> R
    C -. optional .-> I[AI providers]
    I -. response .-> R
    D --> I
```

For the [functional module map](docs/module-map.md), [communication map](docs/architecture.md#communication-map), [data model](docs/architecture.md#data-model-overview), [processes and deployment](docs/architecture.md#processes-and-deployment), [failure handling](docs/architecture.md#failure-handling), and [roadmap](docs/architecture.md#roadmap-next-steps), see the architecture notes.

## Key features

- Multi-room, multi-client lifecycle management.
- A separate admin panel to add, activate, deactivate, restart, and remove clients, adjust service periods, and choose a room language.
- Per-room music queues, playback controls, and radio streaming.
- Optional Spanish/English AI conversation, per-room settings, and up to three configurable personalities.
- One Node.js codebase for Windows and Linux, with platform-aware paths for external tools.
- Structured logs, an audio-service health check, and local streaming metrics.

## Screenshots

Product screenshots with user, room, and operational identifiers redacted.

![Admin panel showing client and room controls](screenshots/admin-panel.png)

![Room with the radio active and the bot present](screenshots/room-radio.png)

![Chat request playing a track in a room](screenshots/room-playback.png)

## Engineering highlights

- Modular CommonJS application with roughly 34 JavaScript application files.
- Hybrid authentication: a headless browser obtains a valid session; the application then uses WebSocket and REST connections with automatic reconnection.
- Audio pipeline: `yt-dlp` input is converted by `ffmpeg` to MP3 and served over HTTP.
- Periodic reconciliation compares desired room clients in SQLite with active rooms, handling additions, removals, retries, and expirations.
- AI is optional and can be disabled independently; music commands do not depend on an AI provider.
- Structured event logging and a health check allow the main process to detect audio-service failures and attempt recovery.

## In production

- NeroMusic runs 24/7 on an Ubuntu VPS and the same codebase also runs on Windows.
- Deployment options documented for Ubuntu: `systemd` with either Caddy or Cloudflare Tunnel for public HTTPS audio access.

## What this repo contains / what it doesn't

NeroMusic is a commercial, private product. Its application source, deployment configuration, operational data, and customer information are not published here. This showcase contains architecture and engineering documentation plus small, generic modules written from scratch to demonstrate selected programming patterns. `samples/` is MIT-licensed; that license does not apply to the private product or its source.

## Code samples

The three standalone samples were written from scratch and demonstrate reusable engineering patterns without including product source. The current suite contains 21 automated tests:

| Sample                                                   | Demonstrates                                                            |
| -------------------------------------------------------- | ----------------------------------------------------------------------- |
| [Provider fallback](samples/llm-fallback/README.md)      | Timeouts, retries, cancellation, typed failures, and provider fallback. |
| [State reconciler](samples/state-reconciler/README.md)   | Converging desired SQLite state with a runtime adapter.                 |
| [SQLite migrations](samples/sqlite-migrations/README.md) | Transactional, repeatable schema migrations and concurrency safety.     |

## Quality tooling

The samples are plain JavaScript with JSDoc annotations. `npm run typecheck` runs `tsc --strict` with `allowJs` and `checkJs`, so the JSDoc types are verified without emitting code or shipping TypeScript. ESLint and Prettier enforce style and formatting, and CI runs lint, type checking, formatting, tests, and a production dependency audit on Node.js 20.19 and 22. `tsconfig.json` exists only to configure that JSDoc-based type checking; it is not a TypeScript source tree. GitHub's language bar reports JavaScript because every committed sample file is `.js`, and `tsconfig.json` does not change that classification.

## How I built it

I developed NeroMusic with AI assistance under my direction. I conceived the product, researched implementation options, defined and approved the design decisions, reviewed and corrected the implementation, and handled functional testing, deployment, and operation. The product was validated through manual functional tests in real rooms. Automated tests in this repository cover only the independent sample modules, not NeroMusic itself.

## Tech stack

| Area                    | Technology                                                     |
| ----------------------- | -------------------------------------------------------------- |
| Runtime                 | Node.js, CommonJS                                              |
| Persistence             | SQLite with `better-sqlite3`                                   |
| Real-time communication | WebSocket; REST for supporting operations                      |
| Session setup           | Puppeteer with a headless browser, used for login              |
| Audio                   | `yt-dlp`, `ffmpeg`, HTTP streaming                             |
| AI                      | Optional provider cascade with per-room configuration          |
| Operations              | Ubuntu, `systemd`, Caddy or Cloudflare Tunnel; Windows support |
| Showcase samples        | Node.js built-ins, `node:test`, and `better-sqlite3`           |

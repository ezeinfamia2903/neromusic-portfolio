# Product features

NeroMusic is designed for rooms with independent playback and settings rather than one global player.

## Music in a room

Participants can request music from chat. The bot searches for a track, adds it to that room's queue, and streams audio to the room radio. Playback state and queue operations are scoped to a room.

Common commands include:

| Command              | User-facing behavior                               |
| -------------------- | -------------------------------------------------- |
| `!play <query>`      | Search for and play a requested track.             |
| `!add <query>`       | Add a track to the room queue.                     |
| `!next` / `!back`    | Move through the queue.                            |
| `!list`              | Show queued tracks.                                |
| `!remove <position>` | Remove an item from the queue.                     |
| `!stop` / `!clear`   | Stop playback or clear the queue.                  |
| `!link`              | Share the room's listen link.                      |
| `!install`           | Configure the room radio when the room permits it. |

Commands and replies are localized to the room's selected language.

## Multi-client administration

A separate admin panel manages the client-room lifecycle. It supports creating clients, activating or deactivating them, removing them, changing the service period, restarting a room, and choosing Spanish or English per room. It also shows service and client status.

SQLite stores durable client and room settings. A periodic manager compares that desired configuration with runtime room connections, so panel changes can be reconciled without manually editing application state.

## Optional conversation

The conversational feature is optional. When enabled and configured, NeroMusic can respond in Spanish or English, apply up to three selected room personalities, and use an ordered set of configured providers with fallback. Settings are per room. Disabling conversation does not disable music commands.

## Cross-platform operation

The same Node.js source is intended for Windows and Linux. Platform-aware resolution lets deployments use local executables or system-installed tools without maintaining two copies of the application. The operational dependencies still need to be installed for each host.

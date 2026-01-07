# AURABOT

## Overview

AURABOT is a Facebook Messenger chat bot built with TypeScript. It provides a flexible, extensible command system for managing Facebook group interactions. The bot features a modular architecture with support for multiple command categories, database persistence, permission management, and event handling for various Facebook Messenger events.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Core Application Structure

The application follows a modular TypeScript architecture with clear separation of concerns:

- **Entry Point**: `index.ts` imports `src/main.ts` which initializes the bot, database, and Express server
- **Bot Core** (`src/bot.ts`): Handles Facebook login via appstate cookies and sets up the MQTT listener for real-time events
- **Client Store** (`src/client.ts`): Central state management using Maps and Sets for commands, reply handlers, reaction handlers, and cached user/thread data

### Command System

Commands are organized in a hierarchical folder structure under `commands/`:
- `admin/` - Administrative commands (kick, ban, eval, shell, uid, load/unload)
- `fun/` - Entertainment commands (daily, dice, balance, weather, quote)
- `media/` - Media handling (autodown for video/audio downloads)
- `system/` - System utilities (help, ping, uptime, info)

Each command exports a standardized interface with:
- `config`: Metadata (name, version, author, description, category, role, aliases)
- `run`: Main execution function
- Optional handlers: `handleReply`, `handleReaction`, `handleChat`, `handleEvent`

Commands support:
- Prefix-based commands (default: `!`)
- No-prefix commands (triggered by keywords)
- Role-based permissions (0=User, 1=Group Admin, 2=Bot Admin, 3=Owner)
- Hot reloading without restart

### Event Handling

The `src/handlers/` directory contains specialized handlers for different Facebook event types:
- `message` and `message_reply` events
- `message_reaction` events
- Thread events (user join/leave, name changes)
- Typing indicators
- Presence updates
- Read receipts

### Hook System

A flexible hook system (`src/hooks/`) allows registering callbacks for various lifecycle events:
- `onAnyEvent`, `onFirstChat`, `onChat`, `onRun`
- `onReply`, `onReaction`, `handlerEvent`, `onEvent`
- `typ`, `presence`, `read_receipt`

### Database Layer

Uses Sequelize ORM with SQLite:
- **Models**: `User` (uid, name, gender, money, exp) and `Thread` (threadID, name, prefix, settings, bannedUsers)
- **Controllers**: `userController` and `threadController` provide CRUD operations and business logic
- Database file stored at project root as `database.sqlite`

### Permission System

Multi-level permission checking:
- Owner (role 3): Defined in `config.json`
- Bot Admins (role 2): Listed in config
- Group Admins (role 1): Fetched from Facebook API with caching
- Regular Users (role 0): Default

Additional permission features:
- User/thread banning
- Command cooldowns
- Admin-only mode
- Anti-inbox (block DM commands)

### Configuration

Configuration is loaded from `config.json`:
- Bot settings (prefix, name)
- File paths (appstate, commands directory)
- Facebook API options
- External API credentials
- Logger settings
- Permission definitions

## External Dependencies

### Facebook Messenger API
- **@dongdev/fca-unofficial**: Unofficial Facebook Chat API for sending/receiving messages, managing groups, and handling events
- Requires `appstate.json` with Facebook session cookies for authentication

### Database
- **Sequelize** (v6.x): ORM for database operations
- **SQLite3**: Local file-based database storage at `database.sqlite`

### External APIs
- Configurable external API endpoint (`minhdong.site`) for YouTube search and video downloads
- Used by media commands for content retrieval

### Runtime
- **Express**: Minimal HTTP server on port 5000 (keeps Replit container alive)
- **ts-node / ts-node-dev**: TypeScript execution and hot reloading during development

### Development
- TypeScript 5.x with strict mode
- Target: ES2020 with CommonJS modules
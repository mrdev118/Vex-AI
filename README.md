# 🤖 AURABOT

AURABOT is a Facebook Chat Bot built with TypeScript, featuring a flexible and easily extensible command management system.

## ✨ Features

- 🎯 **Powerful Command System**: Manage commands by category, supports aliases and permission checks.
- 🔧 **Easily Extensible**: Clear module structure, easy to add new commands.
- 💾 **Integrated Database**: Uses Sequelize with SQLite for data storage.
- 📝 **Logging System**: Full logging system with colors and timestamps.
- 🛡️ **Permission System**: Permission system for owners and admins.
- ⚡ **Hot Reload**: Supports loading/unloading commands without restarting the bot.
- 🎨 **Event Handlers**: Handles multiple event types (message, reaction, typing, presence, etc.).
- 🔒 **Nickname Protection**: Automatic protection of group name and member nicknames.

## 📋 Requirements

- Node.js >= 16.x
- npm or yarn
- TypeScript >= 5.0.0

## 🚀 Installation

### Method 1: Using Setup Script (Recommended)

1. **Clone repository**
```bash
git clone <repository-url>
cd AURABOT

```

2. **Run setup script**

```bash
# Windows
setup.bat

# Linux/Mac
chmod +x setup.sh
./setup.sh

# Or use npm (automatically selects the appropriate script)
npm run setup

```

The script will automatically:

* ✅ Check Node.js and npm
* ✅ Install dependencies
* ✅ Create `config.json` from `config.example.json`
* ✅ Configure git to protect API keys
* ✅ Guide you through the next steps

3. **Edit config.json**
* Open the `config.json` file and add:
* `externalApi.key`: Your API key
* `permissions.owner`: Your Owner ID
* Other configurations if needed





### Method 2: Manual Installation

1. **Clone repository**

```bash
git clone <repository-url>
cd AURABOT

```

2. **Install dependencies**

```bash
npm install

```

3. **Configure Bot**
* Copy `config.example.json` to `config.json`:
```bash
# Windows
copy config.example.json config.json

# Linux/Mac
cp config.example.json config.json

```


* Edit the `config.json` file:
* Set the `prefix` for the bot (default: `!`)
* Add your `owner` ID
* Add `externalApi.key` (your API key)
* Configure other parameters if necessary


* **Protect API key from commits** (Important!):
```bash
# Windows
scripts\setup-git.bat

# Linux/Mac
chmod +x scripts/setup-git.sh
./scripts/setup-git.sh

```


This command will make Git ignore changes in `config.json`, helping you keep your API key local without committing it to the repository.
**Note**: If you have committed `config.json` previously, run the command above to protect your key.


4. **Run Bot for the First Time**

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm start

```

5. **Login to Facebook**
* When running the bot for the first time, you will need to log in to Facebook.
* The bot will automatically create an `appstate.json` file after a successful login.


## 📱 Termux 24/7 (pm2 + Termux:Boot)

1. Install basics and pm2:
```bash
pkg update && pkg upgrade
pkg install nodejs-lts git
npm i -g pm2
```

2. Install deps and start under pm2 (uses ts-node):
```bash
npm install
pm2 start npm --name vex-bot -- start
pm2 save
```

3. Keep awake and auto-restore:
```bash
termux-wake-lock
pm2 resurrect
```

4. Auto-start on device boot (needs Termux:Boot):
```bash
mkdir -p ~/.termux/boot
cp scripts/termux-boot.sh ~/.termux/boot/start.sh
chmod +x ~/.termux/boot/start.sh
```
After reboot, open Termux once so Termux:Boot can run the script.

5. Useful pm2 commands:
```bash
pm2 status
pm2 logs vex-bot
pm2 restart vex-bot
pm2 save
```



# Build TypeScript

npm run build

```

## ⚙️ Configuration

The `config.json` file contains main configurations:

```json
{
  "bot": {
    "prefix": "!",
    "name": "AURABOT"
  },
  "paths": {
    "appstate": "./appstate.json",
    "commands": "./commands"
  },
  "api": {
    "forceLogin": true,
    "listenEvents": true,
    "logLevel": "error",
    "selfListen": false
  },
  "logger": {
    "level": "info",
    "enableColors": true,
    "enableTimestamp": true
  },
  "permissions": {
    "owner": "502275138",
    "admins": []
  }
}

```

### Important Parameters:

* **prefix**: The prefix character for commands (e.g., `!`, `.`, `/`)
* **owner**: The Facebook UID of the bot owner
* **admins**: Array of UIDs for admins (can be left empty)
* **logger.level**: Log level (`info`, `warn`, `error`, `debug`)

## 📁 Project Structure

```
AURABOT/
├── commands/           # Directory containing commands
│   ├── admin/         # Admin commands
│   ├── fun/           # Entertainment commands
│   └── system/        # System commands
├── database/          # Database models and controllers
│   ├── models/        # Sequelize models
│   └── controllers/   # Database controllers
├── src/               # Main source code
│   ├── handlers/      # Event handlers
│   ├── hooks/         # Hooks system
│   ├── utils/         # Utilities
│   ├── bot.ts         # Bot initialization
│   ├── client.ts      # Command client
│   ├── config.ts      # Config loader
│   └── main.ts        # Entry point
├── config.json        # Configuration file
├── index.ts           # Entry point
└── package.json       # Dependencies

```

## 📝 Creating New Commands

Create a new file in the `commands/<category>/<command-name>.ts` directory:

```typescript
import { ICommand, IRunParams } from '../../types';

const command: ICommand = {
    config: {
        name: "command-name",
        version: "1.0.0",
        author: "Your Name",
        description: "Command description",
        category: "Category",
        aliases: ["alias1", "alias2"], // Optional
        usages: "!command-name [args]",   // Optional
        role: 0 // 0: User, 1: Admin, 2: Owner
    },

    run: async ({ api, event, args, send, reply, react, Users, Threads }: IRunParams) => {
        // Command logic goes here
        await send("Hello World!");
    }
};

export = command;

```

### Available Helper Functions:

* `send(message)`: Send a message
* `reply(message)`: Reply to a message
* `react(emoji)`: Add a reaction
* `Users.getData(uid)`: Get user data
* `Threads.getData(tid)`: Get thread data

## 🎮 Available Commands

### System Commands

* `!help [command]` - View command list or detailed info
* `!info` - Information about the bot
* `!ping` - Check latency
* `!uptime` - Uptime duration

### Admin Commands

* `!ban @user` - Ban user from the group
* `!kick @user` - Kick user from the group
* `!load <command-name>` - Load a new command
* `!unload <command-name>` - Unload a command
* `!uid` - Get user's UID
* `!adduser <uid>` - Add user to the group
* `!eval <code>` - Run JavaScript code
* `!shell <command>` - Run shell command

### Fun Commands

* `!balance` - View money balance and EXP
* `!daily` - Receive daily rewards
* `!coin` - Flip a coin
* `!dice` - Roll dice
* `!random [min] [max]` - Random number
* `!choose <option1> | <option2>` - Choose randomly
* `!calc <expression>` - Calculate expression
* `!weather <location>` - View weather
* `!quote` - Random quote
* `!top` - Leaderboard
* `!bot` - Bot auto-reply
* `!autosad` - Automatically react sad

## 🔧 Development

### Available Scripts:

```bash
# Run bot in development mode (hot reload)
npm run dev

# Run bot in production mode
npm start

# Build TypeScript to JavaScript
npm run build

```

### TypeScript Configuration

The project uses TypeScript with strict mode configuration. The `tsconfig.json` file is already configured.

## 🗄️ Database

The bot uses SQLite with Sequelize ORM. The database is automatically created upon first run.

### Available Models:

* **User**: Stores user information (money, exp, etc.)
* **Thread**: Stores chat group information

## 🔒 Nickname Protection System

The bot includes an automatic nickname protection system with two features:

### 1. Group Name Protection
- **Protected Name**: `𝗩𝗲𝘅𝗼𝗻𝗦𝗠𝗣 | Season 1 | Bedrock Only`
- Only group admins can change the group name
- If a regular member tries to change it, the bot automatically restores the protected name
- The bot sends a warning message to the group

### 2. Nickname Change Protection
- Members can only change their own nickname
- Members cannot change other people's nicknames
- If a member tries to change someone else's nickname, the bot automatically reverts it
- Only group admins can change other members' nicknames
- The bot sends a warning message when unauthorized changes are detected

**Note**: The protection system includes a 3-second cooldown to prevent loops and ensure smooth operation.

## 🔐 Permissions

3-level permission system:

* **Role 0**: Regular User
* **Role 1**: Group Admin
* **Role 2**: Bot Owner

## 📄 License

MIT License - See the [LICENSE](https://www.google.com/search?q=LICENSE) file for more details.

## 👤 Author

**DongDev**

## ⚠️ Note

* The bot uses an unofficial Facebook Chat API and may be blocked by Facebook.
* Do not share the `appstate.json` file - this contains your login information.
* Use the bot responsibly.
* Comply with Facebook's Terms of Service.

## 🤝 Contributing

All contributions are welcome! Please create an issue or pull request.

## 📞 Support

If you encounter issues, please create an issue on the GitHub repository.

---

**Made with ❤️ by DongDev**

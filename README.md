<p align="center">
  <img src="https://i.imgur.com/exDGDGc.png" alt="DTEmpire Banner" />
</p>

<h1 align="center">🤖 DTEmpire v2</h1>

<p align="center">
  A powerful, all-in-one Discord bot featuring AI tools, moderation, music, economy, utilities, and more — built for modern Discord servers.
</p>

<p align="center">
  <a href="https://dsc.gg/dtempirev2">
    <img src="https://img.shields.io/badge/Invite-DTEmpire-blue?style=for-the-badge&logo=discord" />
  </a>
  <a href="https://discord.gg/r9QRUy6nrK">
    <img src="https://img.shields.io/badge/Support-Server-purple?style=for-the-badge&logo=discord" />
  </a>
</p>

---

## 📌 Overview

**DTEmpire** is a feature-rich Discord bot designed to cover everything a normal server needs — from **AI integration** and **music playback** to **moderation**, **economy**, **tickets**, and **automation**.

- Prefix: `^`
- Version: **2.7.1**
- Total Commands: **51**
- Categories: **12**
- Built with **Discord.js v14**

---

## ✨ Key Features

- 🤖 **AI Chat, Image, Video & TTS**
- 🛡️ **Advanced Moderation & Logging**
- 💰 **Full Economy System with Jobs, Properties, Lottery, Gambling & Trading**
- 🎵 **High-Quality Music System with DJ Mode & Smart Search**
- 🎫 **Complete Ticket System**
- 📊 **Polls, Suggestions & Birthday Reminders**
- 📈 **Server Statistics & Leveling System**
- ⚙️ **Auto Rooms, YouTube Alerts & Automation**

---

## 🆕 What's New — January 2026 (v2.7.0)

### 💰 **Enhanced Economy System**
- **Steal Command** (`^eco steal @user`) — Attempt to steal from other users (50% success rate, 1-hour cooldown)
  - Success: Steal 10-30% of target's wallet
  - Failure: Pay double the steal amount as penalty
- **Pay Command** (`^eco pay @user <amount>`) — Send money directly to other users
- **Gambling Events:**
  - `^eco race <amount> <horse>` — Horse racing with 3x multiplier (bet on horses 1-5)
  - `^eco football <amount> <team>` — Football betting with 2x multiplier (red or blue team)
  - `^eco gamble <amount>` — Classic gambling with 45% win chance, 2x multiplier
  - All gambling events have a minimum bet of $100

### 📊 **Polls System** (`^polls`)
- Create interactive polls with up to 10 options
- Real-time voting with upvote/downvote buttons
- Automatic vote counting with progress bars
- Set custom duration (1 minute to 1 week)
- Visual results with winner announcement
- Commands:
  - `^polls create "Question?" "Option 1" "Option 2" [duration]`
  - `^polls end <poll_id>` — Manually end active polls
  - `^polls results <poll_id>` — View current or final results
  - `^polls list` — See all server polls

### 💡 **Suggestion System** (`^suggest`)
- Submit suggestions from any channel
- Interactive voting system with ⬆️ upvote and ⬇️ downvote buttons
- Admin review actions: Approve ✅, Deny ❌, or Consider 🤔
- Real-time vote tracking with percentages
- DM notifications for suggestion status updates
- Commands:
  - `^suggest <your suggestion>` — Submit a suggestion
  - `^suggest setchannel #channel` — Set suggestion channel (Admin)

### 🎂 **Birthday System** (`^birthday`)
- Automatic birthday announcements at midnight
- Beautiful birthday embeds with GIF and @everyone ping
- Birthday reminders and countdown tracking
- Commands:
  - `^birthday set <MM/DD>` — Set your birthday
  - `^birthday list` — View all server birthdays
  - `^birthday upcoming` — See birthdays in next 30 days
  - `^birthday check [@user]` — Check someone's birthday
  - `^birthday setchannel #channel` — Set announcement channel (Admin)

### 👥 **Role Management System**
- **Add Role Command** (`^addrole @role(s) @user(s)`) — Add single or multiple roles to users
  - Support for bulk role assignments
  - Add multiple roles to multiple users simultaneously
  - Permission and hierarchy validation
- **Remove Role Command** (`^removerole @role(s) @user(s)`) — Remove roles from users
- **Reaction Roles** (`^reactionrole`) — Self-assignable roles with buttons
  - Create interactive role panels with custom titles and descriptions
  - Button-based role assignment (up to 25 roles per panel)
  - Users can toggle roles by clicking buttons
  - Custom emoji for each role
  - Commands:
    - `^reactionrole create "Title" "Description" @role1:emoji1 @role2:emoji2`
    - `^reactionrole add/remove/list/delete`

### 🎵 **Previous Music Updates**

- **No-Prefix Music Channel:** Set a dedicated text channel and type natural commands without the `^` prefix. Configure with `^setmusicchannel #music` then use `play never gonna give you up`, `pause`, `resume`, `skip`, `stop`, `queue`, `nowplaying`, `volume 70`, `shuffle`, `loop`, or `smartsearch` right in that channel.
- **AI Music Interpreter:** Type natural requests like "play some chill lofi" or "queue edm party mix" — the bot interprets intent, offers top results via Smart Search, and can recommend tracks.
- **DJ Mode + Profiles:** Enable DJ Mode to auto-recommend songs when the queue ends. Profiles include `gaming`, `chill`, `party`, `focus`, `edm`, `lofi`, and `default`.
- **Now Playing UI Overhaul:** Cleaner embed with bot icon, large banner image, progress updates, and footer status (volume, loop mode, queue position). Centralized to avoid duplicate messages.
- **Volume Handling Improved:** Better validation and clamped ranges for reliable volume control.
- **Help Menus Polished:** Comprehensive general help plus a dedicated music help page. Updated images and clearer navigation.
- **Stability Fixes:** Resolved duplicate Now Playing messages and corrected queue position display.
- **Announcement Command Usage:**
  - `^announce create <#channel> [title] | [description]` — Create an announcement
  - `^announce setup <#channel>` — Set default announcement channel
  - `^announce help` — Show announcement help

Tip: Use `^music` or `^help music` for detailed guidance on music features, Smart Search, and DJ Mode.

---

## 📂 Command Categories

### 🤖 AI (4)
- `aichat` – Chat with AI using different models  
- `imagegen` – Generate AI images  
- `tts` – Text to speech  
- `videogen` – AI video generation  

### 🛠️ Admin (2)
- `setchannel` – Configure bot channels  
- `setlogs` – Auto-create server log channels  

### ⚙️ Config (1)
- `setguildjoin` – Log servers the bot joins  

### 💰 Economy (1)
- `economy` – Complete economy system:
  - **Jobs:** Work, apply, level up (5 job tiers)
  - **Properties:** Buy/sell houses, shops, lands, businesses
  - **Banking:** Deposit, withdraw, collect daily rent
  - **Trading:** Pay users, steal from others (50% success)
  - **Gambling:** Race, football betting, casino games
  - **Lottery:** Buy tickets, win jackpots
  - **Leaderboard:** Top richest players
  - **Profile:** View economy stats & transactions  

### 🎉 Fun (3)
- `giveaway` – Create & manage giveaways  
- `snipe` – View deleted/edited messages  
- `sticky` – Sticky messages in channels  

### ℹ️ Info (2)
- `getguilds` – View multiple server info  
- `servers` – List all servers bot is in  

### 📊 Leveling (1)
- `level` – Check XP, rank & progress  

### 🛡️ Moderation (5)
- `addrole` – Add single or multiple roles to users
- `cleanup` – Bulk message cleanup  
- `mod` – Kick, ban, mute & more
- `removerole` – Remove roles from users
- `welcome` – Welcome & leave messages  

### 👑 Owner (1)
- `globalbadwords` – Global word filter  

### 🎫 Ticket (1)
- `ticket` – Full support ticket system  

### 🧰 Utility (15)
- `announce` – Create professional announcements  
- `autoroom` – Auto voice channel creation  
- `birthday` – Birthday reminder system with auto-announcements
- `dm` – DM users  
- `help` – Show command list  
- `info` – Bot info  
- `invite` – Bot invite & support links  
- `polls` – Create interactive polls with voting
- `reactionrole` – Self-assignable roles with buttons
- `restart` – Restart bot (Owner only)  
- `serverstats` – Detailed server stats  
- `suggest` – Suggestion system with voting & admin review
- `uptime` – Bot uptime & resources  
- `whois` – User information  
- `youtube` – YouTube notifications  

### 🎵 Music (9)
- `music` – Music help  
- `nowplaying` – Current song info  
- `pause` / `resume`  
- `play` – YouTube, Spotify & more  
- `queue` – View queue  
- `skip` / `stop`  
- `volume` – Adjust volume  

---

## 🖥️ Built-In Help Menu

```text
🤖 DTEmpire Help Menu
Prefix: ^
Version: 2.7.1
Total Commands: 45

📁 AI (4)
aichat, imagegen, tts, videogen

📁 Admin (2)
setchannel, setlogs

📁 Config (1)
setguildjoin

📁 Economy (1)
economy (work, jobs, properties, buy, sell, 
lottery, bank, steal, pay, race, football, 
gamble, leaderboard, profile)

📁 Fun (3)
giveaway, snipe, sticky

📁 Info (2)
getguilds, servers

📁 Leveling (1)
level

📁 Moderation (5)
addrole, cleanup, mod, removerole, welcome

📁 Owner (1)
globalbadwords

📁 Ticket (1)
ticket

📁 Utility (15)
announce, autoroom, birthday, dm, help, 
info, invite, polls, reactionrole, restart, 
serverstats, suggest, uptime, whois, youtube

📁 Music (9)
music, nowplaying, pause, play, queue,
resume, skip, stop, volume
````

---

## 🚀 Quick Setup (Self-Hosting)

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/hyperdargo/DTEmpire-v2.git
cd DTEmpire-v2
```

### 2️⃣ Install Dependencies

```bash
npm install
```

### 3️⃣ Configure Environment Variables

Create a `.env` file:

```env
DISCORD_TOKEN=your_bot_token
SPOTIFY_CLIENT_ID=your_spotify_id
SPOTIFY_CLIENT_SECRET=your_spotify_secret
OPENAI_API_KEY=your_openai_key
DATABASE_URL=your_database_url
```

### 4️⃣ Start the Bot

```bash
npm start
# or
npm run dev
```

---

## 🔧 Requirements

* **Node.js** v16.9.0+
* **Discord.js** v14+
* **Administrator permission** recommended
* **Python** (optional, for AI features)

---

## 🤝 Contributing

We welcome contributions from the community! Whether you're fixing bugs, adding features, or improving documentation, your help is appreciated.

### 💡 How to Contribute

1. **Fork the Repository**
   ```bash
   git clone https://github.com/hyperdargo/DTEmpire-v2.git
   cd DTEmpire-v2
   ```

2. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Your Changes**
   - Write clean, documented code
   - Test your changes thoroughly
   - Follow existing code style

4. **Submit a Pull Request**
   - Push your changes to your fork
   - Open a Pull Request with a clear description
   - Your PR will be reviewed and merged if approved

### 🎯 Contribution Guidelines

- **Code Contributions:** All accepted code will be credited with your GitHub username
- **Feature Suggestions:** Join our [Discord Server](https://discord.gg/r9QRUy6nrK) to suggest features
- **Bug Reports:** Open an issue on GitHub with detailed information
- **Documentation:** Help improve our docs and examples

### 🏆 Contributors

All contributors will be:
- Credited in code with their username
- Listed in our contributors section
- Acknowledged in release notes

**Special thanks to:**
- **davidbarnett0587** - Polls System, Birthday System, Suggestion System

*Your name could be here! Start contributing today.*

---

## 🤝 Support & Links

* 💬 **Discord Support**: [https://discord.gg/r9QRUy6nrK](https://discord.gg/r9QRUy6nrK)
* 📚 **Documentation**: [https://docs.ankitgupta.com.np/](https://docs.ankitgupta.com.np/)
* 🐛 **Issues & Requests**: GitHub Issues

---

## 📄 License

Licensed under the **MIT License**.
See the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**Jaggu762**

* GitHub: [https://github.com/hyperdargo](https://github.com/hyperdargo)
* Discord: Jaggu762
* Website: [https://ankitgupta.com.np](https://ankitgupta.com.np)

---

<p align="center">
  DTEmpire v2.7.1 • Built with ❤️ for the Discord community
</p>


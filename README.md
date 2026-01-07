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
  <a href="https://discord.gg/eVuKw3VrvX">
    <img src="https://img.shields.io/badge/Support-Server-purple?style=for-the-badge&logo=discord" />
  </a>
</p>

---

## 📌 Overview

**DTEmpire** is a feature-rich Discord bot designed to cover everything a normal server needs — from **AI integration** and **music playback** to **moderation**, **economy**, **tickets**, and **automation**.

- Prefix: `^`
- Version: **2.7.2**
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

## 🆕 What's New — January 2026 (v2.7.2)

### 💰 Economy Updates
- **Daily Check-In** (`^economy daily` / `checkin` / `streak`): 24h cooldown with a 48h grace window to keep streaks, streak-based coin bonuses, XP, and reputation points.
- **Lottery System Overhaul:** 
  - 10-minute timer starts automatically when the first ticket is purchased
  - Timer persists through bot restarts (auto-resumes on next ticket purchase)
  - **Rolling Jackpot:** If no one wins, the entire pot rolls over to the next round and keeps accumulating until someone wins!
  - Live countdown display shows time remaining until draw
  - Admin command `^economy forcelottery` to trigger draws instantly
  - Pick numbers 1-100, matching the random draw wins the accumulated jackpot
  - New `^economy lotteryresult` to view the last draw (winner or rollover) and current prize pool
- **Job Applications:** Jobs require player level now; list shows availability based on your level.
- **Steal Command Stability:** Fixed corrupt logic to restore victim DMs, fines, and cooldowns.

### 📅 Event Announcements
- New `^event <title> | <when> | <description> | [#channel]` command to post clean event embeds (requires Manage Server). Posts to the mentioned channel or the current one.

### 🛠️ Quality & Safety
- General robustness fixes around economy actions to prevent crashes and ensure clean embeds.

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
    - **Daily Rewards:** Check-in for coins, XP, streaks & bonuses
  - **Trading:** Pay users, steal from others (50% success)
  - **Gambling:** Race, football betting, casino games
  - **Lottery:** Buy tickets (1-100), 10-min auto-draw, rolling jackpots, results viewer (`^economy lotteryresult`), admin draw (`^economy forcelottery`)
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
Version: 2.7.2
Total Commands: 45

📁 AI (4)
aichat, imagegen, tts, videogen

📁 Admin (2)
setchannel, setlogs

📁 Config (1)
setguildjoin

📁 Economy (1)
economy (work, jobs, properties, buy, sell, 
lottery, buyticket, lotteryresult, forcelottery, bank, steal, pay, race, football, 
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
- **Feature Suggestions:** Join our [Discord Server](https://discord.gg/eVuKw3VrvX) to suggest features
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

* 💬 **Discord Support**: [https://discord.gg/eVuKw3VrvX](https://discord.gg/eVuKw3VrvX)
* 📚 **Documentation**: [https://docs.ankitgupta.com.np/](https://docs.ankitgupta.com.np/)
* 🐛 **Issues & Requests**: GitHub Issues

---

## 📄 License

Licensed under the **MIT License**.
See the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**DargoTamber**

* GitHub: [https://github.com/hyperdargo](https://github.com/hyperdargo)
* Discord: DargoTamber
* Website: [https://ankitgupta.com.np](https://ankitgupta.com.np)

---

<p align="center">
  DTEmpire v2.7.2 • Built with ❤️ for the Discord community
</p>


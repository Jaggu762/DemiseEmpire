<p align="center">
  <img src="https://i.imgur.com/exDGDGc.png" alt="DTEmpire Banner" />
</p>

<h1 align="center">🤖 DemiseEmpire v2</h1>

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

**DemiseEmpire** is a feature-rich Discord bot designed to cover everything a normal server needs — from **AI integration** and **music playback** to **moderation**, **economy**, **tickets**, and **automation**.

- Prefix: `^`
- Version: **2.8.0**
- Total Commands: **54**
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

## 🆕 What's New — January 2026 (v2.8.0)

### 💰 Advanced Banking System
- **Bank Interest:** 1% daily interest on all bank deposits (passive income!)
- **Fixed Deposits (FD):** Lock funds for 1-365 days at 3% daily interest rate (higher returns for long-term saving)
  - Commands: `^economy fd create <amount> <days>` | `^economy fd view` | `^economy fd withdraw`
  - Auto-unlock and claim interest when matured
- **Loan System:** Borrow up to 80% of your property value with 5% monthly interest
  - Commands: `^economy loan apply <amount>` | `^economy loan repay <amount>` | `^economy loan status`
  - Properties locked until loan is fully repaid (EMI payment system)

### 📊 Income Tax & Fee System
- **Progressive Tax Rates by Income Source:**
  - Job Salary: 10% tax
  - Property Income: 8% tax
  - Gambling Winnings: 15% tax
  - Trading/Transfers: 5% tax
  - Lottery Winnings: 20% tax
- **Transaction Fees:** 2% fee on transfers over $50,000 (prevents wealth manipulation)
- **Auto-Tax Collection:** All taxes automatically collected into a server-wide pool

### 🎁 Tax Collection Giveaways (Community Feature!)
- **Automatic Giveaways:** When server taxes reach thresholds (500k → 1M → 1.5M → etc.), auto-giveaway triggered
- **How it Works:** 30-second reaction-based giveaway; winner takes entire tax pool!
- **No Winner?** Pool carries over to next threshold (growing prize pool!)
- **Admin Setup:** 
  - `^economy taxgiveaway setchannel #channel` - designate giveaway channel
  - `^economy taxgiveaway status` - view current tax pool & progress
  - `^economy taxgiveaway trigger` - manually start giveaway

### 💰 Economy Updates (v2.7.2 carry-over)
- **Daily Check-In** (`^economy daily` / `checkin` / `streak`): 24h cooldown with a 48h grace window to keep streaks, streak-based coin bonuses, XP, and reputation points.
- **Lottery System Overhaul:** 
  - 10-minute timer starts automatically when the first ticket is purchased
  - Timer persists through bot restarts (auto-resumes when the bot is back online; resumes countdown on first lottery command or ticket purchase)
  - **Rolling Jackpot:** If no one wins, the entire pot rolls over to the next round and keeps accumulating until someone wins!
  - Live countdown display shows time remaining until draw
  - Admin command `^economy forcelottery` to trigger draws instantly
  - Pick numbers 1-100, matching the random draw wins the accumulated jackpot
  - New `^economy lotteryresult` to view the last draw (winner or rollover) and current prize pool
  - Optional auto-ticket subscriptions: choose a number once, auto-apply every round (2k/round), immediate apply when enabled if available
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
  - **Jobs:** Work, apply, level up (5 job tiers, with 10% income tax)
  - **Properties:** Buy/sell houses, shops, lands, businesses
  - **Banking:** Deposit, withdraw, collect daily rent
    - **Bank Interest:** 1% daily passive income on deposits
    - **Fixed Deposits:** Lock funds 1-365 days for 3% daily interest
    - **Loans:** Borrow up to 80% of property value (5% monthly interest, properties locked)
    - **Daily Rewards:** Check-in for coins, XP, streaks & bonuses
  - **Trading:** Pay users (2% fee on 50k+), steal from others (50% success, 5% tax)
  - **Gambling:** Race, football betting, casino games (15% tax on winnings)
  - **Lottery:** Buy tickets (1-100), 10-min auto-draw, rolling jackpots, auto-ticket subscriptions, results viewer (`^economy lotteryresult`), admin draw (`^economy forcelottery`), 20% tax on winnings
  - **Tax Giveaways:** Community giveaways funded by server taxes (every 500k collected!)
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
Version: 2.8.0
Total Commands: 54

📁 AI (4)
aichat, imagegen, tts, videogen

📁 Admin (2)
setchannel, setlogs

📁 Config (1)
setguildjoin

📁 Economy (1)
economy (work, jobs, properties, buy, sell, 
lottery, buyticket, lotteryresult, forcelottery, bank, fd, loan,
taxgiveaway, steal, pay, race, football, 
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
git clone https://github.com/jaggu762/DemiseEmpire.git
cd DemiseEmpire
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
   git clone https://github.com/jaggu762/DTEmpire-v2.git
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

* GitHub: [https://github.com/jaggu762](https://github.com/jaggu762)
* Discord: Jaggu762

---

<p align="center">
  DTEmpire v2.7.2 • Built with ❤️ for the Discord community
</p>



# Reputation / Karma System

A comprehensive reputation system for Discord servers that allows community members to acknowledge and appreciate helpful users.

## Overview

The reputation system enables users to give reputation points (karma) to other members who have been helpful, contributed positively to the community, or deserve recognition. The system includes safeguards to prevent abuse and maintain fairness.

## Features

### Core Features
- ⭐ **Give Reputation**: Award reputation points to helpful users with a reason
- 📊 **View Reputation**: Check your own or others' reputation and rank
- 🏆 **Leaderboard**: See top community members ranked by reputation
- 📜 **History**: View reputation history and reasons
- 📈 **Statistics**: Server-wide reputation statistics

### Security Features
- 🚫 **Self-Rep Prevention**: Users cannot give reputation to themselves
- 🤖 **Bot Protection**: Cannot give reputation to bot accounts
- ⏱️ **Daily Limit**: Each user can give 1 reputation per 24 hours
- 🔒 **Cooldown System**: 7-day cooldown before giving rep to the same user again
- 👶 **Account Age Check**: Account must be at least 7 days old
- 🏠 **Server Member Age**: Must be in server for at least 3 days
- ✅ **Reason Required**: Must provide a meaningful reason (5-200 characters)

## Commands

### Basic Commands

#### Give Reputation
```
^rep give @user <reason>
```

#### Check Reputation
```
^rep check [@user]
```

#### Leaderboard
```
^rep leaderboard [page]
```

#### Reputation History
```
^rep history [@user]
```

#### System Information
```
^rep info
```

### Command Aliases

The reputation command has several aliases:
- `^rep` (main command)
- `^reputation`
- `^karma`

## Configuration

### Default Settings
- Daily Limit: 1 rep per user per 24h
- Same-User Cooldown: 7 days
- Min Account Age: 7 days
- Min Server Member Age: 3 days
- Reason Length: 5-200 characters
- Self-Rep: Disabled
- Negative Rep: Disabled in v1

## Database Schema

### Reputation Table
Stores user reputation data per guild.

### Reputation Logs
Tracks all reputation transactions.

### Reputation Cooldowns
Tracks cooldowns between specific user pairs.

## Status Badges

- 🌱 **New**: 0-4 reputation
- 📈 **Growing**: 5-9 reputation
- ✨ **Active Member**: 10-19 reputation
- ⭐ **Trusted**: 20-49 reputation
- 🌟 **Highly Trusted**: 50+ reputation

## Testing

Run the test suite:
```bash
node test/test-reputation.js
```

## Credits

Implemented by: DTEmpire Development Team
Version: 1.0.0 (MVP)
Date: January 2026

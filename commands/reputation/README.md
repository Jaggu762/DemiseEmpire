# Reputation System

A basic reputation system for the DTEmpire Discord bot that tracks user activity and reputation points.

## Features

- **Automatic Reputation Tracking**: Users earn reputation points through:
  - Message Posts: 1 point per message (1 minute cooldown)
  - Command Usage: 2 points per command (5 minute cooldown)
  
- **Manual Reputation Management**: Admins and moderators can:
  - Add or remove reputation points from users
  - Track reason for reputation changes
  
- **Leaderboard**: View top users by reputation in your server

## Commands

### `!checkRep [@user]`
**Aliases**: `!rep`, `!reputation`, `!checkreputation`

Check reputation points for yourself or another user.

**Examples**:
- `!checkRep` - Check your own reputation
- `!checkRep @User` - Check another user's reputation
- `!rep 123456789` - Check reputation by user ID

**Displays**:
- Total reputation points
- Server rank
- Message count
- Command count  
- Member since date
- Last activity timestamp
- Recent reputation history

---

### `!addRep <@user> <points> [reason]`
**Aliases**: `!giverep`, `!addreputation`, `!givereputation`

Add or remove reputation points from a user (Admin/Moderator only).

**Permissions Required**: `Manage Messages` or `Administrator`

**Examples**:
- `!addRep @User 50 Great contribution` - Add 50 points
- `!addRep @User -20 Spam warning` - Remove 20 points

**Limits**:
- Maximum ±1000 points per command
- Cannot give reputation to bots
- Cannot give reputation to yourself

---

### `!repLeaderboard [page]`
**Aliases**: `!replb`, `!reptop`, `!toprep`, `!repboard`

View the reputation leaderboard for your server.

**Examples**:
- `!replb` - View page 1 of leaderboard
- `!replb 2` - View page 2 of leaderboard

**Features**:
- Shows top 10 users per page
- Displays points, messages, and commands for each user
- Shows your own position if not on current page
- 🥇🥈🥉 medals for top 3 users

## Database Structure

Reputation data is stored per user per guild with the following structure:

```javascript
{
  userId: "123456789",
  guildId: "987654321",
  points: 100,
  messageCount: 50,
  commandCount: 25,
  lastMessageTime: 1234567890,
  lastCommandTime: 1234567890,
  createdAt: 1234567890,
  updatedAt: 1234567890,
  history: [
    {
      points: 50,
      reason: "Manual adjustment by moderator",
      timestamp: 1234567890
    }
  ]
}
```

## Technical Details

### Cooldowns
- **Message Reputation**: 1 minute cooldown between earning points
- **Command Reputation**: 5 minutes cooldown between earning points

### Point Distribution
- **Messages**: 1 point per message
- **Commands**: 2 points per command
- **Manual**: Admin-defined (±1000 max per command)

### History Tracking
- Keeps last 100 reputation changes per user
- Tracks points changed, reason, and timestamp
- Viewable in `!checkRep` command

## Integration

The reputation system automatically integrates with:
- Message handler in `index.js`
- Command handler in `index.js`
- Database system in `utils/database.js`

No additional configuration required - it works out of the box!

## Future Enhancements

Potential improvements for the future:
- Reputation decay over time
- Reputation-based roles
- Reputation milestones and rewards
- Weekly/monthly reputation leaderboards
- Reputation transfer between users
- Reputation multipliers for special events
- Custom point values per action
- Negative reputation penalties for rule violations

# Reputation System - Deployment & Usage Guide

## 🚀 Quick Start

The reputation/karma system is **enabled by default** for all servers. Admins can configure or disable it per their needs.

## 📋 Prerequisites

- Bot must have the following permissions:
  - `Manage Roles` (for role rewards)
  - `Send Messages` 
  - `Embed Links`
  - `Read Message History`

## ⚙️ Initial Configuration

### Step 1: Set Log Channel (Recommended)
```
^rep config log #reputation-logs
```

### Step 2: Configure Role Rewards (Optional)
```
^rep roles add 10 @Active
^rep roles add 25 @Contributor
^rep roles add 50 @Trusted
^rep roles add 100 @VIP
```

### Step 3: Review Settings
```
^rep config
```

## 📝 User Commands

### Give Reputation
```
^rep give @user <reason>
```
**Example:**
```
^rep give @Alice Helped me debug a critical issue in production
```

### Check Reputation
```
^rep check              # Check your own
^rep check @user        # Check someone else's
```

### View Leaderboard
```
^rep leaderboard
^rep leaderboard 2      # Page 2
```

### View History
```
^rep history            # Your history
^rep history @user      # Others' history (staff only)
```

### System Information
```
^rep info
```

## 🛡️ Staff Commands

**Requirements:** Manage Messages permission

### View Reputation History
```
^rep history @user
```

## ⚙️ Admin Commands

**Requirements:** Administrator permission

### Configuration

**View Current Settings:**
```
^rep config
```

**Enable/Disable System:**
```
^rep config enable
^rep config disable
```

**Set Cooldown Duration:**
```
^rep config cooldown <days>
```
Example: `^rep config cooldown 7` (1-30 days)

**Set Daily Limit:**
```
^rep config daily <amount>
```
Example: `^rep config daily 1` (1-10 per day)

**Require/Optional Reason:**
```
^rep config reason true
^rep config reason false
```

**Restrict to Specific Channels:**
```
^rep config channels #general #community
^rep config channels clear         # Allow all channels
```

**Set Log Channel:**
```
^rep config log #reputation-logs
^rep config log clear              # Disable logging
```

**Reset to Defaults:**
```
^rep config reset
```

### Role Rewards Management

**Add Role Reward:**
```
^rep roles add <rep_threshold> @role
```
Example: `^rep roles add 10 @Active`

**Remove Role Reward:**
```
^rep roles remove @role
```

**List All Rewards:**
```
^rep roles list
```

### Moderation

**Reset User Reputation:**
```
^rep reset @user
```

**View Suspicious Patterns:**
```
^rep suspicious
```

## 🔒 Default Security Settings

- **Daily Limit:** 1 reputation per user per 24 hours
- **Same-User Cooldown:** 7 days
- **Account Age Requirement:** 7 days minimum
- **Server Member Age:** 3 days minimum in server
- **Self-Rep:** Blocked
- **Bot-Rep:** Blocked
- **Reason Requirement:** Yes (5-200 characters)

## 🎭 Role Rewards

Role rewards are automatically assigned when users reach reputation thresholds:

1. **Configure thresholds:**
   ```
   ^rep roles add 10 @Active
   ^rep roles add 50 @Trusted
   ```

2. **Automatic assignment:**
   - User reaches 10 rep → Gets @Active role
   - User reaches 50 rep → Gets @Active AND @Trusted roles

3. **Role removal:**
   - Roles are automatically removed if reputation drops below threshold
   - Happens on `^rep reset` command

## 🎫 Ticket Integration

When staff closes a support ticket:
1. A "⭐ Rate Support" button appears
2. Ticket owner can click to give staff +1 reputation
3. Staff automatically gets reputation with reason: "Excellent support in ticket"
4. Role rewards are assigned if thresholds reached

## 👤 Whois Integration

The `^whois` command now displays:
- Reputation score
- Server rank
- Highest reputation role (if any)

Example output:
```
⭐ Reputation
25 points • Rank: #3
🎭 Rep Role: @Trusted
```

## ⚠️ Abuse Prevention

### Pattern Detection

The system automatically detects suspicious reputation trading:

- **Triggers:** 3+ mutual exchanges between two users in 30 days
- **Action:** Logs to database, console warning, admin notification
- **Philosophy:** Log and flag, don't automatically block

### Review Suspicious Activity

```
^rep suspicious
```

Shows:
- User pairs involved
- Exchange counts (A→B, B→A)
- Detection timestamp
- Review guidance

### Handling Abuse

1. Review suspicious patterns: `^rep suspicious`
2. Check user histories: `^rep history @user`
3. Reset if confirmed abuse: `^rep reset @user`

## 📊 Best Practices

### For Admins

1. **Set up role rewards** to incentivize participation
2. **Configure log channel** for transparency
3. **Review suspicious patterns** monthly
4. **Adjust cooldowns** based on server size and activity

### For Users

1. **Be specific** in reasons (5-200 characters)
2. **Give genuine appreciation** - abuse will be detected
3. **Check leaderboard** to see top contributors
4. **Rate support staff** in tickets when applicable

## 🔧 Troubleshooting

### "You cannot give reputation to yourself"
- Self-rep is blocked by design

### "You have reached your daily reputation limit"
- Wait 24 hours to give more reputation
- Admins can adjust with `^rep config daily <amount>`

### "You must wait X days before giving reputation to this user again"
- Same-user cooldown in effect
- Admins can adjust with `^rep config cooldown <days>`

### "Your account must be at least X days old"
- Account age check prevents sockpuppets
- Wait until account meets minimum age

### Roles not assigning automatically
- Check bot has `Manage Roles` permission
- Verify bot's role is higher than reward roles
- Check role rewards are configured: `^rep roles list`

## 📈 Monitoring

### Server Statistics
```
^rep info
```

Shows:
- Total users with reputation
- Total reputation given
- Average reputation
- Recent activity (24h)

### Activity Logs

All reputation actions are logged to the configured log channel:
- Who gave reputation
- Who received it
- Reason provided
- New total and rank
- Timestamp

## 🎯 Use Cases

### Community Recognition
- Thank helpful members
- Acknowledge contributions
- Build positive culture

### Staff Performance
- Track support quality
- Recognize outstanding assistance
- Reward consistent helpfulness

### Gamification
- Create competitive leaderboard
- Offer role rewards as milestones
- Encourage engagement

## 📚 Related Commands

- `^whois @user` - Shows reputation in user info
- Ticket system - Includes rate support button

## 🆘 Support

For issues or questions:
1. Check this guide first
2. Review `^rep info` for system status
3. Test configuration with `^rep config`
4. Contact server administrators

---

**System Status:** ✅ Production Ready

**Version:** 1.0.0

**Last Updated:** 2026-01-06

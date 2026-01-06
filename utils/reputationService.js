/**
 * Reputation/Karma System Service
 * Handles all reputation logic independently from Discord commands
 */

class ReputationService {
    constructor(db) {
        this.db = db;
        
        // Configuration constants (locked in Phase 0)
        this.DAILY_LIMIT = 1; // Max reps a user can give per 24h
        this.SAME_USER_COOLDOWN_DAYS = 7; // Days before can give rep to same user again
        this.MIN_ACCOUNT_AGE_DAYS = 7; // Minimum Discord account age
        this.MIN_SERVER_MEMBER_DAYS = 3; // Minimum days in server
        this.REASON_MIN_LENGTH = 5; // Minimum reason length
        this.REASON_MAX_LENGTH = 200; // Maximum reason length
    }

    /**
     * Check if a user can give reputation to another user
     * @param {Object} giver - Discord Member object who wants to give rep
     * @param {Object} receiver - Discord Member object who would receive rep
     * @param {Object} guild - Discord Guild object
     * @returns {Object} { canGive: boolean, reason: string }
     */
    async canGiveRep(giver, receiver, guild) {
        // Check 1: Self-rep disabled
        if (giver.id === receiver.id) {
            return {
                canGive: false,
                reason: '❌ You cannot give reputation to yourself!'
            };
        }

        // Check 2: Bot accounts
        if (receiver.user.bot) {
            return {
                canGive: false,
                reason: '❌ You cannot give reputation to bots!'
            };
        }

        // Check 3: Giver is a bot (shouldn't happen but safety check)
        if (giver.user.bot) {
            return {
                canGive: false,
                reason: '❌ Bots cannot give reputation!'
            };
        }

        // Check 4: Account age (giver)
        const accountAge = Date.now() - giver.user.createdTimestamp;
        const minAccountAge = this.MIN_ACCOUNT_AGE_DAYS * 24 * 60 * 60 * 1000;
        if (accountAge < minAccountAge) {
            const daysOld = Math.floor(accountAge / (24 * 60 * 60 * 1000));
            return {
                canGive: false,
                reason: `❌ Your account must be at least ${this.MIN_ACCOUNT_AGE_DAYS} days old to give reputation! (Currently ${daysOld} days old)`
            };
        }

        // Check 5: Server member age (giver)
        const memberAge = Date.now() - giver.joinedTimestamp;
        const minMemberAge = this.MIN_SERVER_MEMBER_DAYS * 24 * 60 * 60 * 1000;
        if (memberAge < minMemberAge) {
            const daysInServer = Math.floor(memberAge / (24 * 60 * 60 * 1000));
            return {
                canGive: false,
                reason: `❌ You must be in this server for at least ${this.MIN_SERVER_MEMBER_DAYS} days to give reputation! (Currently ${daysInServer} days)`
            };
        }

        // Check 6: Daily limit
        const dailyCount = await this.db.getDailyRepCount(giver.id, guild.id);
        if (dailyCount >= this.DAILY_LIMIT) {
            return {
                canGive: false,
                reason: `❌ You have reached your daily reputation limit! (${this.DAILY_LIMIT} per day)\n💡 You can give more reputation tomorrow.`
            };
        }

        // Check 7: Same-user cooldown
        const cooldown = await this.db.getRepCooldown(guild.id, giver.id, receiver.id);
        if (cooldown) {
            const timeLeft = cooldown.expires_at - Date.now();
            const daysLeft = Math.ceil(timeLeft / (24 * 60 * 60 * 1000));
            const hoursLeft = Math.ceil(timeLeft / (60 * 60 * 1000));
            
            let timeString;
            if (daysLeft > 1) {
                timeString = `${daysLeft} days`;
            } else if (hoursLeft > 1) {
                timeString = `${hoursLeft} hours`;
            } else {
                const minutesLeft = Math.ceil(timeLeft / (60 * 1000));
                timeString = `${minutesLeft} minutes`;
            }
            
            return {
                canGive: false,
                reason: `❌ You must wait ${timeString} before giving reputation to ${receiver.user.username} again!\n💡 You can give reputation to other users in the meantime.`
            };
        }

        // All checks passed!
        return {
            canGive: true,
            reason: '✅ You can give reputation!'
        };
    }

    /**
     * Give reputation to a user
     * @param {Object} giver - Discord Member object who is giving rep
     * @param {Object} receiver - Discord Member object receiving rep
     * @param {Object} guild - Discord Guild object
     * @param {string} reason - Reason for giving rep
     * @param {string} channelId - Channel ID where rep was given
     * @returns {Object} { success: boolean, message: string, data?: Object }
     */
    async giveRep(giver, receiver, guild, reason, channelId) {
        // Validate reason
        if (!reason || reason.trim().length < this.REASON_MIN_LENGTH) {
            return {
                success: false,
                message: `❌ Reason must be at least ${this.REASON_MIN_LENGTH} characters long!`
            };
        }

        if (reason.length > this.REASON_MAX_LENGTH) {
            return {
                success: false,
                message: `❌ Reason must be no more than ${this.REASON_MAX_LENGTH} characters long!`
            };
        }

        // Check if can give rep
        const canGive = await this.canGiveRep(giver, receiver, guild);
        if (!canGive.canGive) {
            return {
                success: false,
                message: canGive.reason
            };
        }

        try {
            // Increment receiver's reputation
            const updatedRep = await this.db.updateUserReputation(receiver.id, guild.id, 1);

            // Create log entry
            await this.db.addRepLog(
                guild.id,
                giver.id,
                receiver.id,
                reason.trim(),
                channelId
            );

            // Set cooldown (7 days for same user)
            const cooldownExpiry = Date.now() + (this.SAME_USER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
            await this.db.setRepCooldown(guild.id, giver.id, receiver.id, cooldownExpiry);

            // Check for suspicious patterns (A↔B trading)
            const pattern = await this.db.checkRepPattern(guild.id, giver.id, receiver.id);
            if (pattern.suspicious) {
                // Log suspicious pattern but don't block
                await this.db.logSuspiciousPattern(guild.id, giver.id, receiver.id, pattern);
                console.log(`⚠️ Suspicious rep pattern detected: ${giver.id} ↔ ${receiver.id} (${pattern.count} exchanges)`);
            }

            // Get receiver's rank
            const rank = await this.db.getRepRank(receiver.id, guild.id);

            return {
                success: true,
                message: '✅ Reputation given successfully!',
                data: {
                    receiver: receiver.user,
                    newRepTotal: updatedRep.rep,
                    rank: rank,
                    reason: reason.trim()
                }
            };
        } catch (error) {
            console.error('Error giving reputation:', error);
            return {
                success: false,
                message: '❌ An error occurred while giving reputation. Please try again.'
            };
        }
    }

    /**
     * Get reputation information for a user
     * @param {Object} user - Discord User object
     * @param {string} guildId - Guild ID
     * @returns {Object} Reputation data including rank
     */
    async getRep(user, guildId) {
        try {
            const repData = await this.db.getUserReputation(user.id, guildId);
            const rank = await this.db.getRepRank(user.id, guildId);
            
            return {
                success: true,
                data: {
                    user: user,
                    rep: repData.rep,
                    rank: rank,
                    lastReceivedAt: repData.last_received_at,
                    createdAt: repData.created_at
                }
            };
        } catch (error) {
            console.error('Error getting reputation:', error);
            return {
                success: false,
                message: '❌ An error occurred while fetching reputation data.'
            };
        }
    }

    /**
     * Get reputation leaderboard for a guild
     * @param {string} guildId - Guild ID
     * @param {number} limit - Number of top users to return
     * @returns {Object} Leaderboard data
     */
    async getLeaderboard(guildId, limit = 10) {
        try {
            const leaderboard = await this.db.getRepLeaderboard(guildId, limit);
            
            return {
                success: true,
                data: leaderboard
            };
        } catch (error) {
            console.error('Error getting leaderboard:', error);
            return {
                success: false,
                message: '❌ An error occurred while fetching the leaderboard.'
            };
        }
    }

    /**
     * Get reputation history for a user
     * @param {Object} user - Discord User object
     * @param {string} guildId - Guild ID
     * @param {number} limit - Number of entries to return
     * @returns {Object} History data
     */
    async getRepHistory(user, guildId, limit = 10) {
        try {
            const history = await this.db.getRepHistory(user.id, guildId, limit);
            
            return {
                success: true,
                data: history
            };
        } catch (error) {
            console.error('Error getting reputation history:', error);
            return {
                success: false,
                message: '❌ An error occurred while fetching reputation history.'
            };
        }
    }

    /**
     * Get statistics about the reputation system for a guild
     * @param {string} guildId - Guild ID
     * @returns {Object} Statistics data
     */
    async getStats(guildId) {
        try {
            const leaderboard = await this.db.getRepLeaderboard(guildId, 1000);
            const totalUsers = leaderboard.length;
            const totalRep = leaderboard.reduce((sum, user) => sum + user.rep, 0);
            const avgRep = totalUsers > 0 ? Math.round(totalRep / totalUsers) : 0;

            // Get logs for the guild
            const logs = this.db.data.repLogs?.[guildId] || [];
            const last24h = logs.filter(log => log.created_at > Date.now() - (24 * 60 * 60 * 1000));

            return {
                success: true,
                data: {
                    totalUsers: totalUsers,
                    totalRepGiven: totalRep,
                    averageRep: avgRep,
                    repsLast24h: last24h.length,
                    totalLogs: logs.length
                }
            };
        } catch (error) {
            console.error('Error getting reputation stats:', error);
            return {
                success: false,
                message: '❌ An error occurred while fetching statistics.'
            };
        }
    }

    /**
     * Check and assign reputation role rewards to a member
     * @param {Object} member - Discord Member object
     * @param {string} guildId - Guild ID
     * @param {number} currentRep - User's current reputation
     * @returns {Object} { rolesAdded: [], rolesRemoved: [] }
     */
    async checkAndAssignRoles(member, guildId, currentRep) {
        try {
            const roleRewards = await this.db.getRepRoleRewards(guildId);
            if (roleRewards.length === 0) {
                return { rolesAdded: [], rolesRemoved: [] };
            }

            const rolesUserShouldHave = roleRewards
                .filter(reward => currentRep >= reward.rep_threshold)
                .map(reward => reward.role_id);

            const allRewardRoleIds = roleRewards.map(r => r.role_id);
            const rolesUserHas = member.roles.cache
                .filter(role => allRewardRoleIds.includes(role.id))
                .map(role => role.id);

            const rolesAdded = [];
            const rolesRemoved = [];

            // Add roles user should have but doesn't
            for (const roleId of rolesUserShouldHave) {
                if (!rolesUserHas.includes(roleId)) {
                    try {
                        await member.roles.add(roleId, 'Reputation role reward');
                        rolesAdded.push(roleId);
                    } catch (error) {
                        console.error(`Failed to add role ${roleId}:`, error.message);
                    }
                }
            }

            // Remove roles user has but shouldn't (lost reputation)
            for (const roleId of rolesUserHas) {
                if (!rolesUserShouldHave.includes(roleId)) {
                    try {
                        await member.roles.remove(roleId, 'Lost reputation threshold');
                        rolesRemoved.push(roleId);
                    } catch (error) {
                        console.error(`Failed to remove role ${roleId}:`, error.message);
                    }
                }
            }

            return { rolesAdded, rolesRemoved };
        } catch (error) {
            console.error('Error checking and assigning roles:', error);
            return { rolesAdded: [], rolesRemoved: [] };
        }
    }
}

module.exports = ReputationService;

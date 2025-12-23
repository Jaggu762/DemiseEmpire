const fs = require('fs');
const path = require('path');

class Database {
    constructor() {
        this.data = {
            guildConfigs: {},
            userEconomy: {},
            snipes: {},
            mutes: {},
            warnings: {},
            giveaways: {},
            properties: {}, // Added for property system
            jobs: {}, // Added for job system
            lottery: {}, // Added for lottery system
            transactions: {}, // Added for transaction history
            stickyMessages: {} // Added for sticky messages
        };
        this.dbPath = path.join(__dirname, '..', 'data', 'database.json');
    }

    async initialize() {
        try {
            // Create data directory
            const dataDir = path.join(__dirname, '..', 'data');
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            // Try to load existing data
            if (fs.existsSync(this.dbPath)) {
                const fileData = fs.readFileSync(this.dbPath, 'utf8');
                this.data = JSON.parse(fileData);
                console.log('✅ Loaded existing database');
            } else {
                // Save initial data
                this.save();
            }

            return this;
        } catch (error) {
            console.error('❌ Database load error:', error.message);
            return this; // Return in-memory database
        }
    }

    save() {
        try {
            fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('❌ Database save error:', error.message);
        }
    }

    // ========== STICKY MESSAGE METHODS ==========
    async getStickyMessage(channelId) {
        if (!this.data.stickyMessages) this.data.stickyMessages = {};
        return this.data.stickyMessages[channelId] || null;
    }

    async getStickyMessagesByGuild(guildId) {
        if (!this.data.stickyMessages) return [];
        
        const stickyMessages = [];
        for (const channelId in this.data.stickyMessages) {
            const sticky = this.data.stickyMessages[channelId];
            if (sticky.guildId === guildId) {
                stickyMessages.push(sticky);
            }
        }
        return stickyMessages;
    }

    async createStickyMessage(data) {
        if (!this.data.stickyMessages) this.data.stickyMessages = {};
        
        const stickyId = Date.now().toString();
        const stickyData = {
            id: stickyId,
            ...data,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        this.data.stickyMessages[data.channelId] = stickyData;
        this.save();
        return stickyData;
    }

    async updateStickyMessage(channelId, updates) {
        if (!this.data.stickyMessages || !this.data.stickyMessages[channelId]) {
            return null;
        }
        
        Object.assign(this.data.stickyMessages[channelId], updates);
        this.data.stickyMessages[channelId].updatedAt = Date.now();
        this.save();
        return this.data.stickyMessages[channelId];
    }

    async deleteStickyMessage(channelId) {
        if (!this.data.stickyMessages || !this.data.stickyMessages[channelId]) {
            return false;
        }
        
        delete this.data.stickyMessages[channelId];
        this.save();
        return true;
    }

    // Guild config methods
    async getGuildConfig(guildId) {
        if (!this.data.guildConfigs[guildId]) {
            this.data.guildConfigs[guildId] = {
                guild_id: guildId,
                prefix: '.',
                
                
                 // ========== AUTOROOM SETTINGS ==========
                autoroom_creator: null,
                autoroom_category: null,
                autoroom_format: null,
                autoroom_limit: null, // 0 = no limit
                autoroom_bitrate: null, // in kbps
                autoroom_private: false,
                autoroom_cleanup: 5, // minutes until empty room deletion
                
                // ========== LOG CHANNELS ==========
                // Core log channels
                log_channel: null,
                mod_log_channel: null,
                audit_log_channel: null,
                
                // Specialized log channels from your list
                join_leave_log_channel: null,
                message_log_channel: null,
                role_log_channel: null,
                channel_log_channel: null,
                voice_log_channel: null,
                invite_log_channel: null,
                ticket_log_channel: null,
                
                // Additional log channels
                warning_log_channel: null,
                mute_log_channel: null,
                kick_log_channel: null,
                ban_log_channel: null,
                economy_log_channel: null,
                leveling_log_channel: null,
                giveaway_log_channel: null,
                
                // ========== SYSTEM CHANNELS ==========
                welcome_channel: null,
                welcome_message: 'Welcome {user} to {server}!',
                leave_channel: null,
                leave_message: '{user} has left the server.',
                
                // Feature channels
                verification_channel: null,
                ai_channel: null,
                music_channel: null,
                suggestion_channel: null,
                report_channel: null,
                announcements_channel: null,
                counting_channel: null,
                level_up_channel: null,
                starboard_channel: null,
                media_only_channel: null,
                slowmode_channel: null,
                
                // ========== ROLE CONFIGURATIONS ==========
                auto_role: null,
                moderator_role: null,
                admin_role: null,
                mute_role: null,
                verified_role: null,
                
                // ========== AI SETTINGS ==========
                ai_model: 'deepseek',
                ai_enabled: true,
                ai_temperature: 0.7,
                ai_max_tokens: 1000,
                
                // ========== MODERATION SETTINGS ==========
                anti_raid_enabled: true,
                anti_spam_enabled: true,
                max_warnings: 3,
                warning_action: 'mute', // mute, kick, ban
                
                // Auto-moderation settings
                bad_words_enabled: true,
                invite_link_protection: true,
                mass_mention_protection: true,
                caps_protection: true,
                emoji_spam_protection: true,
                
                // ========== ECONOMY SETTINGS ==========
                economy_enabled: true,
                currency_name: 'coins',
                currency_symbol: '🪙',
                payday_amount: 100,
                payday_cooldown: 3600000,
                daily_amount: 50,
                weekly_amount: 500,
                monthly_amount: 2000,
                
                // ========== LEVEL SYSTEM ==========
                leveling_enabled: true,
                xp_per_message: 15,
                xp_cooldown: 60000, // 1 minute
                level_up_notification: true,
                level_multiplier: 1.0,
                
                // ========== LOGGING SETTINGS ==========
                mod_logs_enabled: true,
                message_logs_enabled: false,
                message_delete_logs: true,
                message_edit_logs: true,
                voice_logs_enabled: false,
                voice_join_logs: true,
                voice_leave_logs: true,
                voice_move_logs: true,
                member_logs_enabled: true,
                member_join_logs: true,
                member_leave_logs: true,
                member_update_logs: true,
                role_logs_enabled: true,
                role_create_logs: true,
                role_delete_logs: true,
                role_update_logs: true,
                channel_logs_enabled: true,
                channel_create_logs: true,
                channel_delete_logs: true,
                channel_update_logs: true,
                
                // ========== SERVER PROTECTION ==========
                max_mentions: 5,
                max_duplicate_messages: 5,
                max_emojis: 10,
                max_attachments: 5,
                max_caps_ratio: 0.7,
                raid_threshold: 5,
                raid_timeframe: 10000,
                
                // ========== ALT ACCOUNT CHECK ==========
                alt_account_check: false,
                min_account_age_days: 7,
                suspicious_join_action: 'log', // log, warn, kick, ban
                
                // ========== SERVER FEATURES ==========
                nsfw_enabled: false,
                music_enabled: true,
                games_enabled: true,
                suggestions_enabled: true,
                reports_enabled: true,
                starboard_enabled: false,
                counting_enabled: false,
                
                // ========== TICKET SYSTEM ==========
                ticket_system_enabled: false,
                ticket_category: null,
                ticket_log_channel: null,
                ticket_support_role: null,
                
                // ========== VERIFICATION SYSTEM ==========
                verification_enabled: false,
                verification_type: 'button', // button, captcha, reaction
                verification_role: null,
                verification_timeout: 300000, // 5 minutes
                
                // ========== BACKUP SETTINGS ==========
                auto_backup_enabled: false,
                backup_interval: 86400000, // 24 hours
                last_backup: null,
                
                // ========== STATISTICS ==========
                total_messages: 0,
                total_commands: 0,
                total_joins: 0,
                total_leaves: 0,
                created_at: Date.now(),
                updated_at: Date.now()
            };
            this.save();
        }
        return this.data.guildConfigs[guildId];
    }

    async updateGuildConfig(guildId, updates) {
        const config = await this.getGuildConfig(guildId);
        Object.assign(config, updates);
        config.updated_at = Date.now();
        this.data.guildConfigs[guildId] = config;
        this.save();
        return config;
    }

    // Economy methods
    async getUserEconomy(userId, guildId) {
        const key = `${userId}-${guildId}`;
        if (!this.data.userEconomy[key]) {
            this.data.userEconomy[key] = {
                user_id: userId,
                guild_id: guildId,
                wallet: 100,
                bank: 0,
                total: 100,
                last_payday: null,
                daily_streak: 0,
                last_daily: null,
                weekly_streak: 0,
                last_weekly: null,
                monthly_streak: 0,
                last_monthly: null,
                xp: 0,
                level: 1,
                messages: 0,
                voice_time: 0,
                reputation: 0,
                last_message_xp: 0,
                items: [],
                achievements: [],
                created_at: Date.now(),
                updated_at: Date.now()
            };
            this.save();
        }
        return this.data.userEconomy[key];
    }

    async updateUserEconomy(userId, guildId, updates) {
        const economy = await this.getUserEconomy(userId, guildId);
        Object.assign(economy, updates);
        economy.total = economy.wallet + economy.bank;
        economy.updated_at = Date.now();
        const key = `${userId}-${guildId}`;
        this.data.userEconomy[key] = economy;
        this.save();
        return economy;
    }

    async getAllEconomy(guildId) {
        const allEconomies = [];
        for (const key in this.data.userEconomy) {
            if (this.data.userEconomy[key].guild_id === guildId) {
                allEconomies.push(this.data.userEconomy[key]);
            }
        }
        return allEconomies.sort((a, b) => b.total - a.total);
    }

    // ========== PROPERTY METHODS ==========
    async getUserProperties(userId, guildId) {
        const key = `properties_${userId}_${guildId}`;
        if (!this.data.properties) this.data.properties = {};
        if (!this.data.properties[key]) {
            this.data.properties[key] = {
                user_id: userId,
                guild_id: guildId,
                houses: [],
                shops: [],
                lands: [],
                businesses: [],
                last_rent_collection: null,
                total_property_value: 0
            };
            this.save();
        }
        return this.data.properties[key];
    }

    async updateUserProperties(userId, guildId, updates) {
        const properties = await this.getUserProperties(userId, guildId);
        Object.assign(properties, updates);
        const key = `properties_${userId}_${guildId}`;
        this.data.properties[key] = properties;
        this.save();
        return properties;
    }

    // ========== JOB METHODS ==========
    async getUserJob(userId, guildId) {
        const key = `job_${userId}_${guildId}`;
        if (!this.data.jobs) this.data.jobs = {};
        if (!this.data.jobs[key]) {
            this.data.jobs[key] = {
                user_id: userId,
                guild_id: guildId,
                job_type: 'unemployed',
                job_level: 0,
                last_work: null,
                experience: 0,
                salary: 0
            };
            this.save();
        }
        return this.data.jobs[key];
    }

    async updateUserJob(userId, guildId, updates) {
        const job = await this.getUserJob(userId, guildId);
        Object.assign(job, updates);
        const key = `job_${userId}_${guildId}`;
        this.data.jobs[key] = job;
        this.save();
        return job;
    }

    // ========== LOTTERY METHODS ==========
    async getLotteryTicket(userId, guildId) {
        const key = `lottery_${userId}_${guildId}`;
        if (!this.data.lottery) this.data.lottery = {};
        return this.data.lottery[key] || null;
    }

    async buyLotteryTicket(userId, guildId, ticketNumber, amount) {
        const key = `lottery_${userId}_${guildId}`;
        if (!this.data.lottery) this.data.lottery = {};
        
        this.data.lottery[key] = {
            user_id: userId,
            guild_id: guildId,
            ticket_number: ticketNumber,
            amount: amount,
            purchased_at: Date.now(),
            drawn: false
        };
        
        this.save();
        return this.data.lottery[key];
    }

    async getActiveLotteryTickets(guildId) {
        if (!this.data.lottery) return [];
        
        return Object.values(this.data.lottery).filter(ticket => 
            ticket.guild_id === guildId && !ticket.drawn
        );
    }

    // ========== TRANSACTION METHODS ==========
    async addTransaction(userId, guildId, type, amount, details = {}) {
        if (!this.data.transactions) this.data.transactions = {};
        
        const transactionId = Date.now().toString();
        const transaction = {
            id: transactionId,
            user_id: userId,
            guild_id: guildId,
            type: type,
            amount: amount,
            details: details,
            timestamp: Date.now()
        };
        
        if (!this.data.transactions[guildId]) {
            this.data.transactions[guildId] = [];
        }
        
        this.data.transactions[guildId].push(transaction);
        
        // Keep only last 100 transactions per guild to prevent bloating
        if (this.data.transactions[guildId].length > 100) {
            this.data.transactions[guildId] = this.data.transactions[guildId].slice(-100);
        }
        
        this.save();
        return transaction;
    }

    async getUserTransactions(userId, guildId, limit = 10) {
        if (!this.data.transactions || !this.data.transactions[guildId]) return [];
        
        return this.data.transactions[guildId]
            .filter(t => t.user_id === userId)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    // Snipe methods
    async saveSnipe(guildId, channelId, snipeData) {
        const key = `${guildId}-${channelId}`;
        this.data.snipes[key] = {
            ...snipeData,
            timestamp: Date.now(),
            saved_at: Date.now()
        };
        this.save();
    }

    async getSnipe(guildId, channelId) {
        const key = `${guildId}-${channelId}`;
        return this.data.snipes[key] || null;
    }

    // Mute methods
    async storeMute(guildId, userId, unmuteTime, reason, moderatorId = null) {
        if (!this.data.mutes) this.data.mutes = {};
        
        const muteId = `${guildId}_${userId}`;
        this.data.mutes[muteId] = {
            guildId,
            userId,
            unmuteTime,
            reason,
            moderatorId,
            createdAt: Date.now(),
            active: true
        };
        
        this.save();
        return muteId;
    }

    async removeMute(guildId, userId) {
        if (!this.data.mutes) return;
        
        const muteId = `${guildId}_${userId}`;
        if (this.data.mutes[muteId]) {
            this.data.mutes[muteId].active = false;
            this.data.mutes[muteId].removedAt = Date.now();
            this.save();
        }
    }

    async getActiveMutes() {
        if (!this.data.mutes) return [];
        
        const now = Date.now();
        return Object.values(this.data.mutes).filter(mute => 
            mute.active && mute.unmuteTime > now
        );
    }

    // Warning methods
    async addWarning(guildId, userId, moderatorId, reason) {
        if (!this.data.warnings) this.data.warnings = {};
        
        const warningId = Date.now().toString();
        const warningKey = `${guildId}_${userId}`;
        
        if (!this.data.warnings[warningKey]) {
            this.data.warnings[warningKey] = [];
        }
        
        this.data.warnings[warningKey].push({
            id: warningId,
            guildId,
            userId,
            moderatorId,
            reason,
            timestamp: Date.now(),
            active: true
        });
        
        this.save();
        return warningId;
    }

    async getWarnings(guildId, userId) {
        if (!this.data.warnings) return [];
        
        const warningKey = `${guildId}_${userId}`;
        const warnings = this.data.warnings[warningKey] || [];
        return warnings.filter(w => w.active);
    }

    async clearWarnings(guildId, userId) {
        if (!this.data.warnings) return;
        
        const warningKey = `${guildId}_${userId}`;
        if (this.data.warnings[warningKey]) {
            this.data.warnings[warningKey].forEach(w => w.active = false);
            this.save();
        }
    }

    // Giveaway methods
    async createGiveaway(guildId, data) {
        if (!this.data.giveaways) this.data.giveaways = {};
        
        const giveawayId = Date.now().toString();
        this.data.giveaways[giveawayId] = {
            id: giveawayId,
            guildId,
            ...data,
            ended: false,
            participants: [],
            created_at: Date.now(),
            updated_at: Date.now()
        };
        
        this.save();
        return giveawayId;
    }

    async getGiveaway(giveawayId) {
        if (!this.data.giveaways) return null;
        return this.data.giveaways[giveawayId] || null;
    }

    async updateGiveaway(giveawayId, updates) {
        if (!this.data.giveaways || !this.data.giveaways[giveawayId]) return null;
        
        Object.assign(this.data.giveaways[giveawayId], updates);
        this.data.giveaways[giveawayId].updated_at = Date.now();
        this.save();
        return this.data.giveaways[giveawayId];
    }

    async deleteGiveaway(giveawayId) {
        if (!this.data.giveaways || !this.data.giveaways[giveawayId]) return;
        
        delete this.data.giveaways[giveawayId];
        this.save();
    }

    async getActiveGiveaways() {
        if (!this.data.giveaways) return [];
        return Object.values(this.data.giveaways).filter(g => !g.ended);
    }

    // Logging methods
    async logAction(guildId, action, data) {
        // This method can be expanded to write logs to a separate file or database
        console.log(`[Log] ${guildId}: ${action}`, data);
        return true;
    }

    // Member tracking methods
    async trackMemberJoin(guildId, userId, joinData = {}) {
        // You can expand this to track member joins in detail
        const config = await this.getGuildConfig(guildId);
        config.total_joins = (config.total_joins || 0) + 1;
        await this.updateGuildConfig(guildId, { total_joins: config.total_joins });
        return true;
    }

    async trackMemberLeave(guildId, userId, leaveData = {}) {
        // You can expand this to track member leaves in detail
        const config = await this.getGuildConfig(guildId);
        config.total_leaves = (config.total_leaves || 0) + 1;
        await this.updateGuildConfig(guildId, { total_leaves: config.total_leaves });
        return true;
    }

    // Statistics methods
    async incrementMessageCount(guildId) {
        const config = await this.getGuildConfig(guildId);
        config.total_messages = (config.total_messages || 0) + 1;
        await this.updateGuildConfig(guildId, { total_messages: config.total_messages });
    }

    async incrementCommandCount(guildId) {
        const config = await this.getGuildConfig(guildId);
        config.total_commands = (config.total_commands || 0) + 1;
        await this.updateGuildConfig(guildId, { total_commands: config.total_commands });
    }

    // Additional utility methods
    async getAllGuildConfigs() {
        return this.data.guildConfigs;
    }

    async resetGuildConfig(guildId) {
        delete this.data.guildConfigs[guildId];
        this.save();
        return this.getGuildConfig(guildId); // Returns fresh config
    }

    async backupDatabase() {
        const backupPath = this.dbPath.replace('.json', `_backup_${Date.now()}.json`);
        try {
            fs.writeFileSync(backupPath, JSON.stringify(this.data, null, 2));
            console.log(`✅ Database backed up to: ${backupPath}`);
            return backupPath;
        } catch (error) {
            console.error('❌ Backup failed:', error.message);
            return null;
        }
    }

    // Cleanup methods
    async cleanupOldData(maxAgeDays = 30) {
        try {
            const maxAge = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
            let cleaned = 0;

            // Clean old snipes (older than 30 days)
            for (const key in this.data.snipes) {
                if (this.data.snipes[key].timestamp < maxAge) {
                    delete this.data.snipes[key];
                    cleaned++;
                }
            }

            // Clean inactive mutes (older than 30 days)
            if (this.data.mutes) {
                for (const key in this.data.mutes) {
                    if (this.data.mutes[key].createdAt < maxAge && !this.data.mutes[key].active) {
                        delete this.data.mutes[key];
                        cleaned++;
                    }
                }
            }

            // Clean old drawn lottery tickets (older than 30 days)
            if (this.data.lottery) {
                for (const key in this.data.lottery) {
                    const ticket = this.data.lottery[key];
                    if (ticket.purchased_at < maxAge && ticket.drawn) {
                        delete this.data.lottery[key];
                        cleaned++;
                    }
                }
            }

            // Clean old transactions (older than 90 days)
            if (this.data.transactions) {
                for (const guildId in this.data.transactions) {
                    this.data.transactions[guildId] = this.data.transactions[guildId].filter(
                        t => t.timestamp > maxAge
                    );
                    cleaned += this.data.transactions[guildId].length;
                }
            }

            // Clean old sticky messages (older than 90 days)
            if (this.data.stickyMessages) {
                for (const channelId in this.data.stickyMessages) {
                    const sticky = this.data.stickyMessages[channelId];
                    if (sticky.createdAt < maxAge) {
                        delete this.data.stickyMessages[channelId];
                        cleaned++;
                    }
                }
            }

            if (cleaned > 0) {
                this.save();
                console.log(`✅ Cleaned ${cleaned} old data entries`);
            }

            return cleaned;
        } catch (error) {
            console.error('❌ Cleanup error:', error.message);
            return 0;
        }
    }

    async close() {
        console.log('✅ Database saved and closed');
        this.save();
    }

    // Alt account check methods
    async getSuspiciousAccounts(guildId, maxAgeDays = 7) {
        // This method would check for accounts created recently
        // In a real implementation, you'd want to track member accounts
        // For now, return an empty array
        return [];
    }

    // Additional economy helper methods
    async getAllProperties(guildId) {
        if (!this.data.properties) return [];
        
        const allProperties = [];
        for (const key in this.data.properties) {
            if (this.data.properties[key].guild_id === guildId) {
                allProperties.push(this.data.properties[key]);
            }
        }
        return allProperties.sort((a, b) => b.total_property_value - a.total_property_value);
    }

    async getAllJobs(guildId) {
        if (!this.data.jobs) return [];
        
        const allJobs = [];
        for (const key in this.data.jobs) {
            if (this.data.jobs[key].guild_id === guildId) {
                allJobs.push(this.data.jobs[key]);
            }
        }
        return allJobs;
    }

    async drawLottery(guildId, winningTicket) {
        if (!this.data.lottery) return null;
        
        const tickets = await this.getActiveLotteryTickets(guildId);
        const winner = tickets.find(ticket => ticket.ticket_number === winningTicket);
        
        if (winner) {
            const key = `lottery_${winner.user_id}_${guildId}`;
            if (this.data.lottery[key]) {
                this.data.lottery[key].drawn = true;
                this.data.lottery[key].won = true;
                this.data.lottery[key].drawn_at = Date.now();
            }
        }
        
        // Mark all tickets as drawn
        tickets.forEach(ticket => {
            const key = `lottery_${ticket.user_id}_${guildId}`;
            if (this.data.lottery[key] && !this.data.lottery[key].drawn) {
                this.data.lottery[key].drawn = true;
                this.data.lottery[key].won = false;
                this.data.lottery[key].drawn_at = Date.now();
            }
        });
        
        this.save();
        return winner;
    }

    // Lottery winner payout method
    async payoutLotteryWinner(guildId, winnerUserId, amount) {
        if (!winnerUserId || !amount) return false;
        
        try {
            const economy = await this.getUserEconomy(winnerUserId, guildId);
            economy.wallet += amount;
            await this.updateUserEconomy(winnerUserId, guildId, economy);
            
            // Add transaction record
            await this.addTransaction(winnerUserId, guildId, 'lottery_win', amount, {
                type: 'lottery_win'
            });
            
            return true;
        } catch (error) {
            console.error('Lottery payout error:', error);
            return false;
        }
    }
}

module.exports = Database;
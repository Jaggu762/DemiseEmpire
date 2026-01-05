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
            stickyMessages: {}, // Added for sticky messages
            tickets: {}, // Added for ticket system
            ticketSystems: {}, // Added for ticket system configurations
            ticketLogs: {}, // Added for ticket logs
            birthdays: {}, // Added for birthday system
            polls: {}, // Added for poll system
            suggestions: {} // Added for suggestion system
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
                prefix: '^',
                
                // Add both fields for join/leave notifications
                guild_join_channel: null,    // For bot join notifications
                guild_leave_channel: null,   // For bot leave notifications (NEW)

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
                birthday_channel: null,
                
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
                
                // ========== MUSIC ENHANCEMENTS ==========
                dj_mode_enabled: false,
                dj_mode_profile: 'default',
                
                // ========== TICKET SYSTEM ==========
                ticket_system_enabled: false,
                ticket_category: null,
                ticket_log_channel: null,
                ticket_support_role: null,
                ticket_panel_channel: null, // Added
                ticket_type: null, // 'support', 'staff', 'bug', 'reports'
                ticket_counter: 0, // Ticket counter for unique IDs
                
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
                total_tickets: 0, // Added
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

    // ========== TICKET SYSTEM METHODS ==========
    
    async createTicket(ticketData) {
        if (!this.data.tickets) this.data.tickets = {};
        
        const ticketId = `TICKET-${Date.now().toString().slice(-6)}`;
        const ticket = {
            id: ticketId,
            ...ticketData,
            status: 'open',
            created_at: Date.now(),
            updated_at: Date.now(),
            closed_at: null,
            transcript_id: null,
            participants: [ticketData.user_id],
            messages: []
        };
        
        this.data.tickets[ticketId] = ticket;
        
        // Increment guild ticket counter
        if (ticketData.guild_id) {
            const config = await this.getGuildConfig(ticketData.guild_id);
            config.total_tickets = (config.total_tickets || 0) + 1;
            config.ticket_counter = (config.ticket_counter || 0) + 1;
            await this.updateGuildConfig(ticketData.guild_id, {
                total_tickets: config.total_tickets,
                ticket_counter: config.ticket_counter
            });
        }
        
        this.save();
        return ticket;
    }

    async getTicket(ticketId) {
        if (!this.data.tickets) return null;
        return this.data.tickets[ticketId] || null;
    }

    async getTicketByChannel(channelId) {
        if (!this.data.tickets) return null;
        
        for (const ticketId in this.data.tickets) {
            const ticket = this.data.tickets[ticketId];
            if (ticket.channel_id === channelId) {
                return ticket;
            }
        }
        return null;
    }

    async getTicketByUserId(userId, guildId) {
        if (!this.data.tickets) return null;
        
        for (const ticketId in this.data.tickets) {
            const ticket = this.data.tickets[ticketId];
            if (ticket.user_id === userId && ticket.guild_id === guildId && ticket.status === 'open') {
                return ticket;
            }
        }
        return null;
    }

    async updateTicket(ticketId, updates) {
        if (!this.data.tickets || !this.data.tickets[ticketId]) return null;
        
        Object.assign(this.data.tickets[ticketId], updates);
        this.data.tickets[ticketId].updated_at = Date.now();
        this.save();
        return this.data.tickets[ticketId];
    }

    async closeTicket(ticketId, reason = 'Closed by user') {
        if (!this.data.tickets || !this.data.tickets[ticketId]) return null;
        
        const updates = {
            status: 'closed',
            closed_at: Date.now(),
            closed_by: 'system',
            close_reason: reason
        };
        
        return await this.updateTicket(ticketId, updates);
    }

    async deleteTicket(ticketId) {
        if (!this.data.tickets || !this.data.tickets[ticketId]) return false;
        
        delete this.data.tickets[ticketId];
        this.save();
        return true;
    }

    async getOpenTickets(guildId) {
        if (!this.data.tickets) return [];
        
        const openTickets = [];
        for (const ticketId in this.data.tickets) {
            const ticket = this.data.tickets[ticketId];
            if (ticket.guild_id === guildId && ticket.status === 'open') {
                openTickets.push(ticket);
            }
        }
        return openTickets;
    }

    async getClosedTickets(guildId) {
        if (!this.data.tickets) return [];
        
        const closedTickets = [];
        for (const ticketId in this.data.tickets) {
            const ticket = this.data.tickets[ticketId];
            if (ticket.guild_id === guildId && ticket.status === 'closed') {
                closedTickets.push(ticket);
            }
        }
        return closedTickets;
    }

    async getAllTickets(guildId) {
        if (!this.data.tickets) return [];
        
        const tickets = [];
        for (const ticketId in this.data.tickets) {
            const ticket = this.data.tickets[ticketId];
            if (ticket.guild_id === guildId) {
                tickets.push(ticket);
            }
        }
        return tickets;
    }

    async addParticipantToTicket(ticketId, userId) {
        if (!this.data.tickets || !this.data.tickets[ticketId]) return null;
        
        const ticket = this.data.tickets[ticketId];
        if (!ticket.participants.includes(userId)) {
            ticket.participants.push(userId);
            ticket.updated_at = Date.now();
            this.save();
        }
        return ticket;
    }

    async removeParticipantFromTicket(ticketId, userId) {
        if (!this.data.tickets || !this.data.tickets[ticketId]) return null;
        
        const ticket = this.data.tickets[ticketId];
        ticket.participants = ticket.participants.filter(id => id !== userId);
        ticket.updated_at = Date.now();
        this.save();
        return ticket;
    }

    async addMessageToTicket(ticketId, messageData) {
        if (!this.data.tickets || !this.data.tickets[ticketId]) return null;
        
        const ticket = this.data.tickets[ticketId];
        if (!ticket.messages) ticket.messages = [];
        
        const message = {
            id: messageData.id || Date.now().toString(),
            user_id: messageData.user_id,
            username: messageData.username,
            content: messageData.content,
            timestamp: messageData.timestamp || Date.now(),
            attachments: messageData.attachments || []
        };
        
        ticket.messages.push(message);
        ticket.updated_at = Date.now();
        this.save();
        return ticket;
    }

    async getTicketMessages(ticketId, limit = 100) {
        if (!this.data.tickets || !this.data.tickets[ticketId]) return [];
        
        const ticket = this.data.tickets[ticketId];
        if (!ticket.messages) return [];
        
        return ticket.messages.slice(-limit); // Get last N messages
    }

    async saveTicketTranscript(ticketId, transcriptData) {
        if (!this.data.tickets || !this.data.tickets[ticketId]) return null;
        
        const transcriptId = `TRANSCRIPT-${Date.now().toString().slice(-8)}`;
        const updates = {
            transcript_id: transcriptId,
            transcript_data: transcriptData,
            updated_at: Date.now()
        };
        
        return await this.updateTicket(ticketId, updates);
    }

    // ========== TICKET LOGGING METHODS ==========
    
    async saveTicketLog(logData) {
        try {
            if (!this.data.ticketLogs) {
                this.data.ticketLogs = {};
            }
            
            const logId = `TLOG-${Date.now().toString().slice(-8)}`;
            const guildId = logData.guildId;
            
            if (!this.data.ticketLogs[guildId]) {
                this.data.ticketLogs[guildId] = [];
            }
            
            const fullLogData = {
                id: logId,
                ...logData,
                logged_at: Date.now()
            };
            
            this.data.ticketLogs[guildId].push(fullLogData);
            
            // Keep only last 500 logs per guild to prevent bloating
            if (this.data.ticketLogs[guildId].length > 500) {
                this.data.ticketLogs[guildId] = this.data.ticketLogs[guildId].slice(-500);
            }
            
            this.save();
            return logId;
        } catch (error) {
            console.error('Save ticket log error:', error);
            return null;
        }
    }

    async getTicketLogs(guildId, limit = 10, offset = 0) {
        try {
            if (!this.data.ticketLogs || !this.data.ticketLogs[guildId]) {
                return [];
            }
            
            const logs = this.data.ticketLogs[guildId];
            
            // Sort by most recent first
            logs.sort((a, b) => new Date(b.logged_at || b.closedAt || 0) - new Date(a.logged_at || a.closedAt || 0));
            
            return logs.slice(offset, offset + limit);
        } catch (error) {
            console.error('Get ticket logs error:', error);
            return [];
        }
    }

    async getTicketLogCount(guildId) {
        try {
            if (!this.data.ticketLogs || !this.data.ticketLogs[guildId]) {
                return 0;
            }
            
            return this.data.ticketLogs[guildId].length;
        } catch (error) {
            console.error('Get ticket log count error:', error);
            return 0;
        }
    }

    async getTicketLogById(logId) {
        try {
            if (!this.data.ticketLogs) return null;
            
            for (const guildId in this.data.ticketLogs) {
                const log = this.data.ticketLogs[guildId].find(l => l.id === logId);
                if (log) return log;
            }
            return null;
        } catch (error) {
            console.error('Get ticket log by ID error:', error);
            return null;
        }
    }

    async searchTicketLogs(guildId, query = '', ticketType = '') {
        try {
            if (!this.data.ticketLogs || !this.data.ticketLogs[guildId]) {
                return [];
            }
            
            query = query.toLowerCase();
            let logs = this.data.ticketLogs[guildId];
            
            // Filter by ticket type if specified
            if (ticketType) {
                logs = logs.filter(log => 
                    log.ticketType && log.ticketType.toLowerCase() === ticketType.toLowerCase()
                );
            }
            
            // Filter by search query
            if (query) {
                logs = logs.filter(log => 
                    (log.userTag && log.userTag.toLowerCase().includes(query)) ||
                    (log.reason && log.reason.toLowerCase().includes(query)) ||
                    (log.ticketType && log.ticketType.toLowerCase().includes(query)) ||
                    (log.closedByTag && log.closedByTag.toLowerCase().includes(query))
                );
            }
            
            // Sort by most recent first
            logs.sort((a, b) => new Date(b.logged_at || b.closedAt || 0) - new Date(a.logged_at || a.closedAt || 0));
            
            return logs;
        } catch (error) {
            console.error('Search ticket logs error:', error);
            return [];
        }
    }

    async getTicketStatistics(guildId) {
        try {
            if (!this.data.ticketLogs || !this.data.ticketLogs[guildId]) {
                return {
                    total: 0,
                    byType: {},
                    byCloser: {},
                    recentCounts: []
                };
            }
            
            const logs = this.data.ticketLogs[guildId];
            const stats = {
                total: logs.length,
                byType: {},
                byCloser: {},
                recentCounts: []
            };
            
            // Count by ticket type
            for (const log of logs) {
                const type = log.ticketType || 'Unknown';
                stats.byType[type] = (stats.byType[type] || 0) + 1;
                
                // Count by closer
                if (log.closedByTag) {
                    stats.byCloser[log.closedByTag] = (stats.byCloser[log.closedByTag] || 0) + 1;
                }
            }
            
            // Get counts for last 7 days
            const now = Date.now();
            for (let i = 6; i >= 0; i--) {
                const dayStart = new Date(now - i * 24 * 60 * 60 * 1000);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
                
                const dayLogs = logs.filter(log => {
                    const logTime = log.logged_at || log.closedAt || 0;
                    return logTime >= dayStart.getTime() && logTime < dayEnd.getTime();
                });
                
                stats.recentCounts.push({
                    date: dayStart.toISOString().split('T')[0],
                    count: dayLogs.length
                });
            }
            
            return stats;
        } catch (error) {
            console.error('Get ticket statistics error:', error);
            return {
                total: 0,
                byType: {},
                byCloser: {},
                recentCounts: []
            };
        }
    }

    async deleteOldTicketLogs(guildId, maxAgeDays = 30) {
        try {
            if (!this.data.ticketLogs || !this.data.ticketLogs[guildId]) {
                return 0;
            }
            
            const maxAge = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
            const oldLogs = this.data.ticketLogs[guildId].filter(log => 
                (log.logged_at || log.closedAt || 0) < maxAge
            );
            
            const deletedCount = oldLogs.length;
            this.data.ticketLogs[guildId] = this.data.ticketLogs[guildId].filter(log => 
                (log.logged_at || log.closedAt || 0) >= maxAge
            );
            
            if (deletedCount > 0) {
                this.save();
            }
            
            return deletedCount;
        } catch (error) {
            console.error('Delete old ticket logs error:', error);
            return 0;
        }
    }

    // ========== TICKET SYSTEM CONFIGURATION METHODS ==========
    
    async getTicketSystem(guildId, systemType) {
        if (!this.data.ticketSystems) this.data.ticketSystems = {};
        
        const key = `${guildId}_${systemType}`;
        if (!this.data.ticketSystems[key]) {
            this.data.ticketSystems[key] = {
                guild_id: guildId,
                type: systemType,
                enabled: false,
                category_id: null,
                panel_channel_id: null,
                support_role_id: null,
                log_channel_id: null,
                welcome_message: getDefaultWelcomeMessage(systemType),
                button_label: getDefaultButtonLabel(systemType),
                button_emoji: getDefaultButtonEmoji(systemType),
                button_color: getDefaultButtonColor(systemType),
                created_at: Date.now(),
                updated_at: Date.now()
            };
            this.save();
        }
        return this.data.ticketSystems[key];
    }

    async updateTicketSystem(guildId, systemType, updates) {
        const system = await this.getTicketSystem(guildId, systemType);
        Object.assign(system, updates);
        system.updated_at = Date.now();
        
        const key = `${guildId}_${systemType}`;
        this.data.ticketSystems[key] = system;
        this.save();
        return system;
    }

    async deleteTicketSystem(guildId, systemType) {
        const key = `${guildId}_${systemType}`;
        if (this.data.ticketSystems && this.data.ticketSystems[key]) {
            delete this.data.ticketSystems[key];
            this.save();
            return true;
        }
        return false;
    }

    async getAllTicketSystems(guildId) {
        if (!this.data.ticketSystems) return [];
        
        const systems = [];
        for (const key in this.data.ticketSystems) {
            if (key.startsWith(`${guildId}_`)) {
                systems.push(this.data.ticketSystems[key]);
            }
        }
        return systems;
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

            // Clean closed tickets older than 30 days
            if (this.data.tickets) {
                for (const ticketId in this.data.tickets) {
                    const ticket = this.data.tickets[ticketId];
                    if (ticket.status === 'closed' && ticket.closed_at && ticket.closed_at < maxAge) {
                        delete this.data.tickets[ticketId];
                        cleaned++;
                    }
                }
            }

            // Clean old ticket logs (older than 90 days)
            if (this.data.ticketLogs) {
                for (const guildId in this.data.ticketLogs) {
                    const oldCount = this.data.ticketLogs[guildId].length;
                    this.data.ticketLogs[guildId] = this.data.ticketLogs[guildId].filter(log => 
                        (log.logged_at || log.closedAt || 0) > maxAge
                    );
                    cleaned += (oldCount - this.data.ticketLogs[guildId].length);
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

    // ========== STATISTICS METHODS ==========
    async getTicketStatistics(guildId) {
        const allTickets = await this.getAllTickets(guildId);
        const openTickets = await this.getOpenTickets(guildId);
        const closedTickets = await this.getClosedTickets(guildId);
        
        return {
            total: allTickets.length,
            open: openTickets.length,
            closed: closedTickets.length,
            by_type: this.getTicketCountByType(allTickets),
            by_status: this.getTicketCountByStatus(allTickets)
        };
    }

    getTicketCountByType(tickets) {
        const count = {};
        tickets.forEach(ticket => {
            count[ticket.type] = (count[ticket.type] || 0) + 1;
        });
        return count;
    }

    getTicketCountByStatus(tickets) {
        const count = {};
        tickets.forEach(ticket => {
            count[ticket.status] = (count[ticket.status] || 0) + 1;
        });
        return count;
    }

    // ========== SEARCH METHODS ==========
    async searchTickets(guildId, query) {
        if (!this.data.tickets) return [];
        
        const results = [];
        query = query.toLowerCase();
        
        for (const ticketId in this.data.tickets) {
            const ticket = this.data.tickets[ticketId];
            if (ticket.guild_id !== guildId) continue;
            
            // Search in various fields
            if (
                ticket.id.toLowerCase().includes(query) ||
                (ticket.user_name && ticket.user_name.toLowerCase().includes(query)) ||
                (ticket.reason && ticket.reason.toLowerCase().includes(query)) ||
                (ticket.type && ticket.type.toLowerCase().includes(query))
            ) {
                results.push(ticket);
            }
        }
        
        return results;
    }

    async getUserTickets(userId, guildId) {
        if (!this.data.tickets) return [];
        
        const userTickets = [];
        for (const ticketId in this.data.tickets) {
            const ticket = this.data.tickets[ticketId];
            if (ticket.user_id === userId && ticket.guild_id === guildId) {
                userTickets.push(ticket);
            }
        }
        
        return userTickets;
    }

    // ========== BIRTHDAY METHODS ==========
    async getUserBirthday(userId, guildId) {
        const key = `${userId}_${guildId}`;
        if (!this.data.birthdays) this.data.birthdays = {};
        return this.data.birthdays[key] || null;
    }

    async setUserBirthday(userId, guildId, birthdayData) {
        const key = `${userId}_${guildId}`;
        if (!this.data.birthdays) this.data.birthdays = {};
        
        this.data.birthdays[key] = {
            userId: userId,
            guildId: guildId,
            ...birthdayData
        };
        this.save();
        return this.data.birthdays[key];
    }

    async removeUserBirthday(userId, guildId) {
        const key = `${userId}_${guildId}`;
        if (!this.data.birthdays) return false;
        
        if (this.data.birthdays[key]) {
            delete this.data.birthdays[key];
            this.save();
            return true;
        }
        return false;
    }

    async getAllBirthdays(guildId) {
        if (!this.data.birthdays) return [];
        
        const birthdays = [];
        for (const key in this.data.birthdays) {
            const bday = this.data.birthdays[key];
            if (bday.guildId === guildId) {
                birthdays.push(bday);
            }
        }
        return birthdays;
    }

    async getTodayBirthdays(guildId) {
        if (!this.data.birthdays) return [];
        
        const now = new Date();
        const today = {
            day: now.getDate(),
            month: now.getMonth() + 1
        };
        
        const birthdays = [];
        for (const key in this.data.birthdays) {
            const bday = this.data.birthdays[key];
            if (bday.guildId === guildId && bday.day === today.day && bday.month === today.month) {
                birthdays.push(bday);
            }
        }
        return birthdays;
    }
}

// ========== HELPER FUNCTIONS ==========

function getDefaultWelcomeMessage(systemType) {
    const messages = {
        support: 'Hello {user}, thank you for creating a support ticket. Our team will assist you shortly. Please describe your issue in detail.',
        staff: 'Hello {user}, thank you for applying for staff! Please fill out the application form below.',
        bug: 'Hello {user}, thank you for reporting a bug. Please describe the issue, steps to reproduce, and what you expected to happen.',
        reports: 'Hello {user}, thank you for your report. Please provide details about the user and evidence of the issue.'
    };
    return messages[systemType] || 'Thank you for creating a ticket. Our team will assist you shortly.';
}

function getDefaultButtonLabel(systemType) {
    const labels = {
        support: 'Open Support Ticket',
        staff: 'Apply for Staff',
        bug: 'Report a Bug',
        reports: 'Report a User'
    };
    return labels[systemType] || 'Create Ticket';
}

function getDefaultButtonEmoji(systemType) {
    const emojis = {
        support: '🎫',
        staff: '👥',
        bug: '🐛',
        reports: '🚨'
    };
    return emojis[systemType] || '📝';
}

function getDefaultButtonColor(systemType) {
    const colors = {
        support: '#0061ff', // Blue
        staff: '#ff9900',   // Orange
        bug: '#ff0000',     // Red
        reports: '#9900ff'  // Purple
    };
    return colors[systemType] || '#0099ff';
}

// Export the Database class
module.exports = Database;
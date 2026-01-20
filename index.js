const { Client, Collection, GatewayIntentBits, ActivityType, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ========== LOAD ENVIRONMENT VARIABLES ==========
require('dotenv').config();

// Load config
const config = require('./config.json');

// Override sensitive config values with environment variables
if (process.env.BOT_TOKEN) {
    config.bot.token = process.env.BOT_TOKEN;
}
if (process.env.SPOTIFY_CLIENT_ID) {
    config.music.spotify.clientId = process.env.SPOTIFY_CLIENT_ID;
}
if (process.env.SPOTIFY_CLIENT_SECRET) {
    config.music.spotify.clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
}

// Import LoggingSystem
const LoggingSystem = require('./utils/LoggingSystem');

// Import Sticky Handler
const stickyHandler = require('./events/stickyHandler');

// Create client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildInvites,
    ]
});

// Collections
client.commands = new Collection();
client.aliases = new Collection();
client.snipes = new Map(); // For deleted messages
client.editSnipes = new Map(); // For edited messages
client.cooldowns = new Collection();
client.inviteCache = new Map(); // Store: guildId -> Map(inviteCode -> inviteData)
client.inviteTrackers = new Map(); // Store: guildId -> Map(userId -> inviteCount)

// Initialize TTS cache
client.ttsCache = new Map();

// In your main bot file where you create client.botInfo
client.botInfo = {
    name: config.bot.name,
    version: config.bot.version,
    creator: "Jaggu762",
    prefix: config.bot.prefix,
    ownerId: config.bot.ownerId, // Add this line
    admins: config.bot.admins,   // Also add admins if you want multiple admin users
    embedColor: config.bot.embedColor, // Add this for consistency
    startedAt: Date.now()
};

// Create necessary directories
function setupDirectories() {
    const dirs = ['data', 'commands', 'events', 'utils'];
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Created directory: ${dir}`);
        }
    });
}

// ========== LOAD EVENTS ==========
function loadEvents() {
    const eventsPath = path.join(__dirname, 'events');
    
    // Check if events directory exists
    if (!fs.existsSync(eventsPath)) {
        console.log('Events directory not found, creating...');
        fs.mkdirSync(eventsPath, { recursive: true });
        console.log('✅ Created events directory');
    }
    
    // Load all event categories
    const eventCategories = fs.readdirSync(eventsPath).filter(cat => 
        fs.statSync(path.join(eventsPath, cat)).isDirectory()
    );
    
    console.log(`Found ${eventCategories.length} event categories`);
    
    eventCategories.forEach(category => {
        const categoryPath = path.join(eventsPath, category);
        const eventFiles = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));
        
        console.log(`Loading ${eventFiles.length} events from ${category}`);
        
        eventFiles.forEach(file => {
            try {
                const eventPath = path.join(categoryPath, file);
                delete require.cache[require.resolve(eventPath)];
                const event = require(eventPath);
                
                if (event.name) {
                    // Register the event with client
                    if (event.once) {
                        client.once(event.name, async (...args) => {
                            try {
                                await event.execute(...args, client, client.db);
                            } catch (error) {
                                console.error(`Error in ${event.name} event:`, error);
                            }
                        });
                    } else {
                        client.on(event.name, async (...args) => {
                            try {
                                await event.execute(...args, client, client.db);
                            } catch (error) {
                                console.error(`Error in ${event.name} event:`, error);
                            }
                        });
                    }
                    
                    console.log(`✅ Loaded event: ${event.name} from ${category}/${file}`);
                }
            } catch (error) {
                console.error(`❌ Failed to load event ${file}:`, error.message);
            }
        });
    });
}

// Load commands
function loadCommands() {
    const commandsPath = path.join(__dirname, 'commands');
    
    // Check if commands directory exists
    if (!fs.existsSync(commandsPath)) {
        console.log('Commands directory not found, creating...');
        setupDirectories();
        return;
    }
    
    // Load all command categories
    const categories = fs.readdirSync(commandsPath).filter(cat => 
        fs.statSync(path.join(commandsPath, cat)).isDirectory()
    );
    
    console.log(`Found ${categories.length} command categories`);
    
    categories.forEach(category => {
        const categoryPath = path.join(commandsPath, category);
        const commandFiles = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));
        
        console.log(`Loading ${commandFiles.length} commands from ${category}`);
        
        commandFiles.forEach(file => {
            try {
                const commandPath = path.join(categoryPath, file);
                delete require.cache[require.resolve(commandPath)];
                const command = require(commandPath);
                
                if (command.name) {
                    client.commands.set(command.name, command);
                    
                    if (command.aliases && Array.isArray(command.aliases)) {
                        command.aliases.forEach(alias => {
                            client.aliases.set(alias, command.name);
                        });
                    }
                    
                    console.log(`✅ Loaded command: ${command.name} from ${category}/${file}`);
                }
            } catch (error) {
                console.error(`❌ Failed to load command ${file}:`, error.message);
            }
        });
    });
}

// ========== LOAD SPECIFIC MUSIC COMMANDS MANUALLY ==========
function loadMusicCommands() {
    console.log('🎵 Loading music commands...');
    
    const musicCommands = [
        'music', 'play', 'pause', 'resume', 'queue', 
        'skip', 'stop', 'volume', 'nowplaying'
    ];
    
    // Check if music commands directory exists
    const musicCommandsPath = path.join(__dirname, 'commands', 'music');
    if (!fs.existsSync(musicCommandsPath)) {
        console.error('❌ Music commands directory not found!');
        console.log('Creating music commands directory...');
        fs.mkdirSync(musicCommandsPath, { recursive: true });
        console.log('✅ Created music commands directory');
        return;
    }
    
    let loadedCount = 0;
    for (const cmd of musicCommands) {
        try {
            const commandPath = path.join(musicCommandsPath, `${cmd}.js`);
            
            // Check if file exists
            if (!fs.existsSync(commandPath)) {
                console.log(`⚠️  Music command file not found: ${cmd}.js`);
                console.log(`Creating template for: ${cmd}.js`);
                
                // Create a basic template for missing command
                const template = `const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: '${cmd}',
    description: '${cmd.charAt(0).toUpperCase() + cmd.slice(1)} command',
    aliases: [],
    category: 'music',
    
    async execute(message, args, client, db) {
        try {
            message.reply('🎵 This command is under development!');
        } catch (error) {
            console.error('${cmd} command error:', error);
            message.reply('❌ An error occurred.');
        }
    }
};`;
                
                fs.writeFileSync(commandPath, template);
                console.log(`✅ Created template for ${cmd}.js`);
            }
            
            delete require.cache[require.resolve(commandPath)];
            const command = require(commandPath);
            
            if (command.name) {
                client.commands.set(command.name, command);
                
                // Register aliases
                if (command.aliases && Array.isArray(command.aliases)) {
                    command.aliases.forEach(alias => {
                        client.aliases.set(alias, command.name);
                    });
                }
                
                console.log(`✅ Loaded music command: ${command.name}`);
                loadedCount++;
            }
        } catch (error) {
            console.error(`❌ Failed to load music command ${cmd}:`, error.message);
        }
    }
    
    console.log(`🎵 Music commands loaded: ${loadedCount}/${musicCommands.length}`);
}

// ========== XP SYSTEM HELPER FUNCTIONS ==========

// Calculate XP for a given level
function calculateXPForLevel(level) {
    return Math.floor(Math.pow(level, 2) * 100);
}

// Calculate level from XP
function calculateLevelFromXP(xp) {
    const level = Math.floor(Math.sqrt(xp / 100));
    return Math.max(1, level); // Ensure at least level 1
}

// ========== INVITE TRACKING FUNCTIONS ==========
async function initializeInviteTracking(guild) {
    try {
        if (!guild) return;
        
        // Ensure guild.me is available
        if (!guild.members.me) {
            await guild.members.fetch(client.user.id).catch(() => null);
        }
        
        // Check if bot has permission
        if (!guild.members.me || !guild.members.me.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return;
        }
        
        const invites = await guild.invites.fetch();
        const inviteMap = new Map();
        
        invites.forEach(invite => {
            inviteMap.set(invite.code, {
                code: invite.code,
                inviter: invite.inviter,
                uses: invite.uses,
                maxUses: invite.maxUses,
                expiresAt: invite.expiresAt,
                channel: invite.channel
            });
        });
        
        client.inviteCache.set(guild.id, inviteMap);
        console.log(`[Invite Tracking] Initialized for ${guild.name} - ${inviteMap.size} invites`);
    } catch (error) {
        console.error(`[Invite Tracking] Failed for ${guild.name}:`, error.message);
    }
}

// Function to track which invite was used
async function trackInviteUsage(guild, member) {
    try {
        const oldInvites = client.inviteCache.get(guild.id);
        if (!oldInvites) {
            await initializeInviteTracking(guild);
            return null;
        }
        
        const newInvites = await guild.invites.fetch();
        let usedInvite = null;
        
        // Find which invite was used by comparing use counts
        for (const [code, newInvite] of newInvites) {
            const oldInvite = oldInvites.get(code);
            if (oldInvite && newInvite.uses > oldInvite.uses) {
                usedInvite = newInvite;
                break;
            }
        }
        
        // Update cache with new invite data
        const updatedInviteMap = new Map();
        newInvites.forEach(invite => {
            updatedInviteMap.set(invite.code, {
                code: invite.code,
                inviter: invite.inviter,
                uses: invite.uses,
                maxUses: invite.maxUses,
                expiresAt: invite.expiresAt,
                channel: invite.channel
            });
        });
        client.inviteCache.set(guild.id, updatedInviteMap);
        
        return usedInvite;
    } catch (error) {
        console.error('Track invite usage error:', error);
        return null;
    }
}

// Function to update invite count for a user
async function updateInviteCount(guildId, userId, usedInvite) {
    try {
        if (!usedInvite || !usedInvite.inviter) return;
        
        const inviterId = usedInvite.inviter.id;
        
        // Update in-memory tracker
        let guildTrackers = client.inviteTrackers.get(guildId);
        if (!guildTrackers) {
            guildTrackers = new Map();
            client.inviteTrackers.set(guildId, guildTrackers);
        }
        
        const currentCount = guildTrackers.get(inviterId) || 0;
        guildTrackers.set(inviterId, currentCount + 1);
        
        // Update database if available
        if (client.db && client.db.updateInviteCount) {
            await client.db.updateInviteCount(guildId, inviterId, currentCount + 1);
        }
        
        console.log(`[Invite] ${inviterId} now has ${currentCount + 1} invites in guild ${guildId}`);
        
        return currentCount + 1;
    } catch (error) {
        console.error('Update invite count error:', error);
        return 0;
    }
}

// Function to get invite stats for a user
async function getInviteStats(guildId, userId) {
    try {
        // Check in-memory tracker first
        const guildTrackers = client.inviteTrackers.get(guildId);
        if (guildTrackers) {
            const count = guildTrackers.get(userId);
            if (count !== undefined) {
                return count;
            }
        }
        
        // Check database if available
        if (client.db && client.db.getInviteStats) {
            const stats = await client.db.getInviteStats(guildId, userId);
            return stats?.invite_count || 0;
        }
        
        return 0;
    } catch (error) {
        console.error('Get invite stats error:', error);
        return 0;
    }
}

// ========== LINK PROTECTION FUNCTIONS ==========
async function checkLinks(message) {
    try {
        // Use the normal fs import from the top of the file
        const path = require('path');
        
        // Load link config
        const linkConfigFile = path.join(__dirname, 'data', 'link-channels.json');
        
        // Check if file exists using the global fs
        if (!fs.existsSync(linkConfigFile)) {
            // Create default empty config
            const defaultConfig = {};
            await fs.promises.writeFile(linkConfigFile, JSON.stringify(defaultConfig, null, 2));
            return false; // No config, allow all links
        }
        
        const configData = await fs.promises.readFile(linkConfigFile, 'utf8');
        const config = JSON.parse(configData);
        const guildId = message.guild.id;
        
        // If no config for guild or disabled, allow all links
        if (!config[guildId] || config[guildId].enabled === false) {
            return false;
        }
        
        const settings = config[guildId];
        
        // Check if user is exempt (bot, admin, exempt role/user)
        if (message.author.bot) return false;
        if (message.member.permissions.has(PermissionFlagsBits.Administrator)) return false;
        if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return false;
        
        // Check exempt roles
        if (settings.exemptRoles) {
            for (const roleId of settings.exemptRoles) {
                if (message.member.roles.cache.has(roleId)) return false;
            }
        }
        
        // Check exempt users
        if (settings.exemptUsers && settings.exemptUsers.includes(message.author.id)) {
            return false;
        }
        
        // Check if channel is allowed
        if (settings.channels && settings.channels.includes(message.channel.id)) {
            return false;
        }
        
        // Check for links in message
        const urlRegex = /https?:\/\/[^\s]+|www\.[^\s]+|discord\.(gg|com\/invite)\/[^\s]+/gi;
        const hasLink = urlRegex.test(message.content);
        
        if (hasLink) {
            console.log(`[Link Protection] Deleting link from ${message.author.tag} in ${message.channel.name}`);
            return {
                found: true,
                reason: 'Link detected',
                action: 'delete'
            };
        }
        
        return false;
        
    } catch (error) {
        console.error('Link protection check error:', error);
        return false;
    }
}

async function awardMessageXP(message, client, db) {
    try {
        // Skip if no database or message is from bot
        if (!db || message.author.bot || !message.guild) return;
        
        const userId = message.author.id;
        const guildId = message.guild.id;
        
        // Get guild config to check if leveling is enabled
        const config = await db.getGuildConfig(guildId);
        if (!config?.leveling_enabled) return;
        
        // Get user's economy data
        const economy = await db.getUserEconomy(userId, guildId);
        
        // Always update message count
        const currentMessages = economy?.messages || 0;
        const currentXP = economy?.xp || 0;
        const currentLevel = economy?.level || 1;
        
        // Check cooldown (1 minute)
        const now = Date.now();
        const lastMessageTime = economy?.last_message_xp || 0;
        const cooldown = config.xp_cooldown || 60000; // Default 1 minute
        
        // Initialize updates object
        const updates = {
            messages: currentMessages + 1,
            updated_at: now
        };
        
        // Award XP if cooldown has passed
        if (now - lastMessageTime >= cooldown) {
            const xpPerMessage = config.xp_per_message || 15;
            const multiplier = config.level_multiplier || 1.0;
            const xpToAward = Math.floor(xpPerMessage * multiplier);
            
            const newXP = currentXP + xpToAward;
            const newLevel = calculateLevelFromXP(newXP);
            
            // Add XP and update cooldown
            updates.xp = newXP;
            updates.last_message_xp = now;
            
            console.log(`[XP] Awarded ${xpToAward} XP to ${message.author.tag}. Total: ${newXP} XP, Level: ${newLevel}`);
            
            // Check for level up
            if (newLevel > currentLevel) {
                updates.level = newLevel;
                
                console.log(`[LEVEL UP] ${message.author.tag} reached level ${newLevel}!`);
                
                // Announce level up
                try {
                    const levelCommand = require('./commands/levels/level.js');
                    if (levelCommand.checkLevelRewards) {
                        await levelCommand.checkLevelRewards(guildId, message.author, newLevel, client, db, message);
                    }
                } catch (error) {
                    console.error('Failed to announce level up:', error.message);
                }
            }
        }
        
        // Update database with all changes at once
        await db.updateUserEconomy(userId, guildId, updates);
        
    } catch (error) {
        console.error('Award message XP error:', error);
    }
}

// ========== VOICE XP TRACKING FUNCTIONS ==========

// Store voice start times
const voiceStartTimes = new Map(); // Format: userId_guildId -> startTime

// Award XP for voice time
async function awardVoiceXP(member, startTime, endTime, client, db) {
    try {
        const userId = member.id;
        const guildId = member.guild.id;

        // Calculate time spent in voice (in minutes)
        const timeSpentMs = endTime - startTime;
        const timeSpentMinutes = Math.floor(timeSpentMs / 60000);

        if (timeSpentMinutes < 1) return; // Less than 1 minute, no XP

        // Get guild config
        const config = await db.getGuildConfig(guildId);
        if (!config?.leveling_enabled) return;
        
        const xpPerMinute = 5; // Default 5 XP per minute
        const maxDailyMinutes = 60; // Max 60 minutes per day

        // Get user's economy
        const economy = await db.getUserEconomy(userId, guildId);

        const xpToAward = timeSpentMinutes * xpPerMinute;

        if (xpToAward > 0) {
            const currentXP = economy?.xp || 0;
            const currentLevel = economy?.level || 1;
            const newXP = currentXP + xpToAward;
            const newLevel = calculateLevelFromXP(newXP);

            // Update user's economy
            await db.updateUserEconomy(userId, guildId, {
                xp: newXP,
                voice_time: (economy?.voice_time || 0) + timeSpentMs,
                updated_at: Date.now()
            });

            // If level increased
            if (newLevel > currentLevel) {
                await db.updateUserEconomy(userId, guildId, {
                    level: newLevel
                });

                // Get level command module
                try {
                    const levelCommand = require('./commands/levels/level.js');
                    if (levelCommand.checkLevelRewards) {
                        await levelCommand.checkLevelRewards(guildId, member.user, newLevel, client, db);
                    }
                } catch (error) {
                    console.error('Failed to load level command for voice rewards:', error.message);
                }
            }

            console.log(`[Voice XP] Awarded ${xpToAward} XP to ${member.user.tag} for ${timeSpentMinutes} minutes in voice`);
        }

    } catch (error) {
        console.error('Award voice XP error:', error);
    }
}

// Track voice activity and award XP
async function trackVoiceActivity(oldState, newState, client, db) {
    try {
        // Skip if no database
        if (!db) return;

        const member = newState.member || oldState.member;
        if (!member || member.user.bot) return;

        const userId = member.id;
        const guildId = member.guild.id;
        const now = Date.now();

        // Get guild config
        const config = await db.getGuildConfig(guildId);
        if (!config?.leveling_enabled) return;

        // Key for storing in map
        const voiceKey = `${userId}_${guildId}`;

        // User joined a voice channel
        if (!oldState.channelId && newState.channelId) {
            voiceStartTimes.set(voiceKey, now);
            console.log(`[Voice] ${member.user.tag} joined ${newState.channel.name} in ${member.guild.name}`);
        }
        // User left a voice channel
        else if (oldState.channelId && !newState.channelId) {
            const startTime = voiceStartTimes.get(voiceKey);
            if (startTime) {
                await awardVoiceXP(member, startTime, now, client, db);
                voiceStartTimes.delete(voiceKey);
                console.log(`[Voice] ${member.user.tag} left voice in ${member.guild.name}`);
            }
        }
        // User switched voice channels
        else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            const startTime = voiceStartTimes.get(voiceKey);
            if (startTime) {
                await awardVoiceXP(member, startTime, now, client, db);
            }
            // Start new timer for new channel
            voiceStartTimes.set(voiceKey, now);
            console.log(`[Voice] ${member.user.tag} moved to ${newState.channel.name} in ${member.guild.name}`);
        }

    } catch (error) {
        console.error('Voice tracking error:', error);
    }
}

// ========== MESSAGE CREATE HANDLER ==========
client.on('messageCreate', async (message) => {
    // Ignore bots and DMs
    if (message.author.bot || !message.guild) return;
    
    // ========== LINK PROTECTION CHECK ==========
    try {
        const linkCheck = await checkLinks(message);
        if (linkCheck && linkCheck.found) {
            try {
                // Delete the message
                await message.delete();
                
                // Send warning to user
                const warningMsg = await message.channel.send(`${message.author}, Links are not allowed in this channel! Use \`^mod linkchannel list\` to see allowed channels.`);
                
                // Delete warning after 5 seconds
                setTimeout(() => warningMsg.delete().catch(() => {}), 5000);
                return; // Stop processing this message
                
            } catch (error) {
                console.error('Failed to delete link message:', error);
            }
        }
    } catch (error) {
        console.error('Link protection check error:', error);
    }
    
    // ========== AUTO-MOD BAD WORDS CHECK ==========
    try {
        // Check if moderation module exists
        let modModule;
        try {
            modModule = require('./commands/moderation/mod.js');
        } catch (error) {
            // Mod module not loaded yet, skip check
            console.log('[Auto-Mod] Module not loaded yet, skipping check');
            modModule = null;
        }
        
        // Only check if module is loaded and user doesn't have Manage Messages permission
        if (modModule && modModule.checkBadWords && 
            !message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            
            const result = await modModule.checkBadWords(message);
            
            if (result && result.found) {
                // Delete the message
                await message.delete().catch(() => {});
                
                // Send warning to user
                try {
                    const warnEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('🚫 Message Removed')
                        .setDescription('Your message contained inappropriate content.')
                        .addFields(
                            { name: 'Bad Word', value: `\`${result.word}\``, inline: true },
                            { name: 'Action', value: 'Message Deleted', inline: true }
                        )
                        .setFooter({ text: 'Please follow server rules' });
                    
                    await message.author.send({ embeds: [warnEmbed] }).catch(() => {
                        // If can't DM, send ephemeral message in channel
                        if (message.channel.permissionsFor(client.user).has('SendMessages')) {
                            message.channel.send({
                                content: `${message.author}, your message was removed for containing inappropriate content.`,
                                flags: 64 // Ephemeral
                            }).catch(() => {});
                        }
                    });
                    
                    console.log(`[Auto-Mod] Deleted message from ${message.author.tag}: ${message.content.substring(0, 50)}...`);
                    return; // Stop processing this message
                    
                } catch (error) {
                    console.error('Auto-mod warning error:', error);
                }
            }
        }
    } catch (error) {
        console.error('Auto-mod check error:', error);
    }
    
    // ========== AWARD XP FOR MESSAGES ==========
    await awardMessageXP(message, client, client.db);
    
    // ========== ADDED: Handle sticky messages ==========
    if (client.db && stickyHandler) {
        await stickyHandler.handleMessageCreate(message, client, client.db);
    }
    
    // ========== MUSIC CHANNEL AUTOCOMMANDS (no prefix) ==========
    try {
        // Ensure DB is initialized (safety)
        if (!client.db) {
            const Database = require('./utils/database');
            const dbInstance = new Database();
            client.db = await dbInstance.initialize();
        }

        const cfg = await client.db.getGuildConfig(message.guild.id);
        if (cfg && cfg.music_channel && message.channel.id === cfg.music_channel) {
            const raw = message.content.trim();
            const tokens = raw.split(/\s+/);
            const first = (tokens[0] || '').toLowerCase();
            const restArgs = tokens.slice(1);

            const commandMap = {
                play: 'play', p: 'play',
                pause: 'pause',
                resume: 'resume',
                skip: 'skip', s: 'skip',
                stop: 'stop', st: 'stop',
                queue: 'queue', q: 'queue',
                nowplaying: 'nowplaying', np: 'nowplaying', now: 'nowplaying', current: 'nowplaying',
                volume: 'volume', vol: 'volume',
                shuffle: 'shuffle', random: 'shuffle', mix: 'shuffle',
                loop: 'loop', repeat: 'loop',
                search: 'smartsearch', find: 'smartsearch', lookup: 'smartsearch'
            };

            let target = commandMap[first];
            if (target) {
                const cmd = client.commands.get(target) ||
                            client.commands.get(client.aliases.get(target));
                if (cmd) {
                    // Basic arg validation for specific commands
                    if (target === 'play' && restArgs.length === 0) {
                        await message.reply('❌ Please provide a song name or URL!');
                        return;
                    }
                    if (target === 'volume') {
                        const val = restArgs[0];
                        const num = Number(val);
                        if (!val || Number.isNaN(num)) {
                            await message.reply('❌ Please provide a volume number (e.g., `volume 50`).');
                            return;
                        }
                    }
                    try {
                        await cmd.execute(message, restArgs, client, client.db);
                        return; // handled; skip prefix command flow
                    } catch (err) {
                        console.error(`Autoplay handler error (${target}):`, err);
                    }
                }
            }

            // If not matched directly, try AI interpreter for natural language intents
            try {
                const { interpret } = require('./utils/aiMusicInterpreter');
                const result = await interpret(raw, cfg);
                if (result && result.action) {
                    target = result.action;
                    const args = result.args || [];
                    const cmd = client.commands.get(target) ||
                                client.commands.get(client.aliases.get(target));
                    if (cmd) {
                        // Basic arg validation for volume & play
                        if (target === 'play' && args.length === 0) {
                            await message.reply('❌ Please provide a song name or URL!');
                            return;
                        }
                        if (target === 'volume') {
                            const val = args[0];
                            const num = Number(val);
                            if (!val || Number.isNaN(num)) {
                                await message.reply('❌ Please provide a valid volume (0-100).');
                                return;
                            }
                        }
                        await cmd.execute(message, args, client, client.db);
                        return;
                    }
                }
            } catch (aiErr) {
                console.error('AI interpreter error:', aiErr);
            }
        }
    } catch (err) {
        console.error('Music channel autocommands error:', err);
    }

    // ========== COMMAND HANDLER ==========
    const prefix = client.botInfo.prefix;
    if (!message.content.startsWith(prefix)) return;
    
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    
    const command = client.commands.get(commandName) || 
                   client.commands.get(client.aliases.get(commandName));
    
    if (!command) return;
    
    try {
        // Initialize database if needed
        if (!client.db) {
            const Database = require('./utils/database');
            const dbInstance = new Database();
            client.db = await dbInstance.initialize();
        }
        
        // Execute command with database
        await command.execute(message, args, client, client.db);
    } catch (error) {
        console.error('Command error:', error);
        
        // Try without database for fallback
        try {
            await command.execute(message, args, client, null);
        } catch (error2) {
            message.reply('❌ An error occurred while executing the command.').catch(() => {});
        }
    }
});

// ========== FALLBACK TICKET HANDLER (if ticket command not loaded properly) ==========
async function handleTicketFallback(interaction, client, db) {
    try {
        if (interaction.customId === 'open_support_ticket') {
            await interaction.deferReply({ flags: 64 });
            
            const guild = interaction.guild;
            const user = interaction.user;
            
            // Find or create category
            let category = guild.channels.cache.find(
                c => c.type === ChannelType.GuildCategory && 
                c.name.toLowerCase().includes('tickets')
            );
            
            if (!category) {
                category = await guild.channels.create({
                    name: '🎫 Tickets',
                    type: ChannelType.GuildCategory,
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone.id,
                            deny: [PermissionFlagsBits.ViewChannel]
                        }
                    ]
                });
            }
            
            // Create ticket channel
            const ticketNumber = Date.now().toString().slice(-6);
            const ticketChannel = await guild.channels.create({
                name: `ticket-${user.username.toLowerCase()}-${ticketNumber}`,
                type: ChannelType.GuildText,
                parent: category.id,
                topic: `Support ticket for ${user.tag} (${user.id}) | Created: ${new Date().toISOString()}`,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.EmbedLinks
                        ]
                    }
                ]
            });
            
            // Find staff role
            const staffRole = guild.roles.cache.find(r => 
                r.name.toLowerCase().includes('staff') || 
                r.name.toLowerCase().includes('mod') ||
                r.name.toLowerCase().includes('admin') ||
                r.name.toLowerCase().includes('support')
            );
            
            if (staffRole) {
                await ticketChannel.permissionOverwrites.create(staffRole.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                    ManageMessages: true,
                    ManageChannels: true
                });
            }
            
            // Send welcome message
            const welcomeEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🎫 Support Ticket Created')
                .setDescription(`Hello ${user.toString()}! Our support team will assist you shortly.`)
                .addFields(
                    { name: '👤 Created By', value: user.tag, inline: true },
                    { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
                    { name: '📅 Created At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                    { 
                        name: '📝 How to Get Help', 
                        value: 'Please describe your issue in detail.', 
                        inline: false 
                    }
                )
                .setFooter({ text: 'DTEmpire Support System' })
                .setTimestamp();
            
            const closeButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`close_ticket_${ticketChannel.id}`)
                        .setLabel('Close Ticket')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒')
                );
            
            await ticketChannel.send({
                content: `${user.toString()} ${staffRole ? staffRole.toString() : ''}`,
                embeds: [welcomeEmbed],
                components: [closeButton]
            });
            
            await interaction.editReply({
                content: `✅ Your support ticket has been created: ${ticketChannel.toString()}`
            });
        }
        
        else if (interaction.customId === 'open_bug_report') {
            await interaction.deferReply({ flags: 64 });
            
            const guild = interaction.guild;
            const user = interaction.user;
            
            // Find or create bug category
            let bugCategory = guild.channels.cache.find(
                c => c.type === ChannelType.GuildCategory && 
                c.name.toLowerCase().includes('bug')
            );
            
            if (!bugCategory) {
                bugCategory = await guild.channels.create({
                    name: '🐛 Bug Reports',
                    type: ChannelType.GuildCategory,
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone.id,
                            deny: [PermissionFlagsBits.ViewChannel]
                        }
                    ]
                });
            }
            
            // Create bug report channel
            const bugNumber = Date.now().toString().slice(-6);
            const bugChannel = await guild.channels.create({
                name: `bug-${user.username.toLowerCase()}-${bugNumber}`,
                type: ChannelType.GuildText,
                parent: bugCategory.id,
                topic: `Bug report from ${user.tag} (${user.id}) | Created: ${new Date().toISOString()}`,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.EmbedLinks
                        ]
                    }
                ]
            });
            
            // Find developer/admin role
            const devRole = guild.roles.cache.find(r => 
                r.name.toLowerCase().includes('dev') || 
                r.name.toLowerCase().includes('developer') ||
                r.name.toLowerCase().includes('admin') ||
                r.name.toLowerCase().includes('staff')
            );
            
            if (devRole) {
                await bugChannel.permissionOverwrites.create(devRole.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                    ManageMessages: true,
                    ManageChannels: true
                });
            }
            
            // Send bug report form
            const bugEmbed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('🐛 Bug Report Created')
                .setDescription(`Hello ${user.toString()}! Please describe the bug you encountered.`)
                .addFields(
                    { 
                        name: '📋 Required Information', 
                        value: 'Please include:\n• What happened\n• Steps to reproduce\n• Expected behavior\n• Actual behavior\n• Screenshots if available', 
                        inline: false 
                    },
                    { name: '👤 Reported By', value: user.tag, inline: true },
                    { name: '🆔 User ID', value: `\`${user.id}\``, inline: true }
                )
                .setFooter({ text: 'DTEmpire Bug Report System' })
                .setTimestamp();
            
            const closeButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`close_ticket_${bugChannel.id}`)
                        .setLabel('Close Report')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒')
                );
            
            await bugChannel.send({
                content: `${user.toString()} ${devRole ? devRole.toString() : ''}`,
                embeds: [bugEmbed],
                components: [closeButton]
            });
            
            await interaction.editReply({
                content: `✅ Your bug report has been created: ${bugChannel.toString()}`
            });
        }
        
        else if (interaction.customId.startsWith('close_ticket_')) {
            const channelId = interaction.customId.replace('close_ticket_', '');
            const channel = interaction.guild.channels.cache.get(channelId);
            
            if (!channel) {
                return await interaction.reply({
                    content: '❌ Ticket channel not found.',
                    flags: 64 // Ephemeral
                });
            }
            
            // Check permissions
            const hasPermission = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
                                 interaction.member.roles.cache.some(role => 
                                     role.name.toLowerCase().includes('staff') ||
                                     role.name.toLowerCase().includes('mod') ||
                                     role.name.toLowerCase().includes('admin')
                                 ) ||
                                 channel.topic?.includes(`(${interaction.user.id})`);
            
            if (!hasPermission) {
                return await interaction.reply({
                    content: '❌ You do not have permission to close this ticket.',
                    flags: 64 // Ephemeral
                });
            }
            
            const closeEmbed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('🎫 Ticket Closed')
                .setDescription(`This ticket has been closed by ${interaction.user.tag}`)
                .addFields(
                    { name: 'Closed At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                    { name: 'Ticket', value: channel.name, inline: true }
                )
                .setFooter({ text: 'This channel will be deleted in 10 seconds' })
                .setTimestamp();
            
            await channel.send({ embeds: [closeEmbed] });
            
            await interaction.reply({
                content: '✅ Ticket closed. Channel will be deleted shortly.',
                flags: 64 // Ephemeral
            });
            
            // Delete channel after delay
            setTimeout(async () => {
                try {
                    await channel.delete('Ticket closed by user');
                } catch (error) {
                    console.log('Could not delete channel:', error.message);
                }
            }, 10000);
        }
        
    } catch (error) {
        console.error('Fallback ticket handler error:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ An error occurred. Please try again.',
                flags: 64 // Ephemeral
            });
        }
    }
}

// ========== INTERACTION HANDLER ==========
client.on('interactionCreate', async (interaction) => {
    // Handle button AND select menu interactions
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
        console.log(`[Interaction] Type: ${interaction.isButton() ? 'Button' : 'Select Menu'}, Custom ID: ${interaction.customId}`);
        
        try {
            // Initialize database if needed
            if (!client.db) {
                const Database = require('./utils/database');
                const dbInstance = new Database();
                client.db = await dbInstance.initialize();
            }
            
            // ========== TICKET BUTTON & SELECT MENU HANDLER ==========
            // Check for ticket interactions (buttons AND select menus)
            if (interaction.customId === 'open_support_ticket' || 
                interaction.customId === 'open_bug_report' ||
                interaction.customId === 'open_staff_application' ||
                interaction.customId === 'open_user_report' ||
                interaction.customId === 'support_reason_select' ||
                interaction.customId.startsWith('close_ticket_')) {

                // Get the ticket command module
                const ticketCommand = client.commands.get('ticket');
                if (ticketCommand && ticketCommand.handleInteraction) {
                    await ticketCommand.handleInteraction(interaction, client, client.db);
                    return;
                } else {
                    console.log('❌ Ticket command or handleInteraction method not found');
                    // Fall back to direct handling if command not loaded properly
                    await handleTicketFallback(interaction, client, client.db);
                    return;
                }
            }
            
            // ========== TTS PLAY AGAIN BUTTONS ==========
            if (interaction.customId.startsWith('tts_replay_')) {
                await interaction.deferReply({ flags: 64 }); // 64 = Ephemeral flag
                
                try {
                    const ttsCommand = require('./commands/ai/tts.js');
                    
                    if (ttsCommand.handleTTSButton) {
                        await ttsCommand.handleTTSButton(interaction, client);
                    } else {
                        // Fallback direct handler
                        const cached = client.ttsCache?.get(interaction.customId);
                        
                        if (!cached) {
                            return interaction.editReply({
                                content: '❌ TTS data expired. Please generate a new one.',
                                flags: 64 // Ephemeral
                            });
                        }
                        
                        const apiClient = require('./utils/apiClient');
                        const ttsResult = await apiClient.textToSpeech(cached.text, cached.language);
                        
                        await interaction.editReply({
                            content: `🔊 Playing again for ${interaction.user.username}`,
                            files: [{
                                attachment: ttsResult.buffer,
                                name: cached.useAI ? 'ai-tts-again.mp3' : 'tts-again.mp3'
                            }]
                        });
                    }
                } catch (error) {
                    console.error('TTS Button Error:', error);
                    await interaction.editReply({
                        content: '❌ Failed to play TTS again',
                        flags: 64 // Ephemeral
                    });
                }
                return;
            }
            
            // ========== IMAGE REGENERATION BUTTONS ==========
            if (interaction.customId.startsWith('regenerate_')) {
                const [, model, prompt] = interaction.customId.split('_');
                const decodedPrompt = decodeURIComponent(prompt);
                
                await interaction.deferReply({ flags: 64 }); // Ephemeral
                
                try {
                    const imagegenCommand = require('./commands/ai/imagegen.js');
                    if (imagegenCommand.generateAndSendImage) {
                        await imagegenCommand.generateAndSendImage(interaction, model, decodedPrompt);
                    }
                } catch (error) {
                    console.error('Regeneration error:', error);
                    await interaction.editReply({
                        content: '❌ Failed to regenerate image',
                        flags: 64 // Ephemeral
                    });
                }
                return;
            }
            
            // ========== GIVEAWAY BUTTON HANDLER ==========
            if (interaction.customId.startsWith('giveaway_enter_')) {
                try {
                    const giveawayModule = require('./commands/fun/giveaways.js');
                    if (giveawayModule.handleButtonInteraction) {
                        await giveawayModule.handleButtonInteraction(interaction, client, client.db);
                    }
                } catch (error) {
                    console.error('Giveaway button handler error:', error);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: '❌ An error occurred while processing giveaway entry.',
                            flags: 64 // Ephemeral
                        }).catch(() => {});
                    }
                }
                return;
            }
            
            // ========== ECONOMY BUTTON HANDLER ==========
            if (interaction.customId.startsWith('eco_')) {
                try {
                    // Defer the interaction immediately
                    await interaction.deferReply({ flags: 64 });
                    
                    // Initialize database if needed
                    if (!client.db) {
                        const Database = require('./utils/database');
                        const dbInstance = new Database();
                        client.db = await dbInstance.initialize();
                    }
                    
                    // Get economy command
                    let economyCommand;
                    try {
                        economyCommand = require('./commands/Economy/economy.js');
                    } catch (error) {
                        console.error('[Economy] Failed to load economy command:', error.message);
                        await interaction.editReply({
                            content: '❌ Economy system not available.'
                        });
                        return;
                    }
                    
                    // Handle different economy buttons
                    const buttonType = interaction.customId.replace('eco_', '');
                    
                    // Create a mock message object for the command functions
                    const mockMessage = {
                        author: interaction.user,
                        guild: interaction.guild,
                        channel: interaction.channel,
                        reply: async (content) => {
                            if (typeof content === 'object' && content.embeds) {
                                return interaction.editReply(content);
                            } else {
                                return interaction.editReply({ content });
                            }
                        }
                    };
                    
                    switch (buttonType) {
                        case 'work':
                            await economyCommand.workJob(mockMessage, client, client.db);
                            break;
                        case 'jobs':
                            if (economyCommand.showJobs && typeof economyCommand.showJobs === 'function') {
                                await economyCommand.showJobs(mockMessage, client, client.db);
                            } else {
                                await interaction.editReply({
                                    content: '💼 Loading available jobs...'
                                });
                            }
                            break;
                        case 'properties':
                            await economyCommand.showProperties(mockMessage, client, client.db);
                            break;
                        case 'lottery':
                            await economyCommand.lotteryInfo(mockMessage, client, client.db);
                            break;
                        case 'bank':
                            await economyCommand.bankManagement(mockMessage, [], client, client.db);
                            break;
                        case 'help':
                            if (economyCommand.showEconomyHelp) {
                                await economyCommand.showEconomyHelp(mockMessage, client, client.db);
                            } else {
                                await interaction.editReply({
                                    content: '📚 **Economy System Help**\n\n**Available Commands:**\n• `balance` - Check your balance\n• `work` - Earn money\n• `bank` - Manage savings\n• `lottery` - Play lottery\n• `properties` - View properties'
                                });
                            }
                            break;
                        case 'profile':
                            if (economyCommand.showProfile && typeof economyCommand.showProfile === 'function') {
                                await economyCommand.showProfile(mockMessage, client, client.db);
                            } else {
                                await interaction.editReply({
                                    content: '👤 Loading profile...'
                                });
                            }
                            break;
                        case 'leaderboard':
                            if (economyCommand.showLeaderboard && typeof economyCommand.showLeaderboard === 'function') {
                                await economyCommand.showLeaderboard(mockMessage, client, client.db);
                            } else {
                                await interaction.editReply({
                                    content: '🏆 Loading leaderboard...'
                                });
                            }
                            break;
                        default:
                            await interaction.editReply({
                                content: '❌ Unknown button action.'
                            });
                    }
                    
                } catch (error) {
                    console.error('Economy button handler error:', error);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: '❌ An error occurred processing your request.',
                            flags: 64 // Ephemeral
                        }).catch(() => {});
                    } else {
                        await interaction.editReply({
                            content: '❌ An error occurred processing your request.'
                        }).catch(() => {});
                    }
                }
                return;
            }

            // ========== LEVEL BUTTON HANDLER ==========
            if (interaction.customId.startsWith('level_')) {
                try {
                    const levelCommand = require('./commands/levels/level.js');
                    if (levelCommand.handleLevelButton) {
                        await levelCommand.handleLevelButton(interaction, client, client.db);
                    }
                } catch (error) {
                    console.error('Level button handler error:', error);
                }
                return;
            }

            // ========== SUGGESTION BUTTON HANDLER ==========
            if (interaction.customId.startsWith('suggest_')) {
                try {
                    const suggestionId = interaction.customId.split('_').slice(0, 3).join('_');
                    const action = interaction.customId.split('_').pop();
                    
                    if (!client.suggestions) client.suggestions = new Map();
                    if (!client.db.data.suggestions) client.db.data.suggestions = {};
                    
                    // Load suggestion from database if not in memory
                    let suggestion = client.suggestions.get(suggestionId);
                    if (!suggestion && client.db.data.suggestions[suggestionId]) {
                        suggestion = client.db.data.suggestions[suggestionId];
                        client.suggestions.set(suggestionId, suggestion);
                    }
                    
                    if (!suggestion) {
                        return interaction.reply({ content: '❌ Suggestion data not found!', ephemeral: true });
                    }
                    
                    // Handle voting
                    if (action === 'upvote' || action === 'downvote') {
                        const userId = interaction.user.id;
                        const hasUpvoted = suggestion.upvotes.includes(userId);
                        const hasDownvoted = suggestion.downvotes.includes(userId);
                        
                        if (action === 'upvote') {
                            if (hasUpvoted) {
                                suggestion.upvotes = suggestion.upvotes.filter(id => id !== userId);
                                await interaction.reply({ content: '👍 Upvote removed!', ephemeral: true });
                            } else {
                                if (hasDownvoted) {
                                    suggestion.downvotes = suggestion.downvotes.filter(id => id !== userId);
                                }
                                suggestion.upvotes.push(userId);
                                await interaction.reply({ content: '👍 Upvoted!', ephemeral: true });
                            }
                        } else if (action === 'downvote') {
                            if (hasDownvoted) {
                                suggestion.downvotes = suggestion.downvotes.filter(id => id !== userId);
                                await interaction.reply({ content: '👎 Downvote removed!', ephemeral: true });
                            } else {
                                if (hasUpvoted) {
                                    suggestion.upvotes = suggestion.upvotes.filter(id => id !== userId);
                                }
                                suggestion.downvotes.push(userId);
                                await interaction.reply({ content: '👎 Downvoted!', ephemeral: true });
                            }
                        }
                        
                        // Update storage
                        client.suggestions.set(suggestionId, suggestion);
                        client.db.data.suggestions[suggestionId] = suggestion;
                        client.db.save();
                        
                        // Update embed
                        const statusEmojis = { 'pending': '🟡', 'approved': '✅', 'denied': '❌', 'considering': '🤔' };
                        const statusNames = { 'pending': 'Pending', 'approved': 'Approved', 'denied': 'Denied', 'considering': 'Under Consideration' };
                        const statusColors = { 'pending': '#ffaa00', 'approved': '#00ff00', 'denied': '#ff0000', 'considering': '#0099ff' };
                        
                        const upvoteCount = suggestion.upvotes.length;
                        const downvoteCount = suggestion.downvotes.length;
                        const totalVotes = upvoteCount + downvoteCount;
                        const ratio = totalVotes > 0 ? Math.round((upvoteCount / totalVotes) * 100) : 0;
                        
                        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                            .setColor(statusColors[suggestion.status])
                            .setFields(
                                { name: '👍 Upvotes', value: `${upvoteCount}`, inline: true },
                                { name: '👎 Downvotes', value: `${downvoteCount}`, inline: true },
                                { name: '📊 Status', value: `${statusEmojis[suggestion.status]} ${statusNames[suggestion.status]}`, inline: true },
                                { name: '📈 Approval Rating', value: `${ratio}%`, inline: true },
                                { name: '🗳️ Total Votes', value: `${totalVotes}`, inline: true }
                            );
                        
                        if (suggestion.reviewedBy) {
                            updatedEmbed.addFields({ name: '👤 Reviewed By', value: `<@${suggestion.reviewedBy}>`, inline: true });
                        }
                        
                        await interaction.message.edit({ embeds: [updatedEmbed] });
                    } 
                    // Handle staff actions
                    else if (action === 'approve' || action === 'deny' || action === 'consider') {
                        if (!interaction.member.permissions.has('ManageMessages')) {
                            return interaction.reply({ content: '❌ You need Manage Messages permission to manage suggestions!', ephemeral: true });
                        }
                        
                        if (action === 'approve') {
                            suggestion.status = 'approved';
                            await interaction.reply({ content: '✅ Suggestion approved!', ephemeral: true });
                        } else if (action === 'deny') {
                            suggestion.status = 'denied';
                            await interaction.reply({ content: '❌ Suggestion denied!', ephemeral: true });
                        } else if (action === 'consider') {
                            suggestion.status = 'considering';
                            await interaction.reply({ content: '🤔 Suggestion marked as under consideration!', ephemeral: true });
                        }
                        
                        suggestion.reviewedBy = interaction.user.id;
                        suggestion.reviewedAt = Date.now();
                        
                        client.suggestions.set(suggestionId, suggestion);
                        client.db.data.suggestions[suggestionId] = suggestion;
                        client.db.save();
                        
                        // Update embed
                        const statusEmojis = { 'pending': '🟡', 'approved': '✅', 'denied': '❌', 'considering': '🤔' };
                        const statusNames = { 'pending': 'Pending', 'approved': 'Approved', 'denied': 'Denied', 'considering': 'Under Consideration' };
                        const statusColors = { 'pending': '#ffaa00', 'approved': '#00ff00', 'denied': '#ff0000', 'considering': '#0099ff' };
                        
                        const upvoteCount = suggestion.upvotes.length;
                        const downvoteCount = suggestion.downvotes.length;
                        const totalVotes = upvoteCount + downvoteCount;
                        const ratio = totalVotes > 0 ? Math.round((upvoteCount / totalVotes) * 100) : 0;
                        
                        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                            .setColor(statusColors[suggestion.status])
                            .setFields(
                                { name: '👍 Upvotes', value: `${upvoteCount}`, inline: true },
                                { name: '👎 Downvotes', value: `${downvoteCount}`, inline: true },
                                { name: '📊 Status', value: `${statusEmojis[suggestion.status]} ${statusNames[suggestion.status]}`, inline: true },
                                { name: '📈 Approval Rating', value: `${ratio}%`, inline: true },
                                { name: '🗳️ Total Votes', value: `${totalVotes}`, inline: true },
                                { name: '👤 Reviewed By', value: `<@${suggestion.reviewedBy}>`, inline: true }
                            );
                        
                        await interaction.message.edit({ embeds: [updatedEmbed] });
                        
                        // Notify suggestion author
                        try {
                            const author = await client.users.fetch(suggestion.userId);
                            const notifyEmbed = new EmbedBuilder()
                                .setColor(action === 'approve' ? '#00ff00' : action === 'deny' ? '#ff0000' : '#ffaa00')
                                .setTitle(`Suggestion ${action === 'approve' ? 'Approved' : action === 'deny' ? 'Denied' : 'Under Consideration'}!`)
                                .setDescription(`Your suggestion in **${interaction.guild.name}** has been ${action === 'approve' ? 'approved' : action === 'deny' ? 'denied' : 'marked as under consideration'}!`)
                                .addFields({ name: 'Your Suggestion', value: suggestion.suggestion.substring(0, 200) + (suggestion.suggestion.length > 200 ? '...' : ''), inline: false });
                            
                            await author.send({ embeds: [notifyEmbed] });
                        } catch (error) {
                            // User has DMs disabled
                        }
                    }
                } catch (error) {
                    console.error('Suggestion button handler error:', error);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ content: '❌ An error occurred processing your vote.', ephemeral: true }).catch(() => {});
                    }
                }
                return;
            }

            // ========== POLL BUTTON HANDLER ==========
            if (interaction.customId.startsWith('poll_')) {
                try {
                    const parts = interaction.customId.split('_');
                    const pollId = `poll_${parts[1]}_${parts[2]}`;
                    const action = parts[3];
                    
                    if (!client.polls) client.polls = new Map();
                    if (!client.db.data.polls) client.db.data.polls = {};
                    
                    // Load poll from database if not in memory
                    let poll = client.polls.get(pollId);
                    if (!poll && client.db.data.polls[pollId]) {
                        poll = client.db.data.polls[pollId];
                        poll.voters = new Set(poll.voters || []);
                        client.polls.set(pollId, poll);
                    }
                    
                    if (!poll) {
                        return interaction.reply({ content: '❌ Poll data not found!', ephemeral: true });
                    }
                    
                    // Check if user wants to end poll
                    if (action === 'end') {
                        if (interaction.user.id !== poll.createdBy && !interaction.member.permissions.has('ManageMessages')) {
                            return interaction.reply({ content: '❌ Only the poll creator or moderators can end this poll!', ephemeral: true });
                        }
                        
                        // Acknowledge interaction first
                        await interaction.deferUpdate();
                        
                        // End poll
                        const totalVotes = Object.values(poll.votes).reduce((a, b) => a + b, 0);
                        const sortedOptions = poll.options
                            .map((opt, i) => ({ option: opt, votes: poll.votes[i], index: i }))
                            .sort((a, b) => b.votes - a.votes);
                        
                        const winner = sortedOptions[0];
                        
                        const finalEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                            .setColor('#ff0000')
                            .setTitle('📊 Poll Ended')
                            .setFooter({ text: `Poll ended • ${totalVotes} total votes` });
                        
                        if (totalVotes > 0) {
                            finalEmbed.addFields({
                                name: '🏆 Winner',
                                value: `**${winner.option}** with ${winner.votes} votes (${Math.round((winner.votes / totalVotes) * 100)}%)`,
                                inline: false
                            });
                        }
                        
                        const disabledRows = interaction.message.components.map(row => {
                            const newRow = ActionRowBuilder.from(row);
                            newRow.components.forEach(button => button.setDisabled(true));
                            return newRow;
                        });
                        
                        await interaction.message.edit({ embeds: [finalEmbed], components: disabledRows });
                        
                        client.polls.delete(pollId);
                        return;
                    }
                    
                    const optionIndex = parseInt(action);
                    
                    // Check if user already voted
                    if (poll.voters.has(interaction.user.id)) {
                        return interaction.reply({ content: '❌ You have already voted in this poll!', ephemeral: true });
                    }
                    
                    // Acknowledge and reply
                    await interaction.deferReply({ ephemeral: true });
                    
                    // Record vote
                    poll.votes[optionIndex]++;
                    poll.voters.add(interaction.user.id);
                    
                    client.polls.set(pollId, poll);
                    client.db.data.polls[pollId] = { ...poll, voters: Array.from(poll.voters) };
                    client.db.save();
                    
                    // Update embed
                    const totalVotes = Object.values(poll.votes).reduce((a, b) => a + b, 0);
                    const updatedDescription = `**${poll.question}**\n\n${poll.options.map((opt, i) => {
                        const votes = poll.votes[i];
                        const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                        const barLength = Math.floor(percentage / 5);
                        const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
                        return `**${i + 1}.** ${opt}\n${bar} ${votes} votes (${percentage}%)`;
                    }).join('\n\n')}`;
                    
                    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                        .setDescription(updatedDescription)
                        .setFooter({ text: `Poll by ${poll.options.length} • ${totalVotes} total votes` });
                    
                    await interaction.message.edit({ embeds: [updatedEmbed] });
                    await interaction.editReply({ content: `✅ Your vote for **${poll.options[optionIndex]}** has been recorded!` });
                    
                } catch (error) {
                    console.error('Poll button handler error:', error);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ content: '❌ An error occurred processing your vote.', ephemeral: true }).catch(() => {});
                    }
                }
                return;
            }

            // ========== REACTION ROLE BUTTON HANDLER ==========
            if (interaction.customId.startsWith('rr_')) {
                try {
                    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
                        return interaction.reply({ content: '❌ I need Manage Roles to toggle that.', ephemeral: true });
                    }

                    const roleId = interaction.customId.replace('rr_', '');
                    const role = interaction.guild.roles.cache.get(roleId);
                    
                    if (!role) {
                        return interaction.reply({ content: '❌ Role not found!', ephemeral: true });
                    }

                    if (role.position >= interaction.guild.members.me.roles.highest.position) {
                        return interaction.reply({ content: '❌ That role is higher than my top role.', ephemeral: true });
                    }
                    
                    const member = interaction.member;
                    
                    if (member.roles.cache.has(roleId)) {
                        await member.roles.remove(role);
                        await interaction.reply({ content: `✅ Removed the **${role.name}** role!`, ephemeral: true });
                    } else {
                        await member.roles.add(role);
                        await interaction.reply({ content: `✅ Added the **${role.name}** role!`, ephemeral: true });
                    }
                } catch (error) {
                    console.error('Reaction role button handler error:', error);
                    await interaction.reply({ content: `❌ Failed to manage role: ${error.message}`, ephemeral: true }).catch(() => {});
                }
                return;
            }

            // ========== INVITE STATS BUTTON HANDLER ==========
            if (interaction.customId.startsWith('invite_stats_')) {
                try {
                    const userId = interaction.customId.replace('invite_stats_', '');
                    const inviteCount = await getInviteStats(interaction.guild.id, userId);
                    
                    const embed = new EmbedBuilder()
                        .setColor('#5865F2')
                        .setTitle('📨 Invite Statistics')
                        .setDescription(`Invite stats for <@${userId}>`)
                        .addFields(
                            { name: '📊 Total Invites', value: inviteCount.toString(), inline: true },
                            { name: '🏆 Inviter', value: `<@${userId}>`, inline: true },
                            { name: '📅 Tracked Since', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
                        )
                        .setFooter({ text: 'Keep inviting friends to earn rewards!' })
                        .setTimestamp();
                    
                    await interaction.reply({ embeds: [embed], flags: 64 });
                } catch (error) {
                    console.error('Invite stats button error:', error);
                    await interaction.reply({ 
                        content: '❌ Failed to get invite stats.', 
                        flags: 64 
                    });
                }
                return;
            }

            // ========== OLD TICKET BUTTON HANDLER (Legacy) ==========
            if (interaction.customId.startsWith('ticket_')) {
                try {
                    const ticketModule = require('./commands/ticket/ticket.js');

                    // Handle different ticket interactions
                    if (interaction.customId === 'ticket_staff_apply') {
                        await interaction.deferReply({ flags: 64 }); // Ephemeral
                        await ticketModule.createTicket(interaction, 'Staff Application', 'Staff Position Application', client, client.db);
                    }
                    else if (interaction.customId === 'ticket_bug_report') {
                        await interaction.deferReply({ flags: 64 }); // Ephemeral
                        await ticketModule.createTicket(interaction, 'Bug Report', 'Bug/Issue Report', client, client.db);
                    }
                    else if (interaction.customId === 'ticket_user_report') {
                        await interaction.deferReply({ flags: 64 }); // Ephemeral
                        await ticketModule.createTicket(interaction, 'User Report', 'User Behavior Report', client, client.db);
                    }
                    else if (interaction.customId.startsWith('ticket_close_')) {
                        const channelId = interaction.customId.split('_').pop();
                        const channel = interaction.guild.channels.cache.get(channelId);

                        if (!channel) {
                            return interaction.reply({
                                content: '❌ Ticket channel not found.',
                                flags: 64 // Ephemeral
                            });
                        }

                        // Check permissions
                        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) && 
                            !channel.permissionsFor(interaction.user).has(PermissionFlagsBits.ViewChannel)) {
                            return interaction.reply({
                                content: '❌ You cannot close this ticket.',
                                flags: 64 // Ephemeral
                            });
                        }

                        // Send closing message
                        const closingEmbed = new EmbedBuilder()
                            .setColor('#ff0000')
                            .setTitle('🔒 Ticket Closing')
                            .setDescription(`This ticket will be deleted in 10 seconds...`)
                            .setFooter({ text: 'Thank you for using our support system' });

                        await channel.send({ embeds: [closingEmbed] });

                        // Delete channel after delay
                        setTimeout(() => {
                            channel.delete('Ticket closed').catch(console.error);
                        }, 10000);

                        await interaction.reply({
                            content: '✅ Ticket scheduled for closure.',
                            flags: 64 // Ephemeral
                        });
                    }
                    else if (interaction.customId.startsWith('ticket_add_user_')) {
                        await interaction.reply({
                            content: '👥 Use `/ticket add @user` to add users to the ticket.',
                            flags: 64 // Ephemeral
                        });
                    }
                    else if (interaction.customId === 'ticket_reason_support') {
                        // Support ticket reason select menu
                        const reason = interaction.values[0];
                        const reasons = {
                            'general_support': 'General Support Request',
                            'technical': 'Technical Issues',
                            'account': 'Account Help',
                            'purchase': 'Purchase Help',
                            'other': 'Other Support'
                        };
                        const reasonText = reasons[reason] || 'Support Request';
                        await interaction.deferReply({ flags: 64 }); // Ephemeral
                        await ticketModule.createTicket(interaction, 'Support', reasonText, client, client.db);
                    }

                } catch (error) {
                    console.error('Ticket interaction error:', error);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: '❌ An error occurred',
                            flags: 64 // Ephemeral
                        });
                    }
                }
                return;
            }
            
            // ========== MUSIC BUTTON HANDLER ==========
            if (interaction.customId === 'music_pause_resume' || 
                interaction.customId === 'music_skip' || 
                interaction.customId === 'music_stop' || 
                interaction.customId === 'music_shuffle' || 
                interaction.customId === 'music_loop') {
                
                try {
                    if (!client.playerManager || !client.playerManager.riffy) {
                        return interaction.reply({ 
                            content: '❌ Music system not available', 
                            flags: 64 
                        });
                    }

                    const player = client.playerManager.riffy.players.get(interaction.guild.id);
                    if (!player) {
                        return interaction.reply({ 
                            content: '❌ No music playing', 
                            flags: 64 
                        });
                    }

                    const member = interaction.guild.members.cache.get(interaction.user.id);
                    if (member.voice.channelId !== player.voiceChannel) {
                        return interaction.reply({ 
                            content: '❌ Join the voice channel first!', 
                            flags: 64 
                        });
                    }

                    switch (interaction.customId) {
                        case 'music_pause_resume':
                            player.pause(!player.paused);
                            await interaction.reply({ 
                                content: player.paused ? '⏸️ Paused!' : '▶️ Resumed!', 
                                flags: 64 
                            });
                            
                            // Update now playing message
                            if (client.playerManager.updateNowPlayingProgress) {
                                client.playerManager.updateNowPlayingProgress(interaction.guild.id);
                            }
                            break;

                        case 'music_skip':
                            if (!player.queue.length) {
                                return interaction.reply({ 
                                    content: '❌ No more tracks in queue!', 
                                    flags: 64 
                                });
                            }
                            player.stop();
                            await interaction.reply({ 
                                content: '⏭️ Skipped!', 
                                flags: 64 
                            });
                            break;

                        case 'music_stop':
                            player.destroy();
                            if (client.playerManager.stopProgressUpdates) {
                                client.playerManager.stopProgressUpdates(interaction.guild.id);
                                client.playerManager.nowPlayingMessages.delete(interaction.guild.id);
                            }
                            await interaction.reply({ 
                                content: '⏹️ Stopped!', 
                                flags: 64 
                            });
                            break;

                        case 'music_shuffle':
                            if (player.queue.length < 2) {
                                return interaction.reply({ 
                                    content: '❌ Need at least 2 tracks to shuffle!', 
                                    flags: 64 
                                });
                            }
                            player.queue.shuffle();
                            await interaction.reply({ 
                                content: '🔀 Shuffled!', 
                                flags: 64 
                            });
                            break;

                        case 'music_loop':
                            const newMode = player.loop === "none" ? "queue" : "none";
                            player.setLoop(newMode);
                            await interaction.reply({ 
                                content: newMode === "queue" ? '🔁 Loop enabled!' : '🔁 Loop disabled!', 
                                flags: 64 
                            });
                            break;
                    }
                } catch (error) {
                    console.error('Music button error:', error);
                    await interaction.reply({ 
                        content: '❌ An error occurred', 
                        flags: 64 
                    });
                }
                return;
            }

            // ========== SMARTSEARCH PICK HANDLER ==========
            if (interaction.customId.startsWith('music_pick_')) {
                try {
                    const parts = interaction.customId.split('_');
                    const index = parseInt(parts[2]) - 1; // 1..5
                    const token = parts.slice(3).join('_');
                    const cache = client.smartSearchCache?.get(token);
                    if (!cache) {
                        return interaction.reply({ content: '❌ Search expired.', flags: 64 });
                    }
                    if (!client.playerManager || !client.playerManager.riffy) {
                        return interaction.reply({ content: '❌ Music system not available.', flags: 64 });
                    }
                    const player = client.playerManager.riffy.players.get(interaction.guild.id);
                    let ensure = player;
                    // ensure connection
                    if (!ensure) {
                        const vc = cache.voiceChannel || interaction.member.voice.channelId;
                        if (!vc) return interaction.reply({ content: '❌ Join a voice channel first.', flags: 64 });
                        ensure = client.playerManager.riffy.createConnection({
                            guildId: interaction.guild.id,
                            voiceChannel: vc,
                            textChannel: interaction.channel.id,
                            deaf: true,
                            selfDeaf: true
                        });
                        try { await ensure.connect(); } catch {}
                    }
                    const track = cache.choices[index];
                    if (!track) return interaction.reply({ content: '❌ Invalid selection.', flags: 64 });
                    track.info.requester = interaction.user;
                    ensure.queue.add(track);
                    if (!ensure.playing && !ensure.paused) {
                        try { await ensure.play(); } catch {}
                    }
                    await interaction.reply({ content: `✅ Added: ${track.info.title}`, flags: 64 });
                } catch (error) {
                    console.error('Smartsearch pick error:', error);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ content: '❌ Failed to add track.', flags: 64 });
                    }
                }
                return;
            }
            
            // If no handler matched
            console.log(`[Button] No handler for: ${interaction.customId}`);
            
        } catch (error) {
            console.error('Button interaction error:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ An error occurred',
                    flags: 64 // Ephemeral
                }).catch(() => {});
            }
        }
        return;
    }
});

// ========== LOGGING EVENT LISTENERS ==========

// ========== GUILD MEMBER ADD WITH INVITE TRACKING ==========
client.on('guildMemberAdd', async (member) => {
    try {
        if (!client.db) return;
        
        const guild = member.guild;
        const guildId = guild.id;
        
        // ========== TRACK INVITE USAGE ==========
        try {
            const usedInvite = await trackInviteUsage(guild, member);
            
            if (usedInvite && usedInvite.inviter) {
                // Update invite count
                const newCount = await updateInviteCount(guildId, usedInvite.inviter.id, usedInvite);
                
                // Log invite usage
                console.log(`[Invite] ${member.user.tag} joined using invite from ${usedInvite.inviter.tag} (${newCount} total invites)`);
                
                // Send to logging system if available
                if (client.loggingSystem && client.loggingSystem.logInviteUsage) {
                    await client.loggingSystem.logInviteUsage(guildId, member, usedInvite, newCount);
                }
                
                // Also log to console
                const logChannelId = 'YOUR_LOG_CHANNEL_ID'; // Replace with actual log channel ID
                const logChannel = guild.channels.cache.get(logChannelId);
                if (logChannel) {
                    const embed = new EmbedBuilder()
                        .setColor('#43B581')
                        .setTitle('📨 Invite Used')
                        .setDescription(`${member.user.tag} joined using an invite`)
                        .addFields(
                            { name: '👤 New Member', value: `${member.user.tag} (${member.user.id})`, inline: true },
                            { name: '👥 Invited By', value: `${usedInvite.inviter.tag} (${usedInvite.inviter.id})`, inline: true },
                            { name: '🔗 Invite Code', value: usedInvite.code, inline: true },
                            { name: '📊 Inviter\'s Total', value: newCount.toString(), inline: true },
                            { name: '📝 Channel', value: usedInvite.channel?.name || 'Unknown', inline: true }
                        )
                        .setFooter({ text: 'Invite Tracking System' })
                        .setTimestamp();
                    
                    await logChannel.send({ embeds: [embed] });
                }
            } else {
                console.log(`[Invite] ${member.user.tag} joined but invite source could not be determined`);
            }
        } catch (inviteError) {
            console.error('Invite tracking error:', inviteError);
        }
        
        // ========== WELCOME SYSTEM ==========
        const config = await client.db.getGuildConfig(guildId);
        
        // Auto role
        if (config?.auto_role) {
            try {
                const role = guild.roles.cache.get(config.auto_role);
                if (role) {
                    await member.roles.add(role);
                }
            } catch (error) {
                console.error('Auto role error:', error);
            }
        }
        
        // Welcome channel messages
        if (config?.welcome_channel) {
            const channel = guild.channels.cache.get(config.welcome_channel);
            if (channel) {
                // Send embed if enabled
                if (config.welcome_embed !== false) {
                    const embed = new EmbedBuilder()
                        .setColor('#43B581')
                        .setTitle(`🎉 Welcome to ${guild.name}!`)
                        .setDescription(`**${member.user.username}** just joined the server!\nWe're now **${guild.memberCount}** members strong! 🎊`)
                        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
                        .addFields(
                            {
                                name: '👤 Username',
                                value: member.user.tag,
                                inline: true
                            },
                            {
                                name: '📅 Account Created',
                                value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
                                inline: true
                            },
                            {
                                name: '🎊 Member #',
                                value: `#${guild.memberCount}`,
                                inline: true
                            }
                        )
                        .setFooter({ 
                            text: `Member #${guild.memberCount} • Welcome to the server! 🎉` 
                        })
                        .setTimestamp();
                    
                    await channel.send({ embeds: [embed] });
                }
                
                // Send text message
                if (config.welcome_message) {
                    const welcomeText = config.welcome_message
                        .replace(/{user}/g, member.user.username)
                        .replace(/{server}/g, guild.name)
                        .replace(/{count}/g, guild.memberCount.toString())
                        .replace(/{mention}/g, `<@${member.user.id}>`);
                    
                    await channel.send(welcomeText);
                }
            }
        }
        
        // Log member join to logging system
        if (client.loggingSystem) {
            await client.loggingSystem.logMemberJoin(guildId, member);
        }
        
    } catch (error) {
        console.error('Guild member add error:', error);
    }
});

// Member leave logs
client.on('guildMemberRemove', async (member) => {
    if (client.loggingSystem) {
        await client.loggingSystem.logMemberLeave(member.guild.id, member);
    }
});

// ========== RIFFY RAW EVENT HANDLER ==========
client.on("raw", d => {
    // Only handle voice state updates for Riffy
    if (!d.t) return;
    
    // Pass to Riffy if it exists
    if (client.playerManager && client.playerManager.riffy) {
        client.playerManager.riffy.updateVoiceState(d);
    }
});

// Message delete/edit logs
client.on('messageDelete', async (message) => {
    if (!message.guild || message.author.bot) return;
    
    // Save to snipe - store as array
    const snipeData = {
        author: message.author.tag,
        content: message.content,
        timestamp: Date.now()
    };
    
    // Get existing snipes for this channel or create empty array
    const existingSnipes = client.snipes.get(message.channel.id) || [];
    
    // Add new snipe to the beginning of array (most recent first)
    existingSnipes.unshift(snipeData);
    
    // Keep only last 10 snipes to prevent memory issues
    const limitedSnipes = existingSnipes.slice(0, 10);
    
    // Save back to map
    client.snipes.set(message.channel.id, limitedSnipes);
    
    // Save to database if available
    if (client.db) {
        try {
            await client.db.saveSnipe(
                message.guild.id,
                message.channel.id,
                {
                    author: message.author.tag,
                    content: message.content,
                    author_id: message.author.id
                }
            );
        } catch (error) {
            console.error('Error saving snipe:', error);
        }
    }
    
    // Log to logging system
    if (client.loggingSystem) {
        await client.loggingSystem.logMessageDelete(message.guild.id, message);
    }
    
    // ========== ADDED: Handle sticky message deletion ==========
    if (client.db && stickyHandler) {
        await stickyHandler.handleMessageDelete(message, client, client.db);
    }
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (!oldMessage.guild || oldMessage.author.bot || !newMessage.content) return;
    
    // Save to edit snipe - store as array
    const editSnipeData = {
        author: oldMessage.author.tag,
        oldContent: oldMessage.content,
        newContent: newMessage.content,
        timestamp: Date.now()
    };
    
    // Get existing edit snipes for this channel or create empty array
    const existingEditSnipes = client.editSnipes.get(oldMessage.channel.id) || [];
    
    // Add new edit snipe to the beginning of array
    existingEditSnipes.unshift(editSnipeData);
    
    // Keep only last 10 edit snipes
    const limitedEditSnipes = existingEditSnipes.slice(0, 10);
    
    // Save back to map
    client.editSnipes.set(oldMessage.channel.id, limitedEditSnipes);
    
    // Log to logging system
    if (client.loggingSystem && oldMessage.content !== newMessage.content) {
        await client.loggingSystem.logMessageEdit(oldMessage.guild.id, oldMessage, newMessage);
    }
});

// Role change logs
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    if (!client.loggingSystem) return;
    
    const guildId = oldMember.guild.id;
    
    // Check for role changes
    if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
        const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
        const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));
        
        for (const role of addedRoles.values()) {
            await client.loggingSystem.logRoleAdd(guildId, newMember, role);
        }
        
        for (const role of removedRoles.values()) {
            await client.loggingSystem.logRoleRemove(guildId, newMember, role);
        }
    }
});

// Channel logs
client.on('channelCreate', async (channel) => {
    if (!client.loggingSystem || !channel.guild) return;
    await client.loggingSystem.logChannelCreate(channel.guild.id, channel);
});

client.on('channelDelete', async (channel) => {
    if (!client.loggingSystem || !channel.guild) return;
    await client.loggingSystem.logChannelDelete(channel.guild.id, channel);
});

client.on('channelUpdate', async (oldChannel, newChannel) => {
    if (!client.loggingSystem || !oldChannel.guild) return;
    await client.loggingSystem.logChannelUpdate(oldChannel.guild.id, oldChannel, newChannel);
});

// Voice logs and XP tracking
client.on('voiceStateUpdate', async (oldState, newState) => {
    const guildId = oldState.guild?.id || newState.guild?.id;
    if (!guildId) return;
    
    // Track voice activity for XP
    await trackVoiceActivity(oldState, newState, client, client.db);
    
    // Logging system (if enabled)
    if (client.loggingSystem) {
        // User joined voice channel
        if (!oldState.channelId && newState.channelId) {
            await client.loggingSystem.logVoiceJoin(guildId, newState.member, newState.channel);
        }
        // User left voice channel
        else if (oldState.channelId && !newState.channelId) {
            await client.loggingSystem.logVoiceLeave(guildId, oldState.member, oldState.channel);
        }
        // User moved voice channels
        else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            await client.loggingSystem.logVoiceMove(guildId, oldState.member, oldState.channel, newState.channel);
        }
    }
});

// Invite create logs with cache update
client.on('inviteCreate', async (invite) => {
    if (!invite.guild) return;
    
    const guildId = invite.guild.id;
    
    // Update invite cache
    try {
        const inviteMap = client.inviteCache.get(guildId) || new Map();
        inviteMap.set(invite.code, {
            code: invite.code,
            inviter: invite.inviter,
            uses: invite.uses,
            maxUses: invite.maxUses,
            expiresAt: invite.expiresAt,
            channel: invite.channel
        });
        client.inviteCache.set(guildId, inviteMap);
        
        console.log(`[Invite] New invite created by ${invite.inviter?.tag || 'Unknown'} in ${invite.guild.name}: ${invite.code}`);
    } catch (error) {
        console.error('Invite cache update error:', error);
    }
    
    // Logging system (if enabled)
    if (client.loggingSystem) {
        await client.loggingSystem.logInviteCreate(invite.guild.id, invite);
    }
});

// Invite delete logs with cache update
client.on('inviteDelete', async (invite) => {
    if (!invite.guild) return;
    
    const guildId = invite.guild.id;
    
    // Remove from invite cache
    try {
        const inviteMap = client.inviteCache.get(guildId);
        if (inviteMap) {
            inviteMap.delete(invite.code);
        }
        
        console.log(`[Invite] Invite deleted from ${invite.guild.name}: ${invite.code}`);
    } catch (error) {
        console.error('Invite cache delete error:', error);
    }
    
    // Logging system (if enabled)
    if (client.loggingSystem) {
        await client.loggingSystem.logInviteDelete(invite.guild.id, invite);
    }
});

// Role create/delete logs
client.on('roleCreate', async (role) => {
    if (!client.loggingSystem) return;
    await client.loggingSystem.logRoleCreate(role.guild.id, role);
});

client.on('roleDelete', async (role) => {
    if (!client.loggingSystem) return;
    await client.loggingSystem.logRoleDelete(role.guild.id, role);
});

// ========== AUTO-UNMUTE CHECKER ==========
function startMuteChecker() {
    setInterval(async () => {
        try {
            if (!client.db || !client.db.getActiveMutes) return;
            
            const activeMutes = await client.db.getActiveMutes();
            const now = Date.now();
            
            for (const mute of activeMutes) {
                if (mute.unmuteTime <= now) {
                    try {
                        const guild = client.guilds.cache.get(mute.guildId);
                        if (guild) {
                            const member = await guild.members.fetch(mute.userId).catch(() => null);
                            if (member && member.isCommunicationDisabled()) {
                                await member.timeout(null, 'Auto-unmute');
                                console.log(`[Auto-Unmute] Unmuted ${member.user.tag} in ${guild.name}`);
                                
                                // Remove from database
                                await client.db.removeMute(mute.guildId, mute.userId);
                            }
                        }
                    } catch (error) {
                        console.error('Auto-unmute error:', error);
                    }
                }
            }
        } catch (error) {
            console.error('Mute checker error:', error);
        }
    }, 60000); // Check every minute
}

// ========== GIVEAWAY CHECKER ==========
function startGiveawayInterval(client) {
    setInterval(async () => {
        try {
            if (!client.db) {
                console.log('[Giveaway] Database not initialized, skipping check');
                return;
            }
            
            // Try to load giveaway command
            let giveawayCommand;
            try {
                giveawayCommand = require('./commands/fun/giveaways.js');
            } catch (error) {
                console.error('[Giveaway] Failed to load giveaway command:', error.message);
                return;
            }
            
            // Use the new checkGiveaways function
            if (giveawayCommand.checkGiveaways) {
                await giveawayCommand.checkGiveaways(client, client.db);
            }
        } catch (error) {
            console.error('Giveaway interval error:', error);
        }
    }, 60000); // Check every minute
}

// ========== BAD WORDS INITIALIZATION ==========
async function initializeBadWords() {
    try {
        const fsPromises = require('fs').promises;
        const dataDir = path.join(__dirname, 'data');
        const badWordsFile = path.join(dataDir, 'bad-words.json');
        
        // Create data directory if it doesn't exist
        if (!fs.existsSync(dataDir)) {
            await fsPromises.mkdir(dataDir, { recursive: true });
        }
        
        // Create default bad words file if it doesn't exist
        if (!fs.existsSync(badWordsFile)) {
            const defaultBadWords = {
                "default": {
                    "en": [
                        "fuck", "shit", "asshole", "bitch", "bastard", 
                        "cunt", "dick", "pussy", "whore", "slut",
                        "nigger", "nigga", "retard", "faggot", "kys",
                        "kill yourself", "die", "fucking", "motherfucker"
                    ],
                    "hi": [
                        "madarchod", "behenchod", "bhosdike", "lund", "chutiya",
                        "gaandu", "bhenchod", "mc", "bc", "lauda",
                        "lavde", "gandu", "randi", "kutta", "kutti"
                    ],
                    "ne": [
                        "kukur", "randi", "jatha", "jhant", "khattam",
                        "muji", "beshya", "chakka", "hijo", "khattam"
                    ]
                }
            };
            
            await fsPromises.writeFile(badWordsFile, JSON.stringify(defaultBadWords, null, 2));
            console.log('✅ Created default bad words database');
        }
        
        console.log('✅ Auto-moderation system initialized');
        
    } catch (error) {
        console.error('Failed to initialize bad words:', error);
    }
}

// ========== LINK PROTECTION INITIALIZATION ==========
async function initializeLinkProtection() {
    try {
        const fsPromises = require('fs').promises;
        const dataDir = path.join(__dirname, 'data');
        const linkChannelsFile = path.join(dataDir, 'link-channels.json');
        
        // Create data directory if it doesn't exist
        if (!fs.existsSync(dataDir)) {
            await fsPromises.mkdir(dataDir, { recursive: true });
        }
        
        // Create default link channels file if it doesn't exist
        if (!fs.existsSync(linkChannelsFile)) {
            const defaultLinkConfig = {};
            await fsPromises.writeFile(linkChannelsFile, JSON.stringify(defaultLinkConfig, null, 2));
            console.log('✅ Created default link channels database');
        }
        
        console.log('✅ Link protection system initialized');
        
    } catch (error) {
        console.error('Failed to initialize link protection:', error);
    }
}

// ========== AUTO-INITIALIZE ALL SERVERS WITH GLOBAL WORDS ==========
async function initializeAllServersWithGlobalWords() {
    try {
        console.log('🔄 Initializing all servers with global bad words...');
        
        const fsPromises = require('fs').promises;
        const badWordsFile = path.join(__dirname, 'data', 'bad-words.json');
        
        // Check if file exists
        if (!fs.existsSync(badWordsFile)) {
            console.log('❌ Bad words file not found');
            return;
        }
        
        // Load bad words data
        const data = JSON.parse(await fsPromises.readFile(badWordsFile, 'utf8'));
        
        // Get all global words
        const globalWords = [];
        if (data.default) {
            if (data.default.en) globalWords.push(...data.default.en);
            if (data.default.hi) globalWords.push(...data.default.hi);
            if (data.default.ne) globalWords.push(...data.default.ne);
        }
        
        const uniqueWords = [...new Set(globalWords)];
        
        // Initialize all guilds the bot is in
        const guilds = client.guilds.cache;
        let initializedCount = 0;
        
        for (const guild of guilds.values()) {
            const guildId = guild.id;
            
            if (!data[guildId]) {
                data[guildId] = {
                    words: uniqueWords,
                    enabled: true
                };
                initializedCount++;
            }
        }
        
        // Save back to file
        await fsPromises.writeFile(badWordsFile, JSON.stringify(data, null, 2));
        
        console.log(`✅ Auto-initialized ${initializedCount} servers with ${uniqueWords.length} global bad words`);
        
    } catch (error) {
        console.error('Failed to initialize servers with global words:', error);
    }
}

// ========== SIMPLE LEAVE SYSTEM ==========
client.on('guildMemberRemove', async (member) => {
    try {
        if (!client.db) return;
        
        const config = await client.db.getGuildConfig(member.guild.id);
        
        // Leave channel messages
        if (config?.leave_channel) {
            const channel = member.guild.channels.cache.get(config.leave_channel);
            if (channel) {
                // Send embed if enabled
                if (config.welcome_embed !== false) {
                    const embed = new EmbedBuilder()
                        .setColor('#F04747')
                        .setTitle(`👋 Goodbye from ${member.guild.name}!`)
                        .setDescription(`**${member.user.username}** has left the server.\nWe're now **${member.guild.memberCount}** members. 😢`)
                        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
                        .addFields(
                            {
                                name: '👤 Username',
                                value: member.user.tag,
                                inline: true
                            },
                            {
                                name: '📅 Account Age',
                                value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
                                inline: true
                            },
                            {
                                name: '🎊 Was Member #',
                                value: `#${member.guild.memberCount + 1}`,
                                inline: true
                            }
                        )
                        .setFooter({ 
                            text: `Was member #${member.guild.memberCount + 1} • We'll miss you! 😢` 
                        })
                        .setTimestamp();
                    
                    await channel.send({ embeds: [embed] });
                }
                
                // Send text message
                if (config.leave_message) {
                    const leaveText = config.leave_message
                        .replace(/{user}/g, member.user.username)
                        .replace(/{server}/g, member.guild.name)
                        .replace(/{count}/g, member.guild.memberCount.toString())
                        .replace(/{mention}/g, `<@${member.user.id}>`);
                    
                    await channel.send(leaveText);
                }
            }
        }
        
    } catch (error) {
        console.error('Leave system error:', error);
    }
});

// ========== DEBUG: LOG ALL EVENTS ==========
client.on('debug', (info) => {
    // Only log guild-related debug messages
    if (info.includes('guild') || info.includes('GUILD')) {
        console.log(`[DEBUG] ${info}`);
    }
});

// ========== READY EVENT ==========
client.on('ready', async () => {
    console.log(`\n══════════════════════════════════════════════════════`);
    console.log(`✅ ${client.user.tag} is online!`);
    console.log(`📊 Servers: ${client.guilds.cache.size}`);
    console.log(`👥 Users: ${client.users.cache.size}`);
    console.log(`⚡ Commands: ${client.commands.size}`);
    console.log(`🔧 Version: ${client.botInfo.version}`);
    console.log(`👨‍💻 Creator: ${client.botInfo.creator}`);
    console.log(`══════════════════════════════════════════════════════\n`);
    
    // Set presence
    client.user.setPresence({
        activities: [{
            name: `${client.botInfo.prefix}help | v${client.botInfo.version}`,
            type: ActivityType.Listening
        }],
        status: 'online'
    });
    
    // ========== INITIALIZE INVITE TRACKING FOR ALL GUILDS ==========
    console.log('📨 Initializing invite tracking...');
    for (const [guildId, guild] of client.guilds.cache) {
        await initializeInviteTracking(guild);
    }
    console.log('✅ Invite tracking initialized');
    
    // ========== INITIALIZE RIFFY ==========
    if (client.playerManager && client.playerManager.riffy) {
        try {
            client.playerManager.riffy.init(client.user.id);
            console.log('✅ Riffy initialized with client ID');
        } catch (error) {
            console.error('❌ Failed to initialize Riffy:', error.message);
        }
    }
    
    // Start interval checkers with client reference
    startGiveawayInterval(client);
    startMuteChecker();
    
    // Initialize all servers with global bad words
    setTimeout(() => {
        initializeAllServersWithGlobalWords();
    }, 5000); // Wait 5 seconds for everything to load
    
    // ========== ADDED: Initialize sticky messages on startup ==========
    if (client.db && client.db.data && client.db.data.stickyMessages) {
        console.log('🔄 Initializing sticky messages...');
        let initializedCount = 0;
        
        for (const [channelId, stickyData] of Object.entries(client.db.data.stickyMessages)) {
            try {
                const channel = await client.channels.fetch(channelId).catch(() => null);
                if (channel) {
                    // Check if sticky message still exists
                    if (stickyData.lastMessageId) {
                        const existingMsg = await channel.messages.fetch(stickyData.lastMessageId).catch(() => null);
                        if (!existingMsg) {
                            // Sticky was deleted, recreate it
                            let newStickyMsg;
                            
                            if (stickyData.embedData) {
                                try {
                                    const embedData = JSON.parse(stickyData.embedData);
                                    const embed = new EmbedBuilder(embedData);
                                    newStickyMsg = await channel.send({ embeds: [embed] });
                                } catch (error) {
                                    console.error('Error recreating embed sticky:', error);
                                    // Fallback to text
                                    const embed = new EmbedBuilder()
                                        .setColor('#ffff00')
                                        .setDescription(stickyData.content || 'Sticky Message')
                                        .setFooter({ text: '📌 Sticky Message' });
                                    newStickyMsg = await channel.send({ embeds: [embed] });
                                }
                            } else {
                                const embed = new EmbedBuilder()
                                    .setColor('#ffff00')
                                    .setTitle('📌 Sticky Message')
                                    .setDescription(stickyData.content || 'Sticky Message')
                                    .setFooter({ text: 'This message will stay at the bottom of the channel' })
                                    .setTimestamp();
                                
                                newStickyMsg = await channel.send({ embeds: [embed] });
                            }
                            
                            await client.db.updateStickyMessage(channelId, { lastMessageId: newStickyMsg.id });
                            initializedCount++;
                        }
                    }
                }
            } catch (error) {
                console.error(`Error initializing sticky for channel ${channelId}:`, error);
            }
        }
        
        if (initializedCount > 0) {
            console.log(`✅ Recreated ${initializedCount} sticky messages`);
        }
    }
    
    console.log('✅ Interval checkers started');
    
    // Test XP system initialization
    console.log('🎯 XP System initialized - Messages will now award XP');
    
    // Test invite tracking
    console.log('📨 Invite tracking system ready - Will track who invited new members');
    
    // Test link protection
    console.log('🔗 Link protection system ready - Links will be auto-deleted in non-allowed channels');
    
    // TEST: Send a notification for all current guilds
    setTimeout(async () => {
        console.log(`\n🔍 Sending test notifications for all ${client.guilds.cache.size} guilds...`);
        
        const NOTIFICATION_SERVER_ID = '1364645873396482168';
        const notificationGuild = client.guilds.cache.get(NOTIFICATION_SERVER_ID);
        
        if (notificationGuild) {
            const channel = notificationGuild.channels.cache.find(c => c.name === 'test');
            if (channel) {
                await channel.send(`🤖 **Bot started!** Currently in ${client.guilds.cache.size} servers.`);
                
                // List all guilds
                let guildList = '**Current Guilds:**\n';
                client.guilds.cache.forEach(guild => {
                    guildList += `• ${guild.name} (${guild.memberCount} members)\n`;
                });
                
                const embed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('📊 Bot Startup Report')
                    .setDescription(guildList)
                    .setTimestamp();
                
                await channel.send({ embeds: [embed] });
            }
        }
        
        console.log(`✅ Test notifications sent`);
    }, 3000);
});

// ========== START BOT ==========
async function startBot() {
    try {
        console.log('🚀 Starting DTEmpire v2.6.9...');
        
        // ========== CHECK FOR REQUIRED ENVIRONMENT VARIABLES ==========
        if (!process.env.BOT_TOKEN) {
            console.error('❌ BOT_TOKEN environment variable is not set!');
            process.exit(1);
        }
        
        console.log('✅ Environment variables loaded');
        
        // Setup directories
        setupDirectories();
        
        // Load commands
        loadCommands();
        
        // Load music commands separately (to ensure they load)
        loadMusicCommands();
        
        // Load events
        loadEvents();
        
        console.log(`📦 Total commands loaded: ${client.commands.size}`);
        
        // Initialize auto-mod bad words
        await initializeBadWords();
        
        // Initialize link protection
        await initializeLinkProtection();
        
        // Initialize database
        const Database = require('./utils/database');
        const dbInstance = new Database();
        client.db = await dbInstance.initialize();
        console.log('✅ Database initialized');
        
        // Initialize logging system
        client.loggingSystem = new LoggingSystem(client, client.db);
        console.log('✅ Logging system initialized');
        
        // ========== INITIALIZE MUSIC PLAYER MANAGER WITH RIFFY ==========
        try {
            const PlayerManager = require('./utils/playerManager');
            client.playerManager = new PlayerManager(client);
            
            // Check if player manager initialized successfully
            setTimeout(() => {
                if (client.playerManager && client.playerManager.riffy) {
                    console.log('✅ Music Player Manager initialized with Riffy');
                } else {
                    console.log('⚠️  Music Player Manager may not have initialized properly');
                    console.log('⚠️  Check Lavalink node configuration in config.json');
                }
            }, 2000);
        } catch (playerError) {
            console.error('❌ Failed to initialize player manager:', playerError.message);
            console.log('⚠️  Music features will be disabled');
            client.playerManager = null;
        }
        
        // ========== INITIALIZE AUTOROOM MANAGER ==========
        const AutoRoomManager = require('./utils/autoroomManager');
        client.autoroomManager = new AutoRoomManager(client, client.db);
        
        // Start periodic check (safety net)
        setTimeout(() => {
            if (client.autoroomManager && client.autoroomManager.startPeriodicCheck) {
                client.autoroomManager.startPeriodicCheck();
                console.log('✅ AutoRoom periodic check started');
            }
        }, 5000); // Start after 5 seconds
        
        console.log('✅ AutoRoom Manager initialized');
        
        // Login with environment variable token
        await client.login(config.bot.token);
        
    } catch (error) {
        console.error('❌ Failed to start bot:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    }
}

// ========== GRACEFUL SHUTDOWN ==========
process.on('SIGINT', async () => {
    console.log('\n🔴 Shutting down DTEmpire...');
    
    // Clear voice timers and award pending XP
    try {
        console.log('Processing pending voice XP...');
        const now = Date.now();
        
        for (const [voiceKey, startTime] of voiceStartTimes.entries()) {
            const [userId, guildId] = voiceKey.split('_');
            
            // Get member info
            const guild = client.guilds.cache.get(guildId);
            if (guild) {
                const member = await guild.members.fetch(userId).catch(() => null);
                if (member) {
                    await awardVoiceXP(member, startTime, now, client, client.db);
                }
            }
        }
        
        voiceStartTimes.clear();
        console.log('✅ Voice XP processed');
    } catch (error) {
        console.error('Voice cleanup error:', error);
    }
    
    // Clear TTS cache
    if (client.ttsCache) {
        client.ttsCache.clear();
    }
    
    // Clean up music player
    if (client.playerManager && client.playerManager.cleanup) {
        client.playerManager.cleanup();
    }
    
    if (client.db && client.db.close) {
        await client.db.close();
    }
    if (client.destroy) {
        client.destroy();
    }
    console.log('✅ Bot shutdown complete');
    process.exit(0);
});

// Start the bot
startBot();

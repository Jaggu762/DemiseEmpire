// commands/moderation/mod.js - Main moderation command
const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

// Load bad words
const BAD_WORDS_FILE = path.join(__dirname, '../../data/bad-words.json');
// Load link channels config
const LINK_CHANNELS_FILE = path.join(__dirname, '../../data/link-channels.json');

// Track user warnings for auto-mod violations
const userWarningCounts = new Map();

module.exports = {
    name: 'mod',
    description: 'Moderation commands for server management',
    aliases: ['moderation', 'admin'],
    category: 'Moderation',
    
    async execute(message, args, client, db) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return message.reply('❌ You need **Manage Server** permission to use moderation commands.');
        }
        
        // Show help if no arguments
        if (args.length === 0) {
            const embed = createHelpEmbed();
            return message.reply({ embeds: [embed] });
        }
        
        const subcommand = args[0].toLowerCase();
        
        switch (subcommand) {
            case 'ban':
                await handleBan(message, args.slice(1), client);
                break;
            case 'kick':
                await handleKick(message, args.slice(1), client);
                break;
            case 'mute':
                await handleMute(message, args.slice(1), client);
                break;
            case 'forcesync':
                await forceSyncBadWords(message);
                break;            
            case 'unmute':
                await handleUnmute(message, args.slice(1), client);
                break;
            case 'warn':
                await handleWarn(message, args.slice(1), client);
                break;
            case 'clear':
                await handleClear(message, args.slice(1));
                break;
            case 'badwords':
                await handleBadWords(message, args.slice(1));
                break;
            case 'settings':
                await handleSettings(message, args.slice(1));
                break;
            case 'logs':
                await handleLogs(message, args.slice(1));
                break;
            case 'test':
                await testAutoMod(message);
                break;
            case 'addrole':
                await handleAddRole(message, args.slice(1), client);
                break;
            case 'removerole':
                await handleRemoveRole(message, args.slice(1), client);
                break;
            case 'linkchannel':
                await handleLinkChannel(message, args.slice(1));
                break;
            case 'linkprotection':
                await handleLinkProtection(message, args.slice(1));
                break;
            case 'help':
                const helpEmbed = createHelpEmbed();
                await message.reply({ embeds: [helpEmbed] });
                break;
            default:
                message.reply('❌ Unknown subcommand. Use `^mod help` for available commands.');
        }
    }
};

// ========== HELPER FUNCTIONS ==========

function createHelpEmbed() {
    return new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('🔨 DTEmpire Moderation Commands')
        .setDescription('Server moderation and management tools')
        .addFields(
            {
                name: '🛡️ User Management',
                value: [
                    '`^mod ban @user [reason]` - Ban a user',
                    '`^mod kick @user [reason]` - Kick a user',
                    '`^mod mute @user [time] [reason]` - Mute a user (e.g., 1h, 30m, 1d)',
                    '`^mod unmute @user` - Unmute a user',
                    '`^mod warn @user [reason]` - Warn a user',
                    '`^mod addrole {role} @user` - Add role to user',
                    '`^mod removerole {role} @user` - Remove role from user'
                ].join('\n'),
                inline: false
            },
            {
                name: '🧹 Message Management',
                value: [
                    '`^mod clear [amount]` - Delete messages (1-100)',
                    '`^mod clear @user [amount]` - Delete messages from specific user'
                ].join('\n'),
                inline: false
            },
            {
                name: '🔗 Link Protection',
                value: [
                    '`^mod linkchannel #channel` - Allow links in specific channel',
                    '`^mod linkchannel list` - List all link-allowed channels',
                    '`^mod linkchannel remove #channel` - Remove link permission from channel',
                    '`^mod linkprotection enable` - Enable link protection',
                    '`^mod linkprotection disable` - Disable link protection',
                    '`^mod linkprotection settings` - Show link protection settings'
                ].join('\n'),
                inline: false
            },
            {
                name: '🚫 Auto-Moderation',
                value: [
                    '`^mod badwords list` - Show banned words',
                    '`^mod badwords add <word>` - Add a bad word',
                    '`^mod badwords remove <word>` - Remove a bad word',
                    '`^mod badwords enable` - Enable auto-mod',
                    '`^mod badwords disable` - Disable auto-mod',
                    '`^mod badwords warnings @user` - Check user warnings',
                    '`^mod badwords resetwarn @user` - Reset user warnings',
                    '`^mod forcesync` - Force sync global bad words',
                    '`^mod test` - Test auto-mod system'
                ].join('\n'),
                inline: false
            },
            {
                name: '⚙️ Settings',
                value: [
                    '`^mod settings` - Show current settings',
                    '`^mod logs set #channel` - Set moderation log channel',
                    '`^mod logs disable` - Disable moderation logs'
                ].join('\n'),
                inline: false
            }
        )
        .setFooter({ text: 'All commands require Manage Server permission' });
}

// ========== BAN COMMAND ==========
async function handleBan(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
        return message.reply('❌ You need **Ban Members** permission.');
    }
    
    if (args.length === 0) {
        return message.reply('❌ Usage: `^mod ban @user [reason]`');
    }
    
    const user = message.mentions.users.first();
    if (!user) {
        return message.reply('❌ Please mention a user to ban.');
    }
    
    const reason = args.slice(1).join(' ') || 'No reason provided';
    
    try {
        const member = await message.guild.members.fetch(user.id);
        
        // Check if user is bannable
        if (!member.bannable) {
            return message.reply('❌ I cannot ban this user (higher role).');
        }
        
        await member.ban({ reason: `By ${message.author.tag}: ${reason}` });
        
        // ADD LOGGING
        if (client.loggingSystem) {
            await client.loggingSystem.logModeration(
                message.guild.id,
                'ban',
                user,
                message.author,
                reason
            );
        }
        
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('🔨 User Banned')
            .addFields(
                { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                { name: 'Banned by', value: message.author.tag, inline: true },
                { name: 'Reason', value: reason, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'DTEmpire Moderation' });
        
        await message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Ban error:', error);
        message.reply('❌ Failed to ban user.');
    }
}

// ========== KICK COMMAND ==========
async function handleKick(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
        return message.reply('❌ You need **Kick Members** permission.');
    }
    
    if (args.length === 0) {
        return message.reply('❌ Usage: `^mod kick @user [reason]`');
    }
    
    const user = message.mentions.users.first();
    if (!user) {
        return message.reply('❌ Please mention a user to kick.');
    }
    
    const reason = args.slice(1).join(' ') || 'No reason provided';
    
    try {
        const member = await message.guild.members.fetch(user.id);
        
        if (!member.kickable) {
            return message.reply('❌ I cannot kick this user (higher role).');
        }
        
        await member.kick(`By ${message.author.tag}: ${reason}`);
        
        // ADD LOGGING
        if (client.loggingSystem) {
            await client.loggingSystem.logModeration(
                message.guild.id,
                'kick',
                user,
                message.author,
                reason
            );
        }
        
        const embed = new EmbedBuilder()
            .setColor('#ff9900')
            .setTitle('👢 User Kicked')
            .addFields(
                { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                { name: 'Kicked by', value: message.author.tag, inline: true },
                { name: 'Reason', value: reason, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'DTEmpire Moderation' });
        
        await message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Kick error:', error);
        message.reply('❌ Failed to kick user.');
    }
}

// ========== MUTE COMMAND ==========
async function handleMute(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return message.reply('❌ You need **Moderate Members** permission.');
    }
    
    if (args.length === 0) {
        return message.reply('❌ Usage: `^mod mute @user [time] [reason]`\nExample: `^mod mute @user 1h Being rude`');
    }
    
    const user = message.mentions.users.first();
    if (!user) {
        return message.reply('❌ Please mention a user to mute.');
    }
    
    let time = '1h'; // Default
    let reason = 'No reason provided';
    
    // Parse time argument
    if (args.length > 1 && !isNaN(parseInt(args[1].charAt(0)))) {
        time = args[1];
        reason = args.slice(2).join(' ') || 'No reason provided';
    } else {
        reason = args.slice(1).join(' ') || 'No reason provided';
    }
    
    // Convert time to milliseconds
    const timeMs = parseTime(time);
    if (timeMs === null) {
        return message.reply('❌ Invalid time format. Use: 1m, 30m, 1h, 6h, 12h, 1d, 7d');
    }
    
    if (timeMs > 2419200000) { // 28 days max
        return message.reply('❌ Maximum mute time is 28 days.');
    }
    
    try {
        const member = await message.guild.members.fetch(user.id);
        
        if (!member.moderatable) {
            return message.reply('❌ I cannot mute this user (higher role).');
        }
        
        await member.timeout(timeMs, `By ${message.author.tag}: ${reason}`);
        
        // ADD LOGGING
        if (client.loggingSystem) {
            await client.loggingSystem.logModeration(
                message.guild.id,
                'mute',
                user,
                message.author,
                reason,
                formatTime(timeMs)
            );
        }
        
        const embed = new EmbedBuilder()
            .setColor('#ffff00')
            .setTitle('🔇 User Muted')
            .addFields(
                { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                { name: 'Muted by', value: message.author.tag, inline: true },
                { name: 'Duration', value: formatTime(timeMs), inline: true },
                { name: 'Reason', value: reason, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'DTEmpire Moderation' });
        
        await message.reply({ embeds: [embed] });
        
        // Store mute info for auto-unmute if database exists
        if (client.db && client.db.storeMute) {
            await client.db.storeMute(message.guild.id, user.id, Date.now() + timeMs, reason);
        }
        
    } catch (error) {
        console.error('Mute error:', error);
        message.reply('❌ Failed to mute user.');
    }
}

// ========== UNMUTE COMMAND ==========
async function handleUnmute(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return message.reply('❌ You need **Moderate Members** permission.');
    }
    
    if (args.length === 0) {
        return message.reply('❌ Usage: `^mod unmute @user`');
    }
    
    const user = message.mentions.users.first();
    if (!user) {
        return message.reply('❌ Please mention a user to unmute.');
    }
    
    try {
        const member = await message.guild.members.fetch(user.id);
        
        if (!member.moderatable) {
            return message.reply('❌ I cannot unmute this user.');
        }
        
        await member.timeout(null, `Unmuted by ${message.author.tag}`);
        
        // ADD LOGGING
        if (client.loggingSystem) {
            await client.loggingSystem.logModeration(
                message.guild.id,
                'unmute',
                user,
                message.author,
                'Manual unmute'
            );
        }
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🔊 User Unmuted')
            .addFields(
                { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                { name: 'Unmuted by', value: message.author.tag, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'DTEmpire Moderation' });
        
        await message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Unmute error:', error);
        message.reply('❌ Failed to unmute user.');
    }
}

// ========== WARN COMMAND ==========
async function handleWarn(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return message.reply('❌ You need **Manage Messages** permission.');
    }
    
    if (args.length === 0) {
        return message.reply('❌ Usage: `^mod warn @user [reason]`');
    }
    
    const user = message.mentions.users.first();
    if (!user) {
        return message.reply('❌ Please mention a user to warn.');
    }
    
    const reason = args.slice(1).join(' ') || 'No reason provided';
    
    try {
        // Store warning in database if available
        if (client.db && client.db.addWarning) {
            await client.db.addWarning(message.guild.id, user.id, message.author.id, reason);
        }
        
        // ADD LOGGING
        if (client.loggingSystem) {
            await client.loggingSystem.logModeration(
                message.guild.id,
                'warn',
                user,
                message.author,
                reason
            );
        }
        
        const embed = new EmbedBuilder()
            .setColor('#ff5500')
            .setTitle('⚠️ User Warned')
            .addFields(
                { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                { name: 'Warned by', value: message.author.tag, inline: true },
                { name: 'Reason', value: reason, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'DTEmpire Moderation' });
        
        await message.reply({ embeds: [embed] });
        
        // Send DM to warned user
        try {
            const dmEmbed = new EmbedBuilder()
                .setColor('#ff5500')
                .setTitle('⚠️ You have been warned')
                .setDescription(`You received a warning in **${message.guild.name}**`)
                .addFields(
                    { name: 'Reason', value: reason, inline: false },
                    { name: 'Moderator', value: message.author.tag, inline: true },
                    { name: 'Server', value: message.guild.name, inline: true }
                )
                .setTimestamp();
            
            await user.send({ embeds: [dmEmbed] });
        } catch (dmError) {
            console.log('Could not send DM to user:', dmError.message);
        }
        
    } catch (error) {
        console.error('Warn error:', error);
        message.reply('❌ Failed to warn user.');
    }
}

// ========== CLEAR COMMAND ==========
async function handleClear(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return message.reply('❌ You need **Manage Messages** permission.');
    }
    
    let amount = 10; // Default
    let targetUser = null;
    
    if (args.length === 0) {
        return message.reply('❌ Usage: `^mod clear [amount]` or `^mod clear @user [amount]`');
    }
    
    // Check if first arg is a mention
    if (message.mentions.users.size > 0) {
        targetUser = message.mentions.users.first();
        amount = parseInt(args[1]) || 10;
    } else {
        amount = parseInt(args[0]) || 10;
    }
    
    // Validate amount
    if (isNaN(amount) || amount < 1 || amount > 100) {
        return message.reply('❌ Please specify a number between 1 and 100.');
    }
    
    try {
        let deletedCount = 0;
        let fetched;
        
        do {
            fetched = await message.channel.messages.fetch({ limit: Math.min(amount - deletedCount, 100) });
            
            if (targetUser) {
                const filtered = fetched.filter(msg => msg.author.id === targetUser.id);
                await message.channel.bulkDelete(filtered, true);
                deletedCount += filtered.size;
            } else {
                await message.channel.bulkDelete(fetched, true);
                deletedCount += fetched.size;
            }
            
        } while (deletedCount < amount && fetched.size >= 2);
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🧹 Messages Cleared')
            .addFields(
                { name: 'Deleted', value: `${deletedCount} messages`, inline: true },
                { name: 'Channel', value: message.channel.toString(), inline: true }
            );
        
        if (targetUser) {
            embed.addFields({ name: 'Filtered by', value: targetUser.tag, inline: true });
        }
        
        const reply = await message.reply({ embeds: [embed] });
        
        // Delete the reply after 5 seconds
        setTimeout(() => reply.delete().catch(() => {}), 5000);
        
    } catch (error) {
        console.error('Clear error:', error);
        message.reply('❌ Failed to delete messages (messages may be older than 14 days).');
    }
}

// ========== BAD WORDS COMMAND ==========
async function handleBadWords(message, args) {
    if (args.length === 0) {
        return showBadWordsList(message);
    }
    
    const subcmd = args[0].toLowerCase();
    
    switch (subcmd) {
        case 'list':
            await showBadWordsList(message);
            break;
        case 'add':
            await addBadWord(message, args.slice(1));
            break;
        case 'remove':
            await removeBadWord(message, args.slice(1));
            break;
        case 'enable':
            await toggleAutoMod(message, true);
            break;
        case 'disable':
            await toggleAutoMod(message, false);
            break;
        case 'warnings':
            await checkUserWarnings(message, args.slice(1));
            break;
        case 'resetwarn':
            await resetUserWarnings(message, args.slice(1));
            break;
        default:
            message.reply('❌ Unknown subcommand. Use: list, add, remove, enable, disable, warnings, resetwarn');
    }
}

// ========== BAD WORDS HELPER FUNCTIONS ==========

async function showBadWordsList(message) {
    try {
        // Initialize guild with global words
        await initializeGuildWithGlobalWords(message.guild.id);
        
        const data = await loadBadWords();
        const guildId = message.guild.id;
        
        const words = data[guildId].words;
        const enabled = data[guildId].enabled !== false;
        
        // Format words list with proper numbering
        let wordsList = 'No bad words configured';
        if (words.length > 0) {
            // Create numbered list with each word on new line
            wordsList = words.map((w, i) => `${i + 1}. \`${w}\``).join('\n');
            
            // If too long, truncate and show only first 20
            if (wordsList.length > 1020) {
                const truncatedWords = words.slice(0, 20);
                wordsList = truncatedWords.map((w, i) => `${i + 1}. \`${w}\``).join('\n');
                wordsList += `\n... and ${words.length - 20} more words`;
            }
        }
        
        const embed = new EmbedBuilder()
            .setColor(enabled ? '#ff0000' : '#666666')
            .setTitle('🚫 Bad Words List')
            .setDescription(enabled ? '**Auto-mod is ENABLED** ✅' : '**Auto-mod is DISABLED** ❌')
            .addFields({
                name: `Banned Words (${words.length})`,
                value: wordsList,
                inline: false
            })
            .setFooter({ text: 'Use ^mod badwords add/remove to manage' });
        
        await message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Show bad words error:', error);
        message.reply('❌ Failed to load bad words list.');
    }
}

async function addBadWord(message, args) {
    if (args.length === 0) {
        return message.reply('❌ Usage: `^mod badwords add <word>`');
    }
    
    const word = args.join(' ').toLowerCase().trim();
    
    try {
        const data = await loadBadWords();
        const guildId = message.guild.id;
        
        // Initialize guild if doesn't exist
        if (!data[guildId]) {
            await initializeGuildWithGlobalWords(guildId);
        }
        
        // Fix for issue where words might be stored incorrectly
        if (Array.isArray(data[guildId].words)) {
            if (data[guildId].words.includes(word)) {
                return message.reply('❌ This word is already in the list.');
            }
        } else {
            // Reset if words is not an array
            data[guildId].words = [];
        }
        
        data[guildId].words.push(word);
        await saveBadWords(data);
        
        message.reply(`✅ Added \`${word}\` to bad words list.`);
        
    } catch (error) {
        console.error('Add bad word error:', error);
        message.reply('❌ Failed to add bad word.');
    }
}

async function removeBadWord(message, args) {
    if (args.length === 0) {
        return message.reply('❌ Usage: `^mod badwords remove <word>`');
    }
    
    const word = args.join(' ').toLowerCase().trim();
    
    try {
        const data = await loadBadWords();
        const guildId = message.guild.id;
        
        if (!data[guildId] || !Array.isArray(data[guildId].words) || !data[guildId].words.includes(word)) {
            return message.reply('❌ This word is not in the list.');
        }
        
        data[guildId].words = data[guildId].words.filter(w => w !== word);
        await saveBadWords(data);
        
        message.reply(`✅ Removed \`${word}\` from bad words list.`);
        
    } catch (error) {
        console.error('Remove bad word error:', error);
        message.reply('❌ Failed to remove bad word.');
    }
}

async function toggleAutoMod(message, enabled) {
    try {
        const data = await loadBadWords();
        const guildId = message.guild.id;
        
        if (!data[guildId]) {
            // Initialize with global words if doesn't exist
            await initializeGuildWithGlobalWords(guildId);
        }
        
        data[guildId].enabled = enabled;
        await saveBadWords(data);
        
        message.reply(`✅ Auto-moderation ${enabled ? 'ENABLED' : 'DISABLED'}.`);
        
    } catch (error) {
        console.error('Toggle auto-mod error:', error);
        message.reply('❌ Failed to update auto-mod settings.');
    }
}

// ========== GLOBAL WORDS INITIALIZATION ==========
async function initializeGuildWithGlobalWords(guildId) {
    try {
        const data = await loadBadWords();
        
        // If already exists, return
        if (data[guildId]) {
            return data[guildId];
        }
        
        // Get all global words from all languages
        const globalWords = [];
        if (data.default) {
            if (data.default.en && Array.isArray(data.default.en)) {
                globalWords.push(...data.default.en);
            }
            if (data.default.hi && Array.isArray(data.default.hi)) {
                globalWords.push(...data.default.hi);
            }
            if (data.default.ne && Array.isArray(data.default.ne)) {
                globalWords.push(...data.default.ne);
            }
        }
        
        // Remove duplicates
        const uniqueWords = [...new Set(globalWords)];
        
        // Initialize guild
        data[guildId] = {
            words: uniqueWords,
            enabled: true
        };
        
        await saveBadWords(data);
        console.log(`✅ Auto-initialized guild ${guildId} with ${uniqueWords.length} global bad words`);
        
        return data[guildId];
        
    } catch (error) {
        console.error('Initialize guild error:', error);
        // Return empty config if error
        return { words: [], enabled: true };
    }
}

// ========== SETTINGS COMMAND ==========
async function handleSettings(message, args) {
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('⚙️ Moderation Settings')
        .setDescription('Current moderation configuration for this server')
        .addFields(
            { name: 'Prefix', value: '`.`', inline: true },
            { name: 'Mod Role', value: 'Manage Server', inline: true },
            { name: 'Log Channel', value: 'Not set', inline: true }
        )
        .setFooter({ text: 'More settings coming soon!' });
    
    await message.reply({ embeds: [embed] });
}

// ========== LOGS COMMAND ==========
async function handleLogs(message, args) {
    if (args.length === 0) {
        return message.reply('❌ Usage: `^mod logs set #channel` or `^mod logs disable`');
    }
    
    const subcmd = args[0].toLowerCase();
    
    if (subcmd === 'set') {
        const channel = message.mentions.channels.first();
        if (!channel) {
            return message.reply('❌ Please mention a channel.');
        }
        message.reply(`✅ Log channel set to ${channel.toString()}`);
    } else if (subcmd === 'disable') {
        message.reply('✅ Logging disabled.');
    } else {
        message.reply('❌ Unknown subcommand. Use: set, disable');
    }
}

// ========== ADD ROLE COMMAND ==========
async function handleAddRole(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return message.reply('❌ You need **Manage Roles** permission.');
    }
    
    if (args.length < 2) {
        return message.reply('❌ Usage: `^mod addrole {role name} @username`\nExample: `^mod addrole VIP @user`');
    }
    
    const roleName = args[0];
    const user = message.mentions.users.first();
    
    if (!user) {
        return message.reply('❌ Please mention a user to add the role to.');
    }
    
    try {
        // Find role by name
        const role = message.guild.roles.cache.find(r => 
            r.name.toLowerCase() === roleName.toLowerCase()
        );
        
        if (!role) {
            return message.reply(`❌ Role \`${roleName}\` not found.`);
        }
        
        // Check if bot can manage this role
        if (role.position >= message.guild.members.me.roles.highest.position) {
            return message.reply('❌ I cannot manage this role (it\'s higher than my highest role).');
        }
        
        const member = await message.guild.members.fetch(user.id);
        
        if (member.roles.cache.has(role.id)) {
            return message.reply(`❌ ${user.tag} already has the ${role.name} role.`);
        }
        
        await member.roles.add(role, `Added by ${message.author.tag}`);
        
        const embed = new EmbedBuilder()
            .setColor(role.color || '#00ff00')
            .setTitle('✅ Role Added')
            .addFields(
                { name: 'User', value: user.tag, inline: true },
                { name: 'Role', value: role.name, inline: true },
                { name: 'Added by', value: message.author.tag, inline: true }
            )
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        
        // Log the action
        if (client.loggingSystem) {
            await client.loggingSystem.logRoleAdd(message.guild.id, member, role, message.author);
        }
        
    } catch (error) {
        console.error('Add role error:', error);
        message.reply('❌ Failed to add role. Check my permissions.');
    }
}

// ========== REMOVE ROLE COMMAND ==========
async function handleRemoveRole(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return message.reply('❌ You need **Manage Roles** permission.');
    }
    
    if (args.length < 2) {
        return message.reply('❌ Usage: `^mod removerole {role name} @username`\nExample: `^mod removerole VIP @user`');
    }
    
    const roleName = args[0];
    const user = message.mentions.users.first();
    
    if (!user) {
        return message.reply('❌ Please mention a user to remove the role from.');
    }
    
    try {
        // Find role by name
        const role = message.guild.roles.cache.find(r => 
            r.name.toLowerCase() === roleName.toLowerCase()
        );
        
        if (!role) {
            return message.reply(`❌ Role \`${roleName}\` not found.`);
        }
        
        // Check if bot can manage this role
        if (role.position >= message.guild.members.me.roles.highest.position) {
            return message.reply('❌ I cannot manage this role (it\'s higher than my highest role).');
        }
        
        const member = await message.guild.members.fetch(user.id);
        
        if (!member.roles.cache.has(role.id)) {
            return message.reply(`❌ ${user.tag} doesn't have the ${role.name} role.`);
        }
        
        await member.roles.remove(role, `Removed by ${message.author.tag}`);
        
        const embed = new EmbedBuilder()
            .setColor('#ff5500')
            .setTitle('🚫 Role Removed')
            .addFields(
                { name: 'User', value: user.tag, inline: true },
                { name: 'Role', value: role.name, inline: true },
                { name: 'Removed by', value: message.author.tag, inline: true }
            )
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        
        // Log the action
        if (client.loggingSystem) {
            await client.loggingSystem.logRoleRemove(message.guild.id, member, role, message.author);
        }
        
    } catch (error) {
        console.error('Remove role error:', error);
        message.reply('❌ Failed to remove role. Check my permissions.');
    }
}

// ========== FORCE SYNC BAD WORDS ==========
async function forceSyncBadWords(message) {
    try {
        // Load global words
        const data = await loadBadWords();
        const guildId = message.guild.id;
        
        if (!data.default) {
            return message.reply('❌ No global bad words configured.');
        }
        
        // Get all global words
        const globalWords = [];
        if (data.default.en) globalWords.push(...data.default.en);
        if (data.default.hi) globalWords.push(...data.default.hi);
        if (data.default.ne) globalWords.push(...data.default.ne);
        
        const uniqueWords = [...new Set(globalWords)];
        
        // Force update guild
        data[guildId] = {
            words: uniqueWords,
            enabled: true
        };
        
        await saveBadWords(data);
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🔄 Force Sync Complete')
            .setDescription(`Force synced ${uniqueWords.length} global bad words to this server`)
            .addFields(
                { name: 'Total Words', value: `${uniqueWords.length} words`, inline: true },
                { name: 'Auto-mod Status', value: '✅ ENABLED', inline: true }
            )
            .setFooter({ text: 'Test auto-mod with ^mod test' });
        
        await message.reply({ embeds: [embed] });
        
        // Show first 20 words
        if (uniqueWords.length > 0) {
            const sample = uniqueWords.slice(0, 20).map((w, i) => `${i + 1}. \`${w}\``).join('\n');
            const sampleEmbed = new EmbedBuilder()
                .setColor('#ffff00')
                .setTitle('📋 Synced Bad Words (first 20)')
                .setDescription(sample)
                .setFooter({ text: `${uniqueWords.length} total words synced` });
            
            message.channel.send({ embeds: [sampleEmbed] });
        }
        
    } catch (error) {
        console.error('Force sync error:', error);
        message.reply('❌ Failed to force sync bad words.');
    }
}

// ========== TEST AUTO-MOD ==========
async function testAutoMod(message) {
    try {
        const data = await loadBadWords();
        const guildId = message.guild.id;
        
        if (!data[guildId]) {
            return message.reply('❌ No bad words configured for this server. Use `^mod badwords sync` first.');
        }
        
        const words = data[guildId].words || [];
        const enabled = data[guildId].enabled !== false;
        
        const embed = new EmbedBuilder()
            .setColor(enabled ? '#00ff00' : '#ff0000')
            .setTitle('🔍 Auto-Mod Test')
            .setDescription(enabled ? '✅ Auto-mod is ENABLED' : '❌ Auto-mod is DISABLED')
            .addFields(
                { name: 'Total Bad Words', value: `${words.length} words`, inline: true },
                { name: 'Guild ID', value: guildId, inline: true },
                { name: 'Test Words', value: 'Try typing: `fuck`, `shit`, `randi`, `muji`', inline: false }
            );
        
        // Show sample bad words
        if (words.length > 0) {
            const sampleWords = words.slice(0, 10);
            embed.addFields({ 
                name: 'Sample Bad Words (first 10)', 
                value: sampleWords.map(w => `\`${w}\``).join(', '),
                inline: false 
            });
        }
        
        await message.reply({ embeds: [embed] });
        
        // Test message
        const testMessage = await message.channel.send('Testing auto-mod... Type a bad word to see if it gets deleted.');
        setTimeout(() => testMessage.delete(), 10000);
        
    } catch (error) {
        console.error('Test auto-mod error:', error);
        message.reply('❌ Failed to test auto-mod.');
    }
}

// ========== LINK PROTECTION FUNCTIONS ==========

async function handleLinkChannel(message, args) {
    if (args.length === 0) {
        return showLinkChannels(message);
    }
    
    const subcmd = args[0].toLowerCase();
    
    switch (subcmd) {
        case 'add':
            await addLinkChannel(message, args.slice(1));
            break;
        case 'remove':
            await removeLinkChannel(message, args.slice(1));
            break;
        case 'list':
            await showLinkChannels(message);
            break;
        default:
            // If no subcommand, assume it's a channel mention
            await addLinkChannel(message, args);
    }
}

async function addLinkChannel(message, args) {
    const channel = message.mentions.channels.first();
    
    if (!channel) {
        return message.reply('❌ Please mention a channel. Usage: `^mod linkchannel #channel-name`');
    }
    
    try {
        const config = await loadLinkConfig();
        const guildId = message.guild.id;
        
        // Initialize guild config if doesn't exist
        if (!config[guildId]) {
            config[guildId] = {
                enabled: true,
                channels: [],
                exemptRoles: [],
                exemptUsers: []
            };
        }
        
        // Check if channel already exists
        if (config[guildId].channels.includes(channel.id)) {
            return message.reply(`✅ Links are already allowed in ${channel.toString()}`);
        }
        
        // Add channel
        config[guildId].channels.push(channel.id);
        await saveLinkConfig(config);
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Link Channel Added')
            .addFields(
                { name: 'Channel', value: channel.toString(), inline: true },
                { name: 'ID', value: channel.id, inline: true },
                { name: 'Status', value: '✅ Links allowed', inline: true }
            )
            .setFooter({ text: `Link protection is ${config[guildId].enabled ? 'ENABLED' : 'DISABLED'}` })
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Add link channel error:', error);
        message.reply('❌ Failed to add link channel.');
    }
}

async function removeLinkChannel(message, args) {
    const channel = message.mentions.channels.first();
    
    if (!channel) {
        return message.reply('❌ Please mention a channel. Usage: `^mod linkchannel remove #channel-name`');
    }
    
    try {
        const config = await loadLinkConfig();
        const guildId = message.guild.id;
        
        if (!config[guildId] || !config[guildId].channels.includes(channel.id)) {
            return message.reply(`❌ Links are not allowed in ${channel.toString()} (or no config found)`);
        }
        
        // Remove channel
        config[guildId].channels = config[guildId].channels.filter(id => id !== channel.id);
        await saveLinkConfig(config);
        
        const embed = new EmbedBuilder()
            .setColor('#ff9900')
            .setTitle('🚫 Link Channel Removed')
            .addFields(
                { name: 'Channel', value: channel.toString(), inline: true },
                { name: 'ID', value: channel.id, inline: true },
                { name: 'Status', value: '❌ Links blocked', inline: true }
            )
            .setFooter({ text: 'Links will now be auto-deleted in this channel' })
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Remove link channel error:', error);
        message.reply('❌ Failed to remove link channel.');
    }
}

async function showLinkChannels(message) {
    try {
        const config = await loadLinkConfig();
        const guildId = message.guild.id;
        
        if (!config[guildId] || config[guildId].channels.length === 0) {
            return message.reply('❌ No channels are allowed to send links. Use `^mod linkchannel #channel` to add one.');
        }
        
        const enabled = config[guildId].enabled !== false;
        const channelIds = config[guildId].channels;
        
        // Fetch channels
        const channels = [];
        for (const channelId of channelIds) {
            const channel = message.guild.channels.cache.get(channelId);
            if (channel) {
                channels.push(channel);
            }
        }
        
        const embed = new EmbedBuilder()
            .setColor(enabled ? '#00ff00' : '#ff0000')
            .setTitle('🔗 Link-Allowed Channels')
            .setDescription(enabled ? '✅ **Link Protection is ENABLED**' : '❌ **Link Protection is DISABLED**')
            .addFields({
                name: `Allowed Channels (${channels.length})`,
                value: channels.length > 0 
                    ? channels.map(ch => `${ch.toString()} (${ch.name})`).join('\n')
                    : 'No channels found'
            })
            .setFooter({ text: 'Links are auto-deleted in all other channels' })
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Show link channels error:', error);
        message.reply('❌ Failed to load link channel settings.');
    }
}

async function handleLinkProtection(message, args) {
    if (args.length === 0) {
        return showLinkProtectionSettings(message);
    }
    
    const subcmd = args[0].toLowerCase();
    
    switch (subcmd) {
        case 'enable':
            await toggleLinkProtection(message, true);
            break;
        case 'disable':
            await toggleLinkProtection(message, false);
            break;
        case 'settings':
            await showLinkProtectionSettings(message);
            break;
        default:
            message.reply('❌ Unknown subcommand. Use: enable, disable, settings');
    }
}

async function toggleLinkProtection(message, enabled) {
    try {
        const config = await loadLinkConfig();
        const guildId = message.guild.id;
        
        // Initialize if doesn't exist
        if (!config[guildId]) {
            config[guildId] = {
                enabled: enabled,
                channels: [],
                exemptRoles: [],
                exemptUsers: []
            };
        } else {
            config[guildId].enabled = enabled;
        }
        
        await saveLinkConfig(config);
        
        const embed = new EmbedBuilder()
            .setColor(enabled ? '#00ff00' : '#ff0000')
            .setTitle(enabled ? '✅ Link Protection Enabled' : '❌ Link Protection Disabled')
            .setDescription(enabled 
                ? 'Links will be auto-deleted in all channels except those explicitly allowed.'
                : 'Link protection is now disabled. Users can send links anywhere.'
            )
            .addFields({
                name: 'Note',
                value: enabled 
                    ? 'Use `^mod linkchannel #channel` to allow links in specific channels'
                    : 'Enable protection again with `^mod linkprotection enable`'
            })
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Toggle link protection error:', error);
        message.reply('❌ Failed to update link protection settings.');
    }
}

async function showLinkProtectionSettings(message) {
    try {
        const config = await loadLinkConfig();
        const guildId = message.guild.id;
        
        if (!config[guildId]) {
            return message.reply('❌ Link protection is not configured for this server. Use `^mod linkprotection enable` to enable it.');
        }
        
        const settings = config[guildId];
        const enabled = settings.enabled !== false;
        const channelCount = settings.channels.length;
        const exemptRoleCount = settings.exemptRoles.length;
        const exemptUserCount = settings.exemptUsers.length;
        
        // Fetch allowed channels
        const allowedChannels = [];
        for (const channelId of settings.channels.slice(0, 10)) { // Show first 10
            const channel = message.guild.channels.cache.get(channelId);
            if (channel) {
                allowedChannels.push(channel.toString());
            }
        }
        
        const embed = new EmbedBuilder()
            .setColor(enabled ? '#00ff00' : '#ff0000')
            .setTitle('⚙️ Link Protection Settings')
            .addFields(
                { name: 'Status', value: enabled ? '✅ ENABLED' : '❌ DISABLED', inline: true },
                { name: 'Allowed Channels', value: `${channelCount} channel(s)`, inline: true },
                { name: 'Exempt Roles', value: `${exemptRoleCount} role(s)`, inline: true },
                { name: 'Exempt Users', value: `${exemptUserCount} user(s)`, inline: true }
            );
        
        if (allowedChannels.length > 0) {
            embed.addFields({
                name: `Allowed Channels (first ${allowedChannels.length})`,
                value: allowedChannels.join('\n'),
                inline: false
            });
        }
        
        if (settings.channels.length > 10) {
            embed.setFooter({ text: `${settings.channels.length - 10} more channels not shown. Use ^mod linkchannel list` });
        }
        
        await message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Show link protection settings error:', error);
        message.reply('❌ Failed to load link protection settings.');
    }
}

// ========== LINK PROTECTION CHECK FUNCTION ==========
async function checkLinks(message) {
    try {
        const config = await loadLinkConfig();
        const guildId = message.guild.id;
        
        // If no config or disabled, allow all links
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

// ========== AUTO-MOD WARNING SYSTEM ==========

async function handleAutoModWarning(message, badWord) {
    try {
        const userId = message.author.id;
        const guildId = message.guild.id;
        const key = `${guildId}_${userId}`;
        
        // Get current warning count
        let warnings = userWarningCounts.get(key) || 0;
        warnings++;
        userWarningCounts.set(key, warnings);
        
        console.log(`[Auto-Mod] User ${message.author.tag} warned ${warnings}/5 times for "${badWord}"`);
        
        // Send warning DM to user
        try {
            const warningEmbed = new EmbedBuilder()
                .setColor('#ff5500')
                .setTitle('⚠️ Auto-Mod Warning')
                .setDescription(`Your message in **${message.guild.name}** was removed for containing inappropriate content.`)
                .addFields(
                    { name: 'Bad Word', value: `\`${badWord}\``, inline: true },
                    { name: 'Warning', value: `${warnings}/5`, inline: true },
                    { name: 'Action', value: 'Message Deleted', inline: true },
                    { name: 'Next Action', value: warnings >= 5 ? '3-minute timeout' : 'Continue warning', inline: false }
                )
                .setFooter({ text: 'Please follow server rules' })
                .setTimestamp();
            
            await message.author.send({ embeds: [warningEmbed] });
        } catch (dmError) {
            console.log('Could not send DM to user:', dmError.message);
        }
        
        // If 5 warnings, apply timeout
        if (warnings >= 5) {
            await applyAutoModTimeout(message, userId, guildId);
            
            // Reset warnings after timeout
            setTimeout(() => {
                userWarningCounts.delete(key);
                console.log(`[Auto-Mod] Reset warnings for user ${message.author.tag}`);
            }, 3 * 60 * 1000); // Reset after timeout duration
        }
        
        // Auto-reset warnings after 1 hour (cooldown)
        setTimeout(() => {
            if (userWarningCounts.get(key) === warnings) {
                userWarningCounts.delete(key);
                console.log(`[Auto-Mod] Auto-reset warnings for user ${message.author.tag} after 1 hour`);
            }
        }, 60 * 60 * 1000); // 1 hour
        
    } catch (error) {
        console.error('Auto-mod warning handling error:', error);
    }
}

async function applyAutoModTimeout(message, userId, guildId) {
    try {
        const member = await message.guild.members.fetch(userId).catch(() => null);
        if (!member || !member.moderatable) return;
        
        const timeoutDuration = 3 * 60 * 1000; // 3 minutes in milliseconds
        const reason = 'Auto-mod: 5+ inappropriate messages';
        
        await member.timeout(timeoutDuration, reason);
        
        console.log(`[Auto-Mod] User ${member.user.tag} timed out for 3 minutes (5 warnings)`);
        
        // Send timeout notification
        try {
            const timeoutEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('⏰ Auto-Mod Timeout')
                .setDescription(`You have been timed out in **${message.guild.name}** for repeated violations.`)
                .addFields(
                    { name: 'Duration', value: '3 minutes', inline: true },
                    { name: 'Reason', value: '5+ inappropriate messages', inline: true },
                    { name: 'Warnings Reset', value: 'Your warning count has been reset', inline: false }
                )
                .setFooter({ text: 'Timeout will expire automatically' })
                .setTimestamp();
            
            await member.send({ embeds: [timeoutEmbed] });
        } catch (dmError) {
            console.log('Could not send timeout DM:', dmError.message);
        }
        
        // Log to mod channel if configured
        try {
            if (message.client && message.client.db) {
                const config = await message.client.db.getGuildConfig(guildId);
                if (config.mod_log_channel) {
                    const logChannel = message.guild.channels.cache.get(config.mod_log_channel);
                    if (logChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setColor('#ff9900')
                            .setTitle('⏰ Auto-Mod Timeout Applied')
                            .setDescription(`User timed out for repeated bad word violations`)
                            .addFields(
                                { name: 'User', value: `${member.user.tag} (${userId})`, inline: true },
                                { name: 'Duration', value: '3 minutes', inline: true },
                                { name: 'Reason', value: '5 auto-mod warnings', inline: false },
                                { name: 'Channel', value: message.channel.toString(), inline: true }
                            )
                            .setTimestamp()
                            .setFooter({ text: 'DTEmpire Auto-Mod' });
                        
                        await logChannel.send({ embeds: [logEmbed] });
                    }
                }
            }
        } catch (logError) {
            console.error('Auto-mod log error:', logError);
        }
        
    } catch (error) {
        console.error('Auto-mod timeout error:', error);
    }
}

// Command to check user's warning count
async function checkUserWarnings(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return message.reply('❌ You need **Manage Messages** permission.');
    }
    
    const user = message.mentions.users.first() || message.author;
    const key = `${message.guild.id}_${user.id}`;
    const warnings = userWarningCounts.get(key) || 0;
    
    const embed = new EmbedBuilder()
        .setColor(warnings >= 3 ? '#ff5500' : '#0099ff')
        .setTitle('⚠️ Auto-Mod Warnings')
        .addFields(
            { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
            { name: 'Warnings', value: `${warnings}/5`, inline: true },
            { name: 'Status', value: warnings >= 5 ? '⏰ TIMEOUT APPLIED' : warnings >= 3 ? '⚠️ WARNING' : '✅ OK', inline: true },
            { name: 'Next Action', value: warnings >= 5 ? 'Already timed out' : `${5 - warnings} more for 3-min timeout`, inline: false }
        )
        .setFooter({ text: 'Warnings reset after timeout or 1 hour' });
    
    await message.reply({ embeds: [embed] });
}

// Command to reset user's warnings
async function resetUserWarnings(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return message.reply('❌ You need **Manage Messages** permission.');
    }
    
    const user = message.mentions.users.first();
    if (!user) {
        return message.reply('❌ Please mention a user to reset warnings.');
    }
    
    const key = `${message.guild.id}_${user.id}`;
    const hadWarnings = userWarningCounts.has(key);
    
    userWarningCounts.delete(key);
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Warnings Reset')
        .setDescription(`Auto-mod warnings for ${user.tag} have been reset.`)
        .addFields(
            { name: 'User', value: user.tag, inline: true },
            { name: 'Reset by', value: message.author.tag, inline: true },
            { name: 'Previous Status', value: hadWarnings ? 'Had warnings' : 'No warnings', inline: true }
        )
        .setTimestamp();
    
    await message.reply({ embeds: [embed] });
}

// ========== AUTO-MOD FUNCTION (USED BY INDEX.JS) ==========
async function checkBadWords(message) {
    try {
        // Initialize guild with global words if needed
        await initializeGuildWithGlobalWords(message.guild.id);
        
        const data = await loadBadWords();
        const guildId = message.guild.id;
        
        // If no config for this guild or auto-mod is disabled, return false
        if (!data[guildId] || data[guildId].enabled === false || !data[guildId].words || data[guildId].words.length === 0) {
            return false;
        }
        
        const content = message.content.toLowerCase();
        const badWords = data[guildId].words;
        
        // Ensure badWords is an array
        if (!Array.isArray(badWords)) {
            return false;
        }
        
        // Check each bad word
        for (const word of badWords) {
            // Simple contains check
            if (content.includes(word.toLowerCase())) {
                console.log(`[Auto-Mod Debug] Found bad word: "${word}" in message`);
                
                // Call warning handler
                await handleAutoModWarning(message, word);
                
                return {
                    found: true,
                    word: word,
                    action: 'delete'
                };
            }
        }
        
        return false;
        
    } catch (error) {
        console.error('Check bad words error:', error);
        return false;
    }
}

// ========== UTILITY FUNCTIONS ==========

function parseTime(timeStr) {
    const regex = /^(\d+)([mhd])$/i;
    const match = timeStr.match(regex);
    
    if (!match) return null;
    
    const amount = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    switch (unit) {
        case 'm': return amount * 60 * 1000; // minutes
        case 'h': return amount * 60 * 60 * 1000; // hours
        case 'd': return amount * 24 * 60 * 60 * 1000; // days
        default: return null;
    }
}

function formatTime(ms) {
    if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
    if (ms < 86400000) return `${Math.floor(ms / 3600000)}h`;
    return `${Math.floor(ms / 86400000)}d`;
}

async function loadBadWords() {
    try {
        const data = await fs.readFile(BAD_WORDS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // Return empty object if file doesn't exist
        return {};
    }
}

async function saveBadWords(data) {
    await fs.writeFile(BAD_WORDS_FILE, JSON.stringify(data, null, 2));
}

async function loadLinkConfig() {
    try {
        const data = await fs.readFile(LINK_CHANNELS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // Return empty object if file doesn't exist
        return {};
    }
}

async function saveLinkConfig(data) {
    await fs.writeFile(LINK_CHANNELS_FILE, JSON.stringify(data, null, 2));
}

// ========== EXPORTS FOR USE IN INDEX.JS ==========

// For bad words auto-mod
module.exports.checkBadWords = checkBadWords;

// For link protection auto-mod
module.exports.checkLinks = checkLinks;

// For loading/saving link config
module.exports.loadLinkConfig = loadLinkConfig;
module.exports.saveLinkConfig = saveLinkConfig;
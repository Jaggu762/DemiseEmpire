// commands/moderation/mod.js - Main moderation command
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

// Load bad words
const BAD_WORDS_FILE = path.join(__dirname, '../../data/bad-words.json');

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
                    '`^mod warn @user [reason]` - Warn a user'
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
                name: '🚫 Auto-Moderation',
                value: [
                    '`^mod badwords list` - Show banned words',
                    '`^mod badwords add <word>` - Add a bad word',
                    '`^mod badwords remove <word>` - Remove a bad word',
                    '`^mod badwords enable` - Enable auto-mod',
                    '`^mod badwords disable` - Disable auto-mod',
                    '`^mod badwords warnings @user` - Check user warnings',
                    '`^mod badwords resetwarn @user` - Reset user warnings'
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
        
        console.log(`[Auto-Mod Debug] Checking message in guild: ${guildId}`);
        console.log(`[Auto-Mod Debug] Guild config exists: ${!!data[guildId]}`);
        console.log(`[Auto-Mod Debug] Auto-mod enabled: ${data[guildId]?.enabled}`);
        console.log(`[Auto-Mod Debug] Words count: ${data[guildId]?.words?.length || 0}`);
        console.log(`[Auto-Mod Debug] Message content: ${message.content.substring(0, 50)}...`);
        
        // If no config for this guild or auto-mod is disabled, return false
        if (!data[guildId] || data[guildId].enabled === false || !data[guildId].words || data[guildId].words.length === 0) {
            console.log(`[Auto-Mod Debug] Skipping check - no config, disabled, or no words`);
            return false;
        }
        
        const content = message.content.toLowerCase();
        const badWords = data[guildId].words;
        
        // Ensure badWords is an array
        if (!Array.isArray(badWords)) {
            console.error(`[Auto-Mod Debug] Bad words for guild ${guildId} is not an array:`, badWords);
            return false;
        }
        
        console.log(`[Auto-Mod Debug] Checking against ${badWords.length} bad words`);
        
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
        
        console.log(`[Auto-Mod Debug] No bad words found`);
        return false;
        
    } catch (error) {
        console.error('Check bad words error:', error);
        return false;
    }
}

// Export for use in index.js
module.exports.checkBadWords = checkBadWords;
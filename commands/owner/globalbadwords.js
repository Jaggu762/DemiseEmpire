const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

// Load bad words
const BAD_WORDS_FILE = path.join(__dirname, '../../data/bad-words.json');

module.exports = {
    name: 'globalbadwords',
    description: 'Bot owner only - Manage global bad words for all servers',
    aliases: ['gbadwords', 'globalbad', 'gbw'],
    category: 'Owner',
    ownerOnly: true, // Only bot owner can use this
    
    async execute(message, args, client) {
        // Check if user is bot owner (from config or hardcoded)
        const ownerId = process.env.BOT_OWNER_ID || '564029689233014803'; // Replace with your Discord ID
        
        if (message.author.id !== ownerId) {
            return message.reply('❌ This command is for bot owner only.');
        }
        
        if (args.length === 0) {
            const embed = createHelpEmbed();
            return message.reply({ embeds: [embed] });
        }
        
        const subcommand = args[0].toLowerCase();
        
        switch (subcommand) {
            case 'list':
                await showGlobalBadWords(message);
                break;
            case 'add':
                await addGlobalBadWord(message, args.slice(1));
                break;
            case 'remove':
                await removeGlobalBadWord(message, args.slice(1));
                break;
            case 'sync':
                await syncAllServers(message);
                break;
            case 'stats':
                await showStats(message);
                break;  // ADD THIS
            case 'help':
                const helpEmbed = createHelpEmbed();
                await message.reply({ embeds: [helpEmbed] });
                break;
            default:
                message.reply('❌ Unknown subcommand. Use `^globalbadwords help` for available commands.');
        }
    }
};

function createHelpEmbed() {
    return new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('🌍 Global Bad Words Manager')
        .setDescription('Bot owner commands to manage bad words for ALL servers')
        .addFields(
            {
                name: '📋 View & Manage',
                value: [
                    '`^globalbadwords list` - Show all global bad words',
                    '`^globalbadwords add <word>` - Add a word to global list',
                    '`^globalbadwords remove <word>` - Remove a word from global list'
                ].join('\n'),
                inline: false
            },
            {
                name: '🔄 Sync & Apply',
                value: [
                    '`^globalbadwords sync` - Apply global words to ALL servers',
                    '`^globalbadwords sync serverid` - Apply to specific server'
                ].join('\n'),
                inline: false
            },
            {
                name: '📊 Statistics',
                value: [
                    '`^globalbadwords stats` - Show usage statistics'
                ].join('\n'),
                inline: false
            }
        )
        .setFooter({ text: 'Only bot owner can use these commands' });
}

async function showGlobalBadWords(message) {
    try {
        const data = await loadBadWords();
        
        if (!data.default) {
            return message.reply('❌ No global bad words configured.');
        }
        
        const englishWords = data.default.en || [];
        const hindiWords = data.default.hi || [];
        const nepaliWords = data.default.ne || [];
        
        const totalWords = [...englishWords, ...hindiWords, ...nepaliWords];
        const uniqueWords = [...new Set(totalWords)];
        
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('🌍 Global Bad Words')
            .setDescription('These words apply to ALL servers by default')
            .addFields(
                {
                    name: `English (${englishWords.length})`,
                    value: englishWords.length > 0 
                        ? englishWords.map((w, i) => `${i + 1}. \`${w}\``).join('\n').substring(0, 1000)
                        : 'No words',
                    inline: false
                },
                {
                    name: `Hindi (${hindiWords.length})`,
                    value: hindiWords.length > 0 
                        ? hindiWords.map((w, i) => `${i + 1}. \`${w}\``).join('\n').substring(0, 1000)
                        : 'No words',
                    inline: false
                },
                {
                    name: `Nepali (${nepaliWords.length})`,
                    value: nepaliWords.length > 0 
                        ? nepaliWords.map((w, i) => `${i + 1}. \`${w}\``).join('\n').substring(0, 1000)
                        : 'No words',
                    inline: false
                },
                {
                    name: '📊 Totals',
                    value: [
                        `**Total Unique Words:** ${uniqueWords.length}`,
                        `**English:** ${englishWords.length}`,
                        `**Hindi:** ${hindiWords.length}`,
                        `**Nepali:** ${nepaliWords.length}`
                    ].join('\n'),
                    inline: false
                }
            )
            .setFooter({ text: 'Use ^globalbadwords add/remove to manage' });
        
        await message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Show global bad words error:', error);
        message.reply('❌ Failed to load global bad words.');
    }
}

async function addGlobalBadWord(message, args) {
    if (args.length === 0) {
        return message.reply('❌ Usage: `^globalbadwords add <word> [language]`\nLanguages: en, hi, ne (default: en)');
    }
    
    const word = args[0].toLowerCase().trim();
    const language = (args[1] || 'en').toLowerCase();
    
    if (!['en', 'hi', 'ne'].includes(language)) {
        return message.reply('❌ Invalid language. Use: en (English), hi (Hindi), ne (Nepali)');
    }
    
    try {
        const data = await loadBadWords();
        
        if (!data.default) {
            data.default = { en: [], hi: [], ne: [] };
        }
        
        if (!data.default[language]) {
            data.default[language] = [];
        }
        
        if (data.default[language].includes(word)) {
            return message.reply(`❌ This word is already in the ${language.toUpperCase()} list.`);
        }
        
        data.default[language].push(word);
        await saveBadWords(data);
        
        // Also add to all existing servers
        const allServers = Object.keys(data).filter(key => key !== 'default' && key !== '1452543842959233086');
        let updatedServers = 0;
        
        for (const serverId of allServers) {
            if (data[serverId] && Array.isArray(data[serverId].words)) {
                if (!data[serverId].words.includes(word)) {
                    data[serverId].words.push(word);
                    updatedServers++;
                }
            }
        }
        
        await saveBadWords(data);
        
        message.reply(`✅ Added \`${word}\` to global ${language.toUpperCase()} bad words list.`);
        if (updatedServers > 0) {
            message.channel.send(`🔄 Also added to ${updatedServers} existing servers.`);
        }
        
    } catch (error) {
        console.error('Add global bad word error:', error);
        message.reply('❌ Failed to add global bad word.');
    }
}

async function removeGlobalBadWord(message, args) {
    if (args.length === 0) {
        return message.reply('❌ Usage: `^globalbadwords remove <word>`');
    }
    
    const word = args[0].toLowerCase().trim();
    
    try {
        const data = await loadBadWords();
        
        if (!data.default) {
            return message.reply('❌ No global bad words configured.');
        }
        
        let removedFrom = [];
        
        // Remove from all languages
        for (const lang of ['en', 'hi', 'ne']) {
            if (data.default[lang] && Array.isArray(data.default[lang])) {
                const index = data.default[lang].indexOf(word);
                if (index > -1) {
                    data.default[lang].splice(index, 1);
                    removedFrom.push(lang.toUpperCase());
                }
            }
        }
        
        if (removedFrom.length === 0) {
            return message.reply('❌ This word is not in any global bad words list.');
        }
        
        // Also remove from all existing servers
        const allServers = Object.keys(data).filter(key => key !== 'default' && key !== '1452543842959233086');
        let updatedServers = 0;
        
        for (const serverId of allServers) {
            if (data[serverId] && Array.isArray(data[serverId].words)) {
                const serverIndex = data[serverId].words.indexOf(word);
                if (serverIndex > -1) {
                    data[serverId].words.splice(serverIndex, 1);
                    updatedServers++;
                }
            }
        }
        
        await saveBadWords(data);
        
        message.reply(`✅ Removed \`${word}\` from global bad words list (${removedFrom.join(', ')}).`);
        if (updatedServers > 0) {
            message.channel.send(`🔄 Also removed from ${updatedServers} existing servers.`);
        }
        
    } catch (error) {
        console.error('Remove global bad word error:', error);
        message.reply('❌ Failed to remove global bad word.');
    }
}

async function syncAllServers(message) {
    try {
        const data = await loadBadWords();
        
        if (!data.default) {
            return message.reply('❌ No global bad words configured.');
        }
        
        // Get all global words from all languages
        const globalWords = [];
        for (const lang of ['en', 'hi', 'ne']) {
            if (data.default[lang] && Array.isArray(data.default[lang])) {
                globalWords.push(...data.default[lang]);
            }
        }
        
        const uniqueGlobalWords = [...new Set(globalWords)];
        
        if (uniqueGlobalWords.length === 0) {
            return message.reply('❌ No global words to sync.');
        }
        
        // Get specific server ID if provided
        const targetServerId = message.args && message.args[1] ? message.args[1] : null;
        
        const allServers = Object.keys(data).filter(key => key !== 'default' && key !== '1452543842959233086');
        
        let syncedServers = 0;
        let updatedServers = 0;
        
        for (const serverId of allServers) {
            // If targeting specific server, skip others
            if (targetServerId && serverId !== targetServerId) {
                continue;
            }
            
            if (!data[serverId]) {
                data[serverId] = { words: [...uniqueGlobalWords], enabled: true };
                syncedServers++;
            } else {
                // Merge global words with server words
                const serverWords = data[serverId].words || [];
                const mergedWords = [...new Set([...serverWords, ...uniqueGlobalWords])];
                
                if (mergedWords.length !== serverWords.length) {
                    data[serverId].words = mergedWords;
                    updatedServers++;
                }
            }
        }
        
        await saveBadWords(data);
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🔄 Global Bad Words Sync Complete')
            .addFields(
                { name: '🌍 Global Words', value: `${uniqueGlobalWords.length} unique words`, inline: true },
                { name: '🔄 Synced Servers', value: `${syncedServers} servers`, inline: true },
                { name: '📝 Updated Servers', value: `${updatedServers} servers`, inline: true }
            )
            .setFooter({ text: targetServerId ? `Targeted server: ${targetServerId}` : 'Applied to all servers' });
        
        await message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Sync all servers error:', error);
        message.reply('❌ Failed to sync servers.');
    }
}
async function showStats(message) {
    try {
        const data = await loadBadWords();
        
        if (!data.default) {
            return message.reply('❌ No global bad words configured.');
        }
        
        // Count all servers
        const allServers = Object.keys(data).filter(key => key !== 'default' && !isNaN(key));
        const enabledServers = allServers.filter(serverId => 
            data[serverId] && data[serverId].enabled !== false
        );
        const disabledServers = allServers.filter(serverId => 
            data[serverId] && data[serverId].enabled === false
        );
        
        // Count total bad words
        const englishWords = data.default.en || [];
        const hindiWords = data.default.hi || [];
        const nepaliWords = data.default.ne || [];
        const totalWords = [...englishWords, ...hindiWords, ...nepaliWords];
        const uniqueWords = [...new Set(totalWords)];
        
        // Count custom words per server
        let totalCustomWords = 0;
        let serversWithCustomWords = 0;
        
        for (const serverId of allServers) {
            if (data[serverId] && Array.isArray(data[serverId].words)) {
                const serverWords = data[serverId].words;
                const globalWords = uniqueWords;
                const customWords = serverWords.filter(word => !globalWords.includes(word));
                
                if (customWords.length > 0) {
                    totalCustomWords += customWords.length;
                    serversWithCustomWords++;
                }
            }
        }
        
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('📊 Global Bad Words Statistics')
            .setDescription('Statistics about bad words usage across all servers')
            .addFields(
                { 
                    name: '🌍 Global Words', 
                    value: [
                        `**Total Unique Words:** ${uniqueWords.length}`,
                        `**English:** ${englishWords.length} words`,
                        `**Hindi:** ${hindiWords.length} words`,
                        `**Nepali:** ${nepaliWords.length} words`
                    ].join('\n'), 
                    inline: true 
                },
                { 
                    name: '📊 Server Coverage', 
                    value: [
                        `**Total Servers:** ${allServers.length}`,
                        `**Auto-mod Enabled:** ${enabledServers.length}`,
                        `**Auto-mod Disabled:** ${disabledServers.length}`,
                        `**Coverage:** ${Math.round((enabledServers.length / allServers.length) * 100)}%`
                    ].join('\n'), 
                    inline: true 
                },
                { 
                    name: '⚙️ Customizations', 
                    value: [
                        `**Servers with Custom Words:** ${serversWithCustomWords}`,
                        `**Total Custom Words:** ${totalCustomWords}`,
                        `**Average per Server:** ${serversWithCustomWords > 0 ? Math.round(totalCustomWords / serversWithCustomWords) : 0}`
                    ].join('\n'), 
                    inline: true 
                }
            )
            .setFooter({ text: 'DTEmpire Auto-mod Statistics' })
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Show stats error:', error);
        message.reply('❌ Failed to load statistics.');
    }
}
// Utility functions
async function loadBadWords() {
    try {
        const data = await fs.readFile(BAD_WORDS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return {};
    }
}

async function saveBadWords(data) {
    await fs.writeFile(BAD_WORDS_FILE, JSON.stringify(data, null, 2));
}

// Export utility functions if needed elsewhere
module.exports.loadBadWords = loadBadWords;
module.exports.saveBadWords = saveBadWords;
// commands/levels/level.js
const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    PermissionFlagsBits 
} = require('discord.js');

module.exports = {
    name: 'level',
    description: 'Level system - check your rank and progress',
    aliases: ['rank', 'xp', 'levels'],
    category: 'Leveling',
    
    async execute(message, args, client, db) {
        if (args.length === 0) {
            return showUserRank(message, client, db);
        }
        
        const subcommand = args[0].toLowerCase();
        
        switch (subcommand) {
            case 'leaderboard':
            case 'lb':
                await showLeaderboard(message, client, db);
                break;
            case 'info':
                await showLevelInfo(message, client);
                break;
            case 'set':
                await setUserLevel(message, args.slice(1), client, db);
                break;
            case 'channel':
                await setLevelChannel(message, args.slice(1), client, db);
                break;
            case 'test':
                await testLevelUp(message, args.slice(1), client, db);
                break;
            default:
                // Check if they're trying to see someone else's rank
                const mentionedUser = message.mentions.users.first();
                if (mentionedUser) {
                    await showUserRank(message, client, db, mentionedUser);
                } else {
                    message.reply('❌ Unknown subcommand. Use: leaderboard, info, set, channel, or mention a user');
                }
        }
    }
};

// ========== SHOW USER RANK ==========
async function showUserRank(message, client, db, specificUser = null) {
    try {
        const user = specificUser || message.author;
        const guild = message.guild;
        
        // Get user economy (which includes XP)
        const economy = await db.getUserEconomy(user.id, guild.id);
        
        // If no economy record exists, create one
        if (!economy) {
            await db.updateUserEconomy(user.id, guild.id, {
                wallet: 100,
                bank: 0,
                xp: 0,
                level: 1,
                messages: 0,
                voice_time: 0,
                reputation: 0,
                created_at: Date.now(),
                updated_at: Date.now()
            });
        }
        
        // Get fresh data after creation/update
        const userEconomy = await db.getUserEconomy(user.id, guild.id);
        
        // Debug: Check message count
        const messageCount = userEconomy?.messages || 0;
        console.log(`[Debug] ${user.username} has ${messageCount} messages in database`);
        
        // Calculate progress to next level
        const currentXP = userEconomy?.xp || 0;
        const currentLevel = userEconomy?.level || 1;
        const xpForNextLevel = calculateXPForLevel(currentLevel + 1);
        const xpForCurrentLevel = calculateXPForLevel(currentLevel);
        const progress = Math.max(0, currentXP - xpForCurrentLevel); // Ensure non-negative
        const needed = xpForNextLevel - xpForCurrentLevel;
        const progressPercent = needed > 0 ? Math.min(100, Math.max(0, Math.floor((progress / needed) * 100))) : 100;
        
        // Get rank position
        const allEconomy = await getAllEconomyWithFallback(db, guild.id);
        const sortedByXP = allEconomy.sort((a, b) => (b.xp || 0) - (a.xp || 0));
        const rankIndex = sortedByXP.findIndex(e => e.user_id === user.id);
        const rank = rankIndex >= 0 ? rankIndex + 1 : sortedByXP.length + 1;
        
        // Create progress bar (with safety check)
        const progressBar = createProgressBar(progressPercent, 15);
        
        // Create rank embed
        const embed = new EmbedBuilder()
            .setColor('#ff9900')
            .setTitle(`🏆 ${user.username}'s Rank`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '📊 Rank', value: `#${rank} of ${sortedByXP.length || 1}`, inline: true },
                { name: '⭐ Level', value: currentLevel.toString(), inline: true },
                { name: '✨ XP', value: currentXP.toString(), inline: true },
                { 
                    name: '📈 Progress', 
                    value: `\`${progressBar}\` ${progressPercent}%\n${progress}/${needed} XP to level ${currentLevel + 1}`,
                    inline: false 
                },
                { name: '💬 Messages', value: messageCount.toString(), inline: true },
                { name: '🎤 Voice Time', value: formatTime(userEconomy?.voice_time || 0), inline: true },
                { name: '🏅 Reputation', value: (userEconomy?.reputation || 0).toString(), inline: true }
            )
            .setFooter({ text: `Keep chatting to level up! • DTEmpire Level System` })
            .setTimestamp();
        
        // Create action buttons
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`level_leaderboard_${guild.id}`)
                    .setLabel('Leaderboard')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🏆'),
                new ButtonBuilder()
                    .setCustomId(`level_info_${guild.id}`)
                    .setLabel('Level Info')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('ℹ️'),
                new ButtonBuilder()
                    .setCustomId(`level_rewards_${guild.id}`)
                    .setLabel('Rewards')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🎁')
            );
        
        await message.reply({ 
            embeds: [embed],
            components: [actionRow] 
        });
        
    } catch (error) {
        console.error('Show rank error:', error);
        message.reply('❌ Failed to load rank information. Please try again.');
    }
}

// ========== SHOW LEADERBOARD ==========
async function showLeaderboard(message, client, db) {
    try {
        const guild = message.guild;
        const allEconomy = await getAllEconomyWithFallback(db, guild.id);
        
        // Sort by XP (level)
        const sortedByXP = allEconomy.sort((a, b) => (b.xp || 0) - (a.xp || 0)).slice(0, 10);
        
        const embed = new EmbedBuilder()
            .setColor('#ffd700')
            .setTitle('🏆 Level Leaderboard')
            .setDescription(`Top 10 members in ${guild.name}`)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .setFooter({ text: 'DTEmpire Level System • Updated in real-time' })
            .setTimestamp();
        
        // Add top 3 with special medals
        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
        
        for (let i = 0; i < Math.min(sortedByXP.length, 10); i++) {
            const userData = sortedByXP[i];
            try {
                const user = await client.users.fetch(userData.user_id).catch(() => null);
                const level = userData.level || 1;
                const xp = userData.xp || 0;
                
                embed.addFields({
                    name: `${medals[i]} ${user ? user.username : 'Unknown User'}`,
                    value: `Level ${level} • ${xp} XP • ${userData.messages || 0} messages`,
                    inline: false
                });
            } catch (error) {
                // Skip if user can't be fetched
                continue;
            }
        }
        
        // Add user's position if not in top 10
        const authorIndex = allEconomy.findIndex(e => e.user_id === message.author.id);
        if (authorIndex >= 0) {
            const authorData = allEconomy.find(e => e.user_id === message.author.id);
            if (authorData) {
                embed.addFields({
                    name: `📊 ${message.author.username}'s Position: #${authorIndex + 1}`,
                    value: `Level ${authorData.level || 1} • ${authorData.xp || 0} XP`,
                    inline: false
                });
            }
        }
        
        await message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Leaderboard error:', error);
        message.reply('❌ Failed to load leaderboard.');
    }
}

// ========== SHOW LEVEL INFO ==========
async function showLevelInfo(message, client) {
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('ℹ️ Level System Information')
        .setDescription('How the leveling system works')
        .addFields(
            {
                name: '✨ Earning XP',
                value: [
                    '• **Messages:** 15 XP per message (1 min cooldown)',
                    '• **Voice Chat:** 5 XP per minute (max 60 min/day)',
                    '• **Reactions:** 2 XP per reaction',
                    '• **Active Days:** 50 XP bonus per day'
                ].join('\n'),
                inline: false
            },
            {
                name: '📈 Level Formula',
                value: '`XP Required = Level² × 100`\nExample:\n• Level 1 → 100 XP\n• Level 2 → 400 XP\n• Level 5 → 2,500 XP\n• Level 10 → 10,000 XP',
                inline: false
            },
            {
                name: '🎁 Level Rewards',
                value: [
                    '• **Level 5:** Special role color',
                    '• **Level 10:** Access to exclusive channels',
                    '• **Level 20:** Custom nickname permission',
                    '• **Level 30:** Special badge in profile',
                    '• **Level 50:** VIP role with special perks'
                ].join('\n'),
                inline: false
            }
        )
        .setFooter({ text: 'Stay active to level up faster!' });
    
    await message.reply({ embeds: [embed] });
}

// ========== SET USER LEVEL (ADMIN) ==========
async function setUserLevel(message, args, client, db) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return message.reply('❌ You need **Manage Server** permission to set levels.');
    }
    
    if (args.length < 2) {
        return message.reply('❌ Usage: `^level set @user <level>`\nExample: `^level set @user 10`');
    }
    
    const user = message.mentions.users.first();
    if (!user) {
        return message.reply('❌ Please mention a user.');
    }
    
    const level = parseInt(args[1]);
    if (isNaN(level) || level < 1 || level > 100) {
        return message.reply('❌ Please provide a valid level (1-100).');
    }
    
    try {
        // Calculate XP for the level
        const xp = calculateXPForLevel(level);
        
        // Get current economy to preserve other fields
        const currentEconomy = await db.getUserEconomy(user.id, message.guild.id) || {};
        
        // Update user economy
        await db.updateUserEconomy(user.id, message.guild.id, {
            ...currentEconomy,
            level: level,
            xp: xp,
            updated_at: Date.now()
        });
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Level Updated')
            .addFields(
                { name: 'User', value: user.tag, inline: true },
                { name: 'New Level', value: level.toString(), inline: true },
                { name: 'New XP', value: xp.toString(), inline: true },
                { name: 'Updated by', value: message.author.tag, inline: true }
            )
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        
        // Check for level up rewards - pass the message object
        await checkLevelRewards(message.guild.id, user, level, client, db, message);
        
    } catch (error) {
        console.error('Set level error:', error);
        message.reply('❌ Failed to update user level.');
    }
}

// ========== SET LEVEL CHANNEL (ADMIN) ==========
async function setLevelChannel(message, args, client, db) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return message.reply('❌ You need **Manage Server** permission to set level channel.');
    }
    
    if (args.length === 0) {
        // Show current level channel
        const config = await db.getGuildConfig(message.guild.id);
        const levelChannel = config?.level_up_channel;
        
        if (levelChannel) {
            const channel = message.guild.channels.cache.get(levelChannel);
            if (channel) {
                return message.reply(`✅ Current level up channel: ${channel.toString()}\nUse \`^level channel #channel\` to change it.`);
            }
        }
        return message.reply('❌ No level up channel set. Use `^level channel #channel` to set one.');
    }
    
    // Set new level channel
    const channel = message.mentions.channels.first();
    if (!channel) {
        return message.reply('❌ Please mention a channel. Example: `^level channel #level-up`');
    }
    
    try {
        await db.updateGuildConfig(message.guild.id, {
            level_up_channel: channel.id
        });
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Level Up Channel Set')
            .setDescription(`Level up announcements will now be sent to ${channel.toString()}`)
            .addFields(
                { name: 'Channel', value: channel.name, inline: true },
                { name: 'Set by', value: message.author.tag, inline: true }
            )
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Set level channel error:', error);
        message.reply('❌ Failed to set level channel.');
    }
}

// ========== TEST LEVEL UP (ADMIN) ==========
async function testLevelUp(message, args, client, db) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return message.reply('❌ You need **Manage Server** permission to test level ups.');
    }
    
    const user = message.mentions.users.first() || message.author;
    const level = parseInt(args[1]) || 5;
    
    if (isNaN(level) || level < 1 || level > 100) {
        return message.reply('❌ Please provide a valid level (1-100).');
    }
    
    try {
        // Test level up announcement - pass the message object
        await checkLevelRewards(message.guild.id, user, level, client, db, message);
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Level Up Test')
            .setDescription(`Tested level ${level} announcement for ${user.tag}`)
            .addFields(
                { name: 'User', value: user.tag, inline: true },
                { name: 'Test Level', value: level.toString(), inline: true },
                { name: 'Tested by', value: message.author.tag, inline: true }
            )
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Test level up error:', error);
        message.reply('❌ Failed to test level up.');
    }
}

// ========== HELPER FUNCTIONS ==========

async function getAllEconomyWithFallback(db, guildId) {
    try {
        // Try the database method first
        if (db.getAllEconomy) {
            return await db.getAllEconomy(guildId);
        }
        
        // Fallback: manually filter from userEconomy
        if (db.data && db.data.userEconomy) {
            const allEconomy = [];
            for (const key in db.data.userEconomy) {
                const economy = db.data.userEconomy[key];
                if (economy.guild_id === guildId) {
                    allEconomy.push(economy);
                }
            }
            return allEconomy;
        }
        
        return [];
    } catch (error) {
        console.error('Get all economy error:', error);
        return [];
    }
}

function calculateXPForLevel(level) {
    return Math.floor(Math.pow(level, 2) * 100);
}

function createProgressBar(percent, length) {
    // Ensure percent is between 0 and 100
    const safePercent = Math.max(0, Math.min(100, percent));
    const filled = Math.floor((safePercent / 100) * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

function formatTime(ms) {
    if (!ms || ms === 0) return '0h 0m';
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
}

// ========== LEVEL UP REWARDS ==========
async function checkLevelRewards(guildId, user, newLevel, client, db, originalMessage = null) {
    try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;
        
        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member) return;
        
        const rewards = {
            1: { roleName: 'Level 1', color: '#808080', message: 'Welcome to level 1!' },
            2: { roleName: 'Level 2', color: '#008000', message: 'Moving up to level 2!' },
            3: { roleName: 'Level 3', color: '#0000ff', message: 'Great job reaching level 3!' },
            4: { roleName: 'Level 4', color: '#800080', message: 'Level 4 achieved!' },
            5: { roleName: 'Level 5', color: '#ff9900', message: 'Halfway to level 10!' },
            6: { roleName: 'Level 6', color: '#ff4500', message: 'Level 6 unlocked!' },
            7: { roleName: 'Level 7', color: '#ff1493', message: 'Level 7 - getting higher!' },
            8: { roleName: 'Level 8', color: '#00ced1', message: 'Level 8 milestone!' },
            9: { roleName: 'Level 9', color: '#da70d6', message: 'One more to go for level 10!' },
            10: { roleName: 'Level 10', color: '#00ff00', message: 'Double digits! Level 10!' },
            20: { roleName: 'Level 20', color: '#9900ff', message: 'Level 20 - Amazing progress!' },
            30: { roleName: 'Level 30', color: '#ff00ff', message: 'Level 30 - Elite status!' },
            50: { roleName: 'VIP', color: '#ffd700', message: 'VIP Status Achieved!' }
        };
        
        const reward = rewards[newLevel] || { 
            roleName: `Level ${newLevel}`, 
            color: '#ffffff',
            message: `Congratulations on reaching level ${newLevel}!`
        };
        
        // Try to give role if it exists
        if (reward.roleName) {
            let role = guild.roles.cache.find(r => r.name === reward.roleName);
            
            if (!role) {
                try {
                    role = await guild.roles.create({
                        name: reward.roleName,
                        color: reward.color,
                        reason: `Level ${newLevel} reward role`,
                        permissions: []
                    });
                } catch (roleError) {
                    console.log('Could not create role:', roleError.message);
                }
            }
            
            if (role) {
                try {
                    await member.roles.add(role);
                } catch (addRoleError) {
                    console.log('Could not add role:', addRoleError.message);
                }
            }
        }
        
        // Send level up DM
        try {
            const dmEmbed = new EmbedBuilder()
                .setColor(reward.color)
                .setTitle(`🎉 Level ${newLevel} Unlocked!`)
                .setDescription(`${reward.message}`)
                .addFields(
                    { name: '🎁 Achievement', value: `Level ${newLevel} milestone reached in **${guild.name}**!`, inline: true }
                )
                .setThumbnail(guild.iconURL({ dynamic: true }))
                .setFooter({ text: 'Keep leveling up for more rewards!' });
            
            await user.send({ embeds: [dmEmbed] });
        } catch (dmError) {
            // DM failed, that's okay
        }
        
        // Announce in level up channel if configured
        const config = await db.getGuildConfig(guildId);
        if (config?.level_up_channel) {
            const channelId = config.level_up_channel;
            if (channelId) {
                const levelChannel = guild.channels.cache.get(channelId);
                if (levelChannel) {
                    const announceEmbed = new EmbedBuilder()
                        .setColor(reward.color)
                        .setTitle('🎉 Level Up!')
                        .setDescription(`${user.toString()} has reached **level ${newLevel}**!`)
                        .addFields(
                            { name: 'Achievement', value: reward.message, inline: true }
                        )
                        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                        .setTimestamp();
                    
                    await levelChannel.send({ embeds: [announceEmbed] });
                }
            }
        }
        
        // Send message in current channel if we have the original message
        // Only if it's not a command message (to avoid duplicate announcements)
        if (originalMessage && originalMessage.channel) {
            // Check if this is a command message
            const isCommand = originalMessage.content && originalMessage.content.startsWith(client.botInfo?.prefix || '^');
            
            if (!isCommand) {
                const currentEmbed = new EmbedBuilder()
                    .setColor(reward.color)
                    .setTitle('🎉 Level Up Announcement')
                    .setDescription(`${user.toString()} has reached **level ${newLevel}**!`)
                    .addFields(
                        { name: 'Achievement', value: reward.message, inline: true }
                    )
                    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                    .setTimestamp();
                
                await originalMessage.channel.send({ embeds: [currentEmbed] });
            }
        }
        
    } catch (error) {
        console.error('Level rewards error:', error);
    }
}

// ========== HANDLE BUTTON INTERACTIONS ==========
async function handleLevelButton(interaction, client, db) {
    const customId = interaction.customId;
    
    try {
        if (customId.startsWith('level_leaderboard_')) {
            const guildId = customId.replace('level_leaderboard_', '');
            if (guildId !== interaction.guild.id) return;
            
            const guild = interaction.guild;
            const allEconomy = await getAllEconomyWithFallback(db, guild.id);
            
            // Sort by XP (level)
            const sortedByXP = allEconomy.sort((a, b) => (b.xp || 0) - (a.xp || 0)).slice(0, 10);
            
            const embed = new EmbedBuilder()
                .setColor('#ffd700')
                .setTitle('🏆 Level Leaderboard')
                .setDescription(`Top 10 members in ${guild.name}`)
                .setThumbnail(guild.iconURL({ dynamic: true }))
                .setFooter({ text: 'DTEmpire Level System • Updated in real-time' })
                .setTimestamp();
            
            const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
            
            for (let i = 0; i < Math.min(sortedByXP.length, 10); i++) {
                const userData = sortedByXP[i];
                try {
                    const user = await client.users.fetch(userData.user_id).catch(() => null);
                    const level = userData.level || 1;
                    const xp = userData.xp || 0;
                    
                    embed.addFields({
                        name: `${medals[i]} ${user ? user.username : 'Unknown User'}`,
                        value: `Level ${level} • ${xp} XP • ${userData.messages || 0} messages`,
                        inline: false
                    });
                } catch (error) {
                    continue;
                }
            }
            
            await interaction.reply({ embeds: [embed], flags: 64 }); // flags: 64 = ephemeral
            
        } else if (customId.startsWith('level_info_')) {
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('ℹ️ Level System Information')
                .setDescription('How the leveling system works')
                .addFields(
                    {
                        name: '✨ Earning XP',
                        value: [
                            '• **Messages:** 15 XP per message (1 min cooldown)',
                            '• **Voice Chat:** 5 XP per minute (max 60 min/day)',
                            '• **Reactions:** 2 XP per reaction',
                            '• **Active Days:** 50 XP bonus per day'
                        ].join('\n'),
                        inline: false
                    },
                    {
                        name: '📈 Level Formula',
                        value: '`XP Required = Level² × 100`\nExample:\n• Level 1 → 100 XP\n• Level 2 → 400 XP\n• Level 5 → 2,500 XP\n• Level 10 → 10,000 XP',
                        inline: false
                    },
                    {
                        name: '🎁 Level Rewards',
                        value: [
                            '• **Level 1:** Starter role',
                            '• **Level 5:** Special role color',
                            '• **Level 10:** Access to exclusive channels',
                            '• **Level 20:** Custom nickname permission',
                            '• **Level 30:** Special badge in profile',
                            '• **Level 50:** VIP role with special perks'
                        ].join('\n'),
                        inline: false
                    }
                )
                .setFooter({ text: 'Stay active to level up faster!' });
            
            await interaction.reply({ embeds: [embed], flags: 64 }); // flags: 64 = ephemeral
            
        } else if (customId.startsWith('level_rewards_')) {
            const embed = new EmbedBuilder()
                .setColor('#ff9900')
                .setTitle('🎁 Level Rewards')
                .setDescription('Here are the rewards you can unlock at each level:')
                .addFields(
                    {
                        name: '📊 Every Level',
                        value: '• Level up announcement in the level channel\n• Special DM congratulating you',
                        inline: false
                    },
                    {
                        name: '🎭 Special Roles',
                        value: [
                            '• **Level 1-10:** Colored roles for each level',
                            '• **Level 20:** Custom nickname permission',
                            '• **Level 30:** Special badge role',
                            '• **Level 50:** VIP role with special perks'
                        ].join('\n'),
                        inline: false
                    },
                    {
                        name: '🔓 Unlocked Features',
                        value: [
                            '• **Level 10:** Access to exclusive channels',
                            '• **Level 25:** Ability to use custom emojis',
                            '• **Level 40:** Priority support access',
                            '• **Level 75:** Custom profile card'
                        ].join('\n'),
                        inline: false
                    }
                )
                .setFooter({ text: 'Keep leveling up to unlock more rewards!' });
            
            await interaction.reply({ embeds: [embed], flags: 64 }); // flags: 64 = ephemeral
        }
        
    } catch (error) {
        console.error('Level button error:', error);
        await interaction.reply({ 
            content: '❌ An error occurred while processing your request.', 
            flags: 64 // ephemeral
        });
    }
}

// ========== CALCULATE LEVEL FROM XP ==========
function calculateLevelFromXP(xp) {
    if (xp <= 0) return 1;
    
    // Using the formula: XP = level² × 100
    // So: level = sqrt(XP / 100)
    const calculatedLevel = Math.floor(Math.sqrt(xp / 100));
    
    // Ensure at least level 1
    return Math.max(1, calculatedLevel);
}

// ========== CALCULATE XP FOR LEVEL ==========
function calculateXPForLevel(level) {
    if (level <= 1) return 0;
    return Math.floor(Math.pow(level, 2) * 100);
}

// Export for use in index.js
module.exports.checkLevelRewards = checkLevelRewards;
module.exports.handleLevelButton = handleLevelButton;
module.exports.calculateLevelFromXP = calculateLevelFromXP;
module.exports.calculateXPForLevel = calculateXPForLevel;

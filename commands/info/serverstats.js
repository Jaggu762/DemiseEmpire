// commands/info/serverstats.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'serverstats',
    description: 'Get detailed statistics about the server',
    aliases: ['serverstatistics', 'guildstats', 'stats'],
    category: 'Info',
    
    async execute(message, args, client, db) {
        try {
            if (!message.guild) {
                return message.reply('❌ This command can only be used in a server.');
            }
            
            const guild = message.guild;
            
            // Fetch all data
            await guild.members.fetch();
            await guild.channels.fetch();
            await guild.roles.fetch();
            
            // Calculate statistics
            const stats = await calculateServerStats(guild, db);
            
            // Create main embed
            const mainEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle(`📊 ${guild.name} Statistics`)
                .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
                .setDescription(`Detailed statistics for **${guild.name}**`)
                .addFields(
                    {
                        name: '👥 Member Statistics',
                        value: `**Total:** ${stats.members.total}\n**Humans:** ${stats.members.humans}\n**Bots:** ${stats.members.bots}\n**Online:** ${stats.members.online}`,
                        inline: true
                    },
                    {
                        name: '📁 Channel Statistics',
                        value: `**Total:** ${stats.channels.total}\n**Text:** ${stats.channels.text}\n**Voice:** ${stats.channels.voice}\n**Categories:** ${stats.channels.categories}`,
                        inline: true
                    },
                    {
                        name: '🎭 Role Statistics',
                        value: `**Total:** ${stats.roles.total}\n**Managed:** ${stats.roles.managed}\n**Default:** ${stats.roles.default}`,
                        inline: true
                    }
                )
                .setFooter({ text: `Server created ${stats.age}` })
                .setTimestamp();
            
            await message.channel.send({ embeds: [mainEmbed] });
            
            // Create detailed embed
            const detailedEmbed = new EmbedBuilder()
                .setColor('#43B581')
                .setTitle('📈 Detailed Statistics')
                .addFields(
                    {
                        name: '📊 Member Status',
                        value: `🟢 **Online:** ${stats.presence.online}\n🟡 **Idle:** ${stats.presence.idle}\n🔴 **DND:** ${stats.presence.dnd}\n⚪ **Offline:** ${stats.presence.offline}\n🟣 **Streaming:** ${stats.presence.streaming}`,
                        inline: true
                    },
                    {
                        name: '🔐 Verification',
                        value: `**Level:** ${stats.verification.level}\n**2FA Required:** ${stats.verification.mfa ? '✅' : '❌'}\n**Features:** ${stats.verification.features}`,
                        inline: true
                    },
                    {
                        name: '🚀 Nitro Boost',
                        value: `**Tier:** ${stats.nitro.tier}\n**Boosters:** ${stats.nitro.boosters}\n**Emoji Slots:** ${stats.nitro.emojiSlots}\n**Sticker Slots:** ${stats.nitro.stickerSlots}`,
                        inline: true
                    }
                );
            
            await message.channel.send({ embeds: [detailedEmbed] });
            
            // Create activity embed if there's activity data
            if (stats.activity && stats.activity.length > 0) {
                const activityEmbed = new EmbedBuilder()
                    .setColor('#FF6B6B')
                    .setTitle('🎮 Member Activities')
                    .setDescription('Current member activities in the server');
                
                for (const activity of stats.activity.slice(0, 5)) {
                    activityEmbed.addFields({
                        name: `${activity.emoji} ${activity.name}`,
                        value: `${activity.count} member${activity.count !== 1 ? 's' : ''}`,
                        inline: true
                    });
                }
                
                await message.channel.send({ embeds: [activityEmbed] });
            }
            
            // Create chart for member join distribution
            try {
                const chartBuffer = await createMemberJoinChart(guild);
                
                const chartEmbed = new EmbedBuilder()
                    .setColor('#9C27B0')
                    .setTitle('📅 Member Join Timeline')
                    .setDescription('Distribution of when members joined the server')
                    .setImage('attachment://memberJoinChart.png');
                
                await message.channel.send({
                    embeds: [chartEmbed],
                    files: [{
                        attachment: chartBuffer,
                        name: 'memberJoinChart.png'
                    }]
                });
            } catch (chartError) {
                console.log('Chart generation skipped:', chartError.message);
            }
            
            // Add action buttons
            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('refresh_stats')
                        .setLabel('Refresh Stats')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('🔄'),
                    new ButtonBuilder()
                        .setCustomId('export_stats')
                        .setLabel('Export Data')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('📊'),
                    new ButtonBuilder()
                        .setLabel('View Insights')
                        .setCustomId('view_insights')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🔍')
                );
            
            const statsMessage = await message.channel.send({
                content: '📈 **Statistics Dashboard**',
                components: [actionRow]
            });
            
            // Handle button interactions
            const collector = statsMessage.createMessageComponentCollector({
                time: 300000 // 5 minutes
            });
            
            collector.on('collect', async (interaction) => {
                if (interaction.customId === 'refresh_stats') {
                    await interaction.deferUpdate();
                    await message.channel.send('🔄 Refreshing statistics...');
                    await this.execute(message, args, client, db);
                } else if (interaction.customId === 'export_stats') {
                    await interaction.deferReply({ flags: 64 });
                    await exportStatistics(guild, interaction);
                } else if (interaction.customId === 'view_insights') {
                    await interaction.deferReply({ flags: 64 });
                    await showInsights(guild, interaction);
                }
            });
            
        } catch (error) {
            console.error('Serverstats command error:', error);
            message.reply('❌ An error occurred while fetching server statistics.');
        }
    }
};

// Helper function to calculate server statistics
async function calculateServerStats(guild, db) {
    const members = guild.members.cache;
    const channels = guild.channels.cache;
    const roles = guild.roles.cache;
    
    // Member stats
    const totalMembers = guild.memberCount;
    const humanMembers = members.filter(m => !m.user.bot).size;
    const botMembers = members.filter(m => m.user.bot).size;
    const onlineMembers = members.filter(m => m.presence?.status === 'online').size;
    
    // Channel stats
    const totalChannels = channels.size;
    const textChannels = channels.filter(c => c.type === 0).size;
    const voiceChannels = channels.filter(c => c.type === 2).size;
    const categoryChannels = channels.filter(c => c.type === 4).size;
    
    // Role stats
    const totalRoles = roles.size;
    const managedRoles = roles.filter(r => r.managed).size;
    const defaultRole = roles.filter(r => r.position === 0).size;
    
    // Presence stats
    const idleMembers = members.filter(m => m.presence?.status === 'idle').size;
    const dndMembers = members.filter(m => m.presence?.status === 'dnd').size;
    const offlineMembers = totalMembers - (onlineMembers + idleMembers + dndMembers);
    const streamingMembers = members.filter(m => 
        m.presence?.activities?.some(a => a.type === 1)
    ).size;
    
    // Activity tracking
    const activities = new Map();
    members.forEach(member => {
        if (member.presence?.activities) {
            member.presence.activities.forEach(activity => {
                if (activity.name) {
                    activities.set(activity.name, (activities.get(activity.name) || 0) + 1);
                }
            });
        }
    });
    
    const sortedActivities = Array.from(activities.entries())
        .map(([name, count]) => ({
            name,
            count,
            emoji: getActivityEmoji(name)
        }))
        .sort((a, b) => b.count - a.count);
    
    // Verification stats
    const verificationLevels = {
        0: 'None',
        1: 'Low',
        2: 'Medium',
        3: 'High',
        4: 'Highest'
    };
    
    // Server age
    const serverAge = Date.now() - guild.createdTimestamp;
    const ageString = formatDuration(serverAge);
    
    return {
        members: {
            total: totalMembers,
            humans: humanMembers,
            bots: botMembers,
            online: onlineMembers
        },
        channels: {
            total: totalChannels,
            text: textChannels,
            voice: voiceChannels,
            categories: categoryChannels
        },
        roles: {
            total: totalRoles,
            managed: managedRoles,
            default: defaultRole
        },
        presence: {
            online: onlineMembers,
            idle: idleMembers,
            dnd: dndMembers,
            offline: offlineMembers,
            streaming: streamingMembers
        },
        verification: {
            level: verificationLevels[guild.verificationLevel] || 'Unknown',
            mfa: guild.mfaLevel > 0,
            features: guild.features.length
        },
        nitro: {
            tier: guild.premiumTier,
            boosters: guild.premiumSubscriptionCount || 0,
            emojiSlots: [50, 100, 150, 250][guild.premiumTier] || 50,
            stickerSlots: [0, 15, 30, 60][guild.premiumTier] || 0
        },
        activity: sortedActivities,
        age: ageString
    };
}

// Helper function to format duration
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(months / 12);
    
    if (years > 0) return `${years} year${years !== 1 ? 's' : ''} ago`;
    if (months > 0) return `${months} month${months !== 1 ? 's' : ''} ago`;
    if (days > 0) return `${days} day${days !== 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
}

// Helper function to get activity emoji
function getActivityEmoji(activityName) {
    const emojiMap = {
        'Spotify': '🎵',
        'YouTube': '📺',
        'Twitch': '📡',
        'Visual Studio Code': '💻',
        'Visual Studio': '👨‍💻',
        'Discord': '💬',
        'League of Legends': '⚔️',
        'VALORANT': '🔫',
        'Minecraft': '⛏️',
        'Fortnite': '🎮',
        'Apex Legends': '🎯',
        'Call of Duty': '🔫',
        'Counter-Strike': '🎯',
        'Among Us': '👨‍🚀',
        'Rocket League': '🚗',
        'Roblox': '🧱',
        'GTA V': '🚗',
        'Rainbow Six': '🛡️',
        'Overwatch': '🎯',
        'PUBG': '🎯'
    };
    
    for (const [key, emoji] of Object.entries(emojiMap)) {
        if (activityName.toLowerCase().includes(key.toLowerCase())) {
            return emoji;
        }
    }
    
    return '🎮';
}

// Helper function to create member join chart
async function createMemberJoinChart(guild) {
    const members = Array.from(guild.members.cache.values());
    const joinDates = members.map(m => m.joinedAt);
    
    // Group by month
    const monthCounts = {};
    joinDates.forEach(date => {
        if (!date) return;
        const month = date.toISOString().slice(0, 7); // YYYY-MM
        monthCounts[month] = (monthCounts[month] || 0) + 1;
    });
    
    // Prepare chart data
    const months = Object.keys(monthCounts).sort();
    const counts = months.map(month => monthCounts[month]);
    
    // Create chart
    const width = 800;
    const height = 400;
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });
    
    const configuration = {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'Member Joins',
                data: counts,
                backgroundColor: 'rgba(88, 101, 242, 0.2)',
                borderColor: 'rgba(88, 101, 242, 1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Member Join Timeline',
                    font: {
                        size: 16
                    }
                },
                legend: {
                    display: true
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Members'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Month'
                    }
                }
            }
        }
    };
    
    return await chartJSNodeCanvas.renderToBuffer(configuration);
}

// Helper function to export statistics
async function exportStatistics(guild, interaction) {
    const stats = await calculateServerStats(guild);
    
    const exportData = {
        server: {
            name: guild.name,
            id: guild.id,
            created: guild.createdAt.toISOString(),
            owner: (await guild.fetchOwner()).user.tag
        },
        statistics: stats,
        generated: new Date().toISOString()
    };
    
    // Create JSON file
    const fileName = `stats_${guild.id}_${Date.now()}.json`;
    const filePath = path.join(__dirname, '..', '..', 'temp', fileName);
    
    // Ensure temp directory exists
    const tempDir = path.join(__dirname, '..', '..', 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
    
    await interaction.editReply({
        content: '✅ Statistics exported successfully!',
        files: [{
            attachment: filePath,
            name: fileName
        }]
    });
    
    // Clean up after sending
    setTimeout(() => {
        fs.unlinkSync(filePath);
    }, 5000);
}

// Helper function to show insights
async function showInsights(guild, interaction) {
    const stats = await calculateServerStats(guild);
    
    const insights = [];
    
    // Bot ratio insight
    const botRatio = (stats.members.bots / stats.members.total) * 100;
    if (botRatio > 30) {
        insights.push('⚠️ **High Bot Ratio:** Your server has a high percentage of bots.');
    } else if (botRatio < 5) {
        insights.push('✅ **Healthy Bot Ratio:** Your server has a good balance of humans and bots.');
    }
    
    // Online ratio insight
    const onlineRatio = (stats.presence.online / stats.members.total) * 100;
    if (onlineRatio > 50) {
        insights.push('🎉 **High Activity:** Your server has great member engagement!');
    } else if (onlineRatio < 10) {
        insights.push('😴 **Low Activity:** Consider running events to increase engagement.');
    }
    
    // Role management insight
    if (stats.roles.total > 50) {
        insights.push('📋 **Many Roles:** Consider cleaning up unused roles for better organization.');
    }
    
    // Channel balance insight
    const textVoiceRatio = stats.channels.text / stats.channels.voice;
    if (textVoiceRatio > 3) {
        insights.push('💬 **Text-Heavy:** Your server might benefit from more voice channels.');
    } else if (textVoiceRatio < 0.5) {
        insights.push('🎤 **Voice-Heavy:** Consider adding more text channels for communication.');
    }
    
    // Nitro boost insight
    if (stats.nitro.tier === 0 && stats.members.total > 50) {
        insights.push('🚀 **Boost Potential:** Your server could benefit from Nitro boosting for better features.');
    }
    
    // Create insights embed
    const insightsEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('💡 Server Insights')
        .setDescription('Based on your server statistics')
        .addFields(
            {
                name: '📊 Key Metrics',
                value: [
                    `**Bot Ratio:** ${botRatio.toFixed(1)}%`,
                    `**Online Ratio:** ${onlineRatio.toFixed(1)}%`,
                    `**Text/Voice Ratio:** ${textVoiceRatio.toFixed(1)}`,
                    `**Nitro Tier:** ${stats.nitro.tier}`
                ].join('\n'),
                inline: true
            },
            {
                name: '🎯 Recommendations',
                value: insights.length > 0 ? insights.join('\n\n') : '✅ Your server looks well-balanced!',
                inline: false
            }
        )
        .setFooter({ text: 'These are automated suggestions based on statistics' })
        .setTimestamp();
    
    await interaction.editReply({
        embeds: [insightsEmbed]
    });
}
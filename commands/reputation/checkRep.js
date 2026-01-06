const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'checkrep',
    description: 'Check reputation points for a user',
    aliases: ['rep', 'reputation', 'checkreputation'],
    category: 'Reputation',
    usage: '!checkRep [@user]',
    
    async execute(message, args, client, db) {
        try {
            // Check if database is available
            if (!db) {
                return message.reply('❌ Database not available. Please try again later.');
            }
            
            // Get target user (mentioned user or command author)
            let targetUser = message.mentions.users.first() || message.author;
            
            // If args provided but no mention, try to get user by ID
            if (args[0] && !message.mentions.users.first()) {
                try {
                    targetUser = await client.users.fetch(args[0]);
                } catch (error) {
                    // If not a valid user ID, use author
                    targetUser = message.author;
                }
            }
            
            // Don't allow checking bot's reputation
            if (targetUser.bot) {
                return message.reply('❌ Bots do not have reputation points.');
            }
            
            // Get reputation data
            const reputation = await db.getUserReputation(targetUser.id, message.guild.id);
            
            // Get rank in the server
            const leaderboard = await db.getReputationLeaderboard(message.guild.id, 100);
            const rank = leaderboard.findIndex(rep => rep.userId === targetUser.id) + 1;
            
            // Create embed
            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('⭐ Reputation Status')
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 128 }))
                .setDescription(`Reputation information for ${targetUser.toString()}`)
                .addFields(
                    { 
                        name: '🏆 Reputation Points', 
                        value: `**${reputation.points}** points`, 
                        inline: true 
                    },
                    { 
                        name: '📊 Server Rank', 
                        value: rank > 0 ? `#${rank}` : 'Unranked', 
                        inline: true 
                    },
                    { 
                        name: '💬 Messages', 
                        value: `${reputation.messageCount}`, 
                        inline: true 
                    },
                    { 
                        name: '⚡ Commands', 
                        value: `${reputation.commandCount}`, 
                        inline: true 
                    },
                    { 
                        name: '📅 Member Since', 
                        value: `<t:${Math.floor(reputation.createdAt / 1000)}:R>`, 
                        inline: true 
                    },
                    { 
                        name: '🔄 Last Activity', 
                        value: `<t:${Math.floor(reputation.updatedAt / 1000)}:R>`, 
                        inline: true 
                    }
                )
                .setFooter({ 
                    text: `Earn reputation by chatting and using commands • ${message.guild.name}`,
                    iconURL: message.guild.iconURL({ dynamic: true })
                })
                .setTimestamp();
            
            // Add recent history if available
            if (reputation.history && reputation.history.length > 0) {
                const recentHistory = reputation.history.slice(-3).reverse();
                const historyText = recentHistory.map(entry => {
                    const sign = entry.points >= 0 ? '+' : '';
                    return `${sign}${entry.points} pts - ${entry.reason} (<t:${Math.floor(entry.timestamp / 1000)}:R>)`;
                }).join('\n');
                
                embed.addFields({
                    name: '📜 Recent Activity',
                    value: historyText || 'No recent activity',
                    inline: false
                });
            }
            
            await message.reply({ embeds: [embed] });
            
        } catch (error) {
            console.error('CheckRep command error:', error);
            message.reply('❌ An error occurred while checking reputation. Please try again.');
        }
    }
};

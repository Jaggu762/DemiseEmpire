const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'repleaderboard',
    description: 'Show the reputation leaderboard for this server',
    aliases: ['replb', 'reptop', 'toprep', 'repboard'],
    category: 'Reputation',
    usage: '!repleaderboard [page]',
    
    async execute(message, args, client, db) {
        try {
            // Check if database is available
            if (!db) {
                return message.reply('❌ Database not available. Please try again later.');
            }
            
            // Get page number
            const page = parseInt(args[0]) || 1;
            if (page < 1) {
                return message.reply('❌ Page number must be at least 1.');
            }
            
            // Get leaderboard
            const perPage = 10;
            const allReputation = await db.getReputationLeaderboard(message.guild.id, 100);
            
            if (allReputation.length === 0) {
                return message.reply('❌ No reputation data available yet. Start earning reputation by chatting and using commands!');
            }
            
            const totalPages = Math.ceil(allReputation.length / perPage);
            
            if (page > totalPages) {
                return message.reply(`❌ Page ${page} doesn't exist. There are only ${totalPages} page(s).`);
            }
            
            // Get page data
            const startIndex = (page - 1) * perPage;
            const endIndex = startIndex + perPage;
            const pageReputation = allReputation.slice(startIndex, endIndex);
            
            // Create embed
            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🏆 Reputation Leaderboard')
                .setDescription(`Top members by reputation in **${message.guild.name}**`)
                .setFooter({ 
                    text: `Page ${page} of ${totalPages} • Total members: ${allReputation.length}`,
                    iconURL: message.guild.iconURL({ dynamic: true })
                })
                .setTimestamp();
            
            // Build leaderboard text
            let leaderboardText = '';
            
            for (let i = 0; i < pageReputation.length; i++) {
                const rep = pageReputation[i];
                const rank = startIndex + i + 1;
                
                // Get medal for top 3
                let medal = '';
                if (rank === 1) medal = '🥇';
                else if (rank === 2) medal = '🥈';
                else if (rank === 3) medal = '🥉';
                else medal = `**${rank}.**`;
                
                // Get user
                let userTag = 'Unknown User';
                try {
                    const user = await client.users.fetch(rep.userId);
                    userTag = user.tag;
                } catch (error) {
                    userTag = `User ID: ${rep.userId}`;
                }
                
                leaderboardText += `${medal} **${userTag}**\n`;
                leaderboardText += `   ⭐ ${rep.points} points • 💬 ${rep.messageCount} messages • ⚡ ${rep.commandCount} commands\n\n`;
            }
            
            embed.setDescription(leaderboardText || 'No data available');
            
            // Show current user's rank if not on this page
            const userRep = allReputation.find(rep => rep.userId === message.author.id);
            if (userRep) {
                const userRank = allReputation.findIndex(rep => rep.userId === message.author.id) + 1;
                const isOnPage = userRank >= startIndex + 1 && userRank <= endIndex;
                
                if (!isOnPage) {
                    embed.addFields({
                        name: '📍 Your Position',
                        value: `Rank #${userRank} • ${userRep.points} points`,
                        inline: false
                    });
                }
            }
            
            await message.reply({ embeds: [embed] });
            
        } catch (error) {
            console.error('RepLeaderboard command error:', error);
            message.reply('❌ An error occurred while fetching the leaderboard. Please try again.');
        }
    }
};

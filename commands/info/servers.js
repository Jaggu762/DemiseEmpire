// commands/info/servers.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'servers',
    description: 'Display all servers the bot is in',
    aliases: ['guilds', 'listservers'],
    category: 'Info',
    
    async execute(message, args, client, db) {
        try {
            // Check if the user is the bot owner
            const ownerId = client.botInfo.ownerId; // Make sure ownerId is set in your client config
            if (message.author.id !== ownerId) {
                return message.reply('❌ This command is only available to the bot owner.');
            }
            
            const guilds = client.guilds.cache;
            const totalGuilds = guilds.size;
            
            // Pagination
            const page = parseInt(args[0]) || 1;
            const perPage = 5; // Reduced from 10 to prevent field overflow
            const totalPages = Math.ceil(totalGuilds / perPage);
            
            if (page < 1 || page > totalPages) {
                return message.reply(`❌ Invalid page number. Please choose between 1 and ${totalPages}.`);
            }
            
            const startIndex = (page - 1) * perPage;
            const endIndex = startIndex + perPage;
            const pageGuilds = Array.from(guilds.values()).slice(startIndex, endIndex);
            
            // Create embed
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🌐 Bot Servers')
                .setDescription(`The bot is in **${totalGuilds}** servers\nPage **${page}** of **${totalPages}**`)
                .setFooter({ text: `Use ${client.botInfo.prefix}servers [page] to navigate` })
                .setTimestamp();
            
            // Add server information in multiple fields
            for (let i = 0; i < pageGuilds.length; i++) {
                const guild = pageGuilds[i];
                const owner = await guild.fetchOwner().catch(() => ({ user: { tag: 'Unknown' } }));
                
                // Get bot's member in this guild
                const botMember = guild.members.cache.get(client.user.id);
                const joinedDate = botMember ? botMember.joinedAt : null;
                
                // Create safe field value (max 1024 characters)
                let fieldValue = `👑 **Owner:** ${owner.user.tag}\n`;
                fieldValue += `👥 **Members:** ${guild.memberCount}\n`;
                fieldValue += `🆔 **ID:** \`${guild.id}\`\n`;
                if (joinedDate) {
                    fieldValue += `📅 **Bot joined:** <t:${Math.floor(joinedDate.getTime() / 1000)}:R>`;
                }
                
                // Truncate if necessary (though with perPage=5 this shouldn't happen)
                if (fieldValue.length > 1024) {
                    fieldValue = fieldValue.substring(0, 1020) + '...';
                }
                
                embed.addFields({
                    name: `${startIndex + i + 1}. ${guild.name}`,
                    value: fieldValue,
                    inline: true
                });
            }
            
            // Add empty field if odd number for better formatting
            if (pageGuilds.length % 2 === 1) {
                embed.addFields({
                    name: '\u200b',
                    value: '\u200b',
                    inline: true
                });
            }
            
            // Add stats
            const totalMembers = guilds.reduce((acc, guild) => acc + guild.memberCount, 0);
            const avgMembers = Math.round(totalMembers / totalGuilds);
            
            embed.addFields(
                {
                    name: '📊 Statistics',
                    value: `**Total Servers:** ${totalGuilds}\n**Total Members:** ${totalMembers}\n**Avg. per Server:** ${avgMembers}`,
                    inline: false
                }
            );
            
            // Create navigation buttons
            const actionRows = [];
            const navigationRow = new ActionRowBuilder();
            
            if (page > 1) {
                navigationRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`servers_${page - 1}`)
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⬅️')
                );
            }
            
            navigationRow.addComponents(
                new ButtonBuilder()
                    .setCustomId('servers_current')
                    .setLabel(`Page ${page} / ${totalPages}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );
            
            if (page < totalPages) {
                navigationRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`servers_${page + 1}`)
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('➡️')
                );
            }
            
            actionRows.push(navigationRow);
            
            // Add quick actions row
            const actionsRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('Invite Bot')
                        .setURL(`https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`)
                        .setStyle(ButtonStyle.Link)
                        .setEmoji('🤖'),
                    new ButtonBuilder()
                        .setLabel('Support Server')
                        .setURL('https://discord.gg/r9QRUy6nrK')
                        .setStyle(ButtonStyle.Link)
                        .setEmoji('🆘'),
                    new ButtonBuilder()
                        .setCustomId('refresh_servers')
                        .setLabel('Refresh')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('🔄')
                );
            
            actionRows.push(actionsRow);
            
            const sentMessage = await message.channel.send({ 
                embeds: [embed],
                components: actionRows 
            });
            
            // Create collector for button interactions
            const collector = sentMessage.createMessageComponentCollector({ 
                time: 60000 
            });
            
            collector.on('collect', async (interaction) => {
                // Also check owner for button interactions
                if (interaction.user.id !== ownerId) {
                    return interaction.reply({ 
                        content: '❌ Only the bot owner can use these buttons.',
                        ephemeral: true 
                    });
                }
                
                if (!interaction.customId.startsWith('servers_') && interaction.customId !== 'refresh_servers') return;
                
                if (interaction.customId === 'refresh_servers') {
                    await interaction.deferUpdate();
                    await message.channel.send('🔄 Refreshing server list...');
                    return this.execute(message, [page], client, db);
                }
                
                const requestedPage = parseInt(interaction.customId.split('_')[1]);
                if (requestedPage) {
                    await interaction.deferUpdate();
                    await this.execute(message, [requestedPage], client, db);
                }
            });
            
            collector.on('end', () => {
                sentMessage.edit({ components: [] }).catch(() => {});
            });
            
        } catch (error) {
            console.error('Servers command error:', error);
            message.reply('❌ An error occurred while fetching server information.');
        }
    }
};

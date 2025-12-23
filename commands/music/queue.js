const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'queue',
    description: 'Show the current music queue',
    aliases: ['q', 'list'],
    category: 'music',
    
    async execute(message, args, client) {
        try {
            const player = client.playerManager?.riffy?.players.get(message.guild.id);
            
            if (!player || (!player.queue.current && player.queue.length === 0)) {
                const embed = new EmbedBuilder()
                    .setColor('#0061ff')
                    .setTitle('📋 Music Queue')
                    .setDescription('No music is playing and the queue is empty!')
                    .setFooter({ text: 'Use .play to add songs' })
                    .setTimestamp();
                
                return message.channel.send({ embeds: [embed] });
            }
            
            let page = 1;
            const tracksPerPage = 10;
            
            if (args[0] && !isNaN(args[0])) {
                page = parseInt(args[0]);
                if (page < 1) page = 1;
            }
            
            const queueEmbed = client.playerManager.createQueueEmbed(player, page, tracksPerPage);
            const totalPages = Math.ceil(player.queue.length / tracksPerPage);
            
            // Only add buttons if there are multiple pages
            if (totalPages > 1) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`queue_prev_${message.author.id}`)
                        .setLabel('⬅️ Previous')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page <= 1),
                    new ButtonBuilder()
                        .setCustomId(`queue_next_${message.author.id}`)
                        .setLabel('Next ➡️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page >= totalPages)
                );
                
                await message.channel.send({ 
                    embeds: [queueEmbed], 
                    components: [row] 
                });
            } else {
                await message.channel.send({ embeds: [queueEmbed] });
            }
            
        } catch (error) {
            console.error('Queue command error:', error);
            return message.reply('❌ Failed to show queue.');
        }
    }
};
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'messageUpdate',
    async execute(oldMessage, newMessage, client) {
        // Ignore DMs and partial messages
        if (!newMessage.guild || newMessage.partial || oldMessage.partial) return;
        
        // Ignore if content hasn't changed
        if (oldMessage.content === newMessage.content) return;
        
        // Store edit snipe data
        const editSnipeData = {
            author: newMessage.author.id,
            oldContent: oldMessage.content,
            newContent: newMessage.content,
            attachments: newMessage.attachments,
            timestamp: Date.now()
        };
        
        // Get existing edit snipes for this channel
        const channelEditSnipes = client.editSnipes.get(newMessage.channel.id) || [];
        
        // Add new edit snipe and keep only last 10
        channelEditSnipes.unshift(editSnipeData);
        if (channelEditSnipes.length > 10) {
            channelEditSnipes.pop();
        }
        
        client.editSnipes.set(newMessage.channel.id, channelEditSnipes);
        
        // Log to message logs if enabled
        const db = require('../utils/database');
        const config = await db.getGuildConfig(newMessage.guild.id);
        
        if (config.messageLogs && config.logChannel) {
            const logChannel = newMessage.guild.channels.cache.get(config.logChannel);
            if (logChannel) {
                try {
                    const embed = new EmbedBuilder()
                        .setColor('#ff9900')
                        .setTitle('✏️ Message Edited')
                        .addFields(
                            { name: '👤 User', value: `${newMessage.author.tag} (${newMessage.author.id})`, inline: true },
                            { name: '📝 Channel', value: `${newMessage.channel}`, inline: true },
                            { name: '🔗 Jump to Message', value: `[Click here](${newMessage.url})`, inline: true }
                        )
                        .setFooter({ text: `User ID: ${newMessage.author.id}` })
                        .setTimestamp();
                    
                    if (oldMessage.content) {
                        embed.addFields({ name: '📄 Old Content', value: oldMessage.content.slice(0, 500) || 'No content', inline: false });
                    }
                    
                    if (newMessage.content) {
                        embed.addFields({ name: '📄 New Content', value: newMessage.content.slice(0, 500) || 'No content', inline: false });
                    }
                    
                    await logChannel.send({ embeds: [embed] });
                } catch (error) {
                    console.error('Error logging message edit:', error);
                }
            }
        }
    }
};
// events/stickyHandler.js
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'stickyHandler',
    
    /**
     * Handle new messages and update sticky if needed
     */
    async handleMessageCreate(message, client, db) {
        // Ignore bot messages, DMs, and system messages
        if (message.author.bot || !message.guild || message.system) return;
        
        // Ignore sticky command messages themselves
        if (message.content.startsWith('.sticky')) return;
        
        const channelId = message.channel.id;
        
        // Check if this channel has a sticky message
        const stickyData = await db.getStickyMessage(channelId);
        
        if (stickyData) {
            // Wait a short moment to ensure all processing is done
            setTimeout(async () => {
                try {
                    // Delete old sticky if exists
                    if (stickyData.lastMessageId) {
                        try {
                            const oldMessage = await message.channel.messages.fetch(stickyData.lastMessageId).catch(() => null);
                            if (oldMessage) {
                                await oldMessage.delete().catch(() => {});
                            }
                        } catch (error) {
                            // Message might already be deleted, that's okay
                        }
                    }
                    
                    // Create new sticky message
                    let newStickyMsg;
                    
                    if (stickyData.embedData) {
                        // Send embed sticky
                        try {
                            const embedData = JSON.parse(stickyData.embedData);
                            const embed = new EmbedBuilder(embedData);
                            newStickyMsg = await message.channel.send({ embeds: [embed] });
                        } catch (error) {
                            console.error('Error sending embed sticky:', error);
                            // Fallback to text
                            const embed = new EmbedBuilder()
                                .setColor('#ffff00')
                                .setDescription(stickyData.content || 'Sticky Message')
                                .setFooter({ text: '📌 Sticky Message' });
                            newStickyMsg = await message.channel.send({ embeds: [embed] });
                        }
                    } else {
                        // Send text sticky
                        const embed = new EmbedBuilder()
                            .setColor('#ffff00')
                            .setTitle('📌 Sticky Message')
                            .setDescription(stickyData.content || 'Sticky Message')
                            .setFooter({ text: 'This message will stay at the bottom of the channel' })
                            .setTimestamp();
                        
                        newStickyMsg = await message.channel.send({ embeds: [embed] });
                    }
                    
                    // Update database with new message ID
                    await db.updateStickyMessage(channelId, {
                        lastMessageId: newStickyMsg.id
                    });
                    
                } catch (error) {
                    console.error('Error in sticky handler:', error);
                }
            }, 100); // Small delay to ensure proper ordering
        }
    },
    
    /**
     * Handle message deletions to recreate sticky if it was deleted
     */
    async handleMessageDelete(deletedMessage, client, db) {
        if (!deletedMessage.guild) return;
        
        const channelId = deletedMessage.channel.id;
        const stickyData = await db.getStickyMessage(channelId);
        
        if (stickyData && stickyData.lastMessageId === deletedMessage.id) {
            // The sticky message itself was deleted, recreate it
            setTimeout(async () => {
                try {
                    // Create new sticky message
                    let newStickyMsg;
                    
                    if (stickyData.embedData) {
                        // Send embed sticky
                        try {
                            const embedData = JSON.parse(stickyData.embedData);
                            const embed = new EmbedBuilder(embedData);
                            newStickyMsg = await deletedMessage.channel.send({ embeds: [embed] });
                        } catch (error) {
                            console.error('Error recreating embed sticky:', error);
                            // Fallback to text
                            const embed = new EmbedBuilder()
                                .setColor('#ffff00')
                                .setDescription(stickyData.content || 'Sticky Message')
                                .setFooter({ text: '📌 Sticky Message' });
                            newStickyMsg = await deletedMessage.channel.send({ embeds: [embed] });
                        }
                    } else {
                        // Send text sticky
                        const embed = new EmbedBuilder()
                            .setColor('#ffff00')
                            .setTitle('📌 Sticky Message')
                            .setDescription(stickyData.content || 'Sticky Message')
                            .setFooter({ text: 'This message will stay at the bottom of the channel' })
                            .setTimestamp();
                        
                        newStickyMsg = await deletedMessage.channel.send({ embeds: [embed] });
                    }
                    
                    // Update database with new message ID
                    await db.updateStickyMessage(channelId, {
                        lastMessageId: newStickyMsg.id
                    });
                    
                } catch (error) {
                    console.error('Error recreating deleted sticky:', error);
                }
            }, 1000);
        }
    }
};
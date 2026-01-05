const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'messageDelete',
    async execute(message, client) {
        // Ignore DMs and partial messages
        if (!message.guild || message.partial) return;
        
        // Store snipe data in memory
        const snipeData = {
            author: message.author.id,
            authorTag: message.author.tag,
            content: message.content,
            timestamp: Date.now()
        };
        
        // Get existing snipes for this channel
        const channelSnipes = client.snipes.get(message.channel.id) || [];
        
        // Add new snipe and keep only last 10
        channelSnipes.unshift(snipeData);
        if (channelSnipes.length > 10) {
            channelSnipes.pop();
        }
        
        client.snipes.set(message.channel.id, channelSnipes);
        
        // Save to database if available
        if (client.db && client.db.saveSnipe) {
            try {
                await client.db.saveSnipe(
                    message.guild.id,
                    message.channel.id,
                    {
                        author: message.author.tag,
                        author_id: message.author.id,
                        content: message.content || '[No content]'
                    }
                );
            } catch (error) {
                console.error('Error saving snipe to database:', error.message);
            }
        }
        
        // Log to console for debugging
        console.log(`🗑️ Message deleted in #${message.channel.name} by ${message.author.tag}: ${message.content?.substring(0, 50) || 'No content'}...`);
        
        // Check for mentions (ghost pings)
        if (message.content) {
            const mentions = {
                everyone: message.content.includes('@everyone'),
                here: message.content.includes('@here'),
                users: (message.content.match(/<@!?(\d+)>/g) || []).length,
                roles: (message.content.match(/<@&(\d+)>/g) || []).length
            };
            
            if (mentions.everyone || mentions.here || mentions.users > 0 || mentions.roles > 0) {
                console.log(`👻 Ghost ping detected! Mentions: ${JSON.stringify(mentions)}`);
                
                // You could log this to a specific channel or database
                if (client.db && client.db.saveGhostPing) {
                    try {
                        // Create ghost ping log
                        const ghostPingData = {
                            guild_id: message.guild.id,
                            channel_id: message.channel.id,
                            author_id: message.author.id,
                            author_tag: message.author.tag,
                            content: message.content,
                            mentions: JSON.stringify(mentions),
                            timestamp: Date.now()
                        };
                        
                        // This would require adding a ghost_pings table to your database
                        // For now, we'll just log it
                    } catch (error) {
                        console.error('Error logging ghost ping:', error);
                    }
                }
            }
        }
        
        // Handle sticky messages (simplified version)
        if (client.stickyMessages && client.stickyMessages.has(message.channel.id)) {
            const stickyData = client.stickyMessages.get(message.channel.id);
            
            if (message.id === stickyData.lastMessageId) {
                console.log(`📌 Sticky message deleted in #${message.channel.name}, will be recreated`);
                
                // Resend sticky message after delay
                setTimeout(async () => {
                    try {
                        const stickyEmbed = new EmbedBuilder()
                            .setColor('#ffff00')
                            .setTitle('📌 Sticky Message')
                            .setDescription(stickyData.content || 'No content')
                            .setFooter({ text: 'This message will stay at the bottom of the channel' });
                        
                        const newSticky = await message.channel.send({ embeds: [stickyEmbed] });
                        
                        // Update sticky message ID
                        stickyData.lastMessageId = newSticky.id;
                        client.stickyMessages.set(message.channel.id, stickyData);
                        
                    } catch (error) {
                        console.error('Error resending sticky message:', error);
                    }
                }, 1000);
            }
        }
    }
};
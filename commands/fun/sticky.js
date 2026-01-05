const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'sticky',
    description: 'Manage sticky messages in channels',
    aliases: ['stickymessage', 'pinmessage'],
    category: 'Fun',
    permissions: ['ManageMessages'],
    
    async execute(message, args, client, db) {
        const action = args[0]?.toLowerCase();
        
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.reply('❌ You need Manage Messages permissions to use this command!');
        }
        
        if (!action) {
            // Show current sticky message
            const stickyData = await db.getStickyMessage(message.channel.id);
            
            if (stickyData) {
                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('📌 Sticky Message in this Channel')
                    .setDescription(stickyData.content || 'No content')
                    .addFields(
                        { name: '🆔 Message ID', value: stickyData.lastMessageId || 'Not set', inline: true },
                        { name: '📅 Created', value: `<t:${Math.floor(stickyData.createdAt / 1000)}:R>`, inline: true }
                    )
                    .setFooter({ text: 'Use ^sticky remove to delete this sticky message' });
                
                if (stickyData.embedData) {
                    try {
                        const embedData = JSON.parse(stickyData.embedData);
                        Object.assign(embed, embedData);
                    } catch (error) {
                        console.error('Error parsing embed data:', error);
                    }
                }
                
                return message.reply({ embeds: [embed] });
            } else {
                return message.reply('❌ No sticky message in this channel!\nUse `^sticky set <message>` to create one.');
            }
        }
        
        switch (action) {
            case 'set':
            case 'create':
            case 'add':
                if (args.length < 2) {
                    return message.reply('❌ Please provide a message to stick!');
                }
                
                const content = args.slice(1).join(' ');
                
                // Check if there's already a sticky message
                const existingSticky = await db.getStickyMessage(message.channel.id);
                
                if (existingSticky) {
                    // Update existing sticky
                    try {
                        // Try to delete old sticky message
                        if (existingSticky.lastMessageId) {
                            const oldMessage = await message.channel.messages.fetch(existingSticky.lastMessageId).catch(() => null);
                            if (oldMessage) {
                                await oldMessage.delete().catch(() => {});
                            }
                        }
                    } catch (error) {
                        console.error('Error deleting old sticky:', error);
                    }
                    
                    // Update sticky in database
                    await db.updateStickyMessage(message.channel.id, {
                        content: content,
                        embedData: null,
                        updatedAt: Date.now()
                    });
                    
                } else {
                    // Create new sticky
                    await db.createStickyMessage({
                        guildId: message.guild.id,
                        channelId: message.channel.id,
                        content: content,
                        embedData: null,
                        lastMessageId: null,
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    });
                }
                
                // Send new sticky message
                const stickyEmbed = new EmbedBuilder()
                    .setColor('#ffff00')
                    .setTitle('📌 Sticky Message')
                    .setDescription(content)
                    .setFooter({ text: 'This message will stay at the bottom of the channel' })
                    .setTimestamp();
                
                const stickyMessage = await message.channel.send({ embeds: [stickyEmbed] });
                
                // Update database with new message ID
                await db.updateStickyMessage(message.channel.id, {
                    lastMessageId: stickyMessage.id
                });
                
                message.reply('✅ Sticky message set!').then(msg => {
                    setTimeout(() => msg.delete(), 3000);
                });
                break;
                
            case 'remove':
            case 'delete':
            case 'unsticky':
                const stickyToRemove = await db.getStickyMessage(message.channel.id);
                
                if (!stickyToRemove) {
                    return message.reply('❌ No sticky message in this channel!');
                }
                
                // Try to delete the sticky message
                try {
                    if (stickyToRemove.lastMessageId) {
                        const stickyMsg = await message.channel.messages.fetch(stickyToRemove.lastMessageId);
                        await stickyMsg.delete().catch(() => {});
                    }
                } catch (error) {
                    console.error('Error deleting sticky message:', error);
                }
                
                // Remove from database
                await db.deleteStickyMessage(message.channel.id);
                
                message.reply('✅ Sticky message removed!').then(msg => {
                    setTimeout(() => msg.delete(), 3000);
                });
                break;
                
            case 'embed':
                if (args.length < 2) {
                    return message.reply('❌ Please provide embed JSON!');
                }
                
                try {
                    const embedJson = args.slice(1).join(' ');
                    const embedData = JSON.parse(embedJson);
                    
                    // Validate embed data
                    if (typeof embedData !== 'object') {
                        return message.reply('❌ Invalid embed JSON!');
                    }
                    
                    // Check if sticky exists
                    let sticky = await db.getStickyMessage(message.channel.id);
                    
                    if (!sticky) {
                        // Create new sticky with embed
                        await db.createStickyMessage({
                            guildId: message.guild.id,
                            channelId: message.channel.id,
                            content: null,
                            embedData: JSON.stringify(embedData),
                            lastMessageId: null,
                            createdAt: Date.now(),
                            updatedAt: Date.now()
                        });
                    } else {
                        // Update existing sticky
                        await db.updateStickyMessage(message.channel.id, {
                            embedData: JSON.stringify(embedData),
                            content: null,
                            updatedAt: Date.now()
                        });
                        
                        // Delete old message
                        if (sticky.lastMessageId) {
                            try {
                                const oldMsg = await message.channel.messages.fetch(sticky.lastMessageId);
                                await oldMsg.delete().catch(() => {});
                            } catch (error) {
                                console.error('Error deleting old sticky:', error);
                            }
                        }
                    }
                    
                    // Send new embed
                    const embed = new EmbedBuilder(embedData);
                    const newStickyMsg = await message.channel.send({ embeds: [embed] });
                    
                    // Update database
                    await db.updateStickyMessage(message.channel.id, {
                        lastMessageId: newStickyMsg.id
                    });
                    
                    message.reply('✅ Embed sticky message set!').then(msg => {
                        setTimeout(() => msg.delete(), 3000);
                    });
                    
                } catch (error) {
                    console.error('Embed sticky error:', error);
                    message.reply('❌ Invalid embed JSON format!');
                }
                break;
                
            case 'list':
                const allStickies = await db.getStickyMessagesByGuild(message.guild.id);
                
                if (allStickies.length === 0) {
                    return message.reply('❌ No sticky messages in this server!');
                }
                
                const stickyList = allStickies.map((sticky, index) => {
                    const channel = message.guild.channels.cache.get(sticky.channelId);
                    return `${index + 1}. ${channel ? channel.name : 'Unknown Channel'} - ${sticky.content ? sticky.content.substring(0, 50) + '...' : 'Embed Message'}`;
                }).join('\n');
                
                const listEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('📌 Sticky Messages in this Server')
                    .setDescription(stickyList)
                    .setFooter({ text: `Total: ${allStickies.length} sticky messages` });
                
                message.reply({ embeds: [listEmbed] });
                break;
                
            default:
                message.reply('❌ Invalid action! Use: `set`, `remove`, `embed`, `list`');
        }
    }
};

// Helper function to update/repost sticky messages
async function updateStickyMessage(channel, stickyData, db) {
    if (!stickyData) return null;
    
    try {
        // Delete old sticky if exists
        if (stickyData.lastMessageId) {
            const oldMsg = await channel.messages.fetch(stickyData.lastMessageId).catch(() => null);
            if (oldMsg) {
                await oldMsg.delete().catch(() => {});
            }
        }
        
        let newStickyMsg;
        
        if (stickyData.embedData) {
            // Send embed sticky
            try {
                const embedData = JSON.parse(stickyData.embedData);
                const embed = new EmbedBuilder(embedData);
                newStickyMsg = await channel.send({ embeds: [embed] });
            } catch (error) {
                console.error('Error sending embed sticky:', error);
                // Fallback to text
                const embed = new EmbedBuilder()
                    .setColor('#ffff00')
                    .setDescription(stickyData.content || 'Sticky Message')
                    .setFooter({ text: '📌 Sticky Message' });
                newStickyMsg = await channel.send({ embeds: [embed] });
            }
        } else {
            // Send text sticky
            const embed = new EmbedBuilder()
                .setColor('#ffff00')
                .setTitle('📌 Sticky Message')
                .setDescription(stickyData.content || 'Sticky Message')
                .setFooter({ text: 'This message will stay at the bottom of the channel' })
                .setTimestamp();
            
            newStickyMsg = await channel.send({ embeds: [embed] });
        }
        
        // Update database with new message ID
        await db.updateStickyMessage(channel.id, {
            lastMessageId: newStickyMsg.id
        });
        
        return newStickyMsg;
    } catch (error) {
        console.error('Error updating sticky message:', error);
        return null;
    }
}
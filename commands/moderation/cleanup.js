// commands/moderation/cleanup.js
const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'cleanup',
    description: 'Cleanup and message management commands',
    aliases: ['clean', 'clear', 'purge'],
    category: 'Moderation',
    permissions: ['ManageMessages'],
    
    async execute(message, args, client, db) {
        const action = args[0]?.toLowerCase();
        
        // Check permissions
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.reply('❌ You need **Manage Messages** permission to use this command!');
        }
        
        // Check bot permissions
        if (!message.channel.permissionsFor(client.user).has(PermissionsBitField.Flags.ManageMessages)) {
            return message.reply('❌ I need **Manage Messages** permission in this channel!');
        }
        
        if (!action) {
            return showHelp(message);
        }
        
        switch (action) {
            case 'all':
            case 'channel':
                await clearChannel(message, args[1]);
                break;
                
            case 'messages':
            case 'purge':
                await purgeMessages(message, args);
                break;
                
            case 'before':
                await deleteBefore(message, args);
                break;
                
            case 'after':
                await deleteAfter(message, args);
                break;
                
            case 'between':
                await deleteBetween(message, args);
                break;
                
            case 'user':
                await deleteUserMessages(message, args);
                break;
                
            case 'bots':
                await deleteBotMessages(message, args);
                break;
                
            case 'links':
                await deleteLinks(message, args);
                break;
                
            case 'attachments':
                await deleteAttachments(message, args);
                break;
                
            case 'embeds':
                await deleteEmbeds(message, args);
                break;
                
            case 'help':
                showHelp(message);
                break;
                
            default:
                // If it's a number, assume it's a purge count
                const count = parseInt(action);
                if (!isNaN(count) && count > 0) {
                    await purgeMessages(message, [count.toString()]);
                } else {
                    showHelp(message);
                }
        }
    }
};

// ========== HELPER FUNCTIONS ==========

function showHelp(message) {
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('🧹 Cleanup Commands')
        .setDescription('Clean up messages in this channel')
        .addFields(
            { name: '🧽 Clear Entire Channel', value: '`^cleanup channel` - Clear ALL messages in channel\n`^cleanup all` - Same as above' },
            { name: '📜 Delete Messages', value: '`^cleanup 50` - Delete last 50 messages\n`^cleanup purge 100` - Delete last 100 messages' },
            { name: '⏰ Delete Before/After', value: '`^cleanup before <message_id>` - Delete messages before this ID\n`^cleanup after <message_id>` - Delete messages after this ID' },
            { name: '🎯 Specific Deletions', value: '`^cleanup between <id1> <id2>` - Delete messages between IDs\n`^cleanup user @user 50` - Delete user\'s last 50 messages' },
            { name: '🤖 Filter Types', value: '`^cleanup bots 50` - Delete bot messages\n`^cleanup links 30` - Delete messages with links\n`^cleanup attachments 20` - Delete messages with files' },
            { name: '📱 Get Message ID', value: 'Right-click message → Copy Message ID\nOr enable Developer Mode in Discord settings' }
        )
        .setFooter({ text: 'Note: Can only delete messages up to 14 days old • Max 100 at once' });
    
    return message.reply({ embeds: [embed] });
}

async function clearChannel(message, confirm) {
    if (confirm !== 'confirm') {
        return message.reply({
            content: '⚠️ **WARNING: This will delete ALL messages in this channel!**\n' +
                    'This action is irreversible and will delete **everything**.\n\n' +
                    'To confirm, use: `^cleanup channel confirm`\n' +
                    'Or use `^cleanup 100` to delete specific number of messages.'
        });
    }
    
    const loadingMsg = await message.reply('🧹 Clearing entire channel... This may take a while...');
    
    try {
        let deletedCount = 0;
        let hasMore = true;
        
        while (hasMore) {
            // Fetch messages (max 100 at a time)
            const messages = await message.channel.messages.fetch({ limit: 100 });
            
            if (messages.size === 0) {
                hasMore = false;
                break;
            }
            
            // Filter out messages older than 14 days
            const deletable = messages.filter(msg => {
                const age = Date.now() - msg.createdTimestamp;
                return age < 14 * 24 * 60 * 60 * 1000; // 14 days in milliseconds
            });
            
            if (deletable.size > 0) {
                // Bulk delete
                await message.channel.bulkDelete(deletable, true);
                deletedCount += deletable.size;
                
                // Wait to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
                hasMore = false;
            }
        }
        
        await loadingMsg.edit(`✅ **Channel cleared!** Deleted ${deletedCount} messages.`);
        setTimeout(() => loadingMsg.delete(), 5000);
        
    } catch (error) {
        console.error('Channel clear error:', error);
        message.reply('❌ Failed to clear channel. Some messages may be older than 14 days.');
    }
}

async function purgeMessages(message, args) {
    let count = parseInt(args[1] || args[0]) || 50;
    
    // Limit to 100 messages at once
    if (count > 100) {
        await message.reply('⚠️ Maximum is 100 messages at once. Deleting 100 messages...');
        count = 100;
    }
    
    if (count < 1) {
        return message.reply('❌ Please specify a number greater than 0.');
    }
    
    try {
        const deleted = await message.channel.bulkDelete(count, true);
        
        // Send confirmation (will be auto-deleted)
        const confirmMsg = await message.reply(`✅ Deleted **${deleted.size}** messages.`);
        setTimeout(() => confirmMsg.delete(), 3000);
        
    } catch (error) {
        console.error('Purge error:', error);
        
        if (error.code === 50034) {
            message.reply('❌ Cannot delete messages older than 14 days. Use bulk delete for newer messages.');
        } else {
            message.reply('❌ Failed to delete messages. ' + error.message);
        }
    }
}

async function deleteBefore(message, args) {
    if (args.length < 2) {
        return message.reply('❌ Please provide a message ID: `^cleanup before <message_id>`');
    }
    
    const messageId = args[1];
    
    try {
        // Get the target message to use as reference
        const targetMsg = await message.channel.messages.fetch(messageId);
        if (!targetMsg) {
            return message.reply('❌ Message not found. Make sure the ID is correct.');
        }
        
        // Fetch messages before this one
        const messages = await message.channel.messages.fetch({ 
            limit: 100,
            before: messageId 
        });
        
        // Filter deletable messages (under 14 days old)
        const deletable = messages.filter(msg => {
            const age = Date.now() - msg.createdTimestamp;
            return age < 14 * 24 * 60 * 60 * 1000;
        });
        
        if (deletable.size === 0) {
            return message.reply('❌ No deletable messages found before that message (might be older than 14 days).');
        }
        
        // Delete them
        await message.channel.bulkDelete(deletable, true);
        
        const confirmMsg = await message.reply(`✅ Deleted **${deletable.size}** messages before that message.`);
        setTimeout(() => confirmMsg.delete(), 3000);
        
    } catch (error) {
        console.error('Delete before error:', error);
        message.reply('❌ Failed to delete messages. Make sure the message ID is correct.');
    }
}

async function deleteAfter(message, args) {
    if (args.length < 2) {
        return message.reply('❌ Please provide a message ID: `^cleanup after <message_id>`');
    }
    
    const messageId = args[1];
    
    try {
        // Get the target message to use as reference
        const targetMsg = await message.channel.messages.fetch(messageId);
        if (!targetMsg) {
            return message.reply('❌ Message not found. Make sure the ID is correct.');
        }
        
        // Fetch messages after this one
        const messages = await message.channel.messages.fetch({ 
            limit: 100,
            after: messageId 
        });
        
        // Filter deletable messages (under 14 days old)
        const deletable = messages.filter(msg => {
            const age = Date.now() - msg.createdTimestamp;
            return age < 14 * 24 * 60 * 60 * 1000;
        });
        
        if (deletable.size === 0) {
            return message.reply('❌ No deletable messages found after that message (might be older than 14 days).');
        }
        
        // Delete them
        await message.channel.bulkDelete(deletable, true);
        
        const confirmMsg = await message.reply(`✅ Deleted **${deletable.size}** messages after that message.`);
        setTimeout(() => confirmMsg.delete(), 3000);
        
    } catch (error) {
        console.error('Delete after error:', error);
        message.reply('❌ Failed to delete messages. Make sure the message ID is correct.');
    }
}

async function deleteBetween(message, args) {
    if (args.length < 3) {
        return message.reply('❌ Please provide two message IDs: `^cleanup between <id1> <id2>`');
    }
    
    const id1 = args[1];
    const id2 = args[2];
    
    try {
        // Fetch messages between the two IDs
        const messages = await message.channel.messages.fetch({ 
            limit: 100 
        });
        
        // Find the messages between the two IDs
        const messageArray = Array.from(messages.values());
        const index1 = messageArray.findIndex(msg => msg.id === id1);
        const index2 = messageArray.findIndex(msg => msg.id === id2);
        
        if (index1 === -1 || index2 === -1) {
            return message.reply('❌ One or both message IDs not found.');
        }
        
        const startIndex = Math.min(index1, index2);
        const endIndex = Math.max(index1, index2);
        const messagesToDelete = messageArray.slice(startIndex + 1, endIndex);
        
        // Filter deletable messages
        const deletable = messagesToDelete.filter(msg => {
            const age = Date.now() - msg.createdTimestamp;
            return age < 14 * 24 * 60 * 60 * 1000;
        });
        
        if (deletable.length === 0) {
            return message.reply('❌ No deletable messages found between those messages.');
        }
        
        // Delete them
        await message.channel.bulkDelete(deletable, true);
        
        const confirmMsg = await message.reply(`✅ Deleted **${deletable.length}** messages between those messages.`);
        setTimeout(() => confirmMsg.delete(), 3000);
        
    } catch (error) {
        console.error('Delete between error:', error);
        message.reply('❌ Failed to delete messages. Make sure the message IDs are correct.');
    }
}

async function deleteUserMessages(message, args) {
    if (args.length < 2) {
        return message.reply('❌ Please mention a user: `^cleanup user @user 50`');
    }
    
    let user;
    let count = 50;
    
    // Parse arguments
    if (message.mentions.users.first()) {
        user = message.mentions.users.first();
        count = parseInt(args[2]) || 50;
    } else {
        // Try to get user by ID
        const userId = args[1];
        try {
            user = await message.client.users.fetch(userId);
            count = parseInt(args[2]) || 50;
        } catch (error) {
            return message.reply('❌ Please mention a valid user or provide their ID.');
        }
    }
    
    if (count > 100) count = 100;
    
    try {
        // Fetch messages
        const messages = await message.channel.messages.fetch({ limit: 100 });
        
        // Filter messages from the user
        const userMessages = messages.filter(msg => 
            msg.author.id === user.id && 
            (Date.now() - msg.createdTimestamp) < 14 * 24 * 60 * 60 * 1000
        ).first(count);
        
        if (userMessages.size === 0) {
            return message.reply(`❌ No deletable messages found from ${user.tag}.`);
        }
        
        // Delete them
        await message.channel.bulkDelete(userMessages, true);
        
        const confirmMsg = await message.reply(`✅ Deleted **${userMessages.size}** messages from ${user.tag}.`);
        setTimeout(() => confirmMsg.delete(), 3000);
        
    } catch (error) {
        console.error('Delete user messages error:', error);
        message.reply('❌ Failed to delete user messages.');
    }
}

async function deleteBotMessages(message, args) {
    let count = parseInt(args[1]) || 50;
    if (count > 100) count = 100;
    
    try {
        // Fetch messages
        const messages = await message.channel.messages.fetch({ limit: 100 });
        
        // Filter bot messages
        const botMessages = messages.filter(msg => 
            msg.author.bot && 
            (Date.now() - msg.createdTimestamp) < 14 * 24 * 60 * 60 * 1000
        ).first(count);
        
        if (botMessages.size === 0) {
            return message.reply('❌ No deletable bot messages found.');
        }
        
        // Delete them
        await message.channel.bulkDelete(botMessages, true);
        
        const confirmMsg = await message.reply(`✅ Deleted **${botMessages.size}** bot messages.`);
        setTimeout(() => confirmMsg.delete(), 3000);
        
    } catch (error) {
        console.error('Delete bot messages error:', error);
        message.reply('❌ Failed to delete bot messages.');
    }
}

async function deleteLinks(message, args) {
    let count = parseInt(args[1]) || 50;
    if (count > 100) count = 100;
    
    try {
        // Fetch messages
        const messages = await message.channel.messages.fetch({ limit: 100 });
        
        // Filter messages with links (URL pattern)
        const urlPattern = /https?:\/\/[^\s]+/gi;
        const linkMessages = messages.filter(msg => 
            urlPattern.test(msg.content) && 
            (Date.now() - msg.createdTimestamp) < 14 * 24 * 60 * 60 * 1000
        ).first(count);
        
        if (linkMessages.size === 0) {
            return message.reply('❌ No deletable messages with links found.');
        }
        
        // Delete them
        await message.channel.bulkDelete(linkMessages, true);
        
        const confirmMsg = await message.reply(`✅ Deleted **${linkMessages.size}** messages containing links.`);
        setTimeout(() => confirmMsg.delete(), 3000);
        
    } catch (error) {
        console.error('Delete links error:', error);
        message.reply('❌ Failed to delete messages with links.');
    }
}

async function deleteAttachments(message, args) {
    let count = parseInt(args[1]) || 50;
    if (count > 100) count = 100;
    
    try {
        // Fetch messages
        const messages = await message.channel.messages.fetch({ limit: 100 });
        
        // Filter messages with attachments
        const attachmentMessages = messages.filter(msg => 
            msg.attachments.size > 0 && 
            (Date.now() - msg.createdTimestamp) < 14 * 24 * 60 * 60 * 1000
        ).first(count);
        
        if (attachmentMessages.size === 0) {
            return message.reply('❌ No deletable messages with attachments found.');
        }
        
        // Delete them
        await message.channel.bulkDelete(attachmentMessages, true);
        
        const confirmMsg = await message.reply(`✅ Deleted **${attachmentMessages.size}** messages with attachments.`);
        setTimeout(() => confirmMsg.delete(), 3000);
        
    } catch (error) {
        console.error('Delete attachments error:', error);
        message.reply('❌ Failed to delete messages with attachments.');
    }
}

async function deleteEmbeds(message, args) {
    let count = parseInt(args[1]) || 50;
    if (count > 100) count = 100;
    
    try {
        // Fetch messages
        const messages = await message.channel.messages.fetch({ limit: 100 });
        
        // Filter messages with embeds
        const embedMessages = messages.filter(msg => 
            msg.embeds.length > 0 && 
            (Date.now() - msg.createdTimestamp) < 14 * 24 * 60 * 60 * 1000
        ).first(count);
        
        if (embedMessages.size === 0) {
            return message.reply('❌ No deletable messages with embeds found.');
        }
        
        // Delete them
        await message.channel.bulkDelete(embedMessages, true);
        
        const confirmMsg = await message.reply(`✅ Deleted **${embedMessages.size}** messages with embeds.`);
        setTimeout(() => confirmMsg.delete(), 3000);
        
    } catch (error) {
        console.error('Delete embeds error:', error);
        message.reply('❌ Failed to delete messages with embeds.');
    }
}
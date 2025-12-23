// commands/utility/autoroom.js
const { EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');

module.exports = {
    name: 'autoroom',
    description: 'Setup automatic voice channel creation',
    aliases: ['autovc', 'voicecreator'],
    category: 'Utility',
    permissions: ['ManageChannels'],
    
    async execute(message, args, client, db) {
        const action = args[0]?.toLowerCase();
        
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return message.reply('❌ You need **Manage Channels** permission to use this command!');
        }
        
        if (!action) {
            return showCurrentSettings(message, client, db);
        }
        
        switch (action) {
            case 'setup':
            case 'create':
                await setupAutoroom(message, args, client, db);
                break;
                
            case 'delete':
            case 'remove':
                await removeAutoroom(message, client, db);
                break;
                
            case 'category':
                await setCategory(message, args, db);
                break;
                
            case 'limit':
                await setUserLimit(message, args, db);
                break;
                
            case 'name':
                await setNameFormat(message, args, db);
                break;
                
            case 'bitrate':
                await setBitrate(message, args, db);
                break;
                
            case 'private':
                await setPrivate(message, args, db);
                break;
                
            case 'cleanup':
                await cleanupOldRooms(message, client, db);
                break;
                
            case 'list':
                await listActiveRooms(message, client, db);
                break;
                
            case 'test':
                await testAutoroom(message, client, db);
                break;
                
            case 'help':
                showHelp(message);
                break;
                
            default:
                showHelp(message);
        }
    }
};

async function showCurrentSettings(message, client, db) {
    try {
        const config = await db.getGuildConfig(message.guild.id);
        
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🎤 AutoRoom System Settings')
            .setDescription('Automatic voice channel creation system');
        
        if (config.autoroom_creator) {
            const creatorChannel = message.guild.channels.cache.get(config.autoroom_creator);
            embed.addFields({
                name: '🎯 Creator Channel',
                value: creatorChannel ? `${creatorChannel}` : 'Channel not found',
                inline: true
            });
        } else {
            embed.addFields({
                name: '🎯 Creator Channel',
                value: '❌ Not set',
                inline: true
            });
        }
        
        if (config.autoroom_category) {
            const category = message.guild.channels.cache.get(config.autoroom_category);
            embed.addFields({
                name: '📁 Parent Category',
                value: category ? `${category}` : 'Category not found',
                inline: true
            });
        } else {
            embed.addFields({
                name: '📁 Parent Category',
                value: '🎯 Same as creator',
                inline: true
            });
        }
        
        embed.addFields(
            {
                name: '👤 User Limit',
                value: config.autoroom_limit ? `${config.autoroom_limit} users` : '🔓 No limit',
                inline: true
            },
            {
                name: '🔊 Bitrate',
                value: config.autoroom_bitrate ? `${config.autoroom_bitrate}kbps` : '🎵 Default',
                inline: true
            },
            {
                name: '🔒 Private Rooms',
                value: config.autoroom_private ? '✅ Enabled' : '❌ Disabled',
                inline: true
            },
            {
                name: '📝 Name Format',
                value: config.autoroom_format || '🎤 {user}\'s Room',
                inline: false
            },
            {
                name: '🧹 Cleanup Time',
                value: config.autoroom_cleanup ? `${config.autoroom_cleanup} minutes` : '⏰ Never',
                inline: true
            }
        );
        
        // Count active rooms
        if (client.autoroomManager) {
            const activeRooms = client.autoroomManager.getActiveRooms(message.guild.id) || [];
            embed.addFields({
                name: '📊 Active Rooms',
                value: `${activeRooms.length} rooms currently active`,
                inline: true
            });
        }
        
        embed.setFooter({ text: 'Use ^autoroom help for all commands' });
        
        return message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Error showing autoroom settings:', error);
        return message.reply('❌ Failed to load settings.');
    }
}

async function setupAutoroom(message, args, client, db) {
    // Get the creator channel
    let creatorChannel;
    
    if (message.mentions.channels.first()) {
        creatorChannel = message.mentions.channels.first();
    } else if (args[1]) {
        // Try to get by ID or name
        creatorChannel = message.guild.channels.cache.find(ch => 
            ch.id === args[1] || ch.name.toLowerCase().includes(args[1].toLowerCase())
        );
    } else {
        return message.reply('❌ Please mention or provide the creator voice channel: `^autoroom setup #channel`');
    }
    
    // Check if it's a voice channel
    if (creatorChannel.type !== ChannelType.GuildVoice) {
        return message.reply('❌ Creator channel must be a voice channel!');
    }
    
    try {
        await db.updateGuildConfig(message.guild.id, {
            autoroom_creator: creatorChannel.id,
            autoroom_format: '🎤 {user}\'s Room',
            autoroom_limit: 0, // No limit
            autoroom_bitrate: 64, // Default
            autoroom_private: false,
            autoroom_cleanup: 5 // 5 minutes cleanup
        });
        
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('✅ AutoRoom System Setup Complete!')
            .setDescription(`When someone joins **${creatorChannel}**, a new personal voice channel will be created.`)
            .addFields(
                { name: '🎯 Creator Channel', value: `${creatorChannel}`, inline: true },
                { name: '📁 Parent Category', value: `${creatorChannel.parent || 'Same category'}`, inline: true },
                { name: '📝 Default Name', value: '🎤 {user}\'s Room', inline: true },
                { name: '👤 User Limit', value: '🔓 No limit', inline: true },
                { name: '🔒 Private', value: '❌ Disabled', inline: true },
                { name: '🧹 Cleanup', value: '5 minutes after empty', inline: true }
            )
            .setFooter({ text: 'Join the creator channel to test! Use ^autoroom help to customize.' });
        
        // Initialize autoroom manager if needed
        if (!client.autoroomManager) {
            const AutoRoomManager = require('../../utils/autoroomManager');
            client.autoroomManager = new AutoRoomManager(client, db);
        }
        
        return message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Setup error:', error);
        return message.reply('❌ Failed to setup autoroom system.');
    }
}

async function removeAutoroom(message, client, db) {
    try {
        const config = await db.getGuildConfig(message.guild.id);
        
        if (!config.autoroom_creator) {
            return message.reply('❌ AutoRoom system is not setup.');
        }
        
        await db.updateGuildConfig(message.guild.id, {
            autoroom_creator: null,
            autoroom_category: null,
            autoroom_format: null,
            autoroom_limit: null,
            autoroom_bitrate: null,
            autoroom_private: null,
            autoroom_cleanup: null
        });
        
        // Cleanup any active rooms
        if (client.autoroomManager) {
            client.autoroomManager.cleanupGuild(message.guild.id);
        }
        
        return message.reply('✅ AutoRoom system removed. All settings cleared.');
        
    } catch (error) {
        console.error('Remove error:', error);
        return message.reply('❌ Failed to remove autoroom system.');
    }
}

async function setCategory(message, args, db) {
    const category = message.mentions.channels.first() || 
                     message.guild.channels.cache.get(args[1]);
    
    if (!category) {
        return message.reply('❌ Please mention a category: `^autoroom category #category`');
    }
    
    if (category.type !== ChannelType.GuildCategory) {
        return message.reply('❌ Please select a category channel!');
    }
    
    try {
        await db.updateGuildConfig(message.guild.id, {
            autoroom_category: category.id
        });
        
        return message.reply(`✅ AutoRoom category set to **${category.name}**. New rooms will be created here.`);
        
    } catch (error) {
        console.error('Category error:', error);
        return message.reply('❌ Failed to set category.');
    }
}

async function setUserLimit(message, args, db) {
    const limit = parseInt(args[1]);
    
    if (isNaN(limit) || limit < 0 || limit > 99) {
        return message.reply('❌ Please provide a valid limit (0-99). Use 0 for no limit.');
    }
    
    try {
        await db.updateGuildConfig(message.guild.id, {
            autoroom_limit: limit
        });
        
        return message.reply(`✅ User limit set to **${limit === 0 ? 'No limit' : limit + ' users'}**.`);
        
    } catch (error) {
        console.error('Limit error:', error);
        return message.reply('❌ Failed to set user limit.');
    }
}

async function setNameFormat(message, args, db) {
    const nameFormat = args.slice(1).join(' ');
    
    if (!nameFormat) {
        return message.reply('❌ Please provide a name format: `^autoroom name {user}\'s Hangout`\nVariables: {user}, {count}, {game}');
    }
    
    if (nameFormat.length > 100) {
        return message.reply('❌ Name format too long (max 100 characters).');
    }
    
    try {
        await db.updateGuildConfig(message.guild.id, {
            autoroom_format: nameFormat
        });
        
        const example = nameFormat
            .replace(/{user}/g, 'Username')
            .replace(/{count}/g, '1')
            .replace(/{game}/g, 'Playing Game');
        
        return message.reply(`✅ Name format set to: \`${nameFormat}\`\nExample: **${example}**`);
        
    } catch (error) {
        console.error('Name error:', error);
        return message.reply('❌ Failed to set name format.');
    }
}

async function setBitrate(message, args, db) {
    const bitrate = parseInt(args[1]);
    
    if (isNaN(bitrate) || bitrate < 8 || bitrate > 384) {
        return message.reply('❌ Please provide a valid bitrate (8-384 kbps).');
    }
    
    try {
        await db.updateGuildConfig(message.guild.id, {
            autoroom_bitrate: bitrate
        });
        
        return message.reply(`✅ Bitrate set to **${bitrate}kbps**.`);
        
    } catch (error) {
        console.error('Bitrate error:', error);
        return message.reply('❌ Failed to set bitrate.');
    }
}

async function setPrivate(message, args, db) {
    const enabled = args[1]?.toLowerCase();
    
    if (!['on', 'off'].includes(enabled)) {
        return message.reply('❌ Usage: `^autoroom private on/off`');
    }
    
    try {
        await db.updateGuildConfig(message.guild.id, {
            autoroom_private: enabled === 'on'
        });
        
        const status = enabled === 'on' 
            ? 'Private rooms (visible only to room owner)' 
            : 'Public rooms (visible to everyone)';
        
        return message.reply(`✅ ${status}`);
        
    } catch (error) {
        console.error('Private error:', error);
        return message.reply('❌ Failed to update privacy setting.');
    }
}

async function cleanupOldRooms(message, client, db) {
    try {
        if (!client.autoroomManager) {
            return message.reply('❌ AutoRoom manager not initialized.');
        }
        
        const count = client.autoroomManager.cleanupEmptyRooms(message.guild.id);
        
        return message.reply(`✅ Cleaned up **${count}** empty rooms.`);
        
    } catch (error) {
        console.error('Cleanup error:', error);
        return message.reply('❌ Failed to cleanup rooms.');
    }
}

async function listActiveRooms(message, client, db) {
    try {
        if (!client.autoroomManager) {
            return message.reply('❌ No active AutoRooms.');
        }
        
        const activeRooms = client.autoroomManager.getActiveRooms(message.guild.id);
        
        if (!activeRooms || activeRooms.length === 0) {
            return message.reply('❌ No active AutoRooms.');
        }
        
        const roomList = activeRooms.map(room => {
            const owner = message.guild.members.cache.get(room.ownerId)?.user?.username || 'Unknown';
            const channel = message.guild.channels.cache.get(room.channelId);
            return `• ${channel ? channel.name : 'Deleted'} (Owner: ${owner}, Users: ${room.userCount})`;
        }).join('\n');
        
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('📊 Active AutoRooms')
            .setDescription(`**${activeRooms.length}** rooms currently active:\n\n${roomList}`)
            .setFooter({ text: 'Rooms auto-delete when empty' });
        
        return message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('List error:', error);
        return message.reply('❌ Failed to list rooms.');
    }
}

async function testAutoroom(message, client, db) {
    try {
        const config = await db.getGuildConfig(message.guild.id);
        
        if (!config.autoroom_creator) {
            return message.reply('❌ AutoRoom system not setup. Use `^autoroom setup #channel`');
        }
        
        const creatorChannel = message.guild.channels.cache.get(config.autoroom_creator);
        
        if (!creatorChannel) {
            return message.reply('❌ Creator channel not found.');
        }
        
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🎤 AutoRoom Test')
            .setDescription(`Join **${creatorChannel}** to create a personal voice channel!`)
            .addFields(
                { name: '📝 Name Format', value: config.autoroom_format || '🎤 {user}\'s Room', inline: true },
                { name: '👤 User Limit', value: config.autoroom_limit ? `${config.autoroom_limit} users` : 'No limit', inline: true },
                { name: '🔒 Private', value: config.autoroom_private ? 'Yes' : 'No', inline: true },
                { name: '📁 Category', value: config.autoroom_category ? `<#${config.autoroom_category}>` : 'Same as creator', inline: false }
            )
            .setFooter({ text: 'The room will auto-delete when empty' });
        
        return message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Test error:', error);
        return message.reply('❌ Failed to test autoroom.');
    }
}

function showHelp(message) {
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🎤 AutoRoom System Help')
        .setDescription('Automatically create personal voice channels when someone joins a creator channel')
        .addFields(
            { name: '🚀 Setup', value: '`^autoroom setup #channel` - Setup with a creator channel', inline: false },
            { name: '⚙️ Configuration', value: '`^autoroom category #category` - Set parent category\n`^autoroom name {user}\'s Room` - Set name format\n`^autoroom limit 5` - Set user limit (0=no limit)\n`^autoroom bitrate 96` - Set bitrate (8-384)\n`^autoroom private on/off` - Toggle privacy', inline: false },
            { name: '🔧 Management', value: '`^autoroom list` - Show active rooms\n`^autoroom cleanup` - Delete empty rooms\n`^autoroom test` - Show instructions\n`^autoroom delete` - Remove system', inline: false },
            { name: '📝 Name Variables', value: '`{user}` - Owner username\n`{count}` - Room number\n`{game}` - Owner\'s game', inline: false },
            { name: '👁️ View Settings', value: '`.autoroom` - Show current settings', inline: false }
        )
        .setFooter({ text: 'Rooms auto-create on join • Auto-delete when empty • Owner gets special permissions' });
    
    return message.reply({ embeds: [embed] });
}
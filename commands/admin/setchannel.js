const { EmbedBuilder, PermissionsBitField, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
    name: 'setchannel',
    description: 'Set various channel configurations for the server',
    aliases: ['configchannel', 'channelset'],
    category: 'Admin',
    
    async execute(message, args, client, db) {
        // Check if user has Administrator or Manage Server permission
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && 
            !message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return message.reply('❌ You need **Administrator** or **Manage Server** permission to use this command!');
        }
        
        const subCommand = args[0]?.toLowerCase();
        
        if (!subCommand) {
            // Show current channel configurations
            let config;
            try {
                config = await db.getGuildConfig(message.guild.id);
            } catch (error) {
                console.error('Error getting guild config:', error);
                return message.reply('❌ Error loading configuration. Please try again.');
            }
            
            const embed = new EmbedBuilder()
                .setColor('#0061ff')
                .setTitle('⚙️ Channel Configurations')
                .setDescription('Configure various channels for different bot features.')
                .addFields(
                    { name: '📝 Usage', value: '`^setchannel <type> <#channel>` - Set channel for feature', inline: false },
                    { name: '📋 Available Types', value: '`log` - Moderation logs\n`welcome` - Welcome messages\n`leave` - Goodbye messages\n`verification` - Verification channel\n`ai` - AI chat channel\n`music` - Music commands\n`suggestions` - Suggestions\n`reports` - User reports\n`announcements` - Announcements', inline: false },
                    { name: '📊 Current Settings', value: getCurrentChannels(config, message.guild), inline: false }
                )
                .setFooter({ text: 'DTEmpire Channel Configuration' });
            
            // Create channel type selector
            const row = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('select_channel_type')
                        .setPlaceholder('Select channel type to configure...')
                        .addOptions([
                            { label: 'Log Channel', value: 'log', description: 'Moderation logs channel' },
                            { label: 'Welcome Channel', value: 'welcome', description: 'Welcome messages channel' },
                            { label: 'Leave Channel', value: 'leave', description: 'Goodbye messages channel' },
                            { label: 'Verification Channel', value: 'verification', description: 'Member verification channel' },
                            { label: 'AI Channel', value: 'ai', description: 'AI chat channel' },
                            { label: 'Music Channel', value: 'music', description: 'Music commands channel' },
                            { label: 'Suggestions Channel', value: 'suggestions', description: 'User suggestions channel' },
                            { label: 'Reports Channel', value: 'reports', description: 'User reports channel' },
                            { label: 'Announcements Channel', value: 'announcements', description: 'Bot announcements channel' }
                        ])
                );
            
            const configMessage = await message.reply({ 
                embeds: [embed], 
                components: [row] 
            });
            
            // Create collector
            const filter = i => i.user.id === message.author.id;
            const collector = configMessage.createMessageComponentCollector({ 
                filter, 
                time: 60000 
            });
            
            collector.on('collect', async interaction => {
                if (interaction.customId === 'select_channel_type') {
                    const channelType = interaction.values[0];
                    
                    await interaction.reply({
                        content: `Please mention the channel you want to set for **${channelType}**:\nExample: \`#channel-name\`\n\nType \`cancel\` to cancel.`,
                        ephemeral: true
                    });
                    
                    // Wait for channel mention
                    const channelFilter = m => m.author.id === message.author.id;
                    const channelCollector = message.channel.createMessageCollector({ 
                        filter: channelFilter, 
                        max: 1, 
                        time: 30000 
                    });
                    
                    channelCollector.on('collect', async channelMessage => {
                        // Check for cancel
                        if (channelMessage.content.toLowerCase() === 'cancel') {
                            await channelMessage.reply('❌ Channel configuration cancelled.');
                            channelCollector.stop();
                            return;
                        }
                        
                        const channel = channelMessage.mentions.channels.first();
                        
                        if (!channel) {
                            await channelMessage.reply('❌ Please mention a valid channel!');
                            channelCollector.stop();
                            return;
                        }
                        
                        try {
                            await setChannelConfig(channelType, channel.id, message.guild.id, db);
                            await channelMessage.reply(`✅ **${channelType.charAt(0).toUpperCase() + channelType.slice(1)}** channel set to ${channel}!`);
                        } catch (error) {
                            console.error('Error setting channel:', error);
                            await channelMessage.reply('❌ Failed to set channel. Please try again.');
                        }
                        
                        // Delete the message after a few seconds
                        setTimeout(() => {
                            channelMessage.delete().catch(() => {});
                        }, 3000);
                    });
                    
                    channelCollector.on('end', (collected, reason) => {
                        if (reason === 'time') {
                            message.channel.send('⏰ Channel selection timed out. Please try again.').then(msg => {
                                setTimeout(() => msg.delete(), 3000);
                            });
                        }
                    });
                }
            });
            
            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    const disabledRow = ActionRowBuilder.from(row);
                    disabledRow.components.forEach(c => c.setDisabled(true));
                    configMessage.edit({ components: [disabledRow] }).catch(() => {});
                }
            });
            
            return;
        }
        
        // Handle specific channel type
        if (args.length < 2) {
            return message.reply(`❌ Usage: \`^setchannel ${subCommand} <#channel>\``);
        }
        
        const channel = message.mentions.channels.first();
        if (!channel) {
            return message.reply('❌ Please mention a valid channel!');
        }
        
        try {
            await setChannelConfig(subCommand, channel.id, message.guild.id, db);
            message.reply(`✅ **${subCommand.charAt(0).toUpperCase() + subCommand.slice(1)}** channel set to ${channel}!`);
        } catch (error) {
            console.error('Error setting channel:', error);
            message.reply('❌ Failed to set channel. Please try again.');
        }
    }
};

function getCurrentChannels(config, guild) {
    const channels = [];
    
    // Check each channel type
    const channelTypes = [
        { key: 'log_channel', name: 'Logs' },
        { key: 'welcome_channel', name: 'Welcome' },
        { key: 'leave_channel', name: 'Leave' },
        { key: 'verification_channel', name: 'Verification' },
        { key: 'ai_channel', name: 'AI' },
        { key: 'music_channel', name: 'Music' },
        { key: 'suggestion_channel', name: 'Suggestions' },
        { key: 'report_channel', name: 'Reports' },
        { key: 'announcements_channel', name: 'Announcements' },
        { key: 'counting_channel', name: 'Counting' },
        { key: 'level_up_channel', name: 'Level Up' },
        { key: 'starboard_channel', name: 'Starboard' }
    ];
    
    for (const type of channelTypes) {
        if (config[type.key]) {
            const channel = guild.channels.cache.get(config[type.key]);
            channels.push(`**${type.name}:** ${channel ? channel.toString() : 'Channel not found'}`);
        } else {
            channels.push(`**${type.name}:** Not set`);
        }
    }
    
    return channels.length > 0 ? channels.join('\n') : 'No channels configured';
}

async function setChannelConfig(type, channelId, guildId, db) {
    const updates = {};
    
    // Map command types to database field names
    const fieldMapping = {
        'log': 'log_channel',
        'welcome': 'welcome_channel',
        'leave': 'leave_channel',
        'verification': 'verification_channel',
        'ai': 'ai_channel',
        'music': 'music_channel',
        'suggestions': 'suggestion_channel',
        'reports': 'report_channel',
        'announcements': 'announcements_channel',
        'counting': 'counting_channel',
        'levelup': 'level_up_channel',
        'starboard': 'starboard_channel'
    };
    
    const dbField = fieldMapping[type];
    
    if (!dbField) {
        throw new Error(`Invalid channel type: ${type}`);
    }
    
    updates[dbField] = channelId;
    
    // Use the correct database method
    await db.updateGuildConfig(guildId, updates);
}
// commands/config/setguildjoin.js - Updated version
const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
    name: 'setguildjoin',
    description: 'Set channels to see when the bot joins/leaves servers',
    aliases: ['setjoinchannel', 'guildjoinchannel', 'setguildnotify'],
    category: 'Config',
    
    async execute(message, args, client, db) {
        try {
            if (!message.guild) {
                return message.reply('❌ This command can only be used in a server.');
            }
            
            if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return message.reply('❌ You need **Administrator** permission to use this command.');
            }
            
            // Show help if no arguments
            if (args.length === 0) {
                return showHelp(message, client);
            }
            
            const subcommand = args[0].toLowerCase();
            
            switch (subcommand) {
                case 'join':
                    await setJoinChannel(message, args, client, db);
                    break;
                case 'leave':
                    await setLeaveChannel(message, args, client, db);
                    break;
                case 'both':
                    await setBothChannels(message, args, client, db);
                    break;
                case 'view':
                    await viewSettings(message, client, db);
                    break;
                case 'test':
                    await sendTestNotification(message, args, client, db);
                    break;
                default:
                    // If just a channel mention, assume they want both
                    if (message.mentions.channels.first()) {
                        await setBothChannels(message, args, client, db);
                    } else {
                        showHelp(message, client);
                    }
            }
            
        } catch (error) {
            console.error('Setguildjoin command error:', error);
            message.reply('❌ An error occurred while setting guild notifications.');
        }
    }
};

// ========== HELPER FUNCTIONS ==========

function showHelp(message, client) {
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📡 Guild Join/Leave Notifications')
        .setDescription('Configure channels to get notified when the bot joins or leaves servers')
        .addFields(
            {
                name: '🎉 Set Join Channel',
                value: `\`${client.botInfo.prefix || '^'}setguildjoin join #channel\`\nGet notified when bot joins new servers`,
                inline: false
            },
            {
                name: '🚫 Set Leave Channel',
                value: `\`${client.botInfo.prefix || '^'}setguildjoin leave #channel\`\nGet notified when bot leaves servers`,
                inline: false
            },
            {
                name: '📡 Set Both Channels',
                value: `\`${client.botInfo.prefix || '^'}setguildjoin both #channel\`\nUse same channel for both notifications`,
                inline: false
            },
            {
                name: '👀 View Settings',
                value: `\`${client.botInfo.prefix || '^'}setguildjoin view\`\nView current notification settings`,
                inline: false
            },
            {
                name: '🧪 Test Notification',
                value: `\`${client.botInfo.prefix || '^'}setguildjoin test\`\nSend a test notification`,
                inline: false
            },
            {
                name: '📊 Current Statistics',
                value: `• Servers: ${client.guilds.cache.size}\n• Users: ${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)}`,
                inline: false
            }
        )
        .setFooter({ text: 'Configure notifications in one server to monitor all server activity' });
    
    return message.reply({ embeds: [embed] });
}

async function setJoinChannel(message, args, client, db) {
    const channel = message.mentions.channels.first();
    if (!channel) {
        return message.reply('❌ Please mention a channel: `^setguildjoin join #channel`');
    }
    
    if (channel.type !== ChannelType.GuildText) {
        return message.reply('❌ Please select a text channel.');
    }
    
    // Check permissions
    const botPermissions = channel.permissionsFor(client.user);
    const missingPerms = ['SendMessages', 'EmbedLinks', 'ViewChannel'].filter(
        perm => !botPermissions.has(PermissionFlagsBits[perm])
    );
    
    if (missingPerms.length > 0) {
        return message.reply(`❌ I need **${missingPerms.join(', ')}** permissions in ${channel.toString()}`);
    }
    
    // Save to database
    await db.updateGuildConfig(message.guild.id, {
        guild_join_channel: channel.id
    });
    
    const config = await db.getGuildConfig(message.guild.id);
    
    const embed = new EmbedBuilder()
        .setColor('#43B581')
        .setTitle('✅ Join Notification Channel Set')
        .setDescription(`I will notify you in ${channel.toString()} when I join new servers`)
        .addFields(
            {
                name: '📁 Channel',
                value: `${channel.toString()} (\`${channel.id}\`)`,
                inline: true
            },
            {
                name: '📊 Bot Stats',
                value: `• Servers: ${client.guilds.cache.size}\n• Users: ${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)}`,
                inline: true
            },
            {
                name: '⚙️ Settings',
                value: `• Join Notifications: ✅ Enabled\n• Leave Notifications: ${config.guild_leave_channel ? '✅ Enabled' : '❌ Disabled'}`,
                inline: false
            }
        )
        .setFooter({ text: 'Use ^setguildjoin leave #channel to set leave notifications too' })
        .setTimestamp();
    
    // Add test button
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('test_join_notification')
                .setLabel('Send Test')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🧪'),
            new ButtonBuilder()
                .setCustomId('set_leave_channel')
                .setLabel('Set Leave Channel')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🚫')
        );
    
    const reply = await message.reply({ embeds: [embed], components: [row] });
    
    // Button collector
    const collector = reply.createMessageComponentCollector({ time: 60000 });
    
    collector.on('collect', async (interaction) => {
        if (interaction.user.id !== message.author.id) {
            return interaction.reply({ 
                content: '❌ This button is not for you!', 
                ephemeral: true 
            });
        }
        
        if (interaction.customId === 'test_join_notification') {
            await interaction.deferUpdate();
            await sendTestJoinNotification(client, channel);
        } else if (interaction.customId === 'set_leave_channel') {
            const modalEmbed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('🚫 Set Leave Channel')
                .setDescription(`Reply with \`^setguildjoin leave #channel\` to set leave notifications in ${channel.toString()} too.`)
                .setFooter({ text: 'This helps you track when the bot leaves servers' });
            
            await interaction.reply({ embeds: [modalEmbed], ephemeral: true });
        }
    });
    
    collector.on('end', () => {
        row.components.forEach(component => component.setDisabled(true));
        reply.edit({ components: [row] }).catch(() => {});
    });
}

async function setLeaveChannel(message, args, client, db) {
    const channel = message.mentions.channels.first();
    if (!channel) {
        return message.reply('❌ Please mention a channel: `^setguildjoin leave #channel`');
    }
    
    if (channel.type !== ChannelType.GuildText) {
        return message.reply('❌ Please select a text channel.');
    }
    
    // Check permissions
    const botPermissions = channel.permissionsFor(client.user);
    const missingPerms = ['SendMessages', 'EmbedLinks', 'ViewChannel'].filter(
        perm => !botPermissions.has(PermissionFlagsBits[perm])
    );
    
    if (missingPerms.length > 0) {
        return message.reply(`❌ I need **${missingPerms.join(', ')}** permissions in ${channel.toString()}`);
    }
    
    // Save to database
    await db.updateGuildConfig(message.guild.id, {
        guild_leave_channel: channel.id
    });
    
    const config = await db.getGuildConfig(message.guild.id);
    
    const embed = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle('✅ Leave Notification Channel Set')
        .setDescription(`I will notify you in ${channel.toString()} when I leave servers`)
        .addFields(
            {
                name: '📁 Channel',
                value: `${channel.toString()} (\`${channel.id}\`)`,
                inline: true
            },
            {
                name: '📊 Bot Stats',
                value: `• Servers: ${client.guilds.cache.size}\n• Users: ${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)}`,
                inline: true
            },
            {
                name: '⚙️ Settings',
                value: `• Join Notifications: ${config.guild_join_channel ? '✅ Enabled' : '❌ Disabled'}\n• Leave Notifications: ✅ Enabled`,
                inline: false
            }
        )
        .setFooter({ text: 'Use ^setguildjoin join #channel to set join notifications too' })
        .setTimestamp();
    
    await message.reply({ embeds: [embed] });
}

async function setBothChannels(message, args, client, db) {
    const channel = message.mentions.channels.first();
    if (!channel) {
        return message.reply('❌ Please mention a channel: `^setguildjoin both #channel`');
    }
    
    if (channel.type !== ChannelType.GuildText) {
        return message.reply('❌ Please select a text channel.');
    }
    
    // Check permissions
    const botPermissions = channel.permissionsFor(client.user);
    const missingPerms = ['SendMessages', 'EmbedLinks', 'ViewChannel'].filter(
        perm => !botPermissions.has(PermissionFlagsBits[perm])
    );
    
    if (missingPerms.length > 0) {
        return message.reply(`❌ I need **${missingPerms.join(', ')}** permissions in ${channel.toString()}`);
    }
    
    // Save both channels to database
    await db.updateGuildConfig(message.guild.id, {
        guild_join_channel: channel.id,
        guild_leave_channel: channel.id
    });
    
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('✅ Both Notification Channels Set')
        .setDescription(`I will notify you in ${channel.toString()} when I join or leave servers`)
        .addFields(
            {
                name: '📁 Channel',
                value: `${channel.toString()} (\`${channel.id}\`)`,
                inline: true
            },
            {
                name: '🎉 Join Notifications',
                value: '✅ Enabled',
                inline: true
            },
            {
                name: '🚫 Leave Notifications',
                value: '✅ Enabled',
                inline: true
            },
            {
                name: '📊 Bot Stats',
                value: `• Servers: ${client.guilds.cache.size}\n• Users: ${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)}`,
                inline: false
            },
            {
                name: '📡 What you\'ll see',
                value: '• Detailed server info when I join\n• Notification when I leave\n• Server statistics and analytics',
                inline: false
            }
        )
        .setFooter({ text: 'The bot will now monitor all server activity' })
        .setTimestamp();
    
    // Add test buttons
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('test_join')
                .setLabel('Test Join')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🎉'),
            new ButtonBuilder()
                .setCustomId('test_leave')
                .setLabel('Test Leave')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🚫')
        );
    
    const reply = await message.reply({ embeds: [embed], components: [row] });
    
    // Button collector
    const collector = reply.createMessageComponentCollector({ time: 60000 });
    
    collector.on('collect', async (interaction) => {
        if (interaction.user.id !== message.author.id) {
            return interaction.reply({ 
                content: '❌ This button is not for you!', 
                ephemeral: true 
            });
        }
        
        if (interaction.customId === 'test_join') {
            await interaction.deferUpdate();
            await sendTestJoinNotification(client, channel);
        } else if (interaction.customId === 'test_leave') {
            await interaction.deferUpdate();
            await sendTestLeaveNotification(client, channel);
        }
    });
    
    collector.on('end', () => {
        row.components.forEach(component => component.setDisabled(true));
        reply.edit({ components: [row] }).catch(() => {});
    });
}

async function viewSettings(message, client, db) {
    const config = await db.getGuildConfig(message.guild.id);
    
    const embed = new EmbedBuilder()
        .setColor('#7289DA')
        .setTitle('⚙️ Guild Notification Settings')
        .setDescription(`Settings for ${message.guild.name}`)
        .addFields(
            {
                name: '🎉 Join Channel',
                value: config.guild_join_channel ? `<#${config.guild_join_channel}>` : '❌ Not set',
                inline: true
            },
            {
                name: '🚫 Leave Channel',
                value: config.guild_leave_channel ? `<#${config.guild_leave_channel}>` : '❌ Not set',
                inline: true
            },
            {
                name: '📊 Bot Statistics',
                value: `• Servers: ${client.guilds.cache.size}\n• Users: ${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)}`,
                inline: false
            },
            {
                name: '⚡ Last Activity',
                value: config.updated_at ? `<t:${Math.floor(config.updated_at / 1000)}:R>` : 'Never',
                inline: false
            }
        )
        .setFooter({ text: 'Use ^setguildjoin help to see all commands' })
        .setTimestamp();
    
    await message.reply({ embeds: [embed] });
}

async function sendTestNotification(message, args, client, db) {
    const config = await db.getGuildConfig(message.guild.id);
    
    if (!config.guild_join_channel && !config.guild_leave_channel) {
        return message.reply('❌ No notification channels configured. Use `^setguildjoin join #channel` first.');
    }
    
    // Create select menu for test type
    const row = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('test_notification_type')
                .setPlaceholder('Select test type...')
                .addOptions([
                    {
                        label: 'Join Notification',
                        description: 'Test what shows when bot joins a server',
                        value: 'join',
                        emoji: '🎉'
                    },
                    {
                        label: 'Leave Notification',
                        description: 'Test what shows when bot leaves a server',
                        value: 'leave',
                        emoji: '🚫'
                    }
                ])
        );
    
    const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('🧪 Test Notifications')
        .setDescription('Select what type of notification you want to test')
        .addFields(
            {
                name: '📁 Configured Channels',
                value: `• Join: ${config.guild_join_channel ? `<#${config.guild_join_channel}>` : '❌ Not set'}\n• Leave: ${config.guild_leave_channel ? `<#${config.guild_leave_channel}>` : '❌ Not set'}`,
                inline: false
            },
            {
                name: '📊 Bot Stats',
                value: `• Servers: ${client.guilds.cache.size}\n• Users: ${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)}`,
                inline: false
            }
        )
        .setFooter({ text: 'Test notifications help verify your setup is working' });
    
    const reply = await message.reply({ embeds: [embed], components: [row] });
    
    // Select menu collector
    const collector = reply.createMessageComponentCollector({ time: 60000 });
    
    collector.on('collect', async (interaction) => {
        if (interaction.user.id !== message.author.id) {
            return interaction.reply({ 
                content: '❌ This menu is not for you!', 
                ephemeral: true 
            });
        }
        
        await interaction.deferUpdate();
        
        const testType = interaction.values[0];
        
        // Determine which channel to use
        let channelId;
        if (testType === 'join') {
            channelId = config.guild_join_channel;
        } else {
            channelId = config.guild_leave_channel;
        }
        
        // Fallback to join channel if leave channel not set
        if (!channelId && testType === 'leave' && config.guild_join_channel) {
            channelId = config.guild_join_channel;
        }
        
        if (!channelId) {
            await interaction.followUp({
                content: `❌ No ${testType} notification channel configured!`,
                flags: 64
            });
            return;
        }
        
        const channel = message.guild.channels.cache.get(channelId);
        if (!channel) {
            await interaction.followUp({
                content: `❌ Configured channel not found!`,
                flags: 64
            });
            return;
        }
        
        if (testType === 'join') {
            await sendTestJoinNotification(client, channel);
        } else {
            await sendTestLeaveNotification(client, channel);
        }
        
        await interaction.followUp({
            content: `✅ Test ${testType} notification sent to ${channel.toString()}`,
            flags: 64
        });
    });
}

async function sendTestJoinNotification(client, channel) {
    const testEmbed = new EmbedBuilder()
        .setColor('#43B581')
        .setTitle('🧪 Test Guild Join Notification')
        .setDescription('This is a test notification for when the bot joins a new server.')
        .addFields(
            {
                name: '🏠 Example Server',
                value: `**Test Server Name**\nID: \`123456789012345678\``,
                inline: true
            },
            {
                name: '👥 Members',
                value: `250 members\n200 humans • 50 bots`,
                inline: true
            },
            {
                name: '📅 Created',
                value: `<t:1700000000:F>\n(over 1 year ago)`,
                inline: true
            },
            {
                name: '🟢 Online Status',
                value: `🟢 75 🟠 15\n🔴 5 ⚪ 155`,
                inline: true
            },
            {
                name: '📁 Channels',
                value: `💬 Text: 25\n🔊 Voice: 10\n📁 Categories: 5`,
                inline: true
            },
            {
                name: '👑 Owner',
                value: `TestOwner#0001 (\`1234567890\`)`,
                inline: true
            },
            {
                name: '📊 Bot Stats',
                value: `• Servers: ${client.guilds.cache.size}\n• Users: ${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)}`,
                inline: false
            }
        )
        .setFooter({ text: 'When the bot joins a real server, detailed info will appear here' })
        .setTimestamp();
    
    await channel.send({ 
        content: '📥 **TEST: Bot has joined a new server!**',
        embeds: [testEmbed] 
    });
}

async function sendTestLeaveNotification(client, channel) {
    const testEmbed = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle('🧪 Test Guild Leave Notification')
        .setDescription('This is a test notification for when the bot leaves a server.')
        .addFields(
            {
                name: '🏠 Example Server',
                value: `**Test Server Name**\nID: \`123456789012345678\``,
                inline: true
            },
            {
                name: '👥 Members',
                value: `250 members\nWas in server for 30 days`,
                inline: true
            },
            {
                name: '📅 Server Age',
                value: `<t:1700000000:F>\nCreated over 1 year ago`,
                inline: true
            },
            {
                name: '📁 Channels',
                value: `💬 Text: 25\n🔊 Voice: 10\n📁 Categories: 5`,
                inline: true
            },
            {
                name: '👑 Owner',
                value: `TestOwner#0001 (\`1234567890\`)`,
                inline: true
            },
            {
                name: '📊 After Leaving',
                value: `• Servers: ${client.guilds.cache.size}\n• Users: ${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)}`,
                inline: false
            },
            {
                name: '📝 Reason',
                value: 'Bot was removed from server',
                inline: false
            }
        )
        .setFooter({ text: 'When the bot leaves a real server, similar info will appear here' })
        .setTimestamp();
    
    await channel.send({ 
        content: '📤 **TEST: Bot has left a server!**',
        embeds: [testEmbed] 
    });
}
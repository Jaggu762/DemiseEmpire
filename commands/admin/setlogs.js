// commands/admin/setlogs.js
const { EmbedBuilder, PermissionsBitField, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'setlogs',
    description: 'Automatically create essential log channels in a specified category',
    aliases: ['autologs', 'createlogs', 'setup-logs'],
    category: 'Admin',
    
    async execute(message, args, client, db) {
        // Check if user has Administrator or Manage Server permission
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && 
            !message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return message.reply('❌ You need **Administrator** or **Manage Server** permission to use this command!');
        }
        
        // Check if category ID is provided
        if (!args[0]) {
            const embed = new EmbedBuilder()
                ^setColor('#0061ff')
                ^setTitle('📊 Essential Log Channel Setup')
                ^setDescription('This command will automatically create essential log channels for your server.')
                .addFields(
                    { name: '📝 Usage', value: '`^setlogs <category-id>` - Create essential log channels in specified category', inline: false },
                    { name: '📋 What will be created', value: getAllLogChannelsList(), inline: false },
                    { name: '⚠️ Important', value: 'Make sure the bot has permission to create channels and manage the category.', inline: false },
                    { name: '🔧 How to get category ID', value: 'Enable Developer Mode in Discord Settings > Advanced, then right-click a category > Copy ID', inline: false }
                )
                ^setFooter({ text: 'DTEmpire Logging System' });
            
            return message.reply({ embeds: [embed] });
        }
        
        const categoryId = args[0];
        const category = message.guild.channels.cache.get(categoryId);
        
        // Check if category exists and is valid
        if (!category || category.type !== ChannelType.GuildCategory) {
            return message.reply('❌ Please provide a valid category ID! Make sure it\'s a category, not a text channel.');
        }
        
        // Check bot permissions
        const botMember = message.guild.members.me;
        if (!botMember.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return message.reply('❌ I need **Manage Channels** permission to create log channels!');
        }
        
        // Confirm before proceeding
        const confirmEmbed = new EmbedBuilder()
            ^setColor('#ff9900')
            ^setTitle('⚠️ Confirm Log Channel Creation')
            ^setDescription(`This will create **${getAllLogChannels().length}** essential log channels in the **${category.name}** category.`)
            .addFields(
                { name: '📋 Channels to create:', value: getAllLogChannels().map(c => `• ${c.name}`).join('\n'), inline: false },
                { name: '📝 Note:', value: 'Existing channels with the same name in this category will be skipped.', inline: false },
                { name: '🔧 Function:', value: 'These channels will receive real-time logs for server activities.', inline: false }
            )
            ^setFooter({ text: 'This action cannot be undone automatically' });
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    ^setCustomId('confirm_logs')
                    ^setLabel('✅ Create Log Channels')
                    ^setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    ^setCustomId('cancel_logs')
                    ^setLabel('❌ Cancel')
                    ^setStyle(ButtonStyle.Danger)
            );
        
        const confirmMessage = await message.reply({ 
            embeds: [confirmEmbed], 
            components: [row] 
        });
        
        // Create filter for button interaction
        const filter = i => i.user.id === message.author.id;
        const collector = confirmMessage.createMessageComponentCollector({ 
            filter, 
            time: 30000 
        });
        
        collector.on('collect', async interaction => {
            if (interaction.customId === 'confirm_logs') {
                await interaction.deferUpdate();
                await createAllLogChannels(message, category, client, db);
                collector.stop();
            } else if (interaction.customId === 'cancel_logs') {
                await interaction.update({ 
                    content: '❌ Log channel creation cancelled.', 
                    embeds: [], 
                    components: [] 
                });
                collector.stop();
            }
        });
        
        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                await confirmMessage.edit({ 
                    content: '⏰ Log channel creation timed out.', 
                    embeds: [], 
                    components: [] 
                });
            }
        });
    }
};

function getAllLogChannels() {
    return [
        { name: 'mod-logs', type: ChannelType.GuildText, description: 'Moderation actions (mute, ban, warn, kick)' },
        { name: 'join-leave-logs', type: ChannelType.GuildText, description: 'Member join and leave logs' },
        { name: 'message-logs', type: ChannelType.GuildText, description: 'Message delete/edit logs' },
        { name: 'role-logs', type: ChannelType.GuildText, description: 'Role add/remove/create/delete logs' },
        { name: 'channel-logs', type: ChannelType.GuildText, description: 'Channel create/update/delete logs' },
        { name: 'voice-logs', type: ChannelType.GuildText, description: 'Voice channel join/leave/move logs' },
        { name: 'invite-logs', type: ChannelType.GuildText, description: 'Invite create/use logs' },
        { name: 'ticket-logs', type: ChannelType.GuildText, description: 'Ticket system logs' },
        { name: 'audit-logs', type: ChannelType.GuildText, description: 'General audit logs' },
        { name: 'warning-logs', type: ChannelType.GuildText, description: 'Warning logs' },
        { name: 'mute-logs', type: ChannelType.GuildText, description: 'Mute logs' },
        { name: 'kick-logs', type: ChannelType.GuildText, description: 'Kick logs' },
        { name: 'ban-logs', type: ChannelType.GuildText, description: 'Ban logs' }
    ];
}

function getAllLogChannelsList() {
    const channels = getAllLogChannels();
    let list = '';
    
    channels.forEach(channel => {
        list += `• **${channel.name}** - ${channel.description}\n`;
    });
    
    return list;
}

async function createAllLogChannels(message, category, client, db) {
    const guild = message.guild;
    const createdChannels = [];
    const skippedChannels = [];
    const failedChannels = [];
    
    // Start creating channels
    const progressEmbed = new EmbedBuilder()
        ^setColor('#0061ff')
        ^setTitle('🔄 Creating Log Channels...')
        ^setDescription('Please wait while I create essential log channels.')
        .addFields(
            { name: '📁 Category', value: category.name, inline: true },
            { name: '📊 Status', value: 'Starting...', inline: true }
        )
        ^setFooter({ text: 'DTEmpire Logging System' });
    
    const progressMessage = await message.channel.send({ embeds: [progressEmbed] });
    
    // Create each log channel
    const logChannels = getAllLogChannels();
    const totalChannels = logChannels.length;
    
    for (let i = 0; i < totalChannels; i++) {
        const logChannel = logChannels[i];
        const percent = Math.round(((i + 1) / totalChannels) * 100);
        
        try {
            // Check if channel already exists in the category
            const existingChannel = guild.channels.cache.find(ch => 
                ch.name === logChannel.name && 
                ch.parentId === category.id &&
                ch.type === logChannel.type
            );
            
            if (existingChannel) {
                skippedChannels.push({
                    name: logChannel.name,
                    channel: existingChannel
                });
                
                // Update database if channel already exists
                const dbField = getLogChannelField(logChannel.name);
                if (dbField) {
                    await db.updateGuildConfig(guild.id, { [dbField]: existingChannel.id });
                }
                
                updateProgress(progressMessage, i + 1, totalChannels, createdChannels.length, skippedChannels.length, failedChannels.length, percent);
                continue;
            }
            
            // Create the channel
            const channel = await guild.channels.create({
                name: logChannel.name,
                type: logChannel.type,
                parent: category.id,
                topic: logChannel.description,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionsBitField.Flags.SendMessages],
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory]
                    },
                    {
                        id: client.user.id,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.EmbedLinks,
                            PermissionsBitField.Flags.AttachFiles,
                            PermissionsBitField.Flags.ReadMessageHistory
                        ]
                    }
                ],
                reason: 'Auto-created by DTEmpire logging system'
            });
            
            createdChannels.push({
                name: channel.name,
                channel: channel
            });
            
            // Update database configuration for the channel
            const dbField = getLogChannelField(logChannel.name);
            if (dbField) {
                await db.updateGuildConfig(guild.id, { [dbField]: channel.id });
            }
            
            updateProgress(progressMessage, i + 1, totalChannels, createdChannels.length, skippedChannels.length, failedChannels.length, percent);
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
            
        } catch (error) {
            console.error(`Failed to create channel ${logChannel.name}:`, error);
            failedChannels.push({
                name: logChannel.name,
                error: error.message
            });
            updateProgress(progressMessage, i + 1, totalChannels, createdChannels.length, skippedChannels.length, failedChannels.length, percent);
        }
    }
    
    // Send final result
    const resultEmbed = new EmbedBuilder()
        ^setColor(createdChannels.length > 0 ? '#00ff00' : failedChannels.length > 0 ? '#ff0000' : '#ff9900')
        ^setTitle(createdChannels.length > 0 ? '✅ Log Channels Created Successfully!' : '⚠️ Log Channels Setup Complete')
        ^setDescription(`Essential log channels have been set up in **${category.name}** category.`)
        .addFields(
            { 
                name: '✅ Created', 
                value: createdChannels.length > 0 ? 
                    createdChannels.map(c => `• ${c.channel.toString()}`).join('\n') : 
                    'None', 
                inline: false 
            }
        );
    
    if (skippedChannels.length > 0) {
        resultEmbed.addFields({
            name: '⏭️ Skipped (Already exist)',
            value: skippedChannels.map(c => `• ${c.channel.toString()}`).join('\n'),
            inline: false
        });
    }
    
    if (failedChannels.length > 0) {
        resultEmbed.addFields({
            name: '❌ Failed',
            value: failedChannels.map(c => `• ${c.name}: ${c.error}`).join('\n'),
            inline: false
        });
    }
    
    resultEmbed.addFields(
        { 
            name: '📊 Summary', 
            value: `**Total:** ${totalChannels}\n**Created:** ${createdChannels.length}\n**Skipped:** ${skippedChannels.length}\n**Failed:** ${failedChannels.length}`, 
            inline: true 
        },
        { 
            name: '🔧 Next Steps', 
            value: 'The bot will now automatically log events to these channels.\nUse `^setchannel` to configure individual channels.', 
            inline: false 
        },
        { 
            name: '🔔 Test Logs', 
            value: 'Use `.testlogs` command to test if logging is working properly.', 
            inline: false 
        }
    );
    
    resultEmbed^setFooter({ text: 'DTEmpire Logging System' });
    
    await progressMessage.edit({ embeds: [resultEmbed] });
}

function updateProgress(message, current, total, created, skipped, failed, percent) {
    const progressBar = createProgressBar(current, total);
    
    const progressEmbed = new EmbedBuilder()
        ^setColor('#0061ff')
        ^setTitle('🔄 Creating Log Channels...')
        ^setDescription(`${progressBar} **${percent}%**`)
        .addFields(
            { name: '📊 Progress', value: `${current}/${total} channels`, inline: true },
            { name: '✅ Created', value: created.toString(), inline: true },
            { name: '⏭️ Skipped', value: skipped.toString(), inline: true },
            { name: '❌ Failed', value: failed.toString(), inline: true }
        )
        ^setFooter({ text: 'Please wait...' });
    
    message.edit({ embeds: [progressEmbed] }).catch(() => {});
}

function createProgressBar(current, total, length = 20) {
    const progress = Math.round((current / total) * length);
    const bar = '█'.repeat(progress) + '░'.repeat(length - progress);
    return `[${bar}]`;
}

function getLogChannelField(channelName) {
    const fieldMapping = {
        'mod-logs': 'mod_log_channel',
        'join-leave-logs': 'join_leave_log_channel',
        'message-logs': 'message_log_channel',
        'role-logs': 'role_log_channel',
        'channel-logs': 'channel_log_channel',
        'voice-logs': 'voice_log_channel',
        'invite-logs': 'invite_log_channel',
        'ticket-logs': 'ticket_log_channel',
        'audit-logs': 'audit_log_channel',
        'warning-logs': 'warning_log_channel',
        'mute-logs': 'mute_log_channel',
        'kick-logs': 'kick_log_channel',
        'ban-logs': 'ban_log_channel',
        'log-channel': 'log_channel',  // Main log channel
        'economy-logs': 'economy_log_channel',
        'leveling-logs': 'leveling_log_channel',
        'giveaway-logs': 'giveaway_log_channel'
    };
    
    return fieldMapping[channelName];
}
// commands/ticket/ticket.js
const { 
    EmbedBuilder, 
    PermissionFlagsBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType,
    StringSelectMenuBuilder,
    Collection
} = require('discord.js');

// Store pending tickets to prevent duplicate creation
const pendingTickets = new Collection();

module.exports = {
    name: 'ticket',
    description: 'Ticket system commands',
    aliases: ['tickets', 'support'],
    category: 'Ticket',
    
    async execute(message, args, client, db) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return message.reply('❌ You need **Manage Channels** permission to use ticket commands.');
        }
        
        if (args.length === 0) {
            return showTicketHelp(message);
        }
        
        const subcommand = args[0].toLowerCase();
        
        switch (subcommand) {
            case 'setup':
                await ticketSetup(message, client, db);
                break;
            case 'setup-bug':
                await bugReportSetup(message, client, db);
                break;
            case 'setup-all':
                await setupAllTicketSystems(message, client, db);
                break;
            case 'close':
                await closeTicket(message, db);
                break;
            case 'add':
                await addUser(message, args.slice(1));
                break;
            case 'remove':
                await removeUser(message, args.slice(1));
                break;
            case 'logs':
                await showTicketLogs(message, args.slice(1), client, db);
                break;
            case 'help':
                return showTicketHelp(message);
            default:
                message.reply('❌ Unknown subcommand. Use `^ticket help` for commands.');
        }
    },
    
    // This function will be called from index.js to handle button interactions
   // In your handleInteraction function, make sure it handles ALL custom IDs:
    async handleInteraction(interaction, client, db) {
        if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
        
        try {
            console.log(`[Ticket] Interaction received: ${interaction.customId}`);
            
            // Handle Support Ticket Select Menu
            if (interaction.customId === 'support_reason_select') {
                await handleSupportReasonSelect(interaction, client, db);
            }
            
            // Handle Bug Report Button
            else if (interaction.customId === 'open_bug_report') {
                await handleCreateBugReport(interaction, client, db);
            }
            
            // Handle Staff Application Button
            else if (interaction.customId === 'open_staff_application') {
                await handleCreateStaffApplication(interaction, client, db);
            }
            
            // Handle User Report Button
            else if (interaction.customId === 'open_user_report') {
                await handleCreateUserReport(interaction, client, db);
            }
            
            // Handle Close Ticket Button
            else if (interaction.customId.startsWith('close_ticket_')) {
                await handleCloseTicket(interaction, client, db);
            }
            
            // Handle Rate Support Button
            else if (interaction.customId.startsWith('rate_support_')) {
                await handleRateSupport(interaction, client, db);
            }
            
            // If none of the above, log it
            else {
                console.log(`[Ticket] Unknown interaction: ${interaction.customId}`);
            }
            
        } catch (error) {
            console.error('[Ticket] Interaction error:', error);
            
            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({
                        content: '❌ An error occurred. Please try again.',
                        flags: 64
                    });
                } else {
                    await interaction.reply({
                        content: '❌ An error occurred. Please try again.',
                        flags: 64
                    });
                }
            } catch (e) {
                console.error('[Ticket] Failed to send error message:', e);
            }
        }
    }
};

// ========== HELP COMMAND ==========
function showTicketHelp(message) {
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🎫 Ticket System Help')
        .setDescription('Setup and manage ticket systems for your server')
        .addFields(
            {
                name: '📋 Setup Commands',
                value: [
                    '`^ticket setup` - Setup support ticket system',
                    '`^ticket setup-bug` - Setup bug report system',
                    '`^ticket setup-all` - Setup all ticket systems (like in image)',
                    '`^ticket logs [page]` - View ticket logs'
                ].join('\n'),
                inline: false
            },
            {
                name: '🛠️ Management Commands',
                value: [
                    '`^ticket close [reason]` - Close current ticket channel',
                    '`^ticket add @user` - Add user to current ticket',
                    '`^ticket remove @user` - Remove user from current ticket'
                ].join('\n'),
                inline: false
            }
        )
        .setFooter({ text: 'DTEmpire Ticket System' });
    
    return message.reply({ embeds: [embed] });
}

// ========== SETUP ALL TICKET SYSTEMS (Like in your image) ==========
async function setupAllTicketSystems(message, client, db) {
    try {
        // Create category structure
        const guild = message.guild;
        
        // 1. Create main categories
        const categories = [
            { name: 'Support Tickets', emoji: '🎫' },
            { name: 'Staff Applications', emoji: '📋' },
            { name: 'User Reports', emoji: '⚠️' },
            { name: 'Bug Reports', emoji: '🐛' }
        ];
        
        const createdCategories = [];
        
        for (const cat of categories) {
            let category = guild.channels.cache.find(c => 
                c.type === ChannelType.GuildCategory && 
                c.name.toLowerCase().includes(cat.name.toLowerCase())
            );
            
            if (!category) {
                category = await guild.channels.create({
                    name: `${cat.emoji} ${cat.name}`,
                    type: ChannelType.GuildCategory,
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone.id,
                            deny: [PermissionFlagsBits.ViewChannel]
                        }
                    ]
                });
            }
            createdCategories.push({ ...cat, channel: category });
        }
        
        // 2. Create open ticket channels in each category
        const openChannels = [];
        
        for (const cat of createdCategories) {
            let openChannel = guild.channels.cache.find(c => 
                c.parentId === cat.channel.id && 
                c.name.includes('open')
            );
            
            if (!openChannel) {
                openChannel = await guild.channels.create({
                    name: `${cat.emoji.replace(/[^a-zA-Z0-9]/g, '')}-open-${cat.name.toLowerCase().replace(/ /g, '-')}`,
                    type: ChannelType.GuildText,
                    parent: cat.channel.id,
                    topic: `${cat.name} - Open a ticket here`,
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                            deny: [PermissionFlagsBits.CreatePrivateThreads, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.ManageChannels]
                        }
                    ]
                });
            }
            openChannels.push({ ...cat, openChannel });
        }
        
        // 3. Setup ticket panels in each open channel
        for (const item of openChannels) {
            const { name, emoji, openChannel } = item;
            const buttonId = `open_${name.toLowerCase().replace(/ /g, '_')}`;
            
            let embed, actionRow;
            
            switch (name) {
                case 'Support Tickets':
                    embed = new EmbedBuilder()
                        .setColor('#5865F2')
                        .setTitle('🎫 Support Ticket System')
                        .setDescription('If you need support, open a ticket using the button below.')
                        .addFields(
                            { name: 'How to Create a Ticket', value: 'Click the button below and select a reason for your support request.', inline: false },
                            { name: 'Privacy', value: 'Only you and the support team can see your ticket.', inline: false },
                            { name: 'Response Time', value: 'Our support team will respond as soon as possible.', inline: false }
                        )
                        .setFooter({ text: 'DTEmpire Support • Click below to create a ticket' })
                        .setTimestamp();
                    
                    // Create reason select menu
                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId('support_reason_select')
                        .setPlaceholder('Choose a reason for support...')
                        .addOptions([
                            { label: 'General Support', value: 'general_support', description: 'General questions or help', emoji: '❓' },
                            { label: 'Technical Issues', value: 'technical', description: 'Problems with features or bugs', emoji: '🔧' },
                            { label: 'Account Help', value: 'account', description: 'Account-related questions', emoji: '👤' },
                            { label: 'Purchase Help', value: 'purchase', description: 'Billing or payment issues', emoji: '💰' },
                            { label: 'Other Support', value: 'other', description: 'Anything else', emoji: '📝' }
                        ]);
                    
                    const selectRow = new ActionRowBuilder().addComponents(selectMenu);
                    
                    await openChannel.send({
                        embeds: [embed],
                        components: [selectRow]
                    });
                    break;
                    
                case 'Staff Applications':
                    embed = new EmbedBuilder()
                        .setColor('#43B581')
                        .setTitle('📋 Staff Applications')
                        .setDescription('Interested in joining our staff team? Apply using the button below!')
                        .addFields(
                            { name: 'Requirements', value: '• Active member\n• Good behavior\n• Willing to help others', inline: false },
                            { name: 'Process', value: '1. Submit application\n2. Interview (if needed)\n3. Training period\n4. Staff role assigned', inline: false },
                            { name: 'Benefits', value: '• Special perks\n• Server management experience\n• Community recognition', inline: false }
                        )
                        .setFooter({ text: 'DTEmpire Staff Team • Apply below!' })
                        .setTimestamp();
                    
                    actionRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('open_staff_application')
                                .setLabel('Apply for Staff')
                                .setStyle(ButtonStyle.Success)
                                .setEmoji('📋')
                        );
                    
                    await openChannel.send({
                        embeds: [embed],
                        components: [actionRow]
                    });
                    break;
                    
                case 'User Reports':
                    embed = new EmbedBuilder()
                        .setColor('#FF6B6B')
                        .setTitle('⚠️ User Reports')
                        .setDescription('Report users who violate server rules or behave inappropriately.')
                        .addFields(
                            { name: 'What to Report', value: '• Rule violations\n• Harassment\n• Spamming\n• NSFW content\n• Scamming', inline: false },
                            { name: 'Required Information', value: '• User mention/ID\n• Evidence (screenshots)\n• Description of issue\n• Time of incident', inline: false },
                            { name: 'Confidentiality', value: 'Your report will be kept confidential. False reports may result in action against you.', inline: false }
                        )
                        .setFooter({ text: 'DTEmpire Moderation • Report responsibly' })
                        .setTimestamp();
                    
                    actionRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('open_user_report')
                                .setLabel('Report a User')
                                .setStyle(ButtonStyle.Danger)
                                .setEmoji('⚠️')
                        );
                    
                    await openChannel.send({
                        embeds: [embed],
                        components: [actionRow]
                    });
                    break;
                    
                case 'Bug Reports':
                    embed = new EmbedBuilder()
                        .setColor('#FF6B6B')
                        .setTitle('🐛 Bug Report System')
                        .setDescription('Found a bug? Report it using the button below.')
                        .addFields(
                            { name: 'How to Report', value: '1. Click the button below\n2. Describe the bug\n3. Include steps to reproduce\n4. Add screenshots if possible', inline: false },
                            { name: 'Bug Severity Levels', value: '• Critical: Breaks major functionality\n• High: Affects many users\n• Medium: Minor issues\n• Low: Cosmetic issues', inline: false },
                            { name: 'Tips for Good Reports', value: '• Be specific\n• Include error messages\n• Describe what you expected\n• Mention when it occurred', inline: false }
                        )
                        .setFooter({ text: 'DTEmpire Bug Reports • Help us improve!' })
                        .setTimestamp();
                    
                    actionRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('open_bug_report')
                                .setLabel('Report a Bug')
                                .setStyle(ButtonStyle.Danger)
                                .setEmoji('🐛')
                        );
                    
                    await openChannel.send({
                        embeds: [embed],
                        components: [actionRow]
                    });
                    break;
            }
            
            console.log(`✅ Setup ${name} panel in ${openChannel.name}`);
        }
        
        // 4. Send confirmation
        const confirmEmbed = new EmbedBuilder()
            .setColor('#43B581')
            .setTitle('✅ Ticket Systems Setup Complete!')
            .setDescription('All ticket systems have been setup successfully.')
            .addFields(
                { name: '📁 Categories Created', value: createdCategories.map(c => `${c.emoji} ${c.channel.name}`).join('\n'), inline: false },
                { name: '📝 Open Channels', value: openChannels.map(c => `${c.openChannel.toString()}`).join('\n'), inline: false },
                { name: '⚙️ Systems Ready', value: '• Support Tickets\n• Staff Applications\n• User Reports\n• Bug Reports', inline: false }
            )
            .setFooter({ text: 'Users can now create tickets using the buttons in each channel' });
        
        await message.reply({ embeds: [confirmEmbed] });
        
    } catch (error) {
        console.error('Setup all error:', error);
        message.reply('❌ Failed to setup ticket systems.');
    }
}

// ========== SUPPORT TICKET SETUP (Individual) ==========
async function ticketSetup(message, client, db) {
    try {
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🎫 Support Ticket System')
            .setDescription('If you need support, open a ticket using the button below.')
            .addFields(
                {
                    name: 'How to Create a Ticket',
                    value: 'Click the button below and select a reason for your support request.',
                    inline: false
                },
                {
                    name: 'Privacy',
                    value: 'Only you and the support team can see your ticket.',
                    inline: false
                },
                {
                    name: 'Response Time',
                    value: 'Our support team will respond as soon as possible.',
                    inline: false
                }
            )
            .setFooter({ text: 'DTEmpire Support • Click below to create a ticket' })
            .setTimestamp();
        
        // Create reason select menu
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('support_reason_select')
            .setPlaceholder('Choose a reason for support...')
            .addOptions([
                { label: 'General Support', value: 'general_support', description: 'General questions or help', emoji: '❓' },
                { label: 'Technical Issues', value: 'technical', description: 'Problems with features or bugs', emoji: '🔧' },
                { label: 'Account Help', value: 'account', description: 'Account-related questions', emoji: '👤' },
                { label: 'Purchase Help', value: 'purchase', description: 'Billing or payment issues', emoji: '💰' },
                { label: 'Other Support', value: 'other', description: 'Anything else', emoji: '📝' }
            ]);
        
        const selectRow = new ActionRowBuilder().addComponents(selectMenu);
        
        await message.channel.send({
            embeds: [embed],
            components: [selectRow]
        });
        
        await message.reply('✅ Support ticket system setup complete!');
        
    } catch (error) {
        console.error('Ticket setup error:', error);
        message.reply('❌ Failed to setup ticket system.');
    }
}

// ========== BUG REPORT SETUP (Individual) ==========
async function bugReportSetup(message, client, db) {
    try {
        const embed = new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle('🐛 Bug Report System')
            .setDescription('If you find a bug, report it using the button below.')
            .addFields(
                {
                    name: 'How to Report',
                    value: '1. Click the button below\n2. Describe the bug\n3. Include steps to reproduce\n4. Add screenshots if possible',
                    inline: false
                },
                {
                    name: 'Bug Severity Levels',
                    value: '• Critical: Breaks major functionality\n• High: Affects many users\n• Medium: Minor issues\n• Low: Cosmetic issues',
                    inline: false
                },
                {
                    name: 'Tips for Good Reports',
                    value: '• Be specific\n• Include error messages\n• Describe what you expected to happen\n• Mention when it occurred',
                    inline: false
                }
            )
            .setFooter({ text: 'DTEmpire Bug Reports • Help us improve our services' })
            .setTimestamp();
        
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('open_bug_report')
                    .setLabel('Report a Bug')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🐛')
            );
        
        await message.channel.send({
            embeds: [embed],
            components: [actionRow]
        });
        
        await message.reply('✅ Bug report system setup complete!');
        
    } catch (error) {
        console.error('Bug report setup error:', error);
        message.reply('❌ Failed to setup bug report system.');
    }
}

// ========== CREATE SUPPORT TICKET (Button Handler) ==========
async function handleCreateSupportTicket(interaction, client, db) {
    const userId = interaction.user.id;
    
    try {
        await interaction.deferReply({ flags: 64 });
        
        const guild = interaction.guild;
        const user = interaction.user;
        
        // Check for existing ticket
        const existingTicket = guild.channels.cache.find(channel => 
            channel.name.includes('support-') &&
            channel.topic?.includes(`(${user.id})`)
        );
        
        if (existingTicket) {
            return await interaction.editReply({
                content: `❌ You already have an open support ticket: ${existingTicket.toString()}`
            });
        }
        
        // Find or create category
        let category = guild.channels.cache.find(
            c => c.type === ChannelType.GuildCategory && 
            c.name.toLowerCase().includes('support')
        );
        
        if (!category) {
            category = await guild.channels.create({
                name: '🎫 Support Tickets',
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    }
                ]
            });
        }
        
        // Create ticket channel
        const ticketNumber = Date.now().toString().slice(-6);
        const ticketChannel = await guild.channels.create({
            name: `support-${user.username.toLowerCase()}-${ticketNumber}`,
            type: ChannelType.GuildText,
            parent: category.id,
            topic: `Support ticket for ${user.tag} (${user.id}) | Created: ${new Date().toISOString()} | Type: Support`,
            permissionOverwrites: [
                {
                    id: guild.roles.everyone.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles,
                        PermissionFlagsBits.EmbedLinks
                    ]
                }
            ]
        });
        
        // Find staff role
        const staffRole = guild.roles.cache.find(r => 
            r.name.toLowerCase().includes('staff') || 
            r.name.toLowerCase().includes('mod') ||
            r.name.toLowerCase().includes('admin') ||
            r.name.toLowerCase().includes('support')
        );
        
        if (staffRole) {
            await ticketChannel.permissionOverwrites.create(staffRole.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                ManageMessages: true,
                ManageChannels: true
            });
        }
        
        // Send welcome message
        const welcomeEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🎫 Support Ticket Created')
            .setDescription(`Hello ${user.toString()}! Our support team will assist you shortly.`)
            .addFields(
                { name: '👤 Created By', value: user.tag, inline: true },
                { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
                { name: '📅 Created At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                { name: '🎫 Ticket Type', value: 'Support', inline: true },
                { name: '🔗 Ticket ID', value: ticketNumber, inline: true },
                { 
                    name: '📝 How to Get Help', 
                    value: 'Please describe your issue in detail. Include:\n• What happened\n• Steps to reproduce\n• What you expected\n• Screenshots if possible', 
                    inline: false 
                }
            )
            .setFooter({ text: 'DTEmpire Support System | Use the button below to close' })
            .setTimestamp();
        
        const closeButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`close_ticket_${ticketChannel.id}`)
                    .setLabel('Close Ticket')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒')
            );
        
        await ticketChannel.send({
            content: `${user.toString()} ${staffRole ? staffRole.toString() : ''}`,
            embeds: [welcomeEmbed],
            components: [closeButton]
        });
        
        // Save ticket to database
        if (db && db.saveTicket) {
            try {
                await db.saveTicket({
                    guildId: guild.id,
                    channelId: ticketChannel.id,
                    userId: user.id,
                    userTag: user.tag,
                    ticketType: 'Support',
                    ticketId: ticketNumber,
                    createdAt: new Date(),
                    status: 'open'
                });
            } catch (dbError) {
                console.log('Failed to save ticket to database:', dbError.message);
            }
        }
        
        await interaction.editReply({
            content: `✅ Your support ticket has been created: ${ticketChannel.toString()}`
        });
        
        // Log ticket creation if logging system exists
        if (client.loggingSystem) {
            try {
                await client.loggingSystem.logTicketCreate(
                    guild.id,
                    user,
                    ticketChannel,
                    'Support',
                    'User requested support via ticket button'
                );
            } catch (logError) {
                console.log('Failed to log ticket creation:', logError.message);
            }
        }
        
    } catch (error) {
        console.error('Create support ticket error:', error);
        await interaction.editReply({
            content: '❌ Failed to create support ticket. Please try again or contact an admin.',
            flags: 64
        });
    }
}

// ========== CREATE BUG REPORT (Button Handler) ==========
async function handleCreateBugReport(interaction, client, db) {
    try {
        await interaction.deferReply({ flags: 64 });
        
        const guild = interaction.guild;
        const user = interaction.user;
        
        // Find or create bug category
        let bugCategory = guild.channels.cache.find(
            c => c.type === ChannelType.GuildCategory && 
            c.name.toLowerCase().includes('bug')
        );
        
        if (!bugCategory) {
            bugCategory = await guild.channels.create({
                name: '🐛 Bug Reports',
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    }
                ]
            });
        }
        
        // Create bug report channel
        const bugNumber = Date.now().toString().slice(-6);
        const bugChannel = await guild.channels.create({
            name: `bug-${user.username.toLowerCase()}-${bugNumber}`,
            type: ChannelType.GuildText,
            parent: bugCategory.id,
            topic: `Bug report from ${user.tag} (${user.id}) | Created: ${new Date().toISOString()} | Type: Bug Report`,
            permissionOverwrites: [
                {
                    id: guild.roles.everyone.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles,
                        PermissionFlagsBits.EmbedLinks
                    ]
                }
            ]
        });
        
        // Find developer/admin role
        const devRole = guild.roles.cache.find(r => 
            r.name.toLowerCase().includes('dev') || 
            r.name.toLowerCase().includes('developer') ||
            r.name.toLowerCase().includes('admin') ||
            r.name.toLowerCase().includes('staff')
        );
        
        if (devRole) {
            await bugChannel.permissionOverwrites.create(devRole.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                ManageMessages: true,
                ManageChannels: true
            });
        }
        
        // Send bug report form
        const bugEmbed = new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle('🐛 Bug Report Created')
            .setDescription(`Hello ${user.toString()}! Please describe the bug you encountered.`)
            .addFields(
                { 
                    name: '📋 Required Information', 
                    value: 'Please include:\n• **What happened** (describe the bug)\n• **Steps to reproduce** (exact steps)\n• **Expected behavior** (what should happen)\n• **Actual behavior** (what actually happened)\n• **Screenshots/Logs** (if available)', 
                    inline: false 
                },
                { 
                    name: '⚠️ Bug Severity', 
                    value: '• **Critical**: Breaks major functionality\n• **High**: Affects many users\n• **Medium**: Minor issues\n• **Low**: Cosmetic issues', 
                    inline: false 
                },
                { name: '👤 Reported By', value: user.tag, inline: true },
                { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
                { name: '🎫 Report Type', value: 'Bug Report', inline: true },
                { name: '🔗 Report ID', value: bugNumber, inline: true }
            )
            .setFooter({ text: 'DTEmpire Bug Report System | Use the button below to close' })
            .setTimestamp();
        
        const closeButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`close_ticket_${bugChannel.id}`)
                    .setLabel('Close Report')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒')
            );
        
        await bugChannel.send({
            content: `${user.toString()} ${devRole ? devRole.toString() : ''}`,
            embeds: [bugEmbed],
            components: [closeButton]
        });
        
        // Save ticket to database
        if (db && db.saveTicket) {
            try {
                await db.saveTicket({
                    guildId: guild.id,
                    channelId: bugChannel.id,
                    userId: user.id,
                    userTag: user.tag,
                    ticketType: 'Bug Report',
                    ticketId: bugNumber,
                    createdAt: new Date(),
                    status: 'open'
                });
            } catch (dbError) {
                console.log('Failed to save bug report to database:', dbError.message);
            }
        }
        
        await interaction.editReply({
            content: `✅ Your bug report has been created: ${bugChannel.toString()}`
        });
        
        // Log bug report if logging system exists
        if (client.loggingSystem) {
            try {
                await client.loggingSystem.logTicketCreate(
                    guild.id,
                    user,
                    bugChannel,
                    'Bug Report',
                    'User submitted bug report via button'
                );
            } catch (logError) {
                console.log('Failed to log bug report:', logError.message);
            }
        }
        
    } catch (error) {
        console.error('Create bug report error:', error);
        await interaction.editReply({
            content: '❌ Failed to create bug report. Please try again or contact an admin.',
            flags: 64
        });
    }
}

// ========== CREATE STAFF APPLICATION (Button Handler) ==========
async function handleCreateStaffApplication(interaction, client, db) {
    try {
        await interaction.deferReply({ flags: 64 });
        
        const guild = interaction.guild;
        const user = interaction.user;
        
        // Find or create staff application category
        let staffCategory = guild.channels.cache.find(
            c => c.type === ChannelType.GuildCategory && 
            c.name.toLowerCase().includes('staff')
        );
        
        if (!staffCategory) {
            staffCategory = await guild.channels.create({
                name: '📋 Staff Applications',
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    }
                ]
            });
        }
        
        // Create staff application channel
        const appNumber = Date.now().toString().slice(-6);
        const appChannel = await guild.channels.create({
            name: `staff-app-${user.username.toLowerCase()}-${appNumber}`,
            type: ChannelType.GuildText,
            parent: staffCategory.id,
            topic: `Staff application from ${user.tag} (${user.id}) | Created: ${new Date().toISOString()} | Type: Staff Application`,
            permissionOverwrites: [
                {
                    id: guild.roles.everyone.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles,
                        PermissionFlagsBits.EmbedLinks
                    ]
                }
            ]
        });
        
        // Find admin role
        const adminRole = guild.roles.cache.find(r => 
            r.name.toLowerCase().includes('admin') ||
            r.name.toLowerCase().includes('owner') ||
            r.name.toLowerCase().includes('leadership')
        );
        
        if (adminRole) {
            await appChannel.permissionOverwrites.create(adminRole.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                ManageMessages: true,
                ManageChannels: true
            });
        }
        
        // Send application form
        const appEmbed = new EmbedBuilder()
            .setColor('#43B581')
            .setTitle('📋 Staff Application Created')
            .setDescription(`Hello ${user.toString()}! Please complete your staff application.`)
            .addFields(
                { 
                    name: '📝 Application Questions', 
                    value: 'Please answer the following:\n\n**1. Why do you want to be staff?**\n**2. What experience do you have?**\n**3. How active are you?**\n**4. What would you improve on the server?**\n**5. Any other information?**', 
                    inline: false 
                },
                { name: '👤 Applicant', value: user.tag, inline: true },
                { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
                { name: '🎫 Application Type', value: 'Staff Application', inline: true },
                { name: '🔗 Application ID', value: appNumber, inline: true }
            )
            .setFooter({ text: 'DTEmpire Staff Team | Use the button below to close' })
            .setTimestamp();
        
        const closeButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`close_ticket_${appChannel.id}`)
                    .setLabel('Close Application')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒')
            );
        
        await appChannel.send({
            content: `${user.toString()} ${adminRole ? adminRole.toString() : ''}`,
            embeds: [appEmbed],
            components: [closeButton]
        });
        
        // Save application to database
        if (db && db.saveTicket) {
            try {
                await db.saveTicket({
                    guildId: guild.id,
                    channelId: appChannel.id,
                    userId: user.id,
                    userTag: user.tag,
                    ticketType: 'Staff Application',
                    ticketId: appNumber,
                    createdAt: new Date(),
                    status: 'open'
                });
            } catch (dbError) {
                console.log('Failed to save staff application to database:', dbError.message);
            }
        }
        
        await interaction.editReply({
            content: `✅ Your staff application has been created: ${appChannel.toString()}`
        });
        
    } catch (error) {
        console.error('Create staff application error:', error);
        await interaction.editReply({
            content: '❌ Failed to create staff application. Please try again or contact an admin.',
            flags: 64
        });
    }
}

// ========== CREATE USER REPORT (Button Handler) ==========
async function handleCreateUserReport(interaction, client, db) {
    try {
        await interaction.deferReply({ flags: 64 });
        
        const guild = interaction.guild;
        const user = interaction.user;
        
        // Find or create user report category
        let reportCategory = guild.channels.cache.find(
            c => c.type === ChannelType.GuildCategory && 
            c.name.toLowerCase().includes('report')
        );
        
        if (!reportCategory) {
            reportCategory = await guild.channels.create({
                name: '⚠️ User Reports',
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    }
                ]
            });
        }
        
        // Create user report channel
        const reportNumber = Date.now().toString().slice(-6);
        const reportChannel = await guild.channels.create({
            name: `report-${user.username.toLowerCase()}-${reportNumber}`,
            type: ChannelType.GuildText,
            parent: reportCategory.id,
            topic: `User report from ${user.tag} (${user.id}) | Created: ${new Date().toISOString()} | Type: User Report`,
            permissionOverwrites: [
                {
                    id: guild.roles.everyone.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles,
                        PermissionFlagsBits.EmbedLinks
                    ]
                }
            ]
        });
        
        // Find mod role
        const modRole = guild.roles.cache.find(r => 
            r.name.toLowerCase().includes('mod') ||
            r.name.toLowerCase().includes('admin') ||
            r.name.toLowerCase().includes('staff')
        );
        
        if (modRole) {
            await reportChannel.permissionOverwrites.create(modRole.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                ManageMessages: true,
                ManageChannels: true
            });
        }
        
        // Send report form
        const reportEmbed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('⚠️ User Report Created')
            .setDescription(`Hello ${user.toString()}! Please provide details about the user report.`)
            .addFields(
                { 
                    name: '📝 Report Information Needed', 
                    value: 'Please include:\n\n**1. Reported User:** (mention or ID)\n**2. Reason for Report:**\n**3. Evidence:** (screenshots/links)\n**4. Time of Incident:**\n**5. Additional Details:**', 
                    inline: false 
                },
                { name: '👤 Reported By', value: user.tag, inline: true },
                { name: '🆔 Your ID', value: `\`${user.id}\``, inline: true },
                { name: '🎫 Report Type', value: 'User Report', inline: true },
                { name: '🔗 Report ID', value: reportNumber, inline: true }
            )
            .setFooter({ text: 'DTEmpire Moderation Team | Use the button below to close' })
            .setTimestamp();
        
        const closeButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`close_ticket_${reportChannel.id}`)
                    .setLabel('Close Report')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒')
            );
        
        await reportChannel.send({
            content: `${user.toString()} ${modRole ? modRole.toString() : ''}`,
            embeds: [reportEmbed],
            components: [closeButton]
        });
        
        // Save report to database
        if (db && db.saveTicket) {
            try {
                await db.saveTicket({
                    guildId: guild.id,
                    channelId: reportChannel.id,
                    userId: user.id,
                    userTag: user.tag,
                    ticketType: 'User Report',
                    ticketId: reportNumber,
                    createdAt: new Date(),
                    status: 'open'
                });
            } catch (dbError) {
                console.log('Failed to save user report to database:', dbError.message);
            }
        }
        
        await interaction.editReply({
            content: `✅ Your user report has been created: ${reportChannel.toString()}`
        });
        
    } catch (error) {
        console.error('Create user report error:', error);
        await interaction.editReply({
            content: '❌ Failed to create user report. Please try again or contact an admin.',
            flags: 64
        });
    }
}

// ========== SUPPORT REASON SELECT MENU ==========
async function handleSupportReasonSelect(interaction, client, db) {
    try {
        const reason = interaction.values[0];
        const reasonText = {
            'general_support': 'General Support',
            'technical': 'Technical Issues',
            'account': 'Account Help',
            'purchase': 'Purchase Help',
            'other': 'Other Support'
        }[reason] || 'Support Request';
        
        await interaction.deferReply({ flags: 64 });
        
        const guild = interaction.guild;
        const user = interaction.user;
        
        // Check for existing ticket
        const existingTicket = guild.channels.cache.find(channel => 
            channel.name.includes('support-') &&
            channel.topic?.includes(`(${user.id})`)
        );
        
        if (existingTicket) {
            return await interaction.editReply({
                content: `❌ You already have an open support ticket: ${existingTicket.toString()}`
            });
        }
        
        // Find or create category
        let category = guild.channels.cache.find(
            c => c.type === ChannelType.GuildCategory && 
            c.name.toLowerCase().includes('support')
        );
        
        if (!category) {
            category = await guild.channels.create({
                name: '🎫 Support Tickets',
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    }
                ]
            });
        }
        
        // Create ticket channel
        const ticketNumber = Date.now().toString().slice(-6);
        const ticketChannel = await guild.channels.create({
            name: `support-${user.username.toLowerCase()}-${ticketNumber}`,
            type: ChannelType.GuildText,
            parent: category.id,
            topic: `Support ticket for ${user.tag} (${user.id}) | Created: ${new Date().toISOString()} | Type: Support | Reason: ${reasonText}`,
            permissionOverwrites: [
                {
                    id: guild.roles.everyone.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles,
                        PermissionFlagsBits.EmbedLinks
                    ]
                }
            ]
        });
        
        // Find staff role
        const staffRole = guild.roles.cache.find(r => 
            r.name.toLowerCase().includes('staff') || 
            r.name.toLowerCase().includes('mod') ||
            r.name.toLowerCase().includes('admin') ||
            r.name.toLowerCase().includes('support')
        );
        
        if (staffRole) {
            await ticketChannel.permissionOverwrites.create(staffRole.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                ManageMessages: true,
                ManageChannels: true
            });
        }
        
        // Send welcome message
        const welcomeEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🎫 Support Ticket Created')
            .setDescription(`Hello ${user.toString()}! Our support team will assist you shortly.`)
            .addFields(
                { name: '👤 Created By', value: user.tag, inline: true },
                { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
                { name: '📅 Created At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                { name: '🎫 Ticket Type', value: 'Support', inline: true },
                { name: '📝 Reason', value: reasonText, inline: true },
                { name: '🔗 Ticket ID', value: ticketNumber, inline: true }
            )
            .setFooter({ text: 'DTEmpire Support System | Use the button below to close' })
            .setTimestamp();
        
        const closeButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`close_ticket_${ticketChannel.id}`)
                    .setLabel('Close Ticket')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒')
            );
        
        await ticketChannel.send({
            content: `${user.toString()} ${staffRole ? staffRole.toString() : ''}`,
            embeds: [welcomeEmbed],
            components: [closeButton]
        });
        
        // Save ticket to database
        if (db && db.saveTicket) {
            try {
                await db.saveTicket({
                    guildId: guild.id,
                    channelId: ticketChannel.id,
                    userId: user.id,
                    userTag: user.tag,
                    ticketType: 'Support',
                    ticketId: ticketNumber,
                    reason: reasonText,
                    createdAt: new Date(),
                    status: 'open'
                });
            } catch (dbError) {
                console.log('Failed to save ticket to database:', dbError.message);
            }
        }
        
        await interaction.editReply({
            content: `✅ Your support ticket has been created: ${ticketChannel.toString()}`
        });
        
        // Log ticket creation
        if (client.loggingSystem) {
            try {
                await client.loggingSystem.logTicketCreate(
                    guild.id,
                    user,
                    ticketChannel,
                    'Support',
                    reasonText
                );
            } catch (logError) {
                console.log('Failed to log ticket creation:', logError.message);
            }
        }
        
    } catch (error) {
        console.error('Support reason select error:', error);
        await interaction.editReply({
            content: '❌ Failed to create support ticket. Please try again.',
            flags: 64
        });
    }
}

// ========== CLOSE TICKET (Button Handler) ==========
async function handleCloseTicket(interaction, client, db) {
    try {
        const channelId = interaction.customId.replace('close_ticket_', '');
        const channel = interaction.guild.channels.cache.get(channelId);
        
        if (!channel) {
            return await interaction.reply({
                content: '❌ Ticket channel not found.',
                flags: 64
            });
        }
        
        // Check if user has permission to close
        const hasPermission = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
                             interaction.member.roles.cache.some(role => 
                                 role.name.toLowerCase().includes('staff') ||
                                 role.name.toLowerCase().includes('mod') ||
                                 role.name.toLowerCase().includes('admin')
                             ) ||
                             channel.topic?.includes(`(${interaction.user.id})`);
        
        if (!hasPermission) {
            return await interaction.reply({
                content: '❌ You do not have permission to close this ticket.',
                flags: 64
            });
        }
        
        // Get ticket information from topic
        const topic = channel.topic || '';
        const userMatch = topic.match(/for (.+?) \(/);
        const userIdMatch = topic.match(/\((\d+)\)/);
        const typeMatch = topic.match(/Type: (.+?)(\||$)/);
        const reasonMatch = topic.match(/Reason: (.+?)(\||$)/);
        
        const userName = userMatch ? userMatch[1] : 'Unknown';
        const userId = userIdMatch ? userIdMatch[1] : 'Unknown';
        const ticketType = typeMatch ? typeMatch[1].trim() : 'Unknown';
        const reason = reasonMatch ? reasonMatch[1].trim() : 'No reason specified';
        
        // Save ticket log before closing
        if (db && db.saveTicketLog) {
            try {
                await db.saveTicketLog({
                    guildId: interaction.guild.id,
                    channelId: channel.id,
                    channelName: channel.name,
                    userId: userId,
                    userTag: userName,
                    ticketType: ticketType,
                    reason: reason,
                    closedBy: interaction.user.id,
                    closedByTag: interaction.user.tag,
                    closedAt: new Date(),
                    messageCount: (await channel.messages.fetch()).size
                });
            } catch (logError) {
                console.log('Failed to save ticket log:', logError.message);
            }
        }
        
        const closeEmbed = new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle('🎫 Ticket Closed')
            .setDescription(`This ${ticketType.toLowerCase()} has been closed by ${interaction.user.tag}`)
            .addFields(
                { name: 'Ticket Type', value: ticketType, inline: true },
                { name: 'Created By', value: userName, inline: true },
                { name: 'Closed At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                { name: 'Closed By', value: interaction.user.tag, inline: true },
                { name: 'Ticket ID', value: channel.name.split('-').pop() || 'Unknown', inline: true },
                { name: 'Reason', value: reason || 'Not specified', inline: false }
            )
            .setFooter({ text: 'This channel will be deleted in 30 seconds' })
            .setTimestamp();
        
        // Add rate support button if user is the ticket creator and closer is staff
        const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
                       interaction.member.roles.cache.some(role => 
                           role.name.toLowerCase().includes('staff') ||
                           role.name.toLowerCase().includes('mod') ||
                           role.name.toLowerCase().includes('admin')
                       );
        
        const isTicketOwner = userId === interaction.user.id;
        
        let components = [];
        if (!isTicketOwner && isStaff && userId !== 'Unknown') {
            // Staff closed the ticket, allow user to rate
            const rateButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`rate_support_${interaction.user.id}_${userId}`)
                        .setLabel('⭐ Rate Support')
                        .setStyle(ButtonStyle.Success)
                );
            components.push(rateButton);
            
            closeEmbed.addFields({
                name: '⭐ Rate This Support',
                value: `${userName}, if you're satisfied with the support, click the button below to give reputation!`,
                inline: false
            });
        }
        
        await channel.send({ 
            embeds: [closeEmbed],
            components: components
        });
        
        await interaction.reply({
            content: '✅ Ticket closed. Channel will be deleted shortly.',
            flags: 64
        });
        
        // Update ticket status in database
        if (db && db.updateTicketStatus) {
            try {
                await db.updateTicketStatus(channel.id, 'closed', {
                    closedBy: interaction.user.id,
                    closedAt: new Date()
                });
            } catch (dbError) {
                console.log('Failed to update ticket status:', dbError.message);
            }
        }
        
        // Log ticket closure
        if (client.loggingSystem && client.loggingSystem.logTicketClose) {
            try {
                await client.loggingSystem.logTicketClose(
                    interaction.guild.id,
                    { id: userId, tag: userName },
                    channel,
                    ticketType,
                    reason,
                    interaction.user
                );
            } catch (logError) {
                console.log('Failed to log ticket closure:', logError.message);
            }
        }
        
        // Delete channel after delay (increased to 30s for rating)
        setTimeout(async () => {
            try {
                await channel.delete('Ticket closed by user');
            } catch (error) {
                console.log('Could not delete channel:', error.message);
            }
        }, 30000);
        
    } catch (error) {
        console.error('Close ticket error:', error);
        await interaction.reply({
            content: '❌ Failed to close ticket. Please try again or contact an admin.',
            flags: 64
        });
    }
}

// ========== SHOW TICKET LOGS ==========
async function showTicketLogs(message, args, client, db) {
    try {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return message.reply('❌ You need **Manage Channels** permission to view ticket logs.');
        }
        
        const page = parseInt(args[0]) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;
        
        // Get ticket logs from database
        let logs = [];
        if (db && db.getTicketLogs) {
            logs = await db.getTicketLogs(message.guild.id, limit, offset);
        } else {
            return message.reply('❌ Ticket logging is not enabled or database error.');
        }
        
        if (logs.length === 0) {
            return message.reply(`📭 No ticket logs found${page > 1 ? ` on page ${page}` : ''}.`);
        }
        
        const totalLogs = await db.getTicketLogCount ? await db.getTicketLogCount(message.guild.id) : logs.length;
        const totalPages = Math.ceil(totalLogs / limit);
        
        const logEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('📋 Ticket Logs')
            .setDescription(`Showing ${logs.length} of ${totalLogs} closed tickets`)
            .setFooter({ text: `Page ${page} of ${totalPages} • Use ^ticket logs [page] to navigate` })
            .setTimestamp();
        
        for (const log of logs) {
            const date = new Date(log.closedAt);
            const formattedDate = `<t:${Math.floor(date.getTime() / 1000)}:R>`;
            
            logEmbed.addFields({
                name: `${log.ticketType} - ${log.userTag}`,
                value: `**ID:** ${log.channelName.split('-').pop() || 'N/A'}\n` +
                       `**Reason:** ${log.reason || 'Not specified'}\n` +
                       `**Closed by:** ${log.closedByTag}\n` +
                       `**Closed:** ${formattedDate}\n` +
                       `**Messages:** ${log.messageCount || 0}`,
                inline: true
            });
        }
        
        // Add navigation buttons if there are multiple pages
        const actionRows = [];
        
        if (totalPages > 1) {
            const navigationRow = new ActionRowBuilder();
            
            if (page > 1) {
                navigationRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`ticket_logs_${page - 1}`)
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⬅️')
                );
            }
            
            navigationRow.addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_logs_current')
                    .setLabel(`Page ${page} of ${totalPages}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );
            
            if (page < totalPages) {
                navigationRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`ticket_logs_${page + 1}`)
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('➡️')
                );
            }
            
            actionRows.push(navigationRow);
        }
        
        const replyOptions = { embeds: [logEmbed] };
        if (actionRows.length > 0) {
            replyOptions.components = actionRows;
        }
        
        await message.reply(replyOptions);
        
    } catch (error) {
        console.error('Show ticket logs error:', error);
        message.reply('❌ Failed to retrieve ticket logs.');
    }
}

// ========== MANUAL TICKET COMMANDS ==========
async function closeTicket(message, db) {
    if (!message.channel.name.includes('support-') && 
        !message.channel.name.includes('bug-') && 
        !message.channel.name.includes('staff-app-') && 
        !message.channel.name.includes('report-')) {
        return message.reply('❌ This command can only be used in ticket channels.');
    }
    
    try {
        const reason = message.args.slice(1).join(' ') || 'No reason provided';
        const channel = message.channel;
        const topic = channel.topic || '';
        
        // Get ticket information
        const userMatch = topic.match(/for (.+?) \(/);
        const userIdMatch = topic.match(/\((\d+)\)/);
        const typeMatch = topic.match(/Type: (.+?)(\||$)/);
        
        const userName = userMatch ? userMatch[1] : 'Unknown';
        const userId = userIdMatch ? userIdMatch[1] : 'Unknown';
        const ticketType = typeMatch ? typeMatch[1].trim() : 'Unknown';
        
        // Save ticket log
        if (db && db.saveTicketLog) {
            try {
                await db.saveTicketLog({
                    guildId: message.guild.id,
                    channelId: channel.id,
                    channelName: channel.name,
                    userId: userId,
                    userTag: userName,
                    ticketType: ticketType,
                    reason: reason,
                    closedBy: message.author.id,
                    closedByTag: message.author.tag,
                    closedAt: new Date(),
                    messageCount: (await channel.messages.fetch()).size
                });
            } catch (logError) {
                console.log('Failed to save ticket log:', logError.message);
            }
        }
        
        const embed = new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle('🎫 Ticket Closed')
            .setDescription(`This ${ticketType.toLowerCase()} has been closed by ${message.author.tag}`)
            .addFields(
                { name: 'Reason', value: reason, inline: false },
                { name: 'Closed At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                { name: 'Ticket Type', value: ticketType, inline: true },
                { name: 'Created By', value: userName, inline: true }
            )
            .setFooter({ text: 'Ticket will be deleted in 10 seconds' });
        
        await channel.send({ embeds: [embed] });
        
        // Log ticket closure
        if (message.client.loggingSystem && message.client.loggingSystem.logTicketClose) {
            try {
                await message.client.loggingSystem.logTicketClose(
                    message.guild.id,
                    { id: userId, tag: userName },
                    channel,
                    ticketType,
                    reason,
                    message.author
                );
            } catch (logError) {
                console.log('Failed to log ticket closure:', logError.message);
            }
        }
        
        // Delete channel after delay
        setTimeout(async () => {
            try {
                await channel.delete();
            } catch (error) {
                console.log('Could not delete channel:', error.message);
            }
        }, 10000);
        
    } catch (error) {
        console.error('Close ticket error:', error);
        message.reply('❌ Failed to close ticket.');
    }
}

async function addUser(message, args) {
    if (!message.channel.name.includes('support-') && 
        !message.channel.name.includes('bug-') && 
        !message.channel.name.includes('staff-app-') && 
        !message.channel.name.includes('report-')) {
        return message.reply('❌ This command can only be used in ticket channels.');
    }
    
    const user = message.mentions.users.first();
    if (!user) {
        return message.reply('❌ Please mention a user to add to the ticket.');
    }
    
    try {
        await message.channel.permissionOverwrites.create(user.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            AttachFiles: true
        });
        
        const embed = new EmbedBuilder()
            .setColor('#4CAF50')
            .setDescription(`✅ ${user.toString()} has been added to the ticket.`);
        
        await message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Add user error:', error);
        message.reply('❌ Failed to add user to ticket.');
    }
}

async function removeUser(message, args) {
    if (!message.channel.name.includes('support-') && 
        !message.channel.name.includes('bug-') && 
        !message.channel.name.includes('staff-app-') && 
        !message.channel.name.includes('report-')) {
        return message.reply('❌ This command can only be used in ticket channels.');
    }
    
    const user = message.mentions.users.first();
    if (!user) {
        return message.reply('❌ Please mention a user to remove from the ticket.');
    }
    
    try {
        await message.channel.permissionOverwrites.delete(user.id);
        
        const embed = new EmbedBuilder()
            .setColor('#F44336')
            .setDescription(`❌ ${user.toString()} has been removed from the ticket.`);
        
        await message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Remove user error:', error);
        message.reply('❌ Failed to remove user from ticket.');
    }
}
// ========== RATE SUPPORT HANDLER ==========
async function handleRateSupport(interaction, client, db) {
    try {
        // Parse staff and user IDs from custom ID
        const parts = interaction.customId.split('_');
        const staffId = parts[2];
        const userId = parts[3];
        
        // Check if the person clicking is the ticket owner
        if (interaction.user.id !== userId) {
            return await interaction.reply({
                content: '❌ Only the ticket owner can rate support.',
                flags: 64
            });
        }
        
        // Get staff member
        const staffMember = await interaction.guild.members.fetch(staffId).catch(() => null);
        if (!staffMember) {
            return await interaction.reply({
                content: '❌ Staff member not found.',
                flags: 64
            });
        }
        
        // Use reputation service to give rep
        const repService = new (require('../../utils/reputationService'))(db);
        
        const userMember = await interaction.guild.members.fetch(userId);
        const result = await repService.giveRep(
            userMember,
            staffMember,
            interaction.guild,
            'Excellent support in ticket',
            interaction.channel.id
        );
        
        if (result.success) {
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('⭐ Support Rated!')
                .setDescription(`You gave reputation to ${staffMember.user.username} for their support!`)
                .addFields(
                    { name: 'Staff Member', value: staffMember.user.toString(), inline: true },
                    { name: 'New Reputation', value: `${result.data.newRepTotal} points`, inline: true }
                )
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] });
            
            // Log reputation action
            if (client.loggingSystem) {
                await client.loggingSystem.logReputationAction(
                    interaction.guild.id,
                    'give',
                    interaction.user,
                    staffMember.user,
                    'Excellent support in ticket',
                    interaction.channel.id,
                    {
                        newTotal: result.data.newRepTotal,
                        rank: result.data.rank
                    }
                );
            }
            
            // Check and assign roles
            const roleResult = await repService.checkAndAssignRoles(staffMember, interaction.guild.id, result.data.newRepTotal);
            if (roleResult.rolesAdded.length > 0) {
                const roleNames = roleResult.rolesAdded
                    .map(roleId => {
                        const role = interaction.guild.roles.cache.get(roleId);
                        return role ? role.name : 'Unknown Role';
                    })
                    .join(', ');
                
                await interaction.followUp({
                    content: `🎉 ${staffMember.user.username} earned new roles: **${roleNames}**!`,
                    flags: 64
                });
            }
        } else {
            await interaction.reply({
                content: result.message,
                flags: 64
            });
        }
        
        // Disable the button after use
        try {
            const message = interaction.message;
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('rate_support_used')
                        .setLabel('⭐ Support Rated')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );
            
            await message.edit({ components: [row] });
        } catch (error) {
            console.log('Could not disable button:', error.message);
        }
        
    } catch (error) {
        console.error('Rate support error:', error);
        await interaction.reply({
            content: '❌ An error occurred while rating support.',
            flags: 64
        });
    }
}

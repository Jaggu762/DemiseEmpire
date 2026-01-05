// commands/utility/announce.js
const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'announce',
    description: 'Create beautiful announcements like in the example image',
    aliases: ['announcement', 'embed'],
    category: 'Utility',
    
    async execute(message, args, client, db) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return message.reply('❌ You need **Manage Messages** permission to create announcements.');
        }
        
        if (args.length === 0) {
            return showAnnounceHelp(message);
        }
        
        const subcommand = args[0].toLowerCase();
        
        switch (subcommand) {
            case 'create':
                await handleAnnounceCreate(message, args.slice(1), client, db);
                break;
            case 'imagegen':
                await handleImageGenAnnounce(message, client);
                break;
            case 'setup':
                await handleAnnounceSetup(message, args.slice(1), db);
                break;
            case 'help':
                return showAnnounceHelp(message);
            default:
                message.reply('❌ Unknown subcommand. Use `^announce help` for commands.');
        }
    }
};

// ========== ANNOUNCE HELP ==========
function showAnnounceHelp(message) {
    const embed = new EmbedBuilder()
        .setColor('#ff00ff')
        .setTitle('📢 Announcement System')
        .setDescription('Create beautiful announcements for your server')
        .addFields(
            {
                name: '📋 Commands',
                value: [
                    '`^announce create <#channel> [title] | [description]` - Create an announcement',
                    '`^announce imagegen` - Create image generator announcement (like in photo)',
                    '`^announce setup <#channel>` - Set default announcement channel',
                    '`^announce help` - Show this help menu'
                ].join('\n'),
                inline: false
            },
            {
                name: '🎨 Format',
                value: 'Use `|` to separate title and description\nExample: `^announce create #announcements New Feature | Check out our new bot command!`',
                inline: false
            }
        )
        .setFooter({ text: 'DTEmpire Announcement System' });
    
    return message.reply({ embeds: [embed] });
}

// ========== ANNOUNCE CREATE ==========
async function handleAnnounceCreate(message, args, client, db) {
    if (args.length < 2) {
        return message.reply('❌ Usage: `^announce create <#channel> [title] | [description]`');
    }
    
    // Parse arguments
    const channelMention = args[0];
    const rest = args.slice(1).join(' ');
    
    // Check for pipe separator
    if (!rest.includes('|')) {
        return message.reply('❌ Please separate title and description with `|`\nExample: `Title | Description`');
    }
    
    const parts = rest.split('|').map(s => s.trim());
    const title = parts[0];
    const description = parts.slice(1).join('|').trim(); // Join back in case there are multiple pipes
    
    // Validate title and description
    if (!title || title.length === 0) {
        return message.reply('❌ Please provide a title for the announcement.');
    }
    
    if (!description || description.length === 0) {
        return message.reply('❌ Please provide a description for the announcement.');
    }
    
    // Get channel
    const channel = message.mentions.channels.first();
    if (!channel) {
        return message.reply('❌ Please mention a valid channel.');
    }
    
    // Check bot permissions in the target channel
    const botPermissions = channel.permissionsFor(message.guild.members.me);
    if (!botPermissions.has(PermissionFlagsBits.SendMessages)) {
        return message.reply(`❌ I don't have permission to send messages in ${channel.toString()}`);
    }
    if (!botPermissions.has(PermissionFlagsBits.EmbedLinks)) {
        return message.reply(`❌ I need "Embed Links" permission in ${channel.toString()} to create announcements`);
    }
    
    // Create announcement embed
    const announceEmbed = new EmbedBuilder()
        .setColor('#ff00ff')
        .setTitle(`📢 ${title}`)
        .setDescription(description.length > 0 ? description : null) // Use null if empty
        .setFooter({ text: 'DTEmpire Announcements' })
        .setTimestamp();
    
    // Add fields only if we have a valid description
    if (description && description.length > 0) {
        announceEmbed.addFields(
            {
                name: '📅 Date',
                value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                inline: true
            },
            {
                name: '👤 Announcement by',
                value: message.author.toString(),
                inline: true
            }
        );
    }
    
    // Optional: Add image or thumbnail
    if (message.attachments.size > 0) {
        const attachment = message.attachments.first();
        if (attachment.contentType && attachment.contentType.startsWith('image/')) {
            announceEmbed.setImage(attachment.url);
        }
    }
    
    // Create action row with buttons (optional - can be customized)
    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('announce_react')
                .setLabel('📢 Announcement')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        );
    
    // Send announcement
    try {
        const announceMessage = await channel.send({
            content: '@everyone',
            embeds: [announceEmbed],
            components: [actionRow]
        });
        
        // Add reactions
        try {
            await announceMessage.react('📢');
            await announceMessage.react('👍');
            await announceMessage.react('🎉');
        } catch (reactError) {
            console.log('Could not add reactions:', reactError.message);
            // Continue even if reactions fail
        }
        
        // Save announcement to database if db is provided
        if (db && db.addTransaction) {
            try {
                await db.addTransaction(message.author.id, message.guild.id, 'announcement', 0, {
                    channel: channel.id,
                    title: title,
                    messageId: announceMessage.id
                });
            } catch (dbError) {
                console.log('Database save failed:', dbError.message);
                // Continue even if database save fails
            }
        }
        
        // Send confirmation
        const confirmEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Announcement Posted!')
            .setDescription(`Announcement sent to ${channel.toString()}`)
            .addFields(
                { name: 'Title', value: title, inline: true },
                { name: 'Channel', value: channel.toString(), inline: true },
                { name: 'Message', value: `[Jump to Message](${announceMessage.url})`, inline: true }
            );
        
        await message.reply({ embeds: [confirmEmbed] });
        
    } catch (error) {
        console.error('Announce error:', error);
        message.reply('❌ Failed to send announcement. Check bot permissions.');
    }
}

// ========== IMAGE GENERATOR ANNOUNCE ==========
async function handleImageGenAnnounce(message, client) {
    // Create announcement exactly like in the example image
    const embed = new EmbedBuilder()
        .setColor('#7289da')
        .setTitle('✔️ Announcing the Ultimate Image Generator for Discord!')
        .setDescription("We're thrilled to introduce a brand-new bot command and a companion website that will unleash your creativity! Create stunning, AI-generated images right from your favorite chats.")
        .addFields(
            {
                name: '**What\'s New?**',
                value: '• **Discord Command:** Generate images instantly without leaving the app.\n• **Web Interface:** A powerful, full-screen website for more detailed creation.',
                inline: false
            },
            {
                name: '**How to Use It**',
                value: `1. **In Discord:**\n   Simply use the command:\n   \`\`\`.imggen {your message here}\`\`\`\n   Try it now: \`.imggen a majestic knight riding a giant squirrel through a neon forest\`\n\n2. **On the Web:**\n   For more control and easier prompting, visit our official site 😊\n   https://imggen.ankitgupta.com.np/`,
                inline: false
            },
            {
                name: '**What will you create?**',
                value: 'Fantasy landscapes, funny memes, character art—your imagination is the limit!\n\nWe can\'t wait to see what you all come up with! Share your best creations in # 🎨 art-gallery!',
                inline: false
            }
        )
        .setFooter({ text: 'DTEmpire APP • Unleash Your Creativity!' })
        .setTimestamp();
    
    // Create action buttons like in the example
    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setURL('https://imggen.ankitgupta.com.np/')
                .setLabel('🌐 Visit Website')
                .setStyle(ButtonStyle.Link),
            new ButtonBuilder()
                .setCustomId('imagegen_try')
                .setLabel('🎨 Try Now')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('✨'),
            new ButtonBuilder()
                .setCustomId('imagegen_examples')
                .setLabel('📸 See Examples')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🖼️')
        );
    
    await message.channel.send({
        embeds: [embed],
        components: [actionRow]
    });
    
    // Send command example
    const exampleEmbed = new EmbedBuilder()
        .setColor('#43B581')
        .setTitle('🚀 Quick Start')
        .setDescription('Try these commands right now:')
        .addFields(
            {
                name: 'Generate Image',
                value: '```.imggen a majestic knight riding a giant squirrel through a neon forest```',
                inline: false
            },
            {
                name: 'More Examples',
                value: [
                    '```.imggen cyberpunk city at night with neon lights```',
                    '```.imggen cute anime character with blue hair```',
                    '```.imggen fantasy castle on a floating island```'
                ].join('\n'),
                inline: false
            }
        )
        .setFooter({ text: 'Use .imggen {your prompt} to generate images' });
    
    await message.channel.send({ embeds: [exampleEmbed] });
}

// ========== ANNOUNCE SETUP ==========
async function handleAnnounceSetup(message, args, db) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return message.reply('❌ You need **Manage Server** permission to setup announcements.');
    }
    
    const channel = message.mentions.channels.first();
    if (!channel) {
        return message.reply('❌ Please mention a channel to set as announcement channel.');
    }
    
    try {
        await db.updateGuildConfig(message.guild.id, {
            announcements_channel: channel.id
        });
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Announcement Channel Set!')
            .setDescription(`Default announcement channel set to ${channel.toString()}`)
            .addFields(
                { name: 'Channel', value: channel.toString(), inline: true },
                { name: 'Setup by', value: message.author.toString(), inline: true }
            )
            .setFooter({ text: 'Use ^announce create to post announcements' });
        
        await message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Announce setup error:', error);
        message.reply('❌ Failed to setup announcement channel.');
    }
}
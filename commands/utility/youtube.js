const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'medianotifi',
    description: 'Setup media notifications for YouTube, Twitch, and TikTok',
    aliases: ['medianotif', 'medianoti', 'mn'],
    category: 'Utility',
    
    async execute(message, args, client) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return message.reply('❌ You need Manage Server permissions to use this command!');
        }

        const db = client.db;
        if (!db) {
            return message.reply('❌ Database not initialized!');
        }

        const subcommand = args[0]?.toLowerCase();

        if (!subcommand) {
            return showMediaHelp(message);
        }

        switch (subcommand) {
            case 'setchannel':
            case 'channel':
                await setNotificationChannel(message, args, db);
                break;
            case 'add':
                await addCreator(message, args, db);
                break;
            case 'remove':
            case 'delete':
                await removeCreator(message, args, db);
                break;
            case 'list':
                await listCreators(message, db);
                break;
            default:
                return showMediaHelp(message);
        }
    }
};

function showMediaHelp(message) {
    const embed = new EmbedBuilder()
        .setColor('#ff0050')
        .setTitle('📺 Media Notification System')
        .setDescription('Get notified when your favorite creators go live or upload videos!')
        .addFields(
            { name: '📺 Supported Platforms', value: '• YouTube (Live & Videos)\n• Twitch (Live Streams)\n• TikTok (New Videos)', inline: false },
            { name: '⚙️ Setup Commands', value: '`^medianotifi setchannel <#channel>` - Set notification channel\n`^medianotifi add <platform> <username>` - Add creator\n`^medianotifi remove <platform> <username>` - Remove creator\n`^medianotifi list` - View all tracked creators', inline: false },
            { name: '📝 Examples', value: '`^medianotifi add youtube MrBeast`\n`^medianotifi add twitch xQc`\n`^medianotifi add tiktok charlidamelio`', inline: false },
            { name: '🔔 Notification Types', value: '• 🔴 **Live Stream Started**\n• 📹 **New Video Uploaded**\n• ✅ **Stream Ended**', inline: false }
        )
        .setFooter({ text: 'Stay updated with your favorite creators!' });
    
    return message.reply({ embeds: [embed] });
}

async function setNotificationChannel(message, args, db) {
    const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
    
    if (!channel) {
        return message.reply('❌ Please mention a valid channel!\n**Usage:** `^medianotifi setchannel #channel`');
    }

    if (!channel.isTextBased()) {
        return message.reply('❌ Please select a text channel!');
    }

    const guildConfig = await db.getGuildConfig(message.guild.id);
    guildConfig.media_notification_channel = channel.id;
    await db.updateGuildConfig(message.guild.id, guildConfig);

    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Notification Channel Set!')
        .setDescription(`Media notifications will now be sent to ${channel}`)
        .addFields(
            { name: '📺 Next Steps', value: 'Add creators with:\n`^medianotifi add <platform> <username>`', inline: false }
        );

    return message.reply({ embeds: [embed] });
}

async function addCreator(message, args, db) {
    const platform = args[1]?.toLowerCase();
    const username = args.slice(2).join(' ');

    if (!platform || !username) {
        return message.reply('❌ **Usage:** `^medianotifi add <platform> <username>`\n**Platforms:** youtube, twitch, tiktok\n**Example:** `^medianotifi add youtube MrBeast`');
    }

    const validPlatforms = ['youtube', 'twitch', 'tiktok'];
    if (!validPlatforms.includes(platform)) {
        return message.reply('❌ Invalid platform! Use: **youtube**, **twitch**, or **tiktok**');
    }

    const guildConfig = await db.getGuildConfig(message.guild.id);
    
    if (!guildConfig.media_notification_channel) {
        return message.reply('❌ Please set a notification channel first!\n**Usage:** `^medianotifi setchannel #channel`');
    }

    if (!guildConfig.media_creators) {
        guildConfig.media_creators = [];
    }

    // Check if creator already exists
    const exists = guildConfig.media_creators.some(c => c.platform === platform && c.username.toLowerCase() === username.toLowerCase());
    if (exists) {
        return message.reply(`❌ **${username}** on **${platform}** is already being tracked!`);
    }

    // Add creator
    guildConfig.media_creators.push({
        platform,
        username,
        addedBy: message.author.id,
        addedAt: Date.now()
    });

    await db.updateGuildConfig(message.guild.id, guildConfig);

    const platformEmojis = {
        youtube: '📺',
        twitch: '🟣',
        tiktok: '🎵'
    };

    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Creator Added!')
        .setDescription(`Now tracking **${username}** on **${platform.toUpperCase()}**`)
        .addFields(
            { name: `${platformEmojis[platform]} Platform`, value: platform.toUpperCase(), inline: true },
            { name: '👤 Username', value: username, inline: true },
            { name: '🔔 Notifications', value: `Live streams & new videos`, inline: false },
            { name: '📍 Channel', value: `<#${guildConfig.media_notification_channel}>`, inline: false }
        )
        .setFooter({ text: 'You will be notified when they go live or upload!' });

    return message.reply({ embeds: [embed] });
}

async function removeCreator(message, args, db) {
    const platform = args[1]?.toLowerCase();
    const username = args.slice(2).join(' ');

    if (!platform || !username) {
        return message.reply('❌ **Usage:** `^medianotifi remove <platform> <username>`\n**Example:** `^medianotifi remove youtube MrBeast`');
    }

    const guildConfig = await db.getGuildConfig(message.guild.id);

    if (!guildConfig.media_creators || guildConfig.media_creators.length === 0) {
        return message.reply('❌ No creators are being tracked yet!');
    }

    const index = guildConfig.media_creators.findIndex(c => c.platform === platform && c.username.toLowerCase() === username.toLowerCase());
    
    if (index === -1) {
        return message.reply(`❌ **${username}** on **${platform}** is not being tracked!`);
    }

    guildConfig.media_creators.splice(index, 1);
    await db.updateGuildConfig(message.guild.id, guildConfig);

    const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('🗑️ Creator Removed')
        .setDescription(`No longer tracking **${username}** on **${platform.toUpperCase()}**`);

    return message.reply({ embeds: [embed] });
}

async function listCreators(message, db) {
    const guildConfig = await db.getGuildConfig(message.guild.id);

    if (!guildConfig.media_creators || guildConfig.media_creators.length === 0) {
        return message.reply('❌ No creators are being tracked!\n**Add one with:** `^medianotifi add <platform> <username>`');
    }

    const platformEmojis = {
        youtube: '📺',
        twitch: '🟣',
        tiktok: '🎵'
    };

    const youtubeCreators = guildConfig.media_creators.filter(c => c.platform === 'youtube');
    const twitchCreators = guildConfig.media_creators.filter(c => c.platform === 'twitch');
    const tiktokCreators = guildConfig.media_creators.filter(c => c.platform === 'tiktok');

    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📺 Tracked Creators')
        .setDescription(`Notification Channel: ${guildConfig.media_notification_channel ? `<#${guildConfig.media_notification_channel}>` : '❌ Not Set'}`);

    if (youtubeCreators.length > 0) {
        embed.addFields({
            name: `${platformEmojis.youtube} YouTube (${youtubeCreators.length})`,
            value: youtubeCreators.map(c => `• ${c.username}`).join('\n'),
            inline: false
        });
    }

    if (twitchCreators.length > 0) {
        embed.addFields({
            name: `${platformEmojis.twitch} Twitch (${twitchCreators.length})`,
            value: twitchCreators.map(c => `• ${c.username}`).join('\n'),
            inline: false
        });
    }

    if (tiktokCreators.length > 0) {
        embed.addFields({
            name: `${platformEmojis.tiktok} TikTok (${tiktokCreators.length})`,
            value: tiktokCreators.map(c => `• ${c.username}`).join('\n'),
            inline: false
        });
    }

    embed.setFooter({ text: `Total: ${guildConfig.media_creators.length} creators tracked` });

    return message.reply({ embeds: [embed] });
}
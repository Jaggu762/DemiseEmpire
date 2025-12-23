// commands/moderation/welcome.js (SIMPLE VERSION)
const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'welcome',
    description: 'Configure welcome/leave messages',
    aliases: ['welcomesetup', 'greetings'],
    category: 'Moderation',
    permissions: ['ManageGuild'],
    
    async execute(message, args, client, db) {
        const action = args[0]?.toLowerCase();
        
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return message.reply('❌ You need **Manage Server** permission to use this command!');
        }
        
        if (!action) {
            return showCurrentSettings(message, db);
        }
        
        switch (action) {
            case 'set':
            case 'setup':
                await setupWelcome(message, args, db);
                break;
                
            case 'test':
            case 'preview':
                await testWelcome(message, client, db);
                break;
                
            case 'disable':
            case 'off':
                await disableWelcome(message, db);
                break;
                
            case 'message':
                await setWelcomeMessage(message, args, db);
                break;
                
            case 'channel':
                await setWelcomeChannel(message, args, db);
                break;
                
            case 'role':
                await setWelcomeRole(message, args, db);
                break;
                
            case 'embed':
                await setWelcomeEmbed(message, args, db);
                break;
                
            case 'help':
                showHelp(message);
                break;
                
            default:
                showHelp(message);
        }
    }
};

async function showCurrentSettings(message, db) {
    try {
        const config = await db.getGuildConfig(message.guild.id);
        
        const embed = new EmbedBuilder()
            .setColor('#43B581')
            .setTitle('👋 Welcome System Settings')
            .setDescription('Current configuration for welcome/leave messages');
        
        if (config.welcome_channel) {
            const channel = message.guild.channels.cache.get(config.welcome_channel);
            embed.addFields({
                name: '📢 Welcome Channel',
                value: channel ? `${channel}` : 'Channel not found',
                inline: true
            });
        } else {
            embed.addFields({
                name: '📢 Welcome Channel',
                value: '❌ Not set',
                inline: true
            });
        }
        
        if (config.leave_channel) {
            const channel = message.guild.channels.cache.get(config.leave_channel);
            embed.addFields({
                name: '📢 Leave Channel',
                value: channel ? `${channel}` : 'Channel not found',
                inline: true
            });
        } else {
            embed.addFields({
                name: '📢 Leave Channel',
                value: '❌ Not set',
                inline: true
            });
        }
        
        if (config.welcome_message) {
            embed.addFields({
                name: '💬 Welcome Message',
                value: config.welcome_message.substring(0, 100) + (config.welcome_message.length > 100 ? '...' : ''),
                inline: false
            });
        }
        
        if (config.leave_message) {
            embed.addFields({
                name: '💬 Leave Message',
                value: config.leave_message.substring(0, 100) + (config.leave_message.length > 100 ? '...' : ''),
                inline: false
            });
        }
        
        if (config.auto_role) {
            const role = message.guild.roles.cache.get(config.auto_role);
            embed.addFields({
                name: '🎭 Auto Role',
                value: role ? `${role}` : 'Role not found',
                inline: true
            });
        }
        
        embed.addFields({
            name: '🎨 Embed Style',
            value: config.welcome_embed !== false ? '✅ Enabled' : '❌ Disabled',
            inline: true
        });
        
        embed.setFooter({ text: 'Use ^welcome help for all commands' });
        
        return message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Error showing welcome settings:', error);
        return message.reply('❌ Failed to load settings.');
    }
}

async function setupWelcome(message, args, db) {
    const channel = message.mentions.channels.first() || message.channel;
    
    try {
        await db.updateGuildConfig(message.guild.id, {
            welcome_channel: channel.id,
            leave_channel: channel.id,
            welcome_message: '🎉 Welcome {mention} to {server}! You are member #{count}',
            leave_message: '👋 {user} has left {server}. We now have {count} members.',
            welcome_embed: true
        });
        
        const embed = new EmbedBuilder()
            .setColor('#43B581')
            .setTitle('✅ Welcome System Setup')
            .setDescription(`Welcome and leave messages will be sent to ${channel}`)
            .addFields(
                { name: 'Default Welcome', value: '🎉 Welcome {mention} to {server}! You are member #{count}', inline: false },
                { name: 'Default Leave', value: '👋 {user} has left {server}. We now have {count} members.', inline: false },
                { name: 'Embed Style', value: '✅ Enabled', inline: true }
            )
            .setFooter({ text: 'Use ^welcome test to preview, ^welcome message to customize' });
        
        return message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Setup error:', error);
        return message.reply('❌ Failed to setup welcome system.');
    }
}

async function testWelcome(message, client, db) {
    try {
        const config = await db.getGuildConfig(message.guild.id);
        
        if (!config.welcome_channel) {
            return message.reply('❌ Welcome system is not setup. Use `^welcome setup #channel`');
        }
        
        // Test welcome message
        const welcomeMessage = formatMessage(
            config.welcome_message || '🎉 Welcome {mention} to {server}! You are member #{count}',
            message.member,
            message.guild
        );
        
        // Test leave message
        const leaveMessage = formatMessage(
            config.leave_message || '👋 {user} has left {server}. We now have {count} members.',
            message.member,
            message.guild
        );
        
        // Create welcome embed if enabled
        if (config.welcome_embed !== false) {
            const welcomeEmbed = createWelcomeEmbed(message.member, 'welcome');
            await message.channel.send({ 
                content: '**Welcome Embed Preview:**',
                embeds: [welcomeEmbed] 
            });
        }
        
        // Create leave embed if enabled
        if (config.welcome_embed !== false) {
            const leaveEmbed = createWelcomeEmbed(message.member, 'leave');
            await message.channel.send({ 
                content: '**Leave Embed Preview:**',
                embeds: [leaveEmbed] 
            });
        }
        
        // Show text previews
        const embed = new EmbedBuilder()
            .setColor('#43B581')
            .setTitle('👋 Welcome System Preview')
            .setDescription('Here\'s how messages will look:')
            .addFields(
                { name: '📝 Welcome Text', value: welcomeMessage, inline: false },
                { name: '📝 Leave Text', value: leaveMessage, inline: false }
            )
            .setFooter({ text: 'Messages will be sent automatically when members join/leave' });
        
        return message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Test error:', error);
        return message.reply('❌ Failed to generate preview.');
    }
}

function createWelcomeEmbed(member, type = 'welcome') {
    const colors = {
        welcome: '#43B581', // Green
        leave: '#F04747'    // Red
    };
    
    const titles = {
        welcome: `🎉 Welcome to ${member.guild.name}!`,
        leave: `👋 Goodbye from ${member.guild.name}!`
    };
    
    const descriptions = {
        welcome: `**${member.user.username}** just joined the server!\nWe're now **${member.guild.memberCount}** members strong! 🎊`,
        leave: `**${member.user.username}** has left the server.\nWe're now **${member.guild.memberCount}** members. 😢`
    };
    
    const embed = new EmbedBuilder()
        .setColor(colors[type])
        .setTitle(titles[type])
        .setDescription(descriptions[type])
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
            {
                name: '👤 Username',
                value: member.user.tag,
                inline: true
            },
            {
                name: '🆔 User ID',
                value: `\`${member.user.id}\``,
                inline: true
            },
            {
                name: '📅 Account Age',
                value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
                inline: true
            }
        )
        .setFooter({ 
            text: type === 'welcome' 
                ? `Member #${member.guild.memberCount} • Welcome! 🎊` 
                : `Was member #${member.guild.memberCount + 1} • We'll miss you! 😢`
        })
        .setTimestamp();
    
    // Add badges or status
    const badges = [];
    if (member.user.bot) badges.push('🤖 Bot');
    if (member.premiumSince) badges.push('🌟 Booster');
    
    if (badges.length > 0) {
        embed.addFields({
            name: '🎖️ Badges',
            value: badges.join(' • '),
            inline: true
        });
    }
    
    return embed;
}

async function setWelcomeMessage(message, args, db) {
    const type = args[1]?.toLowerCase(); // 'welcome' or 'leave'
    const customMessage = args.slice(2).join(' ');
    
    if (!type || !customMessage) {
        return message.reply('❌ Usage: `^welcome message welcome/leave <message>`\nVariables: {user}, {server}, {count}, {mention}');
    }
    
    if (!['welcome', 'leave'].includes(type)) {
        return message.reply('❌ Type must be `welcome` or `leave`');
    }
    
    try {
        const field = type === 'welcome' ? 'welcome_message' : 'leave_message';
        await db.updateGuildConfig(message.guild.id, { [field]: customMessage });
        
        const embed = new EmbedBuilder()
            .setColor('#43B581')
            .setTitle('✅ Message Updated')
            .setDescription(`${type.charAt(0).toUpperCase() + type.slice(1)} message set:`)
            .addFields({ name: 'Message', value: customMessage, inline: false })
            .setFooter({ text: 'Use ^welcome test to preview' });
        
        return message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Message set error:', error);
        return message.reply('❌ Failed to update message.');
    }
}

async function setWelcomeChannel(message, args, db) {
    const type = args[1]?.toLowerCase(); // 'welcome' or 'leave' or 'both'
    const channel = message.mentions.channels.first();
    
    if (!type || !channel) {
        return message.reply('❌ Usage: `^welcome channel welcome/leave/both #channel`');
    }
    
    if (!['welcome', 'leave', 'both'].includes(type)) {
        return message.reply('❌ Type must be `welcome`, `leave`, or `both`');
    }
    
    try {
        if (type === 'welcome' || type === 'both') {
            await db.updateGuildConfig(message.guild.id, { welcome_channel: channel.id });
        }
        
        if (type === 'leave' || type === 'both') {
            await db.updateGuildConfig(message.guild.id, { leave_channel: channel.id });
        }
        
        const embed = new EmbedBuilder()
            .setColor('#43B581')
            .setTitle('✅ Channel Updated')
            .setDescription(`${type === 'both' ? 'Welcome and leave' : type.charAt(0).toUpperCase() + type.slice(1)} channel set to ${channel}`);
        
        return message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Channel set error:', error);
        return message.reply('❌ Failed to update channel.');
    }
}

async function setWelcomeRole(message, args, db) {
    const role = message.mentions.roles.first();
    
    if (!role) {
        return message.reply('❌ Please mention a role: `^welcome role @role`');
    }
    
    try {
        await db.updateGuildConfig(message.guild.id, { auto_role: role.id });
        
        const embed = new EmbedBuilder()
            .setColor('#43B581')
            .setTitle('✅ Auto Role Updated')
            .setDescription(`New members will automatically receive ${role}`);
        
        return message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Role set error:', error);
        return message.reply('❌ Failed to set auto role.');
    }
}

async function setWelcomeEmbed(message, args, db) {
    const enabled = args[1]?.toLowerCase();
    
    if (!['on', 'off'].includes(enabled)) {
        return message.reply('❌ Usage: `^welcome embed on/off`');
    }
    
    try {
        await db.updateGuildConfig(message.guild.id, { 
            welcome_embed: enabled === 'on' 
        });
        
        return message.reply(`✅ Embed style ${enabled === 'on' ? 'enabled' : 'disabled'}.`);
        
    } catch (error) {
        console.error('Embed set error:', error);
        return message.reply('❌ Failed to update embed setting.');
    }
}

async function disableWelcome(message, db) {
    try {
        await db.updateGuildConfig(message.guild.id, {
            welcome_channel: null,
            leave_channel: null,
            welcome_embed: false
        });
        
        return message.reply('✅ Welcome system disabled.');
        
    } catch (error) {
        console.error('Disable error:', error);
        return message.reply('❌ Failed to disable welcome system.');
    }
}

function showHelp(message) {
    const embed = new EmbedBuilder()
        .setColor('#43B581')
        .setTitle('👋 Welcome System Help')
        .setDescription('Setup beautiful welcome/leave messages')
        .addFields(
            { name: '🚀 Quick Setup', value: '`^welcome setup #channel` - Setup in a channel\n`^welcome test` - Preview', inline: false },
            { name: '⚙️ Configuration', value: '`^welcome channel welcome #channel` - Set welcome channel\n`^welcome channel leave #channel` - Set leave channel\n`^welcome message welcome <text>` - Set welcome message\n`^welcome message leave <text>` - Set leave message\n`^welcome role @role` - Set auto role\n`^welcome embed on/off` - Toggle embeds', inline: false },
            { name: '🔄 Variables', value: '`{user}` - Username\n`{server}` - Server name\n`{count}` - Member count\n`{mention}` - User mention', inline: false },
            { name: '👁️ View Settings', value: '`.welcome` - Show current settings', inline: false },
            { name: '❌ Disable', value: '`^welcome disable` - Turn off system', inline: false }
        )
        .setFooter({ text: 'Green embeds for join • Red embeds for leave • No canvas required!' });
    
    return message.reply({ embeds: [embed] });
}

function formatMessage(template, member, guild) {
    return template
        .replace(/{user}/g, member.user.username)
        .replace(/{server}/g, guild.name)
        .replace(/{count}/g, guild.memberCount.toString())
        .replace(/{mention}/g, `<@${member.user.id}>`);
}
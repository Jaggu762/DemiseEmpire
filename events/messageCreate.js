const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const config = require('../config.json');

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        // Ignore bot messages
        if (message.author.bot) return;
        
        // Check if message is in DM
        if (!message.guild) {
            // Handle DMs
            handleDM(message, client);
            return;
        }
        
        const db = require('../utils/database');
        const guildConfig = await db.getGuildConfig(message.guild.id);
        
        // Check for command
        if (message.content.startsWith(guildConfig.prefix || config.bot.prefix)) {
            handleCommand(message, client, guildConfig);
            return;
        }
        
        // Auto-moderation checks
        if (guildConfig.automodEnabled) {
            await checkAutoMod(message, guildConfig, client);
        }
        
        // AI chat in configured channels
        if (guildConfig.aiChannel === message.channel.id) {
            await handleAIChat(message, client, guildConfig);
        }
        
        // Anti-links check
        if (guildConfig.antiLinks && !isLinkAllowed(message, guildConfig)) {
            await handleAntiLink(message, guildConfig);
        }
    }
};

async function handleCommand(message, client, guildConfig) {
    const args = message.content.slice(guildConfig.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    
    // Get command from name or alias
    const command = client.commands.get(commandName) || 
                   client.commands.get(client.aliases.get(commandName));
    
    if (!command) return;
    
    // Check permissions
    if (command.permissions) {
        const missingPerms = [];
        
        for (const perm of command.permissions) {
            if (!message.member.permissions.has(PermissionsBitField.Flags[perm])) {
                missingPerms.push(perm);
            }
        }
        
        if (missingPerms.length > 0) {
            return message.reply(`❌ You need the following permissions: ${missingPerms.map(p => `\`${p}\``).join(', ')}`);
        }
    }
    
    // Check if owner-only
    if (command.ownerOnly && !config.bot.admins.includes(message.author.id)) {
        return message.reply('❌ This command is only available to bot owners!');
    }
    
    // Check cooldowns
    if (!cooldowns.has(command.name)) {
        cooldowns.set(command.name, new Collection());
    }
    
    const now = Date.now();
    const timestamps = cooldowns.get(command.name);
    const cooldownAmount = (command.cooldown || 3) * 1000;
    
    if (timestamps.has(message.author.id)) {
        const expirationTime = timestamps.get(message.author.id) + cooldownAmount;
        
        if (now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000;
            return message.reply(`⏰ Please wait ${timeLeft.toFixed(1)} more seconds before using \`${command.name}\` again.`);
        }
    }
    
    // Set cooldown
    timestamps.set(message.author.id, now);
    setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);
    
    // Execute command
    try {
        await command.execute(message, args, client);
    } catch (error) {
        console.error(`Error executing command ${command.name}:`, error);
        
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Command Error')
            .setDescription(`An error occurred while executing the command:\n\`\`\`${error.message}\`\`\``)
            .setFooter({ text: 'Please report this to the bot developer' });
        
        message.reply({ embeds: [errorEmbed] }).catch(() => {});
    }
}

async function checkAutoMod(message, config, client) {
    // Bad word filter
    if (config.badWords && config.badWords !== '[]') {
        try {
            const badWords = JSON.parse(config.badWords);
            const content = message.content.toLowerCase();
            
            for (const word of badWords) {
                if (content.includes(word.toLowerCase())) {
                    await message.delete();
                    
                    const embed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('🚫 Auto-Moderation')
                        .setDescription(`Your message was deleted for containing a banned word.`)
                        .addFields(
                            { name: '👤 User', value: message.author.tag, inline: true },
                            { name: '📝 Channel', value: message.channel.toString(), inline: true }
                        )
                        .setFooter({ text: 'Auto-moderation system' })
                        .setTimestamp();
                    
                    // Send warning to user
                    try {
                        await message.author.send({ embeds: [embed] });
                    } catch (error) {
                        // Can't DM user
                    }
                    
                    // Log to mod logs
                    if (config.moderationLogs && config.logChannel) {
                        const logChannel = message.guild.channels.cache.get(config.logChannel);
                        if (logChannel) {
                            embed.setTitle('🚫 Auto-Mod Action: Bad Word Filter');
                            await logChannel.send({ embeds: [embed] });
                        }
                    }
                    
                    break;
                }
            }
        } catch (error) {
            console.error('Bad word filter error:', error);
        }
    }
    
    // Spam protection
    if (config.spamProtection) {
        const userMessages = client.userMessages.get(message.author.id) || [];
        userMessages.push({
            content: message.content,
            timestamp: Date.now()
        });
        
        // Keep only messages from last 5 seconds
        const recentMessages = userMessages.filter(msg => 
            Date.now() - msg.timestamp < 5000
        );
        
        client.userMessages.set(message.author.id, recentMessages);
        
        // If user sent more than 5 similar messages in 5 seconds
        if (recentMessages.length > 5) {
            const similarCount = recentMessages.filter(msg => 
                msg.content === message.content
            ).length;
            
            if (similarCount > 3) {
                await message.delete();
                
                // Timeout user for 1 minute
                try {
                    await message.member.timeout(60000, 'Spam detected');
                } catch (error) {
                    console.error('Error timing out user:', error);
                }
                
                // Log action
                if (config.moderationLogs && config.logChannel) {
                    const logChannel = message.guild.channels.cache.get(config.logChannel);
                    if (logChannel) {
                        const embed = new EmbedBuilder()
                            .setColor('#ff0000')
                            .setTitle('🚫 Auto-Mod Action: Spam Protection')
                            .setDescription(`User was timed out for spam detection.`)
                            .addFields(
                                { name: '👤 User', value: message.author.tag, inline: true },
                                { name: '⏰ Duration', value: '1 minute', inline: true },
                                { name: '📝 Reason', value: 'Spam detected by auto-mod', inline: true }
                            )
                            .setFooter({ text: 'Auto-moderation system' })
                            .setTimestamp();
                        
                        await logChannel.send({ embeds: [embed] });
                    }
                }
            }
        }
    }
    
    // Mass mention protection
    if (config.maxMentions > 0) {
        const mentionCount = (message.content.match(/<@!?\d+>/g) || []).length;
        
        if (mentionCount > config.maxMentions) {
            await message.delete();
            
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🚫 Auto-Moderation')
                .setDescription(`Your message was deleted for mass mentioning users. (${mentionCount} mentions)`)
                .addFields(
                    { name: '👤 User', value: message.author.tag, inline: true },
                    { name: '📝 Channel', value: message.channel.toString(), inline: true }
                )
                .setFooter({ text: 'Auto-moderation system' })
                .setTimestamp();
            
            // Send warning to user
            try {
                await message.author.send({ embeds: [embed] });
            } catch (error) {
                // Can't DM user
            }
            
            // Log to mod logs
            if (config.moderationLogs && config.logChannel) {
                const logChannel = message.guild.channels.cache.get(config.logChannel);
                if (logChannel) {
                    embed.setTitle('🚫 Auto-Mod Action: Mass Mention Protection');
                    await logChannel.send({ embeds: [embed] });
                }
            }
        }
    }
}

async function handleAIChat(message, client, config) {
    try {
        // Send typing indicator
        await message.channel.sendTyping();
        
        const apiClient = require('../utils/apiClient');
        const response = await apiClient.getAIResponse(message.content, config.aiModel || 'deepseek');
        
        // Split long responses
        if (response.length > 2000) {
            const chunks = response.match(/[\s\S]{1,2000}/g);
            for (const chunk of chunks) {
                await message.reply(chunk);
            }
        } else {
            await message.reply(response);
        }
    } catch (error) {
        console.error('AI Chat error:', error);
        await message.reply('❌ Sorry, I encountered an error while processing your request.');
    }
}

function isLinkAllowed(message, config) {
    const linkRegex = /https?:\/\/[^\s]+/gi;
    const hasLinks = linkRegex.test(message.content);
    
    if (!hasLinks) return true;
    
    // Check if channel is whitelisted
    try {
        const allowedChannels = JSON.parse(config.allowedLinkChannels || '[]');
        if (allowedChannels.includes(message.channel.id)) {
            return true;
        }
    } catch (error) {
        console.error('Error parsing allowed channels:', error);
    }
    
    // Check if user has admin/moderator role
    if (message.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
        message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
        return true;
    }
    
    return false;
}

async function handleAntiLink(message, config) {
    await message.delete();
    
    const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('🚫 Links Not Allowed')
        .setDescription(`Links are not allowed in this channel.`)
        .addFields(
            { name: '👤 User', value: message.author.tag, inline: true },
            { name: '📝 Channel', value: message.channel.toString(), inline: true }
        )
        .setFooter({ text: 'Anti-link system' })
        .setTimestamp();
    
    // Send warning to user
    try {
        await message.author.send({ embeds: [embed] });
    } catch (error) {
        // Can't DM user
    }
    
    // Log to mod logs
    if (config.moderationLogs && config.logChannel) {
        const logChannel = message.guild.channels.cache.get(config.logChannel);
        if (logChannel) {
            await logChannel.send({ embeds: [embed] });
        }
    }
}

async function handleDM(message, client) {
    // Handle DMs to the bot
    const embed = new EmbedBuilder()
        .setColor('#0061ff')
        .setTitle(`🤖 ${client.user.username} Support`)
        .setDescription(`Hello ${message.author.username}! I'm a Discord bot.\n\n**Commands:** Use \`.help\` in a server to see all commands.\n**Support:** Join our support server for help.\n**Invite:** Use \`.invite\` to get invite links.`)
        .addFields(
            { name: '📊 Bot Info', value: `**Version:** ${client.botInfo.version}\n**Creator:** ${client.botInfo.creator}\n**Servers:** ${client.guilds.cache.size}`, inline: true },
            { name: '🔗 Links', value: '[Support Server](https://discord.gg/your-server)\n[Invite Bot](https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID)\n[GitHub](https://github.com/your-repo)', inline: true }
        )
        .setFooter({ text: `DTEmpire v${client.botInfo.version} | Created by Jaggu762` })
        .setTimestamp();
    
    await message.reply({ embeds: [embed] });
}
// events/guild/guildDelete.js
const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'guildDelete',
    once: false,
    
    async execute(guild, client, db) {
        try {
            console.log(`🚫 Bot left guild: ${guild.name} (${guild.id}) with ${guild.memberCount} members`);
            
            // Find which server has the notification channel configured
            const allConfigs = await db.getAllGuildConfigs();
            
            let notificationConfig = null;
            let notificationGuild = null;
            
            // Loop through all guild configs to find one with notification channels
            for (const [guildId, config] of Object.entries(allConfigs)) {
                // Check for leave channel first, then join channel as fallback
                if (config.guild_leave_channel) {
                    notificationConfig = config;
                    notificationGuild = client.guilds.cache.get(guildId);
                    break;
                } else if (config.guild_join_channel) {
                    notificationConfig = config;
                    notificationGuild = client.guilds.cache.get(guildId);
                    // Continue looking for dedicated leave channel
                }
            }
            
            if (!notificationConfig || !notificationGuild) {
                console.log('No guild leave notification channel configured anywhere.');
                return;
            }
            
            // Use leave channel if set, otherwise use join channel
            const channelId = notificationConfig.guild_leave_channel || notificationConfig.guild_join_channel;
            const channel = notificationGuild.channels.cache.get(channelId);
            
            if (!channel) {
                console.log(`Configured channel ${channelId} not found in guild ${notificationGuild.name}.`);
                return;
            }
            
            // Check bot permissions
            const botPermissions = channel.permissionsFor(client.user);
            if (!botPermissions.has(PermissionsBitField.Flags.SendMessages) || 
                !botPermissions.has(PermissionsBitField.Flags.EmbedLinks)) {
                console.log(`Missing permissions in channel ${channel.id}`);
                return;
            }
            
            // Get updated stats after leaving
            const totalGuilds = client.guilds.cache.size;
            const totalMembers = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);
            
            // Calculate how long bot was in the server
            const joinedAt = guild.joinedTimestamp || Date.now();
            const timeInServer = Date.now() - joinedAt;
            const daysInServer = Math.floor(timeInServer / (1000 * 60 * 60 * 24));
            const timeInServerText = daysInServer > 0 
                ? `${daysInServer} day${daysInServer !== 1 ? 's' : ''}` 
                : 'less than a day';
            
            // Get verification level name
            const verificationLevels = {
                0: 'None',
                1: 'Low',
                2: 'Medium',
                3: 'High',
                4: 'Highest'
            };
            
            // Create leave embed
            const leaveEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setTitle(`🚫 ${client.user.username} Left a Server`)
                .setDescription(`**${guild.name}**\n${guild.description || 'No description'}`)
                .setThumbnail(guild.iconURL({ size: 512, dynamic: true }))
                .addFields(
                    {
                        name: '📊 After Leaving',
                        value: `**Total Guilds:** ${totalGuilds}\n**Total Members:** ${totalMembers}`,
                        inline: true
                    },
                    {
                        name: '👥 Server Size',
                        value: `${guild.memberCount} members\n**In server for:** ${timeInServerText}`,
                        inline: true
                    },
                    {
                        name: '📅 Server Created',
                        value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>\n(<t:${Math.floor(guild.createdTimestamp / 1000)}:R>)`,
                        inline: true
                    },
                    {
                        name: '📁 Channel Counts',
                        value: `💬 Text: ${guild.channels.cache.filter(c => c.type === 0).size}\n🔊 Voice: ${guild.channels.cache.filter(c => c.type === 2).size}\n📁 Categories: ${guild.channels.cache.filter(c => c.type === 4).size}`,
                        inline: true
                    },
                    {
                        name: '👑 Server Owner',
                        value: guild.ownerId ? `<@${guild.ownerId}>` : 'Unknown',
                        inline: true
                    },
                    {
                        name: '🛡️ Verification',
                        value: verificationLevels[guild.verificationLevel] || `Level ${guild.verificationLevel}`,
                        inline: true
                    },
                    {
                        name: '📝 Reason',
                        value: 'Bot was removed from server',
                        inline: false
                    }
                )
                .setFooter({ 
                    text: `${client.user.username} • Now in ${totalGuilds} servers`, 
                    iconURL: client.user.displayAvatarURL() 
                })
                .setTimestamp();
            
            await channel.send({ 
                content: `📤 **${client.user.username} has left a server!**`,
                embeds: [leaveEmbed]
            });
            
            console.log(`✅ Sent guild leave notification for ${guild.name} to ${channel.name} in ${notificationGuild.name}`);
            
        } catch (error) {
            console.error('Error in guildDelete event:', error);
        }
    }
};
// events/guild/guildCreate.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'guildCreate',
    once: false,
    
    async execute(guild, client, db) {
        try {
            console.log(`\n=== GUILD CREATE EVENT ===`);
            console.log(`🤖 Bot joined: ${guild.name} (${guild.id}) with ${guild.memberCount} members`);
            
            if (!db) {
                console.log('❌ Database not available');
                return;
            }
            
            // Wait a bit for bot to fully initialize
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Get all guild configs
            const allConfigs = await db.getAllGuildConfigs();
            console.log(`📊 Checking ${Object.keys(allConfigs).length} guild configs...`);
            
            let notificationConfig = null;
            let notificationGuild = null;
            let notificationGuildId = null;
            
            // Find the notification server
            for (const [guildId, config] of Object.entries(allConfigs)) {
                if (config.guild_join_channel) {
                    notificationConfig = config;
                    notificationGuildId = guildId;
                    notificationGuild = client.guilds.cache.get(guildId);
                    console.log(`✅ Found notification config in guild: ${guildId}`);
                    console.log(`   Channel ID: ${config.guild_join_channel}`);
                    break;
                }
            }
            
            if (!notificationConfig || !notificationGuildId) {
                console.log('❌ No guild join notification channel configured');
                return;
            }
            
            if (!notificationGuild) {
                console.log(`❌ Notification guild ${notificationGuildId} not found in bot cache`);
                console.log(`   Bot is in: ${Array.from(client.guilds.cache.keys()).join(', ')}`);
                return;
            }
            
            const channelId = notificationConfig.guild_join_channel;
            console.log(`🔍 Looking for channel: ${channelId} in ${notificationGuild.name}`);
            
            if (!channelId || typeof channelId !== 'string') {
                console.log(`❌ Invalid channel ID: ${channelId}`);
                return;
            }
            
            // Get the channel with better error handling
            let channel;
            try {
                // Try to get from cache first
                channel = notificationGuild.channels.cache.get(channelId);
                
                // If not in cache, try to fetch it
                if (!channel) {
                    console.log(`Channel ${channelId} not in cache, fetching...`);
                    channel = await notificationGuild.channels.fetch(channelId);
                }
                
                console.log(`✅ Channel found: ${channel?.name || 'Unknown'} (Type: ${channel?.type})`);
                
            } catch (fetchError) {
                console.log(`❌ Failed to fetch channel ${channelId}:`, fetchError.message);
                
                // Clear invalid channel from database
                try {
                    await db.updateGuildConfig(notificationGuildId, {
                        guild_join_channel: null
                    });
                    console.log(`🧹 Cleared invalid channel from config`);
                } catch (clearError) {
                    console.log(`Failed to clear channel:`, clearError.message);
                }
                return;
            }
            
            // CRITICAL FIX: Check if channel exists and has permissionsFor method
            if (!channel) {
                console.log(`❌ Channel ${channelId} does not exist`);
                return;
            }
            
            if (typeof channel.permissionsFor !== 'function') {
                console.log(`❌ Channel object is invalid, missing permissionsFor method`);
                console.log(`   Channel type: ${channel.constructor?.name || 'Unknown'}`);
                console.log(`   Channel data:`, JSON.stringify(channel, null, 2).substring(0, 200));
                return;
            }
            
            // Now safely check permissions
            try {
                const botPermissions = channel.permissionsFor(client.user);
                
                if (!botPermissions) {
                    console.log(`❌ Could not get permissions for channel ${channel.id}`);
                    return;
                }
                
                const hasSend = botPermissions.has(PermissionsBitField.Flags.SendMessages);
                const hasEmbed = botPermissions.has(PermissionsBitField.Flags.EmbedLinks);
                const hasView = botPermissions.has(PermissionsBitField.Flags.ViewChannel);
                
                console.log(`🔐 Permissions - Send: ${hasSend}, Embed: ${hasEmbed}, View: ${hasView}`);
                
                if (!hasSend || !hasEmbed || !hasView) {
                    console.log(`❌ Missing required permissions`);
                    return;
                }
                
            } catch (permError) {
                console.log(`❌ Error checking permissions:`, permError.message);
                return;
            }
            
            // === CONTINUE WITH SENDING NOTIFICATION ===
            
            // Calculate statistics
            const totalGuilds = client.guilds.cache.size;
            const totalMembers = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);
            
            // Create embed
            const embed = new EmbedBuilder()
                .setColor('#43B581')
                .setTitle(`🎉 ${client.user.username} Joined a New Server!`)
                .setDescription(`**${guild.name}**`)
                .setThumbnail(guild.iconURL({ size: 256, dynamic: true }))
                .addFields(
                    {
                        name: '📊 Statistics',
                        value: `**Total Guilds:** ${totalGuilds}\n**Total Members:** ${totalMembers}`,
                        inline: true
                    },
                    {
                        name: '👥 Server Size',
                        value: `${guild.memberCount} members`,
                        inline: true
                    },
                    {
                        name: '📅 Created',
                        value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`,
                        inline: true
                    }
                )
                .setFooter({ 
                    text: `${client.user.username} • Guild #${totalGuilds}`, 
                    iconURL: client.user.displayAvatarURL() 
                })
                .setTimestamp();
            
            // Send notification
            console.log(`📨 Sending notification to ${channel.name}...`);
            try {
                await channel.send({ 
                    content: `📥 **${client.user.username} has joined a new server!**`,
                    embeds: [embed] 
                });
                console.log(`✅ Notification sent successfully!`);
            } catch (sendError) {
                console.error(`❌ Failed to send message:`, sendError.message);
            }
            
            console.log(`=== EVENT COMPLETE ===\n`);
            
        } catch (error) {
            console.error('❌ Unhandled error in guildCreate event:', error.message);
            console.error('Stack trace:', error.stack);
        }
    }
};
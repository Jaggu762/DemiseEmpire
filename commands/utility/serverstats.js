const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const moment = require('moment');

module.exports = {
    name: 'serverstats',
    description: 'Get detailed statistics about the server',
    aliases: ['stats', 'serverinfo', 'guildinfo'],
    category: 'Utility',
    
    async execute(message, args, client) {
        const guild = message.guild;
        
        // Calculate various statistics
        const totalMembers = guild.memberCount;
        const humanMembers = guild.members.cache.filter(m => !m.user.bot).size;
        const botMembers = guild.members.cache.filter(m => m.user.bot).size;
        
        const onlineMembers = guild.members.cache.filter(m => 
            m.presence?.status === 'online' || 
            m.presence?.status === 'idle' || 
            m.presence?.status === 'dnd'
        ).size;
        
        const textChannels = guild.channels.cache.filter(c => c.type === 0).size;
        const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;
        const categories = guild.channels.cache.filter(c => c.type === 4).size;
        
        const roles = guild.roles.cache.size;
        const emojis = guild.emojis.cache.size;
        const stickers = guild.stickers.cache.size;
        
        const boosts = guild.premiumSubscriptionCount || 0;
        const boostTier = guild.premiumTier || 'None';
        
        // Get verification level
        const verificationLevels = {
            0: 'None',
            1: 'Low',
            2: 'Medium',
            3: 'High',
            4: 'Highest'
        };
        
        // Get content filter level
        const contentFilterLevels = {
            0: 'Disabled',
            1: 'Scan messages from members without a role',
            2: 'Scan all messages'
        };
        
        // Calculate member join dates
        const membersByJoinDate = guild.members.cache.sort((a, b) => a.joinedTimestamp - b.joinedTimestamp);
        const oldestMembers = membersByJoinDate.first(5);
        const newestMembers = membersByJoinDate.last(5);
        
        // Calculate role distribution
        const topRoles = guild.roles.cache
            .sort((a, b) => b.members.size - a.members.size)
            .filter(r => !r.managed && r.id !== guild.id)
            .first(5);
        
        // Create main embed
        const embed = new EmbedBuilder()
            .setColor('#0061ff')
            .setTitle(`📊 ${guild.name} Statistics`)
            .setThumbnail(guild.iconURL({ dynamic: true, size: 512 }))
            .setImage(guild.bannerURL({ size: 1024 }))
            .addFields(
                { name: '👥 Member Statistics', value: `**Total:** ${totalMembers}\n**Humans:** ${humanMembers}\n**Bots:** ${botMembers}\n**Online:** ${onlineMembers}`, inline: true },
                { name: '📺 Channel Statistics', value: `**Text:** ${textChannels}\n**Voice:** ${voiceChannels}\n**Categories:** ${categories}\n**Total:** ${textChannels + voiceChannels + categories}`, inline: true },
                { name: '🎨 Server Assets', value: `**Roles:** ${roles}\n**Emojis:** ${emojis}\n**Stickers:** ${stickers}\n**Boosts:** ${boosts} (${boostTier})`, inline: true },
                { name: '📅 Server Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>\n(<t:${Math.floor(guild.createdTimestamp / 1000)}:R>)`, inline: true },
                { name: '🛡️ Security', value: `**Verification:** ${verificationLevels[guild.verificationLevel]}\n**Content Filter:** ${contentFilterLevels[guild.explicitContentFilter]}\n**MFA:** ${guild.mfaLevel === 1 ? 'Required' : 'Optional'}`, inline: true },
                { name: '👑 Server Owner', value: `<@${guild.ownerId}>\n${guild.ownerId}`, inline: true }
            );
        
        // Create buttons for additional stats
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('show_members')
                    .setLabel('👥 Show Top Members')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('show_roles')
                    .setLabel('🎨 Show Role Distribution')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('show_channels')
                    .setLabel('📺 Show Channel List')
                    .setStyle(ButtonStyle.Primary)
            );
        
        const statsMessage = await message.reply({ embeds: [embed], components: [row] });
        
        // Create collector for button interactions
        const filter = i => i.user.id === message.author.id;
        const collector = statsMessage.createMessageComponentCollector({ filter, time: 60000 });
        
        collector.on('collect', async interaction => {
            if (interaction.customId === 'show_members') {
                // Show oldest and newest members
                const oldestList = oldestMembers.map((m, i) => 
                    `${i+1}. ${m.user.tag} - <t:${Math.floor(m.joinedTimestamp / 1000)}:R>`
                ).join('\n');
                
                const newestList = newestMembers.map((m, i) => 
                    `${i+1}. ${m.user.tag} - <t:${Math.floor(m.joinedTimestamp / 1000)}:R>`
                ).join('\n');
                
                const membersEmbed = new EmbedBuilder()
                    .setColor('#0061ff')
                    .setTitle('👥 Member Join History')
                    .addFields(
                        { name: 'Oldest Members', value: oldestList || 'None', inline: true },
                        { name: 'Newest Members', value: newestList || 'None', inline: true }
                    )
                    .setFooter({ text: 'Sorted by join date' });
                
                await interaction.reply({ embeds: [membersEmbed], ephemeral: true });
                
            } else if (interaction.customId === 'show_roles') {
                // Show role distribution
                const roleList = topRoles.map((role, i) => 
                    `${i+1}. ${role.name} - ${role.members.size} members`
                ).join('\n');
                
                const rolesEmbed = new EmbedBuilder()
                    .setColor('#0061ff')
                    .setTitle('🎨 Role Distribution')
                    .setDescription(roleList || 'No roles found')
                    .setFooter({ text: 'Top 5 roles by member count' });
                
                await interaction.reply({ embeds: [rolesEmbed], ephemeral: true });
                
            } else if (interaction.customId === 'show_channels') {
                // Show channel list
                const textChannelsList = guild.channels.cache
                    .filter(c => c.type === 0)
                    .sort((a, b) => a.position - b.position)
                    .map(c => `${c} • ${c.name}`)
                    .slice(0, 20)
                    .join('\n');
                
                const voiceChannelsList = guild.channels.cache
                    .filter(c => c.type === 2)
                    .sort((a, b) => a.position - b.position)
                    .map(c => `🔊 ${c.name}`)
                    .slice(0, 20)
                    .join('\n');
                
                const channelsEmbed = new EmbedBuilder()
                    .setColor('#0061ff')
                    .setTitle('📺 Channel List')
                    .addFields(
                        { name: 'Text Channels', value: textChannelsList || 'No text channels', inline: true },
                        { name: 'Voice Channels', value: voiceChannelsList || 'No voice channels', inline: true }
                    )
                    .setFooter({ text: `Showing first 20 channels of each type` });
                
                await interaction.reply({ embeds: [channelsEmbed], ephemeral: true });
            }
        });
        
        collector.on('end', () => {
            // Disable buttons after timeout
            const disabledRow = ActionRowBuilder.from(row);
            disabledRow.components.forEach(component => component.setDisabled(true));
            statsMessage.edit({ components: [disabledRow] });
        });
    }
};
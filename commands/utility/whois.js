const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const moment = require('moment');

module.exports = {
    name: 'whois',
    description: 'Get information about a user',
    aliases: ['userinfo', 'user'],
    category: 'Utility',
    
    async execute(message, args, client) {
        let user;
        
        if (args.length > 0) {
            // Try to find user by mention, ID, or username
            const mention = args[0].replace(/[<@!>]/g, '');
            
            try {
                user = await client.users.fetch(mention);
            } catch {
                user = client.users.cache.find(u => 
                    u.username.toLowerCase().includes(args.join(' ').toLowerCase()) ||
                    u.tag.toLowerCase().includes(args.join(' ').toLowerCase())
                );
            }
        } else {
            user = message.author;
        }
        
        if (!user) {
            return message.reply('❌ User not found!');
        }
        
        const member = message.guild.members.cache.get(user.id);
        
        // Create base embed
        const embed = new EmbedBuilder()
            .setColor(member?.displayHexColor || '#0061ff')
            .setTitle(`👤 ${user.tag}`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 512 }))
            .setImage(user.bannerURL({ size: 1024 }))
            .addFields(
                { name: '🆔 User ID', value: user.id, inline: true },
                { name: '🤖 Bot Account', value: user.bot ? 'Yes' : 'No', inline: true },
                { name: '📅 Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>\n(<t:${Math.floor(user.createdTimestamp / 1000)}:R>)`, inline: true }
            );
        
        if (member) {
            // Add member-specific information
            const roles = member.roles.cache
                .filter(r => r.id !== message.guild.id)
                .sort((a, b) => b.position - a.position)
                .map(r => r.toString())
                .slice(0, 10);
            
            const permissions = member.permissions.toArray()
                .slice(0, 10)
                .map(p => `• ${p.replace(/_/g, ' ').toLowerCase()}`)
                .join('\n');
            
            // Calculate member's highest role
            const highestRole = member.roles.highest;
            
            embed.addFields(
                { name: '📅 Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>\n(<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)`, inline: true },
                { name: '👑 Highest Role', value: highestRole ? highestRole.toString() : 'None', inline: true },
                { name: '🎨 Role Color', value: member.displayHexColor, inline: true },
                { name: '📛 Nickname', value: member.nickname || 'None', inline: true },
                { name: '🚀 Boosting Since', value: member.premiumSince ? `<t:${Math.floor(member.premiumSinceTimestamp / 1000)}:R>` : 'Not boosting', inline: true },
                { name: '🎭 Roles', value: roles.length > 0 ? roles.join(', ') : 'No roles', inline: false }
            );
            
            if (permissions.length > 0) {
                embed.addFields({ name: '🔑 Key Permissions', value: permissions, inline: false });
            }
        }
        
        // Add presence information if available
        if (member?.presence) {
            const activities = member.presence.activities
                .map(activity => {
                    let str = `**${activity.type === 0 ? 'Playing' : activity.type === 1 ? 'Streaming' : activity.type === 2 ? 'Listening' : activity.type === 3 ? 'Watching' : activity.type === 5 ? 'Competing' : 'Custom'}**: ${activity.name}`;
                    
                    if (activity.details) str += `\n${activity.details}`;
                    if (activity.state) str += `\n${activity.state}`;
                    if (activity.timestamps?.start) {
                        const duration = Date.now() - activity.timestamps.start.getTime();
                        str += `\nStarted: <t:${Math.floor(activity.timestamps.start.getTime() / 1000)}:R>`;
                    }
                    
                    return str;
                })
                .join('\n\n');
            
            if (activities) {
                embed.addFields({ name: '🎮 Activities', value: activities.slice(0, 1024), inline: false });
            }
        }
        
        // Add mutual servers count
        const mutualGuilds = client.guilds.cache.filter(g => g.members.cache.has(user.id));
        
        embed.addFields(
            { name: '🏰 Mutual Servers', value: mutualGuilds.size.toString(), inline: true },
            { name: '📊 Server Rank', value: member ? `#${[...message.guild.members.cache.values()].sort((a, b) => a.joinedTimestamp - b.joinedTimestamp).findIndex(m => m.id === user.id) + 1}` : 'N/A', inline: true }
        );
        
        embed.setFooter({ text: `DTEmpire v${client.botInfo.version} | User Information`, iconURL: client.user.displayAvatarURL() })
            .setTimestamp();
        
        // Create buttons for additional information
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('show_avatar')
                    .setLabel('🖼️ Show Avatar')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('show_banner')
                    .setLabel('🎨 Show Banner')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('show_roles')
                    .setLabel('🎭 All Roles')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        if (member) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('show_permissions')
                    .setLabel('🔑 Permissions')
                    .setStyle(ButtonStyle.Secondary)
            );
        }
        
        const infoMessage = await message.reply({ embeds: [embed], components: [row] });
        
        // Create collector for button interactions
        const filter = i => i.user.id === message.author.id;
        const collector = infoMessage.createMessageComponentCollector({ filter, time: 60000 });
        
        collector.on('collect', async interaction => {
            if (interaction.customId === 'show_avatar') {
                const avatarEmbed = new EmbedBuilder()
                    .setColor(member?.displayHexColor || '#0061ff')
                    .setTitle(`${user.username}'s Avatar`)
                    .setImage(user.displayAvatarURL({ dynamic: true, size: 4096 }))
                    .setDescription(`[PNG](${user.displayAvatarURL({ extension: 'png', size: 4096 })}) | [JPG](${user.displayAvatarURL({ extension: 'jpg', size: 4096 })}) | [WEBP](${user.displayAvatarURL({ extension: 'webp', size: 4096 })})${user.avatar?.startsWith('a_') ? ` | [GIF](${user.displayAvatarURL({ extension: 'gif', size: 4096 })})` : ''}`);
                
                await interaction.reply({ embeds: [avatarEmbed], ephemeral: true });
                
            } else if (interaction.customId === 'show_banner') {
                const bannerURL = user.bannerURL({ size: 4096 });
                
                if (bannerURL) {
                    const bannerEmbed = new EmbedBuilder()
                        .setColor(member?.displayHexColor || '#0061ff')
                        .setTitle(`${user.username}'s Banner`)
                        .setImage(bannerURL)
                        .setDescription(`[PNG](${user.bannerURL({ extension: 'png', size: 4096 })}) | [JPG](${user.bannerURL({ extension: 'jpg', size: 4096 })}) | [WEBP](${user.bannerURL({ extension: 'webp', size: 4096 })})`);
                    
                    await interaction.reply({ embeds: [bannerEmbed], ephemeral: true });
                } else {
                    await interaction.reply({ content: '❌ This user doesn\'t have a banner!', ephemeral: true });
                }
                
            } else if (interaction.customId === 'show_roles' && member) {
                const allRoles = member.roles.cache
                    .filter(r => r.id !== message.guild.id)
                    .sort((a, b) => b.position - a.position)
                    .map(r => `${r.toString()} (${r.members.size} members)`)
                    .join('\n');
                
                if (allRoles) {
                    const rolesEmbed = new EmbedBuilder()
                        .setColor(member.displayHexColor)
                        .setTitle(`${user.username}'s Roles`)
                        .setDescription(allRoles.slice(0, 4096))
                        .setFooter({ text: `Total: ${member.roles.cache.size - 1} roles` });
                    
                    await interaction.reply({ embeds: [rolesEmbed], ephemeral: true });
                } else {
                    await interaction.reply({ content: '❌ This user has no roles!', ephemeral: true });
                }
                
            } else if (interaction.customId === 'show_permissions' && member) {
                const allPermissions = member.permissions.toArray()
                    .map(p => `• ${p.replace(/_/g, ' ').toLowerCase()}`)
                    .sort()
                    .join('\n');
                
                const permissionsEmbed = new EmbedBuilder()
                    .setColor(member.displayHexColor)
                    .setTitle(`${user.username}'s Permissions`)
                    .setDescription(allPermissions.slice(0, 4096))
                    .setFooter({ text: `Total: ${member.permissions.toArray().length} permissions` });
                
                await interaction.reply({ embeds: [permissionsEmbed], ephemeral: true });
            }
        });
        
        collector.on('end', () => {
            // Disable buttons after timeout
            const disabledRow = ActionRowBuilder.from(row);
            disabledRow.components.forEach(component => component.setDisabled(true));
            infoMessage.edit({ components: [disabledRow] });
        });
    }
};
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'help',
    description: 'Shows all available commands',
    aliases: ['commands', 'h'],
    category: 'Utility',
    
    async execute(message, args, client) {
        const categories = {};
        
        // Group commands by category
        client.commands.forEach(cmd => {
            const category = cmd.category || 'Uncategorized';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(cmd);
        });
        
        const embed = new EmbedBuilder()
            .setColor('#0061ff')
            .setTitle('🤖 DTEmpire Help Menu')
            .setDescription(`**Prefix:** \`${client.botInfo.prefix}\`\n**Version:** ${client.botInfo.version}\n**Total Commands:** ${client.commands.size}`)
            .setFooter({ 
                text: `DTEmpire v${client.botInfo.version} | Created by DargoTamber`,
                iconURL: client.user.displayAvatarURL() 
            });
        
        // Add each category as a field
        Object.keys(categories).sort().forEach(category => {
            const commands = categories[category];
            const commandList = commands.map(cmd => 
                `\`${cmd.name}\` - ${cmd.description}`
            ).join('\n');
            
            embed.addFields({
                name: `📁 ${category} (${commands.length})`,
                value: commandList,
                inline: false
            });
        });
        
        // Create buttons for quick navigation (with music button)
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('help_economy')
                    .setLabel('💰 Economy')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('help_ai')
                    .setLabel('🤖 AI')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('help_admin')
                    .setLabel('🛠️ Admin')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('help_fun')
                    .setLabel('🎮 Fun')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('help_utility')
                    .setLabel('⚡ Utility')
                    .setStyle(ButtonStyle.Success)
            );
        
        // Create SECOND row for music button (since Discord only allows 5 buttons per row)
        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('help_music')
                    .setLabel('🎵 Music')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🎵'),
                new ButtonBuilder()
                    .setCustomId('help_moderation')
                    .setLabel('🛡️ Moderation')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setURL('https://discord.gg/zGxRRE3MS9')
                    .setLabel('Support Server')
                    .setStyle(ButtonStyle.Link),
                new ButtonBuilder()
                    .setURL('https://github.com/hyperdargo')
                    .setLabel('GitHub')
                    .setStyle(ButtonStyle.Link)
            );
        
        const helpMessage = await message.reply({ 
            embeds: [embed], 
            components: [row, row2] // Send both rows
        });
        
        // Create collector for buttons
        const filter = i => i.user.id === message.author.id;
        const collector = helpMessage.createMessageComponentCollector({ filter, time: 60000 });
        
        collector.on('collect', async interaction => {
            const category = interaction.customId.replace('help_', '');
            
            // Handle music category specially
            if (category === 'music') {
                const musicCommands = client.commands.filter(cmd => cmd.category?.toLowerCase() === 'music');
                
                const musicEmbed = new EmbedBuilder()
                    .setColor('#1DB954') // Spotify green color
                    .setTitle('🎵 Music Commands')
                    .setDescription(`**Total:** ${musicCommands.size} music commands\n**Prefix:** \`${client.botInfo.prefix}\``)
                    .setThumbnail('https://i.imgur.com/7jblalF.png') // Music icon
                    .setFooter({ text: '🎧 Use these commands to play music in voice channels' });
                
                const commandList = Array.from(musicCommands.values()).map(cmd => {
                    const aliasesText = cmd.aliases && cmd.aliases.length > 0 
                        ? `\n**Aliases:** ${cmd.aliases.map(a => `\`${a}\``).join(', ')}`
                        : '';
                    return `**${client.botInfo.prefix}${cmd.name}** - ${cmd.description}${aliasesText}`;
                }).join('\n\n');
                
                // Add common music usage examples
                musicEmbed.addFields(
                    {
                        name: '🎶 Quick Examples',
                        value: [
                            `\`${client.botInfo.prefix}play <song name or url>\``,
                            `\`${client.botInfo.prefix}queue\``,
                            `\`${client.botInfo.prefix}skip\``,
                            `\`${client.botInfo.prefix}volume 50\``
                        ].join('\n'),
                        inline: true
                    },
                    {
                        name: '🌐 Supported Platforms',
                        value: '• YouTube\n• Spotify\n• SoundCloud\n• Twitch\n• Bandcamp',
                        inline: true
                    },
                    {
                        name: '⚡ Music Features',
                        value: '• High quality audio\n• Queue management\n• Volume control\n• 24/7 radio\n• Playlist support',
                        inline: false
                    }
                );
                
                if (musicCommands.size > 0) {
                    musicEmbed.addFields({
                        name: `📋 All Music Commands (${musicCommands.size})`,
                        value: commandList.slice(0, 1000), // Limit to avoid embed size limits
                        inline: false
                    });
                }
                
                await interaction.reply({ embeds: [musicEmbed], ephemeral: true });
                return;
            }
            
            // Handle other categories
            const categoryCommands = client.commands.filter(cmd => cmd.category?.toLowerCase() === category);
            
            if (categoryCommands.size > 0) {
                const categoryEmbed = new EmbedBuilder()
                    .setColor('#0061ff')
                    .setTitle(`📁 ${category.charAt(0).toUpperCase() + category.slice(1)} Commands`)
                    .setDescription(`**Total:** ${categoryCommands.size} commands\n**Prefix:** \`${client.botInfo.prefix}\``)
                    .setFooter({ text: `Use ${client.botInfo.prefix}help for all commands` });
                
                const commandList = Array.from(categoryCommands.values()).map(cmd => {
                    const aliasesText = cmd.aliases && cmd.aliases.length > 0 
                        ? `\n**Aliases:** ${cmd.aliases.map(a => `\`${a}\``).join(', ')}`
                        : '';
                    return `**${client.botInfo.prefix}${cmd.name}** - ${cmd.description}${aliasesText}`;
                }).join('\n\n');
                
                categoryEmbed.setDescription(commandList.slice(0, 4000));
                
                await interaction.reply({ embeds: [categoryEmbed], ephemeral: true });
            } else {
                await interaction.reply({ content: 'No commands found in this category!', ephemeral: true });
            }
        });
        
        collector.on('end', () => {
            // Disable all buttons when collector ends
            const disabledRow = ActionRowBuilder.from(row);
            const disabledRow2 = ActionRowBuilder.from(row2);
            
            disabledRow.components.forEach(c => c.setDisabled(true));
            disabledRow2.components.forEach(c => {
                if (c.data.style !== 5) { // Don't disable link buttons (style 5)
                    c.setDisabled(true);
                }
            });
            
            helpMessage.edit({ components: [disabledRow, disabledRow2] }).catch(() => {});
        });
    }
};
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
                text: `DTEmpire v${client.botInfo.version} | Created by Jaggu762`,
                iconURL: client.user.displayAvatarURL() 
            });
        
        // Add each category as a field
        Object.keys(categories).sort().forEach(category => {
            const commands = categories[category];
            // Sort commands alphabetically by name
            commands.sort((a, b) => a.name.localeCompare(b.name));
            
            const commandList = commands.map(cmd => {
                const aliases = cmd.aliases && cmd.aliases.length > 0 
                    ? ` [${cmd.aliases.join(', ')}]` 
                    : '';
                return `\`${cmd.name}\`${aliases} - ${cmd.description || 'No description'}`;
            }).join('\n');
            
            // Split long command lists to avoid hitting Discord's field value limit (1024 chars)
            if (commandList.length > 1024) {
                const chunks = [];
                let currentChunk = '';
                commands.forEach(cmd => {
                    const aliases = cmd.aliases && cmd.aliases.length > 0 
                        ? ` [${cmd.aliases.join(', ')}]` 
                        : '';
                    const line = `\`${cmd.name}\`${aliases} - ${cmd.description || 'No description'}\n`;
                    if ((currentChunk + line).length > 1024) {
                        chunks.push(currentChunk);
                        currentChunk = line;
                    } else {
                        currentChunk += line;
                    }
                });
                if (currentChunk) chunks.push(currentChunk);
                
                chunks.forEach((chunk, i) => {
                    embed.addFields({
                        name: i === 0 ? `📁 ${category} (${commands.length})` : `📁 ${category} (continued)`,
                        value: chunk.trim(),
                        inline: false
                    });
                });
            } else {
                embed.addFields({
                    name: `📁 ${category} (${commands.length})`,
                    value: commandList,
                    inline: false
                });
            }
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
                    .setURL('https://discord.gg/r9QRUy6nrK')
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
                    .setThumbnail('https://i.imgur.com/R42YPkZ.png') // Music icon
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

function showMusicHelp(message, client) {
    const musicCommands = client.commands.filter(cmd => cmd.category?.toLowerCase() === 'music');
    
    const embed = new EmbedBuilder()
        .setColor('#1DB954')
        .setAuthor({ 
            name: 'DTEmpire V2 Music System', 
            iconURL: client.user.displayAvatarURL({ dynamic: true })
        })
        .setTitle('🎵 Music Commands & Features')
        .setDescription(`Powerful music bot with AI recommendations and smart features\n**Total Commands:** ${musicCommands.size} | **Prefix:** \`${client.botInfo.prefix}\``)
        .setThumbnail('https://i.imgur.com/R42YPkZ.png')
        .addFields(
            {
                name: '🎶 Basic Commands',
                value: [
                    `\`${client.botInfo.prefix}play <song/url>\` - Play a song`,
                    `\`${client.botInfo.prefix}pause\` - Pause playback`,
                    `\`${client.botInfo.prefix}resume\` - Resume playback`,
                    `\`${client.botInfo.prefix}skip\` - Skip current song`,
                    `\`${client.botInfo.prefix}stop\` - Stop and disconnect`,
                    `\`${client.botInfo.prefix}queue\` - Show queue`,
                    `\`${client.botInfo.prefix}nowplaying\` - Show current song`
                ].join('\n'),
                inline: false
            },
            {
                name: '⚙️ Advanced Commands',
                value: [
                    `\`${client.botInfo.prefix}volume <0-100>\` - Adjust volume`,
                    `\`${client.botInfo.prefix}loop [none|single|queue]\` - Set loop mode`,
                    `\`${client.botInfo.prefix}shuffle\` - Shuffle queue`,
                    `\`${client.botInfo.prefix}smartsearch <query>\` - Search with buttons`,
                    `\`${client.botInfo.prefix}recommend [mood]\` - AI suggestions`
                ].join('\n'),
                inline: false
            },
            {
                name: '🤖 AI Features',
                value: [
                    `\`${client.botInfo.prefix}djmode on/off\` - Toggle AI DJ`,
                    `\`${client.botInfo.prefix}djmode profile <gaming|chill|party|focus|edm|lofi>\` - Set mood`,
                    `\`${client.botInfo.prefix}recommend\` - Get AI song suggestions`
                ].join('\n'),
                inline: false
            },
            {
                name: '🎯 Music Channel (No Prefix)',
                value: [
                    `\`${client.botInfo.prefix}setmusicchannel #channel\` - Set music channel`,
                    'Then type commands without prefix:',
                    '• \`play <song>\` • \`pause\` • \`skip\`',
                    '• \`queue\` • \`volume 50\` • \`shuffle\`'
                ].join('\n'),
                inline: false
            },
            {
                name: '🌐 Supported Platforms',
                value: 'YouTube • Spotify • SoundCloud • Twitch • Bandcamp',
                inline: true
            },
            {
                name: '⚡ Features',
                value: 'High Quality • 24/7 • Playlists • Live Streams • AI DJ',
                inline: true
            }
        )
        .setFooter({ text: '🎧 Enjoy high-quality music with DTEmpire!' })
        .setTimestamp();
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setLabel('🎵 Play Music')
                .setCustomId('music_quick_play')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setLabel('🔎 Smart Search')
                .setCustomId('music_quick_search')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setLabel('🎧 DJ Mode')
                .setCustomId('music_quick_dj')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setURL('https://discord.gg/r9QRUy6nrK')
                .setLabel('Support')
                .setStyle(ButtonStyle.Link)
        );
    
    return message.reply({ embeds: [embed], components: [row] });
}
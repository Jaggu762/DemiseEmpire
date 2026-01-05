const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'music',
    description: 'Show music commands and features help',
    aliases: ['musichelp', 'mhelp'],
    category: 'music',
    
    async execute(message, args, client) {
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
                        '• `play <song>` • `pause` • `skip`',
                        '• `queue` • `volume 50` • `shuffle`'
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
            .setImage('https://i.imgur.com/exDGDGc.png')
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
                    .setURL('https://discord.gg/zGxRRE3MS9')
                    .setLabel('Support')
                    .setStyle(ButtonStyle.Link)
            );
        
        return message.channel.send({ embeds: [embed], components: [row] });
    }
};
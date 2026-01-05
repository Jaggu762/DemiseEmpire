const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'smartsearch',
    description: 'Show top 5 matches with buttons to pick',
    aliases: ['search', 'find', 'lookup'],
    category: 'music',
    async execute(message, args, client) {
        try {
            if (!client.playerManager || !client.playerManager.riffy) {
                return message.reply('❌ Music system not available.');
            }
            const query = args.join(' ').trim();
            if (!query) return message.reply('❌ Provide a search query.');

            const res = await client.playerManager.riffy.resolve({ query, requester: message.author });
            const tracks = (res?.tracks || []).slice(0, 5);
            if (!tracks.length) return message.reply('❌ No matches found.');

            // Prepare cache
            client.smartSearchCache = client.smartSearchCache || new Map();
            const token = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
            client.smartSearchCache.set(token, {
                guildId: message.guild.id,
                textChannel: message.channel.id,
                voiceChannel: message.member.voice.channel?.id || null,
                requester: message.author,
                choices: tracks
            });

            const embed = new EmbedBuilder()
                .setColor('#0061ff')
                .setTitle('🔎 Smart Search')
                .setDescription(tracks.map((t, i) => `**${i+1}.** [${t.info.title}](${t.info.uri}) — ${client.playerManager.formatTime(t.info.length)}\n${t.info.author || ''}`).join('\n\n'))
                .setFooter({ text: 'Pick a track below' })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`music_pick_1_${token}`).setLabel('1').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`music_pick_2_${token}`).setLabel('2').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`music_pick_3_${token}`).setLabel('3').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`music_pick_4_${token}`).setLabel('4').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`music_pick_5_${token}`).setLabel('5').setStyle(ButtonStyle.Secondary)
            );

            await message.channel.send({ embeds: [embed], components: [row] });
        } catch (e) {
            console.error('smartsearch command error:', e);
            return message.reply('❌ Failed to search.');
        }
    }
};

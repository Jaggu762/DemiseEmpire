const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'music',
    description: 'Show music commands help',
    aliases: ['musichelp', 'mhelp'],
    category: 'music',
    
    async execute(message, args, client) {
        const embed = new EmbedBuilder()
            .setColor('#0061ff')
            .setTitle('🎵 DTEmpire Music Commands')
            .setDescription('All available music commands:')
            .addFields(
                {
                    name: '🎶 Play Commands',
                    value: '`play [song/url]` - Play music\n`search [query]` - Search for songs',
                    inline: false
                },
                {
                    name: '🎵 Queue Management',
                    value: '`queue` - Show current queue\n`shuffle` - Shuffle the queue\n`loop` - Toggle loop mode\n`remove [position]` - Remove a song from queue',
                    inline: false
                },
                {
                    name: '⏯️ Playback Controls',
                    value: '`pause` - Pause music\n`resume` - Resume music\n`skip` - Skip current song\n`stop` - Stop music & clear queue',
                    inline: false
                },
                {
                    name: '🔊 Audio Settings',
                    value: '`volume [1-100]` - Adjust volume\n`bassboost` - Toggle bass boost\n`nightcore` - Toggle nightcore',
                    inline: false
                },
                {
                    name: '📊 Player Info',
                    value: '`nowplaying` - Show current song\n`lyrics` - Get song lyrics\n`save` - Save current song to DMs',
                    inline: false
                }
            )
            .setFooter({ text: 'Use . before each command | Example: .play hello adele' })
            .setTimestamp();

        await message.channel.send({ embeds: [embed] });
    }
};
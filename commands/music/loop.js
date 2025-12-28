const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'loop',
    description: 'Toggle or set loop mode (none|single|queue)',
    aliases: ['repeat'],
    category: 'music',
    async execute(message, args, client) {
        try {
            if (!client.playerManager || !client.playerManager.riffy) {
                return message.reply('❌ Music system not available.');
            }
            const player = client.playerManager.riffy.players.get(message.guild.id);
            if (!player) return message.reply('❌ No active player in this guild.');
            if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceChannel) {
                return message.reply('❌ You must be in the same voice channel.');
            }

            const modeArg = (args[0] || '').toLowerCase();
            let newMode;
            if (!modeArg) {
                // toggle between none and queue by default
                newMode = player.loop === 'none' ? 'queue' : 'none';
            } else if (['none','off','disable'].includes(modeArg)) {
                newMode = 'none';
            } else if (['single','song','track'].includes(modeArg)) {
                newMode = 'track';
            } else if (['queue','all','playlist'].includes(modeArg)) {
                newMode = 'queue';
            } else {
                return message.reply('❌ Invalid mode. Use: `loop [none|single|queue]`');
            }

            player.setLoop(newMode);
            const pretty = newMode === 'none' ? 'Off' : (newMode === 'track' ? 'Single' : 'Queue');
            const embed = new EmbedBuilder()
                .setColor('#0061ff')
                .setTitle('🔁 Loop Mode Updated')
                .setDescription(`Loop: **${pretty}**`)
                .setTimestamp();
            return message.channel.send({ embeds: [embed] });
        } catch (e) {
            console.error('Loop command error:', e);
            return message.reply('❌ Failed to update loop mode.');
        }
    }
};

// commands/music/stop.js
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'stop',
    description: 'Stop the music and clear the queue',
    aliases: ['leave', 'disconnect'],
    category: 'music',
    
    async execute(message, args, client, db) {
        try {
            const player = client.playerManager.riffy.players.get(message.guild.id);
            
            if (!player) {
                return message.reply('❌ No music is playing right now!');
            }
            
            if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceChannel) {
                return message.reply('❌ You need to be in the same voice channel!');
            }
            
            player.destroy();
            
            const embed = new EmbedBuilder()
                .setColor('#0061ff')
                .setTitle('⏹️ Stopped')
                .setDescription('Stopped the music and cleared the queue!')
                .setTimestamp();
            
            await message.channel.send({ embeds: [embed] });
            
        } catch (error) {
            console.error('Stop command error:', error);
            message.reply('❌ An error occurred while trying to stop the music.');
        }
    }
};
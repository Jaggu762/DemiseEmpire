// commands/music/pause.js
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'pause',
    description: 'Pause the current song',
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
            
            if (player.paused) {
                return message.reply('❌ The music is already paused!');
            }
            
            player.pause(true);
            
            const embed = new EmbedBuilder()
                .setColor('#0061ff')
                .setTitle('⏸️ Paused')
                .setDescription('Paused the current song!')
                .setTimestamp();
            
            await message.channel.send({ embeds: [embed] });
            
        } catch (error) {
            console.error('Pause command error:', error);
            message.reply('❌ An error occurred while trying to pause the music.');
        }
    }
};
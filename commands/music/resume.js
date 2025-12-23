// commands/music/resume.js
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'resume',
    description: 'Resume the paused song',
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
            
            if (!player.paused) {
                return message.reply('❌ The music is already playing!');
            }
            
            player.pause(false);
            
            const embed = new EmbedBuilder()
                .setColor('#0061ff')
                .setTitle('▶️ Resumed')
                .setDescription('Resumed the current song!')
                .setTimestamp();
            
            await message.channel.send({ embeds: [embed] });
            
        } catch (error) {
            console.error('Resume command error:', error);
            message.reply('❌ An error occurred while trying to resume the music.');
        }
    }
};
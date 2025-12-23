// commands/music/skip.js
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'skip',
    description: 'Skip the current song',
    aliases: ['s', 'next'],
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
            
            if (!player.queue.length) {
                return message.reply('❌ No more songs in the queue to skip to!');
            }
            
            player.stop();
            
            const embed = new EmbedBuilder()
                .setColor('#0061ff')
                .setTitle('⏭️ Skipped')
                .setDescription('Skipped to the next song!')
                .setTimestamp();
            
            await message.channel.send({ embeds: [embed] });
            
        } catch (error) {
            console.error('Skip command error:', error);
            message.reply('❌ An error occurred while trying to skip the song.');
        }
    }
};
// commands/music/volume.js
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'volume',
    description: 'Adjust the music volume',
    aliases: ['vol'],
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
            
            if (!args[0]) {
                const embed = new EmbedBuilder()
                    .setColor('#0061ff')
                    .setTitle('🔊 Current Volume')
                    .setDescription(`Current volume is **${player.volume}%**`)
                    .setTimestamp();
                
                return message.channel.send({ embeds: [embed] });
            }
            
            let volume = parseInt(args[0]);
            if (isNaN(volume)) {
                return message.reply('❌ Please enter a numeric volume.');
            }
            // Clamp to 0-100 for stability
            volume = Math.max(0, Math.min(100, volume));
            try {
                player.setVolume(volume);
            } catch (e) {
                // Some nodes expect 0-150; retry if applicable
                try { player.setVolume(Math.max(0, Math.min(150, volume))); } catch {}
            }
            
            const embed = new EmbedBuilder()
                .setColor('#0061ff')
                .setTitle('🔊 Volume Adjusted')
                .setDescription(`Volume set to **${volume}%**`)
                .setTimestamp();
            
            await message.channel.send({ embeds: [embed] });
            
        } catch (error) {
            console.error('Volume command error:', error);
            message.reply('❌ An error occurred while trying to adjust the volume.');
        }
    }
};
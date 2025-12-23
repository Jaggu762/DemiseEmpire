// commands/music/nowplaying.js - FIXED VERSION
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'nowplaying',
    description: 'Show information about the current song',
    aliases: ['np', 'current', 'now'],
    category: 'music',
    
    async execute(message, args, client, db) {
        try {
            console.log(`[NOWPLAYING] Command called by ${message.author.tag} in ${message.guild.id}`);
            
            // Check if player manager exists
            if (!client.playerManager) {
                console.log('[NOWPLAYING] Player manager not found');
                return message.reply('❌ Music system is not initialized.');
            }
            
            // Check if Riffy exists
            if (!client.playerManager.riffy) {
                console.log('[NOWPLAYING] Riffy not found');
                return message.reply('❌ Music player is not available.');
            }
            
            const player = client.playerManager.riffy.players.get(message.guild.id);
            
            console.log(`[NOWPLAYING] Player found: ${!!player}`);
            console.log(`[NOWPLAYING] Player playing: ${player?.playing}`);
            console.log(`[NOWPLAYING] Player paused: ${player?.paused}`);
            
            if (!player) {
                console.log('[NOWPLAYING] No player found');
                return message.reply('❌ No music is playing right now!');
            }
            
            // Check if player is actually playing audio
            if (!player.playing || player.paused) {
                console.log('[NOWPLAYING] Player not playing or paused');
                return message.reply('❌ No music is playing right now!');
            }
            
            // SAFE WAY TO GET TRACK INFO - don't stringify the whole player
            let currentTrack = null;
            let trackTitle = 'Unknown Track';
            let trackAuthor = 'Unknown Artist';
            let trackUri = '#';
            let trackDuration = 0;
            let requester = 'Unknown';
            let thumbnail = null;
            
            // Try to get track info from Riffy events
            try {
                // Check if track info is stored in player manager
                const npMessage = client.playerManager.nowPlayingMessages.get(message.guild.id);
                if (npMessage) {
                    console.log('[NOWPLAYING] Found stored now playing message');
                    // Track info might be in the stored message
                }
                
                // Check player.queue.current
                if (player.queue.current) {
                    currentTrack = player.queue.current;
                    console.log('[NOWPLAYING] Found track in player.queue.current');
                }
                // Check if Riffy stores it differently
                else if (player.currentTrack) {
                    currentTrack = player.currentTrack;
                    console.log('[NOWPLAYING] Found track in player.currentTrack');
                }
                // Check player's internal data (safe access)
                else if (player._currentTrack) {
                    currentTrack = player._currentTrack;
                    console.log('[NOWPLAYING] Found track in player._currentTrack');
                }
                
                // Extract track info safely
                if (currentTrack) {
                    if (currentTrack.info) {
                        trackTitle = currentTrack.info.title || 'Unknown Track';
                        trackAuthor = currentTrack.info.author || 'Unknown Artist';
                        trackUri = currentTrack.info.uri || '#';
                        trackDuration = currentTrack.info.length || 0;
                        thumbnail = currentTrack.info.thumbnail || null;
                        
                        if (currentTrack.info.requester) {
                            requester = currentTrack.info.requester.tag || 'Unknown';
                        }
                    }
                } else {
                    // Try to get from Riffy's trackStart event data
                    console.log('[NOWPLAYING] No current track found, checking Riffy events...');
                    // Riffy should have emitted trackStart with track info
                }
                
            } catch (infoError) {
                console.error('[NOWPLAYING] Error getting track info:', infoError.message);
            }
            
            console.log('[NOWPLAYING] Track info - Title:', trackTitle, 'Duration:', trackDuration);
            
            // Get current position
            const currentPosition = player.position || 0;
            
            // Create progress bar
            let progressBar = '';
            let progressText = '';
            
            if (trackDuration > 0) {
                const percentage = Math.min(1, currentPosition / trackDuration);
                const barLength = 15;
                const progress = Math.round(percentage * barLength);
                
                let bar = '';
                for (let i = 0; i < barLength; i++) {
                    if (i === progress) {
                        bar += '🔘';
                    } else {
                        bar += '▬';
                    }
                }
                progressBar = bar;
                
                // Format time
                const formatTime = (ms) => {
                    if (!ms || ms < 0) return '0:00';
                    const totalSeconds = Math.floor(ms / 1000);
                    const seconds = totalSeconds % 60;
                    const minutes = Math.floor(totalSeconds / 60) % 60;
                    
                    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
                };
                
                progressText = `\`${formatTime(currentPosition)} / ${formatTime(trackDuration)}\`\n${progressBar}`;
            }
            
            // Create embed
            const embed = new EmbedBuilder()
                .setColor('#0061ff')
                .setTitle('🎵 Now Playing')
                .setDescription(`**[${trackTitle}](${trackUri})**`)
                .addFields(
                    { 
                        name: '👤 Artist', 
                        value: trackAuthor, 
                        inline: true 
                    },
                    { 
                        name: '🕒 Duration', 
                        value: formatDuration(trackDuration), 
                        inline: true 
                    },
                    { 
                        name: '📤 Requested by', 
                        value: requester, 
                        inline: true 
                    }
                );
            
            // Add progress bar if available
            if (progressText) {
                embed.addFields({
                    name: '📊 Progress',
                    value: progressText,
                    inline: false
                });
            }
            
            // Add thumbnail if available
            if (thumbnail) {
                embed.setThumbnail(thumbnail);
            }
            
            embed.setFooter({ text: 'DTEmpire Music System' })
                 .setTimestamp();

            await message.channel.send({ embeds: [embed] });
            
        } catch (error) {
            console.error('NowPlaying command error:', error.message);
            console.error('Error stack:', error.stack);
            return message.reply('❌ Failed to get current song info.');
        }
    }
};

// Helper function to format duration
function formatDuration(ms) {
    if (!ms || ms < 0) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}
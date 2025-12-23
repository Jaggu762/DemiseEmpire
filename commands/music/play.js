// commands/music/play.js - UPDATED VERSION WITH FIX
const { EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
    name: 'play',
    description: 'Play music from YouTube, Spotify, etc.',
    aliases: ['p'],
    category: 'music',
    
    async execute(message, args, client, db) {
        try {
            console.log(`[PLAY] Command called by ${message.author.tag}: ${args.join(' ')}`);
            
            if (!message.member.voice.channel) {
                console.log('[PLAY] User not in voice channel');
                return message.reply('❌ You need to be in a voice channel to play music!');
            }

            if (!args.length) {
                console.log('[PLAY] No query provided');
                return message.reply('❌ Please provide a song name or URL!');
            }

            const query = args.join(' ');
            console.log(`[PLAY] Query: ${query}`);
            
            // Check if player manager and Riffy are available
            if (!client.playerManager || !client.playerManager.riffy) {
                console.log('[PLAY] Music system not available');
                return message.reply('❌ Music system is not available right now. Please try again later.');
            }

            console.log('[PLAY] Riffy is available, getting/creating player...');
            
            // Get existing player or create new one
            let player = client.playerManager.riffy.players.get(message.guild.id);
            
            if (!player) {
                console.log('[PLAY] Creating new player...');
                // Create new player connection
                player = client.playerManager.riffy.createConnection({
                    guildId: message.guild.id,
                    voiceChannel: message.member.voice.channel.id,
                    textChannel: message.channel.id,
                    deaf: true,
                    selfDeaf: true
                });
                
                console.log(`[PLAY] Player created: ${player.guildId}`);
                
                // Connect to voice channel
                try {
                    await player.connect();
                    console.log(`✅ Connected to voice channel in guild ${message.guild.id}`);
                } catch (connectError) {
                    console.error('[PLAY] Voice connect error:', connectError);
                    return message.reply('❌ Failed to connect to voice channel. Please try again.');
                }
            } else {
                console.log(`[PLAY] Player already exists in guild ${message.guild.id}`);
                // If player exists but not in same voice channel, move to new channel
                if (player.voiceChannel !== message.member.voice.channel.id) {
                    try {
                        await player.switchChannel(message.member.voice.channel.id);
                        console.log(`✅ Moved to new voice channel in guild ${message.guild.id}`);
                    } catch (moveError) {
                        console.error('[PLAY] Move channel error:', moveError);
                        return message.reply('❌ Failed to move to your voice channel. Make sure I have permission to join.');
                    }
                }
            }

            console.log('[PLAY] Resolving query...');
            // Resolve the query
            const resolve = await client.playerManager.riffy.resolve({ 
                query, 
                requester: message.author 
            }).catch(err => {
                console.error('[PLAY] Resolve error:', err);
                throw new Error(`Failed to resolve query: ${err.message}`);
            });

            console.log(`[PLAY] Resolve result - loadType: ${resolve.loadType}, tracks: ${resolve.tracks?.length}`);
            
            const { loadType, tracks, playlistInfo } = resolve;

            if (loadType === "LOAD_FAILED" || loadType === "NO_MATCHES" || !tracks || tracks.length === 0) {
                console.log('[PLAY] No results found');
                return message.reply('❌ No results found for your query!');
            }

            let addedCount = 0;
            let playlistName = '';
            const wasPlaying = player.playing && !player.paused;
            const hadQueue = player.queue.length > 0;
            
            if (loadType === "playlist") {
                console.log(`[PLAY] Adding playlist: ${playlistInfo.name} with ${tracks.length} tracks`);
                playlistName = playlistInfo.name;
                
                // Add all tracks from playlist
                for (const track of tracks) {
                    try {
                        track.info.requester = message.author;
                        player.queue.add(track);
                        addedCount++;
                    } catch (trackError) {
                        console.error('[PLAY] Error adding track:', trackError);
                    }
                }

                const embed = new EmbedBuilder()
                    .setColor('#0061ff')
                    .setTitle('📁 Playlist Added')
                    .setDescription(`**${playlistName}**`)
                    .addFields(
                        { name: 'Tracks Added', value: `${addedCount} songs`, inline: true },
                        { name: 'Duration', value: client.playerManager.formatTime(
                            tracks.reduce((total, track) => total + (track.info.length || 0), 0)
                        ), inline: true },
                        { name: 'Position in Queue', value: player.queue.length === addedCount && !wasPlaying ? 'Now Playing' : `Starting at #${hadQueue ? player.queue.length - addedCount + 1 : 1}`, inline: true }
                    )
                    .setFooter({ text: `Requested by ${message.author.tag}` })
                    .setTimestamp();

                await message.channel.send({ embeds: [embed] });
                
            } else if (loadType === "search" || loadType === "track") {
                console.log(`[PLAY] Adding single track: ${tracks[0].info.title}`);
                // Add single track
                const track = tracks[0];
                track.info.requester = message.author;
                player.queue.add(track);
                addedCount = 1;

                const embed = new EmbedBuilder()
                    .setColor('#0061ff')
                    .setTitle('🎵 Added to Queue')
                    .setDescription(`**[${track.info.title}](${track.info.uri})**`)
                    .addFields(
                        { name: 'Artist', value: track.info.author || 'Unknown', inline: true },
                        { name: 'Duration', value: client.playerManager.formatTime(track.info.length), inline: true },
                        { name: 'Position', value: player.queue.length === 1 && !wasPlaying ? 'Now Playing' : `#${player.queue.length}`, inline: true }
                    )
                    .setThumbnail(track.info.thumbnail || null)
                    .setFooter({ text: `Requested by ${message.author.tag}` })
                    .setTimestamp();

                await message.channel.send({ embeds: [embed] });
            }

            // ========== FIX: Handle current track when adding to playing queue ==========
            // If player is playing but has no current track, try to get it from Riffy
            if (player.playing && !player.paused && !player.queue.current && player.queue.length > 0) {
                console.log('[PLAY] Player is playing but queue.current is null, trying to fix...');
                
                try {
                    // Try to get the first track from Riffy's internal queue
                    const firstTrack = player.queue[0];
                    if (firstTrack) {
                        console.log('[PLAY] Found first track in queue:', firstTrack.info.title);
                        
                        // Try to manually set current track for nowplaying command
                        // This is a workaround for Riffy's current track tracking
                        player.currentTrack = firstTrack;
                        
                        // Update now playing message if available
                        const npMessage = client.playerManager.nowPlayingMessages.get(message.guild.id);
                        if (npMessage && client.playerManager.updateNowPlayingProgress) {
                            setTimeout(() => {
                                client.playerManager.updateNowPlayingProgress(message.guild.id);
                            }, 1000);
                        }
                    }
                } catch (trackError) {
                    console.error('[PLAY] Error fixing current track:', trackError);
                }
            }

            // Start playing if not already
            if (!player.playing && !player.paused) {
                console.log('[PLAY] Starting playback...');
                try {
                    await player.play();
                    console.log(`✅ Started playing in guild ${message.guild.id}`);
                    
                    // Wait a moment for Riffy to set current track
                    setTimeout(async () => {
                        // Send now playing message
                        let currentTrack = player.queue.current;
                        
                        // If still no current track, use first track in queue
                        if (!currentTrack && player.queue.length > 0) {
                            currentTrack = player.queue[0];
                            console.log('[PLAY] Using first track in queue as current:', currentTrack.info.title);
                        }
                        
                        if (currentTrack) {
                            const nowPlayingEmbed = client.playerManager.createNowPlayingEmbed(currentTrack, player);
                            
                            const nowPlayingMessage = await message.channel.send({ 
                                embeds: [nowPlayingEmbed],
                                components: [client.playerManager.createMusicButtons()] 
                            }).catch(err => {
                                console.error('[PLAY] Error sending now playing message:', err);
                                return null;
                            });
                            
                            // Store the message for progress updates
                            if (nowPlayingMessage) {
                                client.playerManager.nowPlayingMessages.set(message.guild.id, nowPlayingMessage);
                            }
                            
                            // Start progress updates
                            setTimeout(() => {
                                if (player && player.playing && currentTrack) {
                                    client.playerManager.startProgressUpdates(player, currentTrack);
                                }
                            }, 1000);
                        }
                    }, 500);
                    
                } catch (playError) {
                    console.error('[PLAY] Play error:', playError);
                    message.reply('❌ Failed to start playback. Please try again.');
                }
            } else {
                console.log(`[PLAY] Player already playing or paused: playing=${player.playing}, paused=${player.paused}`);
                console.log(`[PLAY] Queue length: ${player.queue.length}`);
                console.log(`[PLAY] Current track: ${player.queue.current?.info?.title || 'None'}`);
                
                // If we added tracks and player is already playing, show queue info
                if (addedCount > 0) {
                    const queueLength = player.queue.length;
                    
                    // Try to get current playing track
                    let playingTrack = player.queue.current;
                    if (!playingTrack && player.queue.length > 0) {
                        playingTrack = player.queue[0];
                    }
                    
                    if (playingTrack) {
                        const statusEmbed = new EmbedBuilder()
                            .setColor('#0061ff')
                            .setTitle('🎵 Player Status')
                            .setDescription(`Player is currently ${player.paused ? 'paused' : 'playing'}`)
                            .addFields(
                                { name: 'Now Playing', value: `**${playingTrack.info.title}**`, inline: false },
                                { name: 'Queue Length', value: `${queueLength} tracks`, inline: true },
                                { name: 'Tracks Added', value: `${addedCount} songs`, inline: true },
                                { name: 'Position Added', value: `#${queueLength - addedCount + 1} to #${queueLength}`, inline: true }
                            )
                            .setFooter({ text: 'Use .queue to see all songs | .nowplaying for current track' })
                            .setTimestamp();
                        
                        await message.channel.send({ embeds: [statusEmbed] });
                    }
                }
            }

        } catch (error) {
            logger.error(`Play command error: ${error.message}`);
            console.error('[PLAY] Full play error:', error);
            
            let errorMessage = '❌ An error occurred while trying to play music.';
            
            if (error.message.includes('No nodes connected')) {
                errorMessage = '❌ Lavalink node is not connected. Please contact the bot owner.';
            } else if (error.message.includes('initialize')) {
                errorMessage = '❌ Music system is still starting up. Please try again in a few seconds.';
            } else if (error.message.includes('Player connection is not initiated')) {
                errorMessage = '❌ Failed to establish voice connection. Please make sure the bot has proper permissions.';
            } else if (error.message.includes('Failed to resolve query')) {
                errorMessage = '❌ Failed to process your request. The service might be down or the URL is invalid.';
            } else if (error.message.includes('Spotify')) {
                errorMessage = '❌ Spotify integration error. Please try a YouTube link or song name instead.';
            } else if (error.message.includes('429')) {
                errorMessage = '❌ Rate limited. Please wait a moment before trying again.';
            }
            
            // Try to clean up broken player
            try {
                const player = client.playerManager?.riffy?.players.get(message.guild.id);
                if (player && (!player.playing || player.error)) {
                    player.destroy();
                }
            } catch (cleanupError) {
                console.error('[PLAY] Cleanup error:', cleanupError);
            }
            
            return message.reply(errorMessage);
        }
    }
};

// Helper function to format duration (keep as backup)
function formatTime(ms) {
    if (!ms || ms < 0 || typeof ms !== 'number') return '0:00';
    
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
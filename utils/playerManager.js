// utils/playerManager.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Riffy } = require('riffy');
const { Spotify } = require('riffy-spotify');
const path = require('path');
const logger = require('./logger');

class PlayerManager {
    constructor(client) {
        this.client = client;
        this.config = null;
        this.riffy = null;
        
        // Add progress tracking
        this.progressIntervals = new Map(); // Store intervals for each guild
        this.nowPlayingMessages = new Map(); // Store last "now playing" message for updates
        this.lastProgressUpdate = new Map(); // Track last progress update time
        
        this.init();
    }

    async init() {
        try {
            logger.info('🎵 Initializing Music Player Manager with Riffy...');
            
            // Load config
            try {
                const configPath = path.resolve(__dirname, '..', 'config.json');
                this.config = require(configPath);
                console.log('✅ Config loaded');
            } catch (configError) {
                console.error('❌ Failed to load config:', configError.message);
                return;
            }
            
            // Check if music config exists
            if (!this.config.music || !this.config.music.nodes || this.config.music.nodes.length === 0) {
                console.error('❌ No music nodes configured');
                return;
            }
            
            // Convert nodes to Riffy format
            const nodes = this.config.music.nodes.map(node => ({
                host: node.host || node.hostname || 'localhost',
                port: node.port || 2333,
                password: node.password || 'youshallnotpass',
                secure: node.secure || false,
                identifier: node.name || node.identifier || 'Main Node'
            }));
            
            console.log('🎵 Music nodes:', nodes);
            
            // Initialize Spotify plugin if credentials are available
            const plugins = [];
            if (this.config.music.spotify && 
                this.config.music.spotify.clientId && 
                this.config.music.spotify.clientSecret) {
                try {
                    const spotify = new Spotify({
                        clientId: this.config.music.spotify.clientId,
                        clientSecret: this.config.music.spotify.clientSecret
                    });
                    plugins.push(spotify);
                    console.log('✅ Spotify plugin loaded');
                } catch (spotifyError) {
                    console.error('❌ Failed to load Spotify plugin:', spotifyError.message);
                }
            }
            
            // Initialize Riffy
            this.riffy = new Riffy(this.client, nodes, {
                send: (payload) => {
                    const guild = this.client.guilds.cache.get(payload.d.guild_id);
                    if (guild) guild.shard.send(payload);
                },
                defaultSearchPlatform: this.config.music.defaultSearchPlatform || 'ytmsearch',
                restVersion: 'v4',
                plugins: plugins
            });
            
            // Initialize Riffy with client user ID (called in ready event)
            
            // Set up event listeners
            this.setupRiffyEvents();
            
            console.log('✅ Riffy initialized');
            logger.success('✅ Music Player Manager initialized');
            
        } catch (error) {
            logger.error(`❌ Failed to initialize music player: ${error.message}`);
            console.error('Full error:', error);
        }
    }

    setupRiffyEvents() {
        if (!this.riffy) return;

        // Node events
        this.riffy.on("nodeConnect", (node) => {
            console.log(`✅ Node connected: ${node.identifier}`);
            logger.success(`✅ Lavalink Node Connected: ${node.identifier}`);
        });

        this.riffy.on("nodeError", (node, error) => {
            console.error(`❌ Node error: ${node.identifier} - ${error.message}`);
            logger.error(`❌ Lavalink Node Error: ${node.identifier} - ${error}`);
        });

        this.riffy.on("nodeDisconnect", (node) => {
            console.log(`⚠️ Node disconnected: ${node.identifier}`);
            logger.warn(`⚠️ Lavalink Node Disconnected: ${node.identifier}`);
        });

        // Player events
        this.riffy.on("playerCreate", (player) => {
            console.log(`🎵 Player created for guild ${player.guildId}`);
        });

        this.riffy.on("playerDestroy", (player) => {
            console.log(`🎵 Player destroyed for guild ${player.guildId}`);
            // Clean up progress tracking
            this.stopProgressUpdates(player.guildId);
            this.nowPlayingMessages.delete(player.guildId);
            this.lastProgressUpdate.delete(player.guildId);
        });

        // Track events
        // In playerManager.js, inside setupRiffyEvents():
        this.riffy.on("trackStart", async (player, track) => {
            console.log(`🎵 Track started in ${player.guildId}: ${track.info.title}`);
            logger.music('track_start', `Playing "${track.info.title}" in ${player.guildId}`);

            // Store the current track in player for easy access
            player.currentTrack = track;
            player._currentTrack = track; // Backup property

            // Clean up any previous progress interval
            this.stopProgressUpdates(player.guildId);

            // Send now playing message
            const message = await this.sendNowPlayingMessage(player, track);

            // Store the message for updates
            if (message) {
                this.nowPlayingMessages.set(player.guildId, message);
            }

            // Store track info separately for nowplaying command
            this.trackCache = this.trackCache || new Map();
            this.trackCache.set(player.guildId, {
                title: track.info.title,
                author: track.info.author,
                uri: track.info.uri,
                duration: track.info.length,
                thumbnail: track.info.thumbnail,
                requester: track.info.requester
            });

            // Start progress updates
            this.startProgressUpdates(player, track);
        });

        this.riffy.on("trackEnd", (player, track) => {
            console.log(`🎵 Track ended in ${player.guildId}: ${track.info.title}`);
            
            // Stop progress updates
            this.stopProgressUpdates(player.guildId);
        });

        this.riffy.on("queueEnd", (player) => {
            console.log(`🎵 Queue ended in ${player.guildId}`);
            logger.music('queue_end', `Queue ended in ${player.guildId}`);
            
            // Stop progress updates
            this.stopProgressUpdates(player.guildId);
            
            // Optionally send queue end message
            this.sendQueueEndMessage(player);
        });

        this.riffy.on("playerError", (player, error) => {
            console.error(`❌ Player error in ${player.guildId}: ${error.message}`);
            logger.error(`❌ Player Error: ${player.guildId} - ${error}`);
            
            // Stop progress updates on error
            this.stopProgressUpdates(player.guildId);
        });
    }

    // 🎯 NEW: Start progress updates for a track
    startProgressUpdates(player, track) {
        const guildId = player.guildId;
        
        // Clear any existing interval
        this.stopProgressUpdates(guildId);
        
        console.log(`🔄 Starting progress updates for guild ${guildId}`);
        
        // Create new interval to update progress every 5 seconds
        const interval = setInterval(async () => {
            try {
                if (!player || !player.playing || player.paused || !track) {
                    return;
                }
                
                // Get current position from player
                // Note: Riffy should update player.position automatically
                // If not, we'll estimate based on time
                const message = this.nowPlayingMessages.get(guildId);
                
                if (message) {
                    try {
                        // Edit the message with updated progress
                        const embed = this.createNowPlayingEmbed(track, player);
                        
                        // Fetch the message to edit it
                        const channel = await this.client.channels.fetch(player.textChannel).catch(() => null);
                        if (channel) {
                            const msg = await channel.messages.fetch(message.id).catch(() => null);
                            if (msg) {
                                await msg.edit({ 
                                    embeds: [embed],
                                    components: [this.createMusicButtons()] 
                                });
                            }
                        }
                    } catch (editError) {
                        console.log(`Could not update progress message: ${editError.message}`);
                    }
                }
                
            } catch (error) {
                console.error(`Progress update error for guild ${guildId}:`, error);
            }
        }, 5000); // Update every 5 seconds
        
        this.progressIntervals.set(guildId, interval);
    }

    // 🎯 NEW: Stop progress updates
    stopProgressUpdates(guildId) {
        const interval = this.progressIntervals.get(guildId);
        if (interval) {
            clearInterval(interval);
            this.progressIntervals.delete(guildId);
            console.log(`🛑 Stopped progress updates for guild ${guildId}`);
        }
    }

    // 🎯 NEW: Manual progress update (call this from commands)
    async updateNowPlayingProgress(guildId) {
        const player = this.riffy?.players.get(guildId);
        const message = this.nowPlayingMessages.get(guildId);
        
        if (player && player.queue.current && message) {
            try {
                const embed = this.createNowPlayingEmbed(player.queue.current, player);
                const channel = await this.client.channels.fetch(player.textChannel).catch(() => null);
                
                if (channel) {
                    const msg = await channel.messages.fetch(message.id).catch(() => null);
                    if (msg) {
                        await msg.edit({ 
                            embeds: [embed],
                            components: [this.createMusicButtons()] 
                        });
                        return true;
                    }
                }
            } catch (error) {
                console.error(`Manual progress update error:`, error);
            }
        }
        return false;
    }

    // 🎯 UPDATED: Now Playing Message with Progress
    async sendNowPlayingMessage(player, track) {
        try {
            const channel = this.client.channels.cache.get(player.textChannel);
            if (!channel) return null;
            
            const embed = this.createNowPlayingEmbed(track, player);
            
            const message = await channel.send({ 
                embeds: [embed],
                components: [this.createMusicButtons()] 
            }).catch(error => {
                console.error('Error sending now playing message:', error);
                return null;
            });
            
            return message;
        } catch (error) {
            console.error('Error in sendNowPlayingMessage:', error);
            return null;
        }
    }

    sendQueueEndMessage(player) {
        try {
            const channel = this.client.channels.cache.get(player.textChannel);
            if (!channel) return;
            
            const embed = new EmbedBuilder()
                .setColor('#0061ff')
                .setTitle('🎵 Queue Ended')
                .setDescription('The queue has ended. Add more songs with `.play`!')
                .setTimestamp();
            
            channel.send({ embeds: [embed] }).catch(console.error);
        } catch (error) {
            console.error('Error sending queue end message:', error);
        }
    }

    // Helper methods for commands
    createMusicButtons() {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('music_pause_resume')
                .setLabel('⏯️ Pause/Resume')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('music_skip')
                .setLabel('⏭️ Skip')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('music_stop')
                .setLabel('⏹️ Stop')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('music_shuffle')
                .setLabel('🔀 Shuffle')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('music_loop')
                .setLabel('🔁 Loop')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    // 🎯 UPDATED: Create Now Playing Embed with Progress Bar
    createNowPlayingEmbed(track, player) {
        // Get current position (default to 0 if not available)
        const currentPosition = player.position || 0;
        const totalDuration = track.info.length || 1;
        const progressBar = this.createProgressBar(currentPosition, totalDuration);
        
        const embed = new EmbedBuilder()
            .setColor(this.config?.bot?.embedColor || '#0061ff')
            .setTitle('🎵 Now Playing')
            .setDescription(`**[${track.info.title}](${track.info.uri})**`)
            .addFields(
                { name: '👤 Artist', value: track.info.author || 'Unknown', inline: true },
                { name: '🕒 Duration', value: this.formatTime(totalDuration), inline: true },
                { name: '📤 Requested by', value: track.info.requester?.tag || 'Unknown', inline: true },
                { name: '📊 Progress', value: progressBar, inline: false }
            )
            .setThumbnail(track.info.thumbnail || null)
            .setFooter({ 
                text: `Position: ${this.formatTime(currentPosition)} / ${this.formatTime(totalDuration)} • DTEmpire V2 Music System` 
            })
            .setTimestamp();

        return embed;
    }

    // 🎯 UPDATED: Create Progress Bar with current time
    createProgressBar(current, total, length = 15) {
        if (!total || total <= 0 || !current || current < 0) {
            return `\`0:00 / ${this.formatTime(total || 0)}\`\n${'▬'.repeat(length)}`;
        }
        
        const percentage = Math.min(1, current / total);
        const progress = Math.round(percentage * length);
        
        let bar = '';
        for (let i = 0; i < length; i++) {
            if (i === progress) {
                bar += '🔘';
            } else {
                bar += '▬';
            }
        }
        
        const currentTime = this.formatTime(current);
        const totalTime = this.formatTime(total);
        
        return `\`${currentTime} / ${totalTime}\`\n${bar}`;
    }

    createQueueEmbed(player, currentPage = 1, tracksPerPage = 10) {
        const queue = player.queue;
        const currentTrack = player.queue.current;
        
        if (queue.length === 0 && !currentTrack) {
            return new EmbedBuilder()
                .setColor(this.config?.bot?.embedColor || '#0061ff')
                .setTitle('📋 Music Queue')
                .setDescription('The queue is empty!')
                .setFooter({ text: 'DTEmpire V2 Music System' })
                .setTimestamp();
        }

        const totalPages = Math.ceil(queue.length / tracksPerPage);
        const startIndex = (currentPage - 1) * tracksPerPage;
        const endIndex = startIndex + tracksPerPage;
        const pageTracks = queue.slice(startIndex, endIndex);

        let description = '';
        
        if (currentTrack) {
            description += `**🎵 Now Playing:** [${currentTrack.info.title}](${currentTrack.info.uri}) - ${this.formatTime(currentTrack.info.length)}\n`;
            description += `Requested by: ${currentTrack.info.requester?.tag || 'Unknown'}\n\n`;
        }

        description += `**📋 Queue (${queue.length} tracks):**\n`;

        if (pageTracks.length === 0 && currentPage > 1) {
            description += 'No tracks on this page\n';
        } else if (pageTracks.length === 0) {
            description += 'No tracks in queue\n';
        } else {
            pageTracks.forEach((track, index) => {
                const position = startIndex + index + 1;
                description += `**${position}.** [${track.info.title}](${track.info.uri}) - ${this.formatTime(track.info.length)}\n`;
                description += `   ↳ Requested by: ${track.info.requester?.tag || 'Unknown'}\n`;
            });
        }

        const embed = new EmbedBuilder()
            .setColor(this.config?.bot?.embedColor || '#0061ff')
            .setTitle('📋 Music Queue')
            .setDescription(description)
            .setFooter({ 
                text: `Page ${currentPage}/${Math.max(1, totalPages)} • Total duration: ${this.formatTime(this.getQueueDuration(player))}` 
            })
            .setTimestamp();

        return embed;
    }

    formatTime(ms) {
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

    getQueueDuration(player) {
        const queue = player.queue;
        return queue.reduce((total, track) => total + (track.info.length || 0), 0);
    }

    // Cleanup
    cleanup() {
        // Stop all progress intervals
        for (const [guildId, interval] of this.progressIntervals) {
            clearInterval(interval);
        }
        this.progressIntervals.clear();
        this.nowPlayingMessages.clear();
        this.lastProgressUpdate.clear();
        
        // Destroy all players
        if (this.riffy && this.riffy.players) {
            for (const [guildId, player] of this.riffy.players) {
                try {
                    player.destroy();
                } catch (error) {
                    console.error(`Error destroying player for ${guildId}: ${error.message}`);
                }
            }
        }
        console.log('✅ Music Player Manager cleaned up');
    }
}

module.exports = PlayerManager;
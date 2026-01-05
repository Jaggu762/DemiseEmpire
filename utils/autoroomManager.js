// utils/autoroomManager.js
const { ChannelType, PermissionsBitField } = require('discord.js');

class AutoRoomManager {
    constructor(client, db) {
        this.client = client;
        this.db = db;
        this.activeRooms = new Map(); // guildId -> [room objects]
        
        this.initialize();
    }
    
    initialize() {
        // Listen for voice state updates
        this.client.on('voiceStateUpdate', async (oldState, newState) => {
            await this.handleVoiceStateUpdate(oldState, newState);
        });
        
        console.log('✅ AutoRoom Manager initialized');
    }
    
    async handleVoiceStateUpdate(oldState, newState) {
        try {
            const guildId = newState.guild.id;
            const config = await this.db.getGuildConfig(guildId);
            
            if (!config.autoroom_creator) return;
            
            const creatorChannelId = config.autoroom_creator;
            
            // User joined the creator channel
            if (!oldState.channelId && newState.channelId === creatorChannelId) {
                await this.createPersonalRoom(newState.member, config);
            }
            
            // Check if user left an AutoRoom
            if (oldState.channelId && oldState.channelId !== creatorChannelId) {
                await this.checkAndDeleteIfEmpty(oldState.channelId, guildId);
            }
            
            // Also check if user moved from one AutoRoom to another
            if (oldState.channelId && newState.channelId && 
                oldState.channelId !== creatorChannelId && 
                newState.channelId !== creatorChannelId) {
                await this.checkAndDeleteIfEmpty(oldState.channelId, guildId);
            }
            
        } catch (error) {
            console.error('AutoRoom voice state error:', error);
        }
    }
    
    async createPersonalRoom(member, config) {
        const guild = member.guild;
        
        try {
            // Get parent category
            let parentId = config.autoroom_category;
            if (!parentId) {
                const creatorChannel = guild.channels.cache.get(config.autoroom_creator);
                if (creatorChannel && creatorChannel.parentId) {
                    parentId = creatorChannel.parentId;
                }
            }
            
            // Generate room name
            let roomName = config.autoroom_format || '🎤 {user}\'s Room';
            
            // Count existing rooms for this owner
            const ownerRooms = this.getOwnerRooms(guild.id, member.id);
            const roomCount = ownerRooms.length + 1;
            
            // Replace variables
            roomName = roomName
                .replace(/{user}/g, member.user.username)
                .replace(/{count}/g, roomCount.toString());
            
            // Try to get user's activity
            if (member.presence?.activities?.length > 0) {
                const activity = member.presence.activities.find(a => a.type === 0); // Playing
                if (activity) {
                    roomName = roomName.replace(/{game}/g, activity.name);
                }
            }
            
            // Clean up {game} if not replaced
            roomName = roomName.replace(/{game}/g, '');
            
            // Create the voice channel
            const room = await guild.channels.create({
                name: roomName.substring(0, 100), // Discord limit
                type: ChannelType.GuildVoice,
                parent: parentId,
                userLimit: config.autoroom_limit || 0,
                bitrate: (config.autoroom_bitrate || 64) * 1000, // Convert to bps
                permissionOverwrites: this.getRoomPermissions(member, config.autoroom_private),
                reason: 'AutoRoom created'
            });
            
            // Move member to the new room
            await member.voice.setChannel(room);
            
            // Store room info
            this.addRoom(guild.id, {
                channelId: room.id,
                ownerId: member.id,
                createdAt: Date.now(),
                userCount: 1
            });
            
            console.log(`🎤 Created AutoRoom "${room.name}" for ${member.user.tag}`);
            
        } catch (error) {
            console.error('Error creating AutoRoom:', error);
        }
    }
    
    getRoomPermissions(owner, isPrivate) {
        const permissions = [
            {
                id: owner.id,
                allow: [
                    PermissionsBitField.Flags.ManageChannels,
                    PermissionsBitField.Flags.MuteMembers,
                    PermissionsBitField.Flags.DeafenMembers,
                    PermissionsBitField.Flags.MoveMembers
                ]
            },
            {
                id: owner.guild.roles.everyone.id,
                allow: [PermissionsBitField.Flags.ViewChannel],
                deny: isPrivate ? [PermissionsBitField.Flags.Connect] : []
            }
        ];
        
        return permissions;
    }
    
    async checkAndDeleteIfEmpty(channelId, guildId) {
        try {
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return;
            
            const channel = guild.channels.cache.get(channelId);
            if (!channel || channel.type !== ChannelType.GuildVoice) return;
            
            // Check if this is an AutoRoom
            const roomInfo = this.getRoomByChannel(guildId, channelId);
            if (!roomInfo) return;
            
            // Check if channel is empty
            const members = channel.members;
            
            if (members.size === 0) {
                // INSTANT DELETE - no delay
                try {
                    await channel.delete('AutoRoom empty');
                    this.removeRoom(guildId, channelId);
                    console.log(`🗑️ Instantly deleted empty AutoRoom "${channel.name}"`);
                } catch (deleteError) {
                    console.error(`Failed to delete channel ${channelId}:`, deleteError.message);
                    // Channel might already be deleted
                    this.removeRoom(guildId, channelId);
                }
            } else {
                // Update user count
                roomInfo.userCount = members.size;
            }
            
        } catch (error) {
            console.error('Error checking/delete empty channel:', error);
            // Remove from our records even if error
            this.removeRoom(guildId, channelId);
        }
    }
    
    // Add periodic check just in case (safety net)
    startPeriodicCheck() {
        setInterval(() => {
            this.forceCheckAllRooms();
        }, 10000); // Check every 10 seconds as backup
    }
    
    async forceCheckAllRooms() {
        for (const [guildId, rooms] of this.activeRooms) {
            for (const room of [...rooms]) { // Create copy for safe iteration
                try {
                    const guild = this.client.guilds.cache.get(guildId);
                    if (!guild) {
                        this.removeRoom(guildId, room.channelId);
                        continue;
                    }
                    
                    const channel = guild.channels.cache.get(room.channelId);
                    if (!channel || channel.type !== ChannelType.GuildVoice) {
                        // Channel was deleted manually
                        this.removeRoom(guildId, room.channelId);
                        continue;
                    }
                    
                    // Check if empty and delete instantly
                    if (channel.members.size === 0) {
                        await channel.delete('Periodic cleanup - empty room').catch(() => {});
                        this.removeRoom(guildId, room.channelId);
                        console.log(`🗑️ Periodic cleanup deleted "${channel.name}"`);
                    }
                    
                } catch (error) {
                    console.error('Force check error:', error);
                    this.removeRoom(guildId, room.channelId);
                }
            }
        }
    }
    
    // Room management methods
    addRoom(guildId, roomData) {
        if (!this.activeRooms.has(guildId)) {
            this.activeRooms.set(guildId, []);
        }
        this.activeRooms.get(guildId).push(roomData);
    }
    
    removeRoom(guildId, channelId) {
        if (!this.activeRooms.has(guildId)) return;
        
        const rooms = this.activeRooms.get(guildId);
        const index = rooms.findIndex(room => room.channelId === channelId);
        
        if (index !== -1) {
            rooms.splice(index, 1);
        }
    }
    
    getRoomByChannel(guildId, channelId) {
        if (!this.activeRooms.has(guildId)) return null;
        
        return this.activeRooms.get(guildId).find(room => room.channelId === channelId);
    }
    
    getOwnerRooms(guildId, ownerId) {
        if (!this.activeRooms.has(guildId)) return [];
        
        return this.activeRooms.get(guildId).filter(room => room.ownerId === ownerId);
    }
    
    getActiveRooms(guildId) {
        return this.activeRooms.get(guildId) || [];
    }
    
    // Cleanup methods
    cleanupEmptyRooms(guildId) {
        let deletedCount = 0;
        
        if (!this.activeRooms.has(guildId)) return 0;
        
        const rooms = this.activeRooms.get(guildId);
        const guild = this.client.guilds.cache.get(guildId);
        
        if (!guild) return 0;
        
        for (const room of [...rooms]) { // Create copy for safe iteration
            try {
                const channel = guild.channels.cache.get(room.channelId);
                if (channel && channel.type === ChannelType.GuildVoice && channel.members.size === 0) {
                    channel.delete('Manual cleanup').catch(() => {});
                    this.removeRoom(guildId, room.channelId);
                    deletedCount++;
                }
            } catch (error) {
                // Channel might already be deleted
                this.removeRoom(guildId, room.channelId);
            }
        }
        
        return deletedCount;
    }
    
    cleanupGuild(guildId) {
        this.cleanupEmptyRooms(guildId);
        this.activeRooms.delete(guildId);
    }
}

module.exports = AutoRoomManager;
// utils/LoggingSystem.js
const { EmbedBuilder, Colors, userMention, channelMention, roleMention, inlineCode } = require('discord.js');

class LoggingSystem {
    constructor(client, db) {
        this.client = client;
        this.db = db;
        console.log('✅ LoggingSystem initialized');
    }

    async getLogChannel(guildId, channelType) {
        try {
            const config = await this.db.getGuildConfig(guildId);
            
            // FIXED: Use the actual database field names
            const channelMapping = {
                'mod': 'mod_log_channel',
                'join_leave': 'join_leave_log_channel',
                'message': 'message_log_channel',
                'role': 'role_log_channel',
                'channel': 'channel_log_channel',
                'voice': 'voice_log_channel',
                'invite': 'invite_log_channel',
                'ticket': 'ticket_log_channel'
            };
            
            const fieldName = channelMapping[channelType];
            if (!fieldName) {
                console.log(`No mapping for channel type: ${channelType}`);
                return null;
            }
            
            const channelId = config[fieldName];
            if (!channelId) {
                console.log(`No channel ID for ${fieldName} in guild ${guildId}`);
                return null;
            }
            
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) {
                console.log(`Guild ${guildId} not found`);
                return null;
            }
            
            const channel = guild.channels.cache.get(channelId);
            if (!channel) {
                console.log(`Channel ${channelId} not found in guild ${guildId}`);
                return null;
            }
            
            return channel;
        } catch (error) {
            console.error(`Failed to get log channel ${channelType}: ${error.message}`);
            return null;
        }
    }

    async logToChannel(guildId, channelType, embedData) {
        try {
            const channel = await this.getLogChannel(guildId, channelType);
            if (!channel) {
                console.log(`No channel found for ${channelType} in guild ${guildId}`);
                return false;
            }

            // Check permissions
            const permissions = channel.permissionsFor(this.client.user);
            if (!permissions?.has('SendMessages')) {
                console.log(`No SendMessages permission in ${channel.name}`);
                return false;
            }
            
            if (!permissions?.has('EmbedLinks')) {
                console.log(`No EmbedLinks permission in ${channel.name}`);
                return false;
            }

            const embed = new EmbedBuilder()
                .setColor(embedData.color || Colors.Blue)
                .setTitle(embedData.title)
                .setDescription(embedData.description)
                .setTimestamp();

            if (embedData.fields) {
                embed.addFields(embedData.fields);
            }

            if (embedData.author) {
                embed.setAuthor(embedData.author);
            }

            if (embedData.footer) {
                embed.setFooter(embedData.footer);
            }

            if (embedData.thumbnail) {
                embed.setThumbnail(embedData.thumbnail);
            }

            if (embedData.image) {
                embed.setImage(embedData.image);
            }

            await channel.send({ embeds: [embed] });
            console.log(`✅ Logged to ${channelType}: ${embedData.title}`);
            return true;
        } catch (error) {
            console.error(`Failed to log to ${channelType}: ${error.message}`);
            return false;
        }
    }

    // ========== MODERATION LOGS ==========
    async logModeration(guildId, action, target, moderator, reason = 'No reason provided', duration = null) {
        const actionColors = {
            'ban': Colors.Red,
            'kick': Colors.Orange,
            'mute': Colors.Yellow,
            'warn': Colors.Gold,
            'unban': Colors.Green,
            'unmute': Colors.Green,
            'clearwarnings': Colors.Purple
        };

        const embedData = {
            title: `🔨 ${action.charAt(0).toUpperCase() + action.slice(1)}`,
            color: actionColors[action] || Colors.Blue,
            description: `${action.charAt(0).toUpperCase() + action.slice(1)} action performed`,
            fields: [
                { name: '👤 User', value: userMention(target.id), inline: true },
                { name: '🆔 User ID', value: inlineCode(target.id), inline: true },
                { name: '🛡️ Moderator', value: userMention(moderator.id), inline: true },
                { name: '📝 Reason', value: reason, inline: false }
            ],
            footer: { text: 'DTEmpire V2 Moderation System' }
        };

        if (duration) {
            embedData.fields.push({ name: '⏰ Duration', value: duration, inline: true });
        }

        const success = await this.logToChannel(guildId, 'mod', embedData);
        if (success) {
            console.log(`✅ Logged moderation: ${action} on ${target.tag} by ${moderator.tag}`);
        }
        return success;
    }

    // ========== JOIN/LEAVE LOGS ==========
    async logMemberJoin(guildId, member) {
        const embedData = {
            title: '🟢 Member Joined',
            color: Colors.Green,
            description: `${member.user.tag} has joined the server`,
            fields: [
                { name: '👤 Member', value: userMention(member.id), inline: true },
                { name: '🆔 User ID', value: inlineCode(member.id), inline: true },
                { name: '📅 Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '👥 Member Count', value: inlineCode(member.guild.memberCount.toString()), inline: true }
            ],
            thumbnail: member.user.displayAvatarURL(),
            footer: { text: 'DTEmpire Member Tracking' }
        };

        const success = await this.logToChannel(guildId, 'join_leave', embedData);
        if (success) {
            console.log(`✅ Logged member join: ${member.user.tag}`);
        }
        return success;
    }

    async logMemberLeave(guildId, member) {
        const embedData = {
            title: '🔴 Member Left',
            color: Colors.Red,
            description: `${member.user.tag} has left the server`,
            fields: [
                { name: '👤 Member', value: member.user.tag, inline: true },
                { name: '🆔 User ID', value: inlineCode(member.id), inline: true },
                { name: '📅 Joined Server', value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : 'Unknown', inline: true },
                { name: '👥 Member Count', value: inlineCode(member.guild.memberCount.toString()), inline: true }
            ],
            thumbnail: member.user.displayAvatarURL(),
            footer: { text: 'DTEmpire Member Tracking' }
        };

        const success = await this.logToChannel(guildId, 'join_leave', embedData);
        if (success) {
            console.log(`✅ Logged member leave: ${member.user.tag}`);
        }
        return success;
    }

    // ========== MESSAGE LOGS ==========
    async logMessageDelete(guildId, message) {
        if (message.author.bot) return false;
        
        const embedData = {
            title: '🗑️ Message Deleted',
            color: Colors.Red,
            description: `Message deleted in ${channelMention(message.channel.id)}`,
            fields: [
                { name: '👤 Author', value: userMention(message.author.id), inline: true },
                { name: '🆔 User ID', value: inlineCode(message.author.id), inline: true },
                { name: '📁 Channel', value: channelMention(message.channel.id), inline: true }
            ],
            footer: { text: 'DTEmpire Message Logging' }
        };

        // Add message content if available (truncate if too long)
        if (message.content) {
            const content = message.content.length > 1000 
                ? message.content.substring(0, 1000) + '...' 
                : message.content;
            embedData.fields.push({ name: '📝 Content', value: content, inline: false });
        }

        // Add attachment info if available
        if (message.attachments.size > 0) {
            embedData.fields.push({ 
                name: '📎 Attachments', 
                value: `${message.attachments.size} attachment(s)`, 
                inline: true 
            });
        }

        const success = await this.logToChannel(guildId, 'message', embedData);
        if (success) {
            console.log(`✅ Logged message delete: ${message.author.tag}`);
        }
        return success;
    }

    async logMessageEdit(guildId, oldMessage, newMessage) {
        if (oldMessage.author.bot || newMessage.author.bot) return false;
        if (oldMessage.content === newMessage.content) return false;

        const embedData = {
            title: '✏️ Message Edited',
            color: Colors.Yellow,
            description: `Message edited in ${channelMention(oldMessage.channel.id)}`,
            fields: [
                { name: '👤 Author', value: userMention(oldMessage.author.id), inline: true },
                { name: '🆔 User ID', value: inlineCode(oldMessage.author.id), inline: true },
                { name: '📁 Channel', value: channelMention(oldMessage.channel.id), inline: true },
                { name: '📝 Before', value: oldMessage.content.length > 500 ? oldMessage.content.substring(0, 500) + '...' : oldMessage.content, inline: false },
                { name: '📝 After', value: newMessage.content.length > 500 ? newMessage.content.substring(0, 500) + '...' : newMessage.content, inline: false }
            ],
            footer: { text: 'DTEmpire Message Logging' }
        };

        const success = await this.logToChannel(guildId, 'message', embedData);
        if (success) {
            console.log(`✅ Logged message edit: ${oldMessage.author.tag}`);
        }
        return success;
    }

    // ========== VOICE LOGS ==========
    async logVoiceJoin(guildId, member, voiceChannel) {
        const embedData = {
            title: '🎤 Voice Join',
            color: Colors.Green,
            description: `${member.user.tag} joined a voice channel`,
            fields: [
                { name: '👤 Member', value: userMention(member.id), inline: true },
                { name: '🔊 Channel', value: channelMention(voiceChannel.id), inline: true },
                { name: '📝 Channel Name', value: voiceChannel.name, inline: true }
            ],
            footer: { text: 'DTEmpire Voice Tracking' }
        };

        const success = await this.logToChannel(guildId, 'voice', embedData);
        if (success) {
            console.log(`✅ Logged voice join: ${member.user.tag} in ${voiceChannel.name}`);
        }
        return success;
    }

    async logVoiceLeave(guildId, member, voiceChannel) {
        const embedData = {
            title: '🔇 Voice Leave',
            color: Colors.Red,
            description: `${member.user.tag} left a voice channel`,
            fields: [
                { name: '👤 Member', value: userMention(member.id), inline: true },
                { name: '🔊 Channel', value: channelMention(voiceChannel.id), inline: true },
                { name: '📝 Channel Name', value: voiceChannel.name, inline: true }
            ],
            footer: { text: 'DTEmpire Voice Tracking' }
        };

        const success = await this.logToChannel(guildId, 'voice', embedData);
        if (success) {
            console.log(`✅ Logged voice leave: ${member.user.tag} from ${voiceChannel.name}`);
        }
        return success;
    }

    async logVoiceMove(guildId, member, oldChannel, newChannel) {
        const embedData = {
            title: '🔀 Voice Move',
            color: Colors.Yellow,
            description: `${member.user.tag} moved between voice channels`,
            fields: [
                { name: '👤 Member', value: userMention(member.id), inline: true },
                { name: '🔊 From', value: channelMention(oldChannel.id), inline: true },
                { name: '🔊 To', value: channelMention(newChannel.id), inline: true }
            ],
            footer: { text: 'DTEmpire Voice Tracking' }
        };

        const success = await this.logToChannel(guildId, 'voice', embedData);
        if (success) {
            console.log(`✅ Logged voice move: ${member.user.tag} from ${oldChannel.name} to ${newChannel.name}`);
        }
        return success;
    }

    // ========== CHANNEL LOGS ==========
    async logChannelCreate(guildId, channel) {
        const embedData = {
            title: '📁 Channel Created',
            color: Colors.Green,
            description: `New channel created`,
            fields: [
                { name: '📁 Channel', value: channelMention(channel.id), inline: true },
                { name: '📝 Name', value: channel.name, inline: true },
                { name: '📚 Type', value: channel.type === 0 ? 'Text' : channel.type === 2 ? 'Voice' : channel.type === 4 ? 'Category' : 'Other', inline: true }
            ],
            footer: { text: 'DTEmpire Channel Tracking' }
        };

        const success = await this.logToChannel(guildId, 'channel', embedData);
        if (success) {
            console.log(`✅ Logged channel create: ${channel.name}`);
        }
        return success;
    }

    async logChannelDelete(guildId, channel) {
        const embedData = {
            title: '🗑️ Channel Deleted',
            color: Colors.Red,
            description: `Channel deleted`,
            fields: [
                { name: '📝 Name', value: channel.name, inline: true },
                { name: '📚 Type', value: channel.type === 0 ? 'Text' : channel.type === 2 ? 'Voice' : channel.type === 4 ? 'Category' : 'Other', inline: true }
            ],
            footer: { text: 'DTEmpire Channel Tracking' }
        };

        const success = await this.logToChannel(guildId, 'channel', embedData);
        if (success) {
            console.log(`✅ Logged channel delete: ${channel.name}`);
        }
        return success;
    }

    async logChannelUpdate(guildId, oldChannel, newChannel) {
        const changes = [];
        
        if (oldChannel.name !== newChannel.name) {
            changes.push(`**Name:** ${oldChannel.name} → ${newChannel.name}`);
        }
        
        if (oldChannel.topic !== newChannel.topic) {
            changes.push(`**Topic:** Changed`);
        }
        
        if (changes.length === 0) return false;

        const embedData = {
            title: '✏️ Channel Updated',
            color: Colors.Yellow,
            description: `Channel updated`,
            fields: [
                { name: '📁 Channel', value: channelMention(newChannel.id), inline: true },
                { name: '📝 Changes', value: changes.join('\n'), inline: false }
            ],
            footer: { text: 'DTEmpire Channel Tracking' }
        };

        const success = await this.logToChannel(guildId, 'channel', embedData);
        if (success) {
            console.log(`✅ Logged channel update: ${newChannel.name}`);
        }
        return success;
    }

    // ========== ROLE LOGS ==========
    async logRoleAdd(guildId, member, role) {
        const embedData = {
            title: '➕ Role Added',
            color: Colors.Green,
            description: `Role added to ${member.user.tag}`,
            fields: [
                { name: '👤 Member', value: userMention(member.id), inline: true },
                { name: '🆔 User ID', value: inlineCode(member.id), inline: true },
                { name: '🎭 Role', value: roleMention(role.id), inline: true },
                { name: '🎨 Role Name', value: role.name, inline: true }
            ],
            footer: { text: 'DTEmpire Role Tracking' }
        };

        const success = await this.logToChannel(guildId, 'role', embedData);
        if (success) {
            console.log(`✅ Logged role add: ${role.name} to ${member.user.tag}`);
        }
        return success;
    }

    async logRoleRemove(guildId, member, role) {
        const embedData = {
            title: '➖ Role Removed',
            color: Colors.Red,
            description: `Role removed from ${member.user.tag}`,
            fields: [
                { name: '👤 Member', value: userMention(member.id), inline: true },
                { name: '🆔 User ID', value: inlineCode(member.id), inline: true },
                { name: '🎭 Role', value: roleMention(role.id), inline: true },
                { name: '🎨 Role Name', value: role.name, inline: true }
            ],
            footer: { text: 'DTEmpire Role Tracking' }
        };

        const success = await this.logToChannel(guildId, 'role', embedData);
        if (success) {
            console.log(`✅ Logged role remove: ${role.name} from ${member.user.tag}`);
        }
        return success;
    }

    async logRoleCreate(guildId, role) {
        const embedData = {
            title: '🎭 Role Created',
            color: Colors.Green,
            description: `New role created`,
            fields: [
                { name: '🎭 Role', value: roleMention(role.id), inline: true },
                { name: '🎨 Role Name', value: role.name, inline: true },
                { name: '🎨 Role Color', value: role.hexColor, inline: true }
            ],
            footer: { text: 'DTEmpire Role Tracking' }
        };

        const success = await this.logToChannel(guildId, 'role', embedData);
        if (success) {
            console.log(`✅ Logged role create: ${role.name}`);
        }
        return success;
    }

    async logRoleDelete(guildId, role) {
        const embedData = {
            title: '🗑️ Role Deleted',
            color: Colors.Red,
            description: `Role deleted`,
            fields: [
                { name: '🎨 Role Name', value: role.name, inline: true },
                { name: '🎨 Role Color', value: role.hexColor, inline: true }
            ],
            footer: { text: 'DTEmpire Role Tracking' }
        };

        const success = await this.logToChannel(guildId, 'role', embedData);
        if (success) {
            console.log(`✅ Logged role delete: ${role.name}`);
        }
        return success;
    }

    // ========== INVITE LOGS ==========
    async logInviteCreate(guildId, invite) {
        const embedData = {
            title: '🔗 Invite Created',
            color: Colors.Green,
            description: `New invite created`,
            fields: [
                { name: '🔗 Code', value: inlineCode(invite.code), inline: true },
                { name: '👤 Creator', value: invite.inviter ? userMention(invite.inviter.id) : 'Unknown', inline: true },
                { name: '📁 Channel', value: invite.channel ? channelMention(invite.channel.id) : 'Unknown', inline: true },
                { name: '⏰ Expires', value: invite.expiresAt ? `<t:${Math.floor(invite.expiresAt.getTime() / 1000)}:R>` : 'Never', inline: true },
                { name: '👥 Max Uses', value: invite.maxUses ? inlineCode(invite.maxUses.toString()) : 'Unlimited', inline: true }
            ],
            footer: { text: 'DTEmpire Invite Tracking' }
        };

        const success = await this.logToChannel(guildId, 'invite', embedData);
        if (success) {
            console.log(`✅ Logged invite create: ${invite.code}`);
        }
        return success;
    }

    async logInviteDelete(guildId, invite) {
        const embedData = {
            title: '🗑️ Invite Deleted',
            color: Colors.Red,
            description: `Invite deleted`,
            fields: [
                { name: '🔗 Code', value: inlineCode(invite.code), inline: true },
                { name: '📁 Channel', value: invite.channel ? channelMention(invite.channel.id) : 'Unknown', inline: true }
            ],
            footer: { text: 'DTEmpire Invite Tracking' }
        };

        const success = await this.logToChannel(guildId, 'invite', embedData);
        if (success) {
            console.log(`✅ Logged invite delete: ${invite.code}`);
        }
        return success;
    }
}

module.exports = LoggingSystem;
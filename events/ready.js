const { ActivityType } = require('discord.js');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`✅ ${client.user.tag} is online!`);
        console.log(`📊 Servers: ${client.guilds.cache.size}`);
        console.log(`👥 Users: ${client.users.cache.size}`);
        console.log(`⚡ Commands: ${client.commands.size}`);
        console.log(`💾 Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`);
        
        // Set bot presence
        const updatePresence = () => {
            const activities = [
                { name: `${client.botInfo.prefix}help | v${client.botInfo.version}`, type: ActivityType.Playing },
                { name: `${client.guilds.cache.size} servers`, type: ActivityType.Watching },
                { name: `${client.users.cache.size} users`, type: ActivityType.Listening },
                { name: 'DTEmpire by DargoTamber', type: ActivityType.Streaming, url: 'https://twitch.tv/discord' }
            ];
            
            const activity = activities[Math.floor(Math.random() * activities.length)];
            client.user.setPresence({
                activities: [activity],
                status: 'online'
            });
        };
        
        // Update presence initially and every 5 minutes
        updatePresence();
        setInterval(updatePresence, 300000);
        
        // Initialize other services
        initializeServices(client);
    }
};

async function initializeServices(client) {
    console.log('🔄 Initializing services...');
    
    // Load giveaways from database
    const db = require('../utils/database');
    try {
        const activeGiveaways = await db.models.Giveaway.findAll({
            where: { ended: false }
        });
        
        console.log(`🎉 Loaded ${activeGiveaways.length} active giveaways`);
    } catch (error) {
        console.error('Error loading giveaways:', error);
    }
    
    // Load sticky messages
    try {
        const stickyMessages = await db.models.StickyMessage.findAll();
        console.log(`📌 Loaded ${stickyMessages.length} sticky messages`);
    } catch (error) {
        console.error('Error loading sticky messages:', error);
    }
    
    // Load mutes and schedule unmutes
    try {
        const activeMutes = await db.models.Mute.findAll({
            where: {
                expiresAt: {
                    [db.sequelize.Op.gt]: new Date()
                }
            }
        });
        
        console.log(`🔇 Loaded ${activeMutes.length} active mutes`);
        
        // Schedule unmutes
        for (const mute of activeMutes) {
            const timeLeft = mute.expiresAt.getTime() - Date.now();
            if (timeLeft > 0) {
                setTimeout(async () => {
                    await unmuteUser(mute, client);
                }, timeLeft);
            }
        }
    } catch (error) {
        console.error('Error loading mutes:', error);
    }
    
    console.log('✅ Services initialized!');
}

async function unmuteUser(mute, client) {
    try {
        const guild = client.guilds.cache.get(mute.guildId);
        if (!guild) return;
        
        const member = await guild.members.fetch(mute.userId).catch(() => null);
        if (!member) return;
        
        // Remove mute role if exists
        const db = require('../utils/database');
        const config = await db.getGuildConfig(guild.id);
        
        if (config.muteRole) {
            const muteRole = guild.roles.cache.get(config.muteRole);
            if (muteRole && member.roles.cache.has(muteRole.id)) {
                await member.roles.remove(muteRole);
            }
        }
        
        // Update database
        await mute.destroy();
        
        // Log unmute
        if (config.moderationLogs && config.logChannel) {
            const logChannel = guild.channels.cache.get(config.logChannel);
            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('🔊 User Unmuted (Auto)')
                    .addFields(
                        { name: '👤 User', value: `${member.user.tag} (${member.id})`, inline: true },
                        { name: '📅 Mute Ended', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
                    )
                    .setFooter({ text: 'Automatic unmute after timeout' })
                    .setTimestamp();
                
                await logChannel.send({ embeds: [embed] });
            }
        }
        
    } catch (error) {
        console.error('Error unmuting user:', error);
    }
}
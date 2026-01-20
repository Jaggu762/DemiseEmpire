const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'uptime',
    description: 'Shows bot uptime and system resource usage',
    aliases: ['status', 'ping'],
    category: 'Utility',
    
    async execute(message, args, client) {
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor(uptime / 3600) % 24;
        const minutes = Math.floor(uptime / 60) % 60;
        const seconds = Math.floor(uptime % 60);
        
        const uptimeStr = `${days}d ${hours}h ${minutes}m ${seconds}s`;
        
        // Calculate memory usage
        const usedMemory = process.memoryUsage().heapUsed / 1024 / 1024;
        const memoryUsage = `${Math.round(usedMemory * 100) / 100} MB`;
        
        // Calculate ping
        const startTime = Date.now();
        const msg = await message.reply('📡 Pinging...');
        const ping = Date.now() - startTime;
        
        const embed = new EmbedBuilder()
            .setColor('#0061ff')
            .setTitle('🚀 DTEmpire Status & Uptime')
            .setDescription(`**Version:** ${client.botInfo.version}\n**Creator:** ${client.botInfo.creator}`)
            .addFields(
                { name: '⏰ Uptime', value: uptimeStr, inline: true },
                { name: '📶 Ping', value: `${ping}ms`, inline: true },
                { name: '🔄 API Latency', value: `${Math.round(client.ws.ping)}ms`, inline: true },
                { name: '💾 Memory Usage', value: memoryUsage, inline: true },
                { name: '🏰 Servers', value: client.guilds.cache.size.toString(), inline: true },
                { name: '👥 Users', value: client.users.cache.size.toString(), inline: true },
                { name: '📊 Commands', value: client.commands.size.toString(), inline: true },
                { name: '📚 Discord.js', value: require('discord.js').version, inline: true },
                { name: '⚙️ Node.js', value: process.version, inline: true },
                { name: '📅 Started At', value: `<t:${Math.floor(client.botInfo.startedAt / 1000)}:R>`, inline: true }
            )
            .setFooter({ 
                text: `DTEmpire v${client.botInfo.version} | Created by Jaggu762`,
                iconURL: client.user.displayAvatarURL() 
            })
            .setTimestamp();
        
        await msg.edit({ content: null, embeds: [embed] });
    }
};
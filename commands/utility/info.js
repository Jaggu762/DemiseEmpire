const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'info',
    description: 'Shows information about the bot',
    aliases: ['about', 'botinfo', 'aboutme'],
    category: 'Utility',
    
    async execute(message, args, client) {
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor(uptime / 3600) % 24;
        const minutes = Math.floor(uptime / 60) % 60;
        
        const embed = new EmbedBuilder()
            .setColor('#0061ff')
            .setTitle('🤖 DTEmpire Bot Information')
            .setDescription('A comprehensive Discord bot with server management, AI features, economy, music, and more!')
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 512 }))
            .addFields(
                { name: '📛 Bot Name', value: client.botInfo.name, inline: true },
                { name: '🔢 Version', value: client.botInfo.version, inline: true },
                { name: '👨‍💻 Creator', value: client.botInfo.creator, inline: true },
                { name: '🏰 Servers', value: client.guilds.cache.size.toString(), inline: true },
                { name: '👥 Users', value: client.users.cache.size.toString(), inline: true },
                { name: '📊 Commands', value: client.commands.size.toString(), inline: true },
                { name: '⏰ Uptime', value: `${days}d ${hours}h ${minutes}m`, inline: true },
                { name: '📡 Ping', value: `${client.ws.ping}ms`, inline: true },
                { name: '🖥️ Node.js', value: process.version, inline: true }
            )
            .addFields({
                name: '✨ Features',
                value: '• Server Management\n• AI Chat & Image Generation\n• Economy System\n• Music Player\n• Auto Moderation\n• Logging System\n• Giveaways\n• Auto Rooms\n• Sticky Messages\n• Snipe Command\n• YouTube/Twitch/TikTok Notifications\n• And much more!'
            })
            .setFooter({ 
                text: `DTEmpire v${client.botInfo.version} | Created by DargoTamber`,
                iconURL: client.user.displayAvatarURL() 
            })
            .setTimestamp();
        
        message.reply({ embeds: [embed] });
    }
};
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'invite',
    description: 'Get bot invite links and support server',
    aliases: ['support', 'invitelink'],
    category: 'Utility',
    
    async execute(message, args, client) {
        const embed = new EmbedBuilder()
            .setColor('#0061ff')
            .setTitle('🔗 DTEmpire Bot Invite Links')
            .setDescription(`Thank you for using **DTEmpire v${client.botInfo.version}!**\n\nInvite the bot to your server or join our support server for help and updates.`)
            .addFields(
                { name: '🤖 Bot Information', value: `**Version:** ${client.botInfo.version}\n**Creator:** ${client.botInfo.creator}\n**Servers:** ${client.guilds.cache.size}\n**Commands:** ${client.commands.size}`, inline: true },
                { name: '✨ Features', value: '• Server Management\n• AI Chat & Image Gen\n• Economy System\n• Music Player\n• Moderation Tools\n• Auto Rooms\n• Giveaways\n• And much more!', inline: true },
                { name: '📊 Statistics', value: `**Uptime:** ${Math.floor(client.uptime / 86400000)} days\n**Memory:** ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\n**Ping:** ${Math.round(client.ws.ping)}ms`, inline: true }
            )
            .setFooter({ text: `DTEmpire v${client.botInfo.version} | Created by Jaggu762`, iconURL: client.user.displayAvatarURL() })
            .setTimestamp();
        
        // Create buttons
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('🤖 Invite Bot')
                    .setURL('https://discord.com/oauth2/authorize?client_id=1452543262392057988&permissions=8&integration_type=0&scope=bot')
                    .setStyle(ButtonStyle.Link),
                new ButtonBuilder()
                    .setLabel('💬 Support Server')
                    .setURL('https://discord.gg/r9QRUy6nrK')
                    .setStyle(ButtonStyle.Link),
                new ButtonBuilder()
                    .setLabel('⭐ GitHub')
                    .setURL('https://github.com/hyperdargo')
                    .setStyle(ButtonStyle.Link),
                new ButtonBuilder()
                    .setLabel('🌐 Website')
                    .setURL('https://docs.ankitgupta.com.np/')
                    .setStyle(ButtonStyle.Link)
            );
        
        message.reply({ embeds: [embed], components: [row] });
    }
};
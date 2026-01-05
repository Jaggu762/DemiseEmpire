const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'restart',
    description: 'Restart the bot (Owner only)',
    aliases: ['reboot'],
    category: 'Utility',
    ownerOnly: true,
    
    async execute(message, args, client) {
        const config = require('../../config.json');
        
        // Check if user is owner
        if (!config.bot.admins.includes(message.author.id)) {
            return message.reply('❌ This command is only available to bot owners!');
        }
        
        const embed = new EmbedBuilder()
            .setColor('#ff9900')
            .setTitle('🔄 Restarting DTEmpire...')
            .setDescription('The bot is now restarting. This may take a few moments.')
            .addFields(
                { name: '👤 Requested By', value: message.author.tag, inline: true },
                { name: '🕐 Time', value: `<t:${Math.floor(Date.now() / 1000)}:T>`, inline: true },
                { name: '📊 Status', value: 'Shutting down services...', inline: true }
            )
            .setFooter({ text: `DTEmpire v${client.botInfo.version}`, iconURL: client.user.displayAvatarURL() })
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        
        // Log restart
        console.log(`[RESTART] Bot restart requested by ${message.author.tag} (${message.author.id})`);
        
        // Destroy music players
        try {
            client.riffy.players.forEach(player => {
                player.destroy();
            });
            console.log('[RESTART] Music players destroyed');
        } catch (error) {
            console.error('[RESTART] Error destroying music players:', error);
        }
        
        // Close database connections
        try {
            const database = require('../../utils/database');
            await database.close();
            console.log('[RESTART] Database connections closed');
        } catch (error) {
            console.error('[RESTART] Error closing database:', error);
        }
        
        // Disconnect from Discord
        setTimeout(() => {
            console.log('[RESTART] Disconnecting from Discord...');
            client.destroy();
            
            // Restart process
            setTimeout(() => {
                console.log('[RESTART] Starting new process...');
                process.exit(1); // Let PM2/process manager restart
            }, 1000);
        }, 2000);
    }
};
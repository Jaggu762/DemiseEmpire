const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'dm',
    description: 'Send a direct message to a user',
    aliases: ['directmessage'],
    category: 'Utility',
    permissions: ['Administrator'],
    
    async execute(message, args, client) {
        // Check permissions
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('❌ You need Administrator permissions to use this command!');
        }
        
        if (args.length < 2) {
            return message.reply('❌ Usage: `^dm <user> <message>`');
        }
        
        // Get user
        const userArg = args[0];
        const messageContent = args.slice(1).join(' ');
        
        let user;
        
        try {
            // Try to parse as mention
            const mention = userArg.replace(/[<@!>]/g, '');
            user = await client.users.fetch(mention);
        } catch {
            // Try to find by username
            user = client.users.cache.find(u => 
                u.username.toLowerCase() === userArg.toLowerCase() ||
                u.tag.toLowerCase() === userArg.toLowerCase()
            );
        }
        
        if (!user) {
            return message.reply('❌ User not found!');
        }
        
        try {
            // Send DM
            const dmEmbed = new EmbedBuilder()
                .setColor('#0061ff')
                .setTitle('📨 Message from Server Staff')
                .setDescription(messageContent)
                .addFields(
                    { name: '📧 From Server', value: message.guild.name, inline: true },
                    { name: '👤 From Staff', value: message.author.tag, inline: true },
                    { name: '🆔 Staff ID', value: message.author.id, inline: true }
                )
                .setFooter({ text: 'Please do not reply to this message', iconURL: message.guild.iconURL() })
                .setTimestamp();
            
            await user.send({ embeds: [dmEmbed] });
            
            // Send confirmation
            const confirmEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ DM Sent Successfully')
                .addFields(
                    { name: '👤 To User', value: `${user.tag} (${user.id})`, inline: true },
                    { name: '📝 Message', value: messageContent.slice(0, 100) + (messageContent.length > 100 ? '...' : ''), inline: false }
                )
                .setFooter({ text: `Sent by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                .setTimestamp();
            
            message.reply({ embeds: [confirmEmbed] });
            
        } catch (error) {
            console.error('DM Error:', error);
            message.reply('❌ Failed to send DM. The user might have DMs disabled.');
        }
    }
};
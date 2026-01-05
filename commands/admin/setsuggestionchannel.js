const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
    name: 'setsuggestionchannel',
    description: 'Set the channel where suggestions will be sent',
    aliases: ['setsuggest', 'suggestchannel', 'setsuggestions'],
    category: 'Admin',
    usage: '^setsuggestionchannel <#channel> or ^setsuggestionchannel disable',
    permissions: ['Administrator'],
    
    async execute(message, args, client, db) {
        // Check permissions
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ You need the **Administrator** permission to use this command!');
        }
        
        if (args.length === 0) {
            // Show current suggestion channel
            const guildConfig = await db.getGuildConfig(message.guild.id);
            
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('💡 Suggestion Channel Settings')
                .setDescription('Configure where user suggestions will be sent')
                .addFields(
                    { 
                        name: '📝 Current Channel', 
                        value: guildConfig.suggestion_channel ? 
                            `<#${guildConfig.suggestion_channel}>` : 
                            '❌ Not set (suggestions appear in command channel)',
                        inline: false 
                    },
                    { 
                        name: '⚙️ Usage', 
                        value: '`^setsuggestionchannel <#channel>` - Set suggestion channel\n`^setsuggestionchannel disable` - Disable (use command channel)',
                        inline: false 
                    }
                )
                .setFooter({ text: 'Suggestions are submitted with ^suggest <suggestion>' });
            
            return message.reply({ embeds: [embed] });
        }
        
        const firstArg = args[0].toLowerCase();
        
        // Check if disabling
        if (firstArg === 'disable' || firstArg === 'off' || firstArg === 'remove') {
            await db.updateGuildConfig(message.guild.id, {
                suggestion_channel: null
            });
            
            const embed = new EmbedBuilder()
                .setColor('#ff9900')
                .setTitle('✅ Suggestion Channel Disabled')
                .setDescription('Suggestions will now appear in the channel where the command is used.')
                .setFooter({ text: 'You can re-enable it anytime with ^setsuggestionchannel <#channel>' });
            
            return message.reply({ embeds: [embed] });
        }
        
        // Get the mentioned channel
        const channel = message.mentions.channels.first() || 
                       message.guild.channels.cache.get(args[0]);
        
        if (!channel) {
            return message.reply('❌ Invalid channel! Please mention a valid text channel.\nExample: `^setsuggestionchannel #suggestions`');
        }
        
        // Verify it's a text channel
        if (channel.type !== ChannelType.GuildText) {
            return message.reply('❌ Please select a text channel!');
        }
        
        // Check if bot can send messages in that channel
        const permissions = channel.permissionsFor(message.guild.members.me);
        if (!permissions.has(PermissionFlagsBits.SendMessages) || 
            !permissions.has(PermissionFlagsBits.EmbedLinks)) {
            return message.reply(`❌ I don't have permission to send messages and embeds in ${channel}!`);
        }
        
        // Update the config
        await db.updateGuildConfig(message.guild.id, {
            suggestion_channel: channel.id
        });
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Suggestion Channel Set!')
            .setDescription(`All suggestions will now be sent to ${channel}`)
            .addFields(
                { name: '📝 Channel', value: `${channel}`, inline: true },
                { name: '💡 Usage', value: 'Users can use `^suggest <suggestion>`', inline: true }
            )
            .setFooter({ text: 'Test it with ^suggest Your suggestion here' });
        
        await message.reply({ embeds: [embed] });
        
        // Send a test message to the channel
        const testEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('💡 Suggestion Channel Configured')
            .setDescription('This channel has been set as the suggestion channel!\n\nAll user suggestions will appear here.')
            .addFields(
                { name: '✨ How it works', value: 'Users submit suggestions with `^suggest <their suggestion>`\nModerators can approve/deny/consider suggestions using the buttons', inline: false }
            )
            .setFooter({ text: `Set by ${message.author.username}` })
            .setTimestamp();
        
        await channel.send({ embeds: [testEmbed] });
    }
};

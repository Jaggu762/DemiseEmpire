const { EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');

module.exports = {
    name: 'dm',
    description: 'Send a direct message to a user',
    aliases: ['directmessage'],
    category: 'Utility',
    permissions: ['Administrator'],
    
    async execute(message, args, client) {
        const allowedRoles = ['bot owner', 'server owner', 'mods'];
        
        // Check if user has DMbyDTEmpire role
        const dmRole = message.guild.roles.cache.find(role => role.name === 'DMbyDTEmpire');
        
        // Check if user has the role, is owner, or has admin perms
        const hasRole = dmRole && message.member.roles.cache.has(dmRole.id);
        const isOwner = message.author.id === message.guild.ownerId;
        const isAdmin = message.member.permissions.has(PermissionsBitField.Flags.Administrator);
        
        // Bot owner check (you'll need to set your bot owner ID)
        const BOT_OWNER_ID = 'YOUR_BOT_OWNER_ID_HERE'; // Replace with your Discord ID
        const isBotOwner = message.author.id === BOT_OWNER_ID;
        
        // If no DMbyDTEmpire role exists, create it and give it to the command user
        if (!dmRole) {
            try {
                const newRole = await message.guild.roles.create({
                    name: 'DMbyDTEmpire',
                    color: '#0061ff',
                    reason: 'Role for DM command access',
                    permissions: []
                });
                
                // If the user is server owner or has admin perms, give them the role
                if (isOwner || isAdmin) {
                    await message.member.roles.add(newRole);
                    
                    const embed = new EmbedBuilder()
                        .setColor('#0061ff')
                        .setTitle('🎭 DMbyDTEmpire Role Created')
                        .setDescription(`The **${newRole.name}** role has been created and assigned to you!`)
                        .addFields(
                            { name: 'ℹ️ Information', value: 'Only users with this role can use the DM command.\nYou can assign this role to other moderators.' }
                        )
                        .setFooter({ text: 'Role created successfully' })
                        .setTimestamp();
                    
                    return message.reply({ embeds: [embed] });
                } else {
                    return message.reply('❌ The DMbyDTEmpire role needs to be created first by a server owner or admin.');
                }
            } catch (error) {
                console.error('Role creation error:', error);
                return message.reply('❌ Failed to create DMbyDTEmpire role.');
            }
        }
        
        // If role exists but user doesn't have it and is not bot owner
        if (!hasRole && !isBotOwner && !isOwner) {
            return message.reply('❌ You need the **DMbyDTEmpire** role to use this command!');
        }
        
        // Command usage check
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
        
        // Prevent DMing self
        if (user.id === message.author.id) {
            return message.reply('❌ You cannot DM yourself!');
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
            
            // Optional: Log the DM in a channel
            // You can add logging to a specific channel here if needed
            
        } catch (error) {
            console.error('DM Error:', error);
            message.reply('❌ Failed to send DM. The user might have DMs disabled.');
        }
    }
};
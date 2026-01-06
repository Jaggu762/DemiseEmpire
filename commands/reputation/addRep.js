const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'addrep',
    description: 'Add reputation points to a user (Admin/Moderator only)',
    aliases: ['giverep', 'addreputation', 'givereputation'],
    category: 'Reputation',
    usage: '!addRep <@user> <points> [reason]',
    
    async execute(message, args, client, db) {
        try {
            // Check if database is available
            if (!db) {
                return message.reply('❌ Database not available. Please try again later.');
            }
            
            // Check permissions - must have ManageMessages or Administrator
            if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages) && 
                !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return message.reply('❌ You need **Manage Messages** or **Administrator** permission to use this command.');
            }
            
            // Parse arguments
            const targetUser = message.mentions.users.first();
            if (!targetUser) {
                return message.reply('❌ Please mention a user to give reputation to.\n**Usage:** `!addRep @user <points> [reason]`');
            }
            
            // Don't allow adding reputation to bots
            if (targetUser.bot) {
                return message.reply('❌ You cannot give reputation to bots.');
            }
            
            // Don't allow adding reputation to self
            if (targetUser.id === message.author.id) {
                return message.reply('❌ You cannot give reputation to yourself.');
            }
            
            // Get points amount
            const pointsArg = args[1];
            if (!pointsArg) {
                return message.reply('❌ Please specify the amount of points to add.\n**Usage:** `!addRep @user <points> [reason]`');
            }
            
            const points = parseInt(pointsArg);
            if (isNaN(points)) {
                return message.reply('❌ Points must be a valid number.');
            }
            
            // Set reasonable limits
            if (points === 0) {
                return message.reply('❌ Points cannot be zero.');
            }
            
            if (Math.abs(points) > 1000) {
                return message.reply('❌ You can only add or remove up to 1000 points at a time.');
            }
            
            // Get reason (optional)
            const reason = args.slice(2).join(' ') || 'Manual adjustment by moderator';
            
            // Add reputation
            const oldReputation = await db.getUserReputation(targetUser.id, message.guild.id);
            const oldPoints = oldReputation.points;
            
            const newReputation = await db.addReputationPoints(
                targetUser.id, 
                message.guild.id, 
                points, 
                `${reason} (by ${message.author.tag})`
            );
            
            // Create success embed
            const embed = new EmbedBuilder()
                .setColor(points > 0 ? '#00FF00' : '#FF0000')
                .setTitle(points > 0 ? '⬆️ Reputation Added' : '⬇️ Reputation Removed')
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 128 }))
                .addFields(
                    { 
                        name: '👤 User', 
                        value: targetUser.toString(), 
                        inline: true 
                    },
                    { 
                        name: '📊 Change', 
                        value: points > 0 ? `+${points}` : `${points}`, 
                        inline: true 
                    },
                    { 
                        name: '💫 New Total', 
                        value: `${newReputation.points} points`, 
                        inline: true 
                    },
                    { 
                        name: '📝 Reason', 
                        value: reason, 
                        inline: false 
                    },
                    {
                        name: '🔄 Before → After',
                        value: `${oldPoints} → ${newReputation.points}`,
                        inline: false
                    }
                )
                .setFooter({ 
                    text: `Modified by ${message.author.tag}`,
                    iconURL: message.author.displayAvatarURL({ dynamic: true })
                })
                .setTimestamp();
            
            await message.reply({ embeds: [embed] });
            
            // Try to notify the user
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor(points > 0 ? '#00FF00' : '#FF0000')
                    .setTitle(points > 0 ? '⬆️ You Received Reputation!' : '⬇️ Your Reputation Changed')
                    .setDescription(`Your reputation in **${message.guild.name}** has been ${points > 0 ? 'increased' : 'decreased'}.`)
                    .addFields(
                        { 
                            name: '📊 Change', 
                            value: points > 0 ? `+${points} points` : `${points} points`, 
                            inline: true 
                        },
                        { 
                            name: '💫 New Total', 
                            value: `${newReputation.points} points`, 
                            inline: true 
                        },
                        { 
                            name: '📝 Reason', 
                            value: reason, 
                            inline: false 
                        }
                    )
                    .setFooter({ 
                        text: message.guild.name,
                        iconURL: message.guild.iconURL({ dynamic: true })
                    })
                    .setTimestamp();
                
                await targetUser.send({ embeds: [dmEmbed] });
            } catch (error) {
                // User has DMs disabled, no big deal
                console.log(`Could not DM ${targetUser.tag} about reputation change`);
            }
            
        } catch (error) {
            console.error('AddRep command error:', error);
            message.reply('❌ An error occurred while adding reputation. Please try again.');
        }
    }
};

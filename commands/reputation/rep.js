const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ReputationService = require('../../utils/reputationService');

module.exports = {
    name: 'rep',
    aliases: ['reputation', 'karma'],
    category: 'reputation',
    description: 'Reputation/Karma system - Give and track reputation points',
    usage: '^rep <give|check|leaderboard|info> [args]',
    examples: [
        '^rep give @user Great help with coding!',
        '^rep check',
        '^rep check @user',
        '^rep leaderboard',
        '^rep info'
    ],

    async execute(message, args, client, db) {
        try {
            // Initialize reputation service
            const repService = new ReputationService(db);

            // Get subcommand
            const subcommand = args[0]?.toLowerCase();

            if (!subcommand) {
                return this.showHelp(message);
            }

            // Route to appropriate subcommand
            switch (subcommand) {
                case 'give':
                case 'add':
                case '+':
                    await this.handleGiveRep(message, args.slice(1), repService, client);
                    break;

                case 'check':
                case 'view':
                case 'show':
                    await this.handleCheckRep(message, args.slice(1), repService, client);
                    break;

                case 'leaderboard':
                case 'lb':
                case 'top':
                    await this.handleLeaderboard(message, args.slice(1), repService, client);
                    break;

                case 'info':
                case 'help':
                case 'about':
                    await this.handleInfo(message, repService);
                    break;

                case 'history':
                case 'logs':
                    await this.handleHistory(message, args.slice(1), repService, client);
                    break;

                case 'reset':
                    await this.handleReset(message, args.slice(1), repService, client, db);
                    break;

                case 'roles':
                case 'role':
                case 'rewards':
                    await this.handleRoles(message, args.slice(1), repService, client, db);
                    break;

                case 'suspicious':
                case 'patterns':
                case 'abuse':
                    await this.handleSuspicious(message, args.slice(1), db, client);
                    break;

                case 'config':
                case 'configure':
                case 'settings':
                    await this.handleConfig(message, args.slice(1), db, client);
                    break;

                default:
                    return this.showHelp(message);
            }

        } catch (error) {
            console.error('Reputation command error:', error);
            await message.reply('❌ An error occurred while processing your request.').catch(() => {});
        }
    },

    /**
     * Handle: ^rep give @user reason
     */
    async handleGiveRep(message, args, repService, client) {
        // Check if user mentioned someone
        const mentionedUser = message.mentions.members.first();
        
        if (!mentionedUser) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Invalid Usage')
                .setDescription('You must mention a user to give reputation to!')
                .addFields({
                    name: '📝 Correct Usage',
                    value: '`^rep give @user <reason>`',
                    inline: false
                })
                .addFields({
                    name: '📌 Example',
                    value: '`^rep give @John Helped me solve a bug!`',
                    inline: false
                })
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        // Get reason (everything after the mention)
        const reason = args.slice(1).join(' ').trim();

        if (!reason) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Reason Required')
                .setDescription('You must provide a reason for giving reputation!')
                .addFields({
                    name: '📝 Correct Usage',
                    value: '`^rep give @user <reason>`',
                    inline: false
                })
                .addFields({
                    name: '⚠️ Requirements',
                    value: '• Reason must be 5-200 characters\n• Be specific and meaningful\n• Explain why they deserve reputation',
                    inline: false
                })
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        // Give reputation
        const result = await repService.giveRep(
            message.member,
            mentionedUser,
            message.guild,
            reason,
            message.channel.id
        );

        if (!result.success) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Cannot Give Reputation')
                .setDescription(result.message)
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        // Success! Send confirmation embed
        const { receiver, newRepTotal, rank, reason: cleanReason } = result.data;

        // Log reputation action to logging system
        if (client.loggingSystem) {
            await client.loggingSystem.logReputationAction(
                message.guild.id,
                'give',
                message.author,
                receiver,
                cleanReason,
                message.channel.id,
                {
                    newTotal: newRepTotal,
                    rank: rank
                }
            );
        }

        // Check and assign role rewards
        const roleResult = await repService.checkAndAssignRoles(mentionedUser, message.guild.id, newRepTotal);
        
        const successEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Reputation Given!')
            .setDescription(`${message.author.username} gave reputation to ${receiver.username}!`)
            .setThumbnail(receiver.displayAvatarURL({ dynamic: true }))
            .addFields(
                {
                    name: '👤 Giver',
                    value: `${message.author.toString()}\n\`${message.author.tag}\``,
                    inline: true
                },
                {
                    name: '🎯 Receiver',
                    value: `${receiver.toString()}\n\`${receiver.tag}\``,
                    inline: true
                },
                {
                    name: '⭐ New Total',
                    value: `**${newRepTotal}** reputation`,
                    inline: true
                },
                {
                    name: '🏆 Server Rank',
                    value: rank > 0 ? `#${rank}` : 'Unranked',
                    inline: true
                },
                {
                    name: '📝 Reason',
                    value: `"${cleanReason}"`,
                    inline: false
                }
            )
            .setFooter({ text: 'Thank you for making the community better! 💖' })
            .setTimestamp();

        // Add role rewards notification if any roles were added
        if (roleResult.rolesAdded.length > 0) {
            const roleNames = roleResult.rolesAdded
                .map(roleId => {
                    const role = message.guild.roles.cache.get(roleId);
                    return role ? role.name : 'Unknown Role';
                })
                .join(', ');
            
            successEmbed.addFields({
                name: '🎉 Role Rewards Unlocked!',
                value: `${receiver.username} earned: **${roleNames}**`,
                inline: false
            });
        }

        await message.reply({ embeds: [successEmbed] });
    },

    /**
     * Handle: ^rep check [@user]
     */
    async handleCheckRep(message, args, repService, client) {
        // Check if user mentioned someone, otherwise check their own rep
        const targetMember = message.mentions.members.first() || message.member;
        const targetUser = targetMember.user;

        const result = await repService.getRep(targetUser, message.guild.id);

        if (!result.success) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Error')
                .setDescription(result.message)
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        const { rep, rank, lastReceivedAt } = result.data;

        // Build embed
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`⭐ ${targetUser.username}'s Reputation`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .setDescription(targetUser.id === message.author.id 
                ? 'Here is your reputation information!' 
                : `Viewing ${targetUser.username}'s reputation`)
            .addFields(
                {
                    name: '⭐ Total Reputation',
                    value: `**${rep}** points`,
                    inline: true
                },
                {
                    name: '🏆 Server Rank',
                    value: rank > 0 ? `#${rank}` : 'Unranked',
                    inline: true
                },
                {
                    name: '📊 Status',
                    value: rep >= 50 ? '🌟 Highly Trusted' 
                        : rep >= 20 ? '⭐ Trusted' 
                        : rep >= 10 ? '✨ Active Member'
                        : rep >= 5 ? '📈 Growing'
                        : '🌱 New',
                    inline: true
                }
            );

        // Add last received timestamp if available
        if (lastReceivedAt) {
            embed.addFields({
                name: '🕒 Last Received',
                value: `<t:${Math.floor(lastReceivedAt / 1000)}:R>`,
                inline: false
            });
        }

        embed.setFooter({ text: `Use ^rep leaderboard to see top members` })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },

    /**
     * Handle: ^rep leaderboard [page]
     */
    async handleLeaderboard(message, args, repService, client) {
        const page = parseInt(args[0]) || 1;
        const perPage = 10;

        // Get full leaderboard
        const result = await repService.getLeaderboard(message.guild.id, 100);

        if (!result.success) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Error')
                .setDescription(result.message)
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        const leaderboard = result.data;

        if (leaderboard.length === 0) {
            const embed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('📊 Reputation Leaderboard')
                .setDescription('No one has any reputation yet! Be the first to give some with `^rep give @user <reason>`!')
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        // Calculate pagination
        const maxPage = Math.ceil(leaderboard.length / perPage);
        const currentPage = Math.min(Math.max(1, page), maxPage);
        const startIndex = (currentPage - 1) * perPage;
        const endIndex = startIndex + perPage;
        const pageData = leaderboard.slice(startIndex, endIndex);

        // Build leaderboard description
        let description = '';
        for (let i = 0; i < pageData.length; i++) {
            const entry = pageData[i];
            const position = startIndex + i + 1;
            
            // Medal emojis for top 3
            let medal = '';
            if (position === 1) medal = '🥇';
            else if (position === 2) medal = '🥈';
            else if (position === 3) medal = '🥉';
            else medal = `**${position}.**`;

            try {
                const user = await client.users.fetch(entry.user_id);
                description += `${medal} **${user.username}** - \`${entry.rep}\` rep\n`;
            } catch (error) {
                description += `${medal} Unknown User - \`${entry.rep}\` rep\n`;
            }
        }

        const embed = new EmbedBuilder()
            .setColor('#ffd700')
            .setTitle('🏆 Reputation Leaderboard')
            .setDescription(description || 'No entries found')
            .setFooter({ text: `Page ${currentPage}/${maxPage} • Total Members: ${leaderboard.length}` })
            .setTimestamp();

        // Add pagination buttons if needed
        if (maxPage > 1) {
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`rep_lb_${currentPage - 1}`)
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('⬅️')
                        .setDisabled(currentPage === 1),
                    new ButtonBuilder()
                        .setCustomId(`rep_lb_${currentPage + 1}`)
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('➡️')
                        .setDisabled(currentPage === maxPage)
                );

            await message.reply({ embeds: [embed], components: [row] });
        } else {
            await message.reply({ embeds: [embed] });
        }
    },

    /**
     * Handle: ^rep info
     */
    async handleInfo(message, repService) {
        const stats = await repService.getStats(message.guild.id);

        const embed = new EmbedBuilder()
            .setColor('#5865f2')
            .setTitle('📊 Reputation System Information')
            .setDescription('The reputation system allows members to acknowledge and appreciate helpful community members.')
            .addFields(
                {
                    name: '✅ How It Works',
                    value: '• Use `^rep give @user <reason>` to give reputation\n• Each user can give 1 reputation per day\n• You can\'t give rep to the same user for 7 days\n• You cannot give reputation to yourself or bots',
                    inline: false
                },
                {
                    name: '📝 Requirements',
                    value: '• Account must be at least 7 days old\n• Must be in server for at least 3 days\n• Must provide a reason (5-200 characters)',
                    inline: false
                },
                {
                    name: '🎯 Commands',
                    value: '`^rep give @user <reason>` - Give reputation\n`^rep check [@user]` - Check reputation\n`^rep leaderboard` - View top members\n`^rep history [@user]` - View rep history',
                    inline: false
                }
            );

        if (stats.success) {
            embed.addFields({
                name: '📊 Server Statistics',
                value: `**Total Users:** ${stats.data.totalUsers}\n**Total Rep Given:** ${stats.data.totalRepGiven}\n**Average Rep:** ${stats.data.averageRep}\n**Reps Last 24h:** ${stats.data.repsLast24h}`,
                inline: false
            });
        }

        embed.setFooter({ text: 'Make the community better, one reputation at a time! 💖' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },

    /**
     * Handle: ^rep history [@user]
     * Staff-only when viewing other users
     */
    async handleHistory(message, args, repService, client) {
        // Check if user mentioned someone
        const targetMember = message.mentions.members.first();
        const targetUser = targetMember ? targetMember.user : message.member.user;
        
        // If checking someone else's history, require staff permissions
        if (targetMember && targetMember.id !== message.member.id) {
            const hasPermission = message.member.permissions.has('ManageMessages') || 
                                 message.member.permissions.has('Administrator');
            
            if (!hasPermission) {
                const embed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ Permission Denied')
                    .setDescription('You need **Manage Messages** permission or higher to view other users\' reputation history!')
                    .addFields({
                        name: '💡 Tip',
                        value: 'You can view your own history with `^rep history` (without mentioning anyone)',
                        inline: false
                    })
                    .setFooter({ text: 'Reputation System' })
                    .setTimestamp();

                return message.reply({ embeds: [embed] });
            }
        }

        const result = await repService.getRepHistory(targetUser, message.guild.id, 10);

        if (!result.success) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Error')
                .setDescription(result.message)
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        const history = result.data;

        if (history.length === 0) {
            const embed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('📜 Reputation History')
                .setDescription(`${targetUser.username} hasn't received any reputation yet!`)
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        // Build history description
        let description = `**Recent reputation received by ${targetUser.username}:**\n\n`;
        
        for (const entry of history) {
            try {
                const giver = await client.users.fetch(entry.giver_id);
                const timestamp = `<t:${Math.floor(entry.created_at / 1000)}:R>`;
                description += `⭐ From **${giver.username}** ${timestamp}\n`;
                description += `   *"${entry.reason}"*\n\n`;
            } catch (error) {
                description += `⭐ From Unknown User\n   *"${entry.reason}"*\n\n`;
            }
        }

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('📜 Reputation History')
            .setDescription(description)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: `Showing last ${history.length} reputation entries` })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },

    /**
     * Handle: ^rep reset @user
     * Admin-only command to reset a user's reputation
     */
    async handleReset(message, args, repService, client, db) {
        // Check for admin permissions
        const hasPermission = message.member.permissions.has('Administrator');
        
        if (!hasPermission) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Permission Denied')
                .setDescription('You need **Administrator** permission to reset reputation!')
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        // Check if user mentioned someone
        const targetMember = message.mentions.members.first();
        
        if (!targetMember) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Invalid Usage')
                .setDescription('You must mention a user to reset their reputation!')
                .addFields({
                    name: '📝 Correct Usage',
                    value: '`^rep reset @user`',
                    inline: false
                })
                .addFields({
                    name: '📌 Example',
                    value: '`^rep reset @John`',
                    inline: false
                })
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        const targetUser = targetMember.user;

        try {
            // Get current reputation before reset
            const currentRep = await db.getUserReputation(targetUser.id, message.guild.id);
            const oldRepValue = currentRep.rep || 0;

            // Reset reputation to 0
            await db.updateUserReputation(targetUser.id, message.guild.id, -oldRepValue);

            // Check and remove role rewards after reset
            const roleResult = await repService.checkAndAssignRoles(targetMember, message.guild.id, 0);

            // Log the reset action
            if (client.loggingSystem) {
                await client.loggingSystem.logReputationAction(
                    message.guild.id,
                    'reset',
                    message.author,
                    targetUser,
                    `Reset by administrator (previous: ${oldRepValue})`,
                    message.channel.id,
                    {
                        newTotal: 0,
                        moderator: message.author
                    }
                );
            }

            // Send confirmation
            const embed = new EmbedBuilder()
                .setColor('#ff9900')
                .setTitle('🔄 Reputation Reset')
                .setDescription(`Successfully reset reputation for ${targetUser.username}`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .addFields(
                    {
                        name: '🎯 Target User',
                        value: `${targetUser.toString()}\n\`${targetUser.tag}\``,
                        inline: true
                    },
                    {
                        name: '📊 Previous Reputation',
                        value: `${oldRepValue} points`,
                        inline: true
                    },
                    {
                        name: '⭐ New Reputation',
                        value: '0 points',
                        inline: true
                    },
                    {
                        name: '🛡️ Administrator',
                        value: `${message.author.toString()}\n\`${message.author.tag}\``,
                        inline: false
                    }
                )
                .setFooter({ text: 'Reputation System • Admin Action' })
                .setTimestamp();

            await message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Reset reputation error:', error);
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Error')
                .setDescription('An error occurred while resetting reputation. Please try again.')
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        }
    },

    /**
     * Handle: ^rep roles <add|remove|list>
     * Admin-only command to manage reputation role rewards
     */
    async handleRoles(message, args, repService, client, db) {
        // Check for admin permissions
        const hasPermission = message.member.permissions.has('Administrator');
        
        if (!hasPermission) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Permission Denied')
                .setDescription('You need **Administrator** permission to manage reputation role rewards!')
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        const subcommand = args[0]?.toLowerCase();

        if (!subcommand) {
            // Show roles help
            const embed = new EmbedBuilder()
                .setColor('#5865f2')
                .setTitle('🎁 Reputation Role Rewards - Help')
                .setDescription('Manage automatic role rewards based on reputation thresholds')
                .addFields(
                    {
                        name: '📝 Commands',
                        value: '`^rep roles add <rep_threshold> @role` - Add a role reward\n`^rep roles remove @role` - Remove a role reward\n`^rep roles list` - List all role rewards',
                        inline: false
                    },
                    {
                        name: '📌 Examples',
                        value: '`^rep roles add 10 @Active` - Award @Active role at 10 rep\n`^rep roles add 50 @Trusted` - Award @Trusted role at 50 rep\n`^rep roles remove @Active` - Remove the Active role reward\n`^rep roles list` - View all configured role rewards',
                        inline: false
                    },
                    {
                        name: 'ℹ️ Info',
                        value: 'Roles are automatically assigned/removed when users reach or lose reputation thresholds.',
                        inline: false
                    }
                )
                .setFooter({ text: 'Reputation System • Admin Only' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        switch (subcommand) {
            case 'add':
                await this.handleRolesAdd(message, args.slice(1), db);
                break;
            case 'remove':
            case 'delete':
                await this.handleRolesRemove(message, args.slice(1), db);
                break;
            case 'list':
            case 'show':
                await this.handleRolesList(message, db, client);
                break;
            default:
                const embed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ Invalid Subcommand')
                    .setDescription('Use `^rep roles` to see available commands.')
                    .setFooter({ text: 'Reputation System' })
                    .setTimestamp();
                return message.reply({ embeds: [embed] });
        }
    },

    /**
     * Handle: ^rep roles add <threshold> @role
     */
    async handleRolesAdd(message, args, db) {
        const threshold = parseInt(args[0]);
        const role = message.mentions.roles.first();

        if (!threshold || isNaN(threshold) || threshold < 1) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Invalid Threshold')
                .setDescription('Please provide a valid reputation threshold (positive number).')
                .addFields({
                    name: '📝 Usage',
                    value: '`^rep roles add <rep_threshold> @role`',
                    inline: false
                })
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        if (!role) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Invalid Role')
                .setDescription('Please mention a valid role to add as a reward.')
                .addFields({
                    name: '📝 Usage',
                    value: '`^rep roles add <rep_threshold> @role`',
                    inline: false
                })
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        try {
            await db.addRepRoleReward(message.guild.id, role.id, threshold);

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Role Reward Added')
                .setDescription(`Successfully configured role reward!`)
                .addFields(
                    {
                        name: '🎭 Role',
                        value: `${role.toString()} (\`${role.name}\`)`,
                        inline: true
                    },
                    {
                        name: '⭐ Required Reputation',
                        value: `${threshold} points`,
                        inline: true
                    }
                )
                .addFields({
                    name: 'ℹ️ Info',
                    value: 'Users will automatically receive this role when they reach the reputation threshold.',
                    inline: false
                })
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error adding role reward:', error);
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Error')
                .setDescription('An error occurred while adding the role reward.')
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        }
    },

    /**
     * Handle: ^rep roles remove @role
     */
    async handleRolesRemove(message, args, db) {
        const role = message.mentions.roles.first();

        if (!role) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Invalid Role')
                .setDescription('Please mention a valid role to remove.')
                .addFields({
                    name: '📝 Usage',
                    value: '`^rep roles remove @role`',
                    inline: false
                })
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        try {
            const removed = await db.removeRepRoleReward(message.guild.id, role.id);

            if (removed) {
                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('✅ Role Reward Removed')
                    .setDescription(`Successfully removed role reward for ${role.toString()}`)
                    .setFooter({ text: 'Reputation System' })
                    .setTimestamp();

                await message.reply({ embeds: [embed] });
            } else {
                const embed = new EmbedBuilder()
                    .setColor('#ffaa00')
                    .setTitle('⚠️ Not Found')
                    .setDescription(`No role reward found for ${role.toString()}`)
                    .setFooter({ text: 'Reputation System' })
                    .setTimestamp();

                await message.reply({ embeds: [embed] });
            }
        } catch (error) {
            console.error('Error removing role reward:', error);
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Error')
                .setDescription('An error occurred while removing the role reward.')
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        }
    },

    /**
     * Handle: ^rep roles list
     */
    async handleRolesList(message, db, client) {
        try {
            const roleRewards = await db.getRepRoleRewards(message.guild.id);

            if (roleRewards.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#ffaa00')
                    .setTitle('🎁 Reputation Role Rewards')
                    .setDescription('No role rewards configured yet!')
                    .addFields({
                        name: '💡 Get Started',
                        value: 'Use `^rep roles add <threshold> @role` to add your first role reward.',
                        inline: false
                    })
                    .setFooter({ text: 'Reputation System' })
                    .setTimestamp();

                return message.reply({ embeds: [embed] });
            }

            let description = '**Configured role rewards:**\n\n';
            for (const reward of roleRewards) {
                const role = message.guild.roles.cache.get(reward.role_id);
                const roleName = role ? role.toString() : `Unknown Role (${reward.role_id})`;
                description += `⭐ **${reward.rep_threshold} reputation** → ${roleName}\n`;
            }

            const embed = new EmbedBuilder()
                .setColor('#5865f2')
                .setTitle('🎁 Reputation Role Rewards')
                .setDescription(description)
                .addFields({
                    name: 'ℹ️ Info',
                    value: `Total rewards: ${roleRewards.length}\nRoles are automatically assigned when users reach thresholds.`,
                    inline: false
                })
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error listing role rewards:', error);
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Error')
                .setDescription('An error occurred while fetching role rewards.')
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        }
    },

    /**
     * Handle: ^rep suspicious
     * Admin-only command to view suspicious reputation patterns
     */
    async handleSuspicious(message, args, db, client) {
        // Check for admin permissions
        const hasPermission = message.member.permissions.has('Administrator');
        
        if (!hasPermission) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Permission Denied')
                .setDescription('You need **Administrator** permission to view suspicious patterns!')
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        try {
            const patterns = await db.getSuspiciousPatterns(message.guild.id, true);

            if (patterns.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('✅ No Suspicious Patterns')
                    .setDescription('No suspicious reputation trading patterns detected!')
                    .addFields({
                        name: 'ℹ️ Info',
                        value: 'The system automatically detects users who exchange reputation with each other 3+ times in 30 days.',
                        inline: false
                    })
                    .setFooter({ text: 'Reputation System' })
                    .setTimestamp();

                return message.reply({ embeds: [embed] });
            }

            let description = `**${patterns.length} suspicious pattern(s) detected:**\n\n`;
            
            for (let i = 0; i < Math.min(patterns.length, 5); i++) {
                const pattern = patterns[i];
                const user1 = await client.users.fetch(pattern.user1_id).catch(() => null);
                const user2 = await client.users.fetch(pattern.user2_id).catch(() => null);
                
                const user1Name = user1 ? user1.username : 'Unknown User';
                const user2Name = user2 ? user2.username : 'Unknown User';
                
                const timestamp = `<t:${Math.floor(pattern.logged_at / 1000)}:R>`;
                description += `⚠️ **${user1Name}** ↔ **${user2Name}**\n`;
                description += `   Exchanges: ${pattern.pattern_data.count} (${pattern.pattern_data.aToB}→, ←${pattern.pattern_data.bToA})\n`;
                description += `   Detected: ${timestamp}\n\n`;
            }

            if (patterns.length > 5) {
                description += `*...and ${patterns.length - 5} more*\n`;
            }

            const embed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('⚠️ Suspicious Reputation Patterns')
                .setDescription(description)
                .addFields({
                    name: '📊 Detection Criteria',
                    value: '• 3+ mutual reputation exchanges in 30 days\n• Both users giving rep to each other\n• Logged but not automatically blocked',
                    inline: false
                })
                .addFields({
                    name: '🔍 Review Action',
                    value: 'Review user histories with `^rep history @user` and consider `^rep reset @user` if abuse is confirmed.',
                    inline: false
                })
                .setFooter({ text: 'Reputation System • Abuse Detection' })
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching suspicious patterns:', error);
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Error')
                .setDescription('An error occurred while fetching suspicious patterns.')
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        }
    },

    /**
     * Handle: ^rep config
     * Admin-only command to configure reputation system settings
     */
    async handleConfig(message, args, db, client) {
        // Check for admin permissions
        const hasPermission = message.member.permissions.has('Administrator');
        
        if (!hasPermission) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Permission Denied')
                .setDescription('You need **Administrator** permission to configure the reputation system!')
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        const subcommand = args[0]?.toLowerCase();

        if (!subcommand) {
            // Show current configuration
            return await this.showCurrentConfig(message, db);
        }

        switch (subcommand) {
            case 'enable':
                await this.configSetEnabled(message, db, true);
                break;
            case 'disable':
                await this.configSetEnabled(message, db, false);
                break;
            case 'cooldown':
                await this.configSetCooldown(message, args.slice(1), db);
                break;
            case 'dailylimit':
            case 'daily':
                await this.configSetDailyLimit(message, args.slice(1), db);
                break;
            case 'reason':
                await this.configSetReasonRequired(message, args.slice(1), db);
                break;
            case 'channels':
            case 'channel':
                await this.configSetChannels(message, args.slice(1), db);
                break;
            case 'logchannel':
            case 'log':
                await this.configSetLogChannel(message, args.slice(1), db);
                break;
            case 'reset':
                await this.configReset(message, db);
                break;
            default:
                await this.showCurrentConfig(message, db);
        }
    },

    async showCurrentConfig(message, db) {
        try {
            const config = await db.getGuildConfig(message.guild.id);

            const embed = new EmbedBuilder()
                .setColor('#5865f2')
                .setTitle('⚙️ Reputation System Configuration')
                .setDescription('Current reputation system settings for this server')
                .addFields(
                    {
                        name: '🔧 System Status',
                        value: `Enabled: ${config.reputation_enabled ? '✅ Yes' : '❌ No'}`,
                        inline: true
                    },
                    {
                        name: '⏰ Cooldowns',
                        value: `Same-user: ${config.reputation_cooldown_days} days\nDaily limit: ${config.reputation_daily_limit} per day`,
                        inline: true
                    },
                    {
                        name: '📝 Reason Settings',
                        value: `Required: ${config.reputation_reason_required ? 'Yes' : 'No'}\nMin length: ${config.reputation_min_reason_length} chars\nMax length: ${config.reputation_max_reason_length} chars`,
                        inline: true
                    },
                    {
                        name: '👤 Account Requirements',
                        value: `Min account age: ${config.reputation_min_account_age_days} days\nMin server time: ${config.reputation_min_server_age_days} days`,
                        inline: true
                    },
                    {
                        name: '📍 Allowed Channels',
                        value: config.reputation_allowed_channels && config.reputation_allowed_channels.length > 0 
                            ? config.reputation_allowed_channels.map(id => `<#${id}>`).join(', ')
                            : 'All channels',
                        inline: true
                    },
                    {
                        name: '📊 Log Channel',
                        value: config.reputation_log_channel ? `<#${config.reputation_log_channel}>` : 'Not set',
                        inline: true
                    }
                )
                .addFields({
                    name: '⚙️ Configuration Commands',
                    value: '`^rep config enable/disable` - Toggle system\n`^rep config cooldown <days>` - Set cooldown duration\n`^rep config daily <amount>` - Set daily limit\n`^rep config reason <true/false>` - Require reason\n`^rep config channels <#channel...>` - Set allowed channels\n`^rep config log <#channel>` - Set log channel\n`^rep config reset` - Reset to defaults',
                    inline: false
                })
                .setFooter({ text: 'Reputation System • Admin Only' })
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error showing config:', error);
            await message.reply('❌ An error occurred while fetching configuration.');
        }
    },

    async configSetEnabled(message, db, enabled) {
        try {
            const config = await db.getGuildConfig(message.guild.id);
            config.reputation_enabled = enabled;
            await db.updateGuildConfig(message.guild.id, config);

            const embed = new EmbedBuilder()
                .setColor(enabled ? '#00ff00' : '#ff9900')
                .setTitle(enabled ? '✅ System Enabled' : '⚠️ System Disabled')
                .setDescription(`Reputation system has been ${enabled ? 'enabled' : 'disabled'} for this server.`)
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error setting enabled:', error);
            await message.reply('❌ An error occurred while updating configuration.');
        }
    },

    async configSetCooldown(message, args, db) {
        const days = parseInt(args[0]);

        if (!days || days < 1 || days > 30) {
            return await message.reply('❌ Please provide a valid cooldown duration between 1 and 30 days.');
        }

        try {
            const config = await db.getGuildConfig(message.guild.id);
            config.reputation_cooldown_days = days;
            await db.updateGuildConfig(message.guild.id, config);

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Cooldown Updated')
                .setDescription(`Same-user cooldown set to **${days} days**.`)
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error setting cooldown:', error);
            await message.reply('❌ An error occurred while updating configuration.');
        }
    },

    async configSetDailyLimit(message, args, db) {
        const limit = parseInt(args[0]);

        if (!limit || limit < 1 || limit > 10) {
            return await message.reply('❌ Please provide a valid daily limit between 1 and 10.');
        }

        try {
            const config = await db.getGuildConfig(message.guild.id);
            config.reputation_daily_limit = limit;
            await db.updateGuildConfig(message.guild.id, config);

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Daily Limit Updated')
                .setDescription(`Daily reputation limit set to **${limit} per day**.`)
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error setting daily limit:', error);
            await message.reply('❌ An error occurred while updating configuration.');
        }
    },

    async configSetReasonRequired(message, args, db) {
        const value = args[0]?.toLowerCase();

        if (value !== 'true' && value !== 'false') {
            return await message.reply('❌ Please specify `true` or `false`.');
        }

        const required = value === 'true';

        try {
            const config = await db.getGuildConfig(message.guild.id);
            config.reputation_reason_required = required;
            await db.updateGuildConfig(message.guild.id, config);

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Reason Requirement Updated')
                .setDescription(`Reason is now **${required ? 'required' : 'optional'}** when giving reputation.`)
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error setting reason requirement:', error);
            await message.reply('❌ An error occurred while updating configuration.');
        }
    },

    async configSetChannels(message, args, db) {
        if (args.length === 0 || args[0] === 'clear') {
            // Clear channel restrictions
            try {
                const config = await db.getGuildConfig(message.guild.id);
                config.reputation_allowed_channels = [];
                await db.updateGuildConfig(message.guild.id, config);

                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('✅ Channel Restrictions Cleared')
                    .setDescription('Reputation can now be given in **all channels**.')
                    .setFooter({ text: 'Reputation System' })
                    .setTimestamp();

                return await message.reply({ embeds: [embed] });
            } catch (error) {
                console.error('Error clearing channels:', error);
                return await message.reply('❌ An error occurred while updating configuration.');
            }
        }

        const channels = message.mentions.channels;
        if (channels.size === 0) {
            return await message.reply('❌ Please mention at least one channel or use `clear` to allow all channels.');
        }

        try {
            const config = await db.getGuildConfig(message.guild.id);
            config.reputation_allowed_channels = Array.from(channels.keys());
            await db.updateGuildConfig(message.guild.id, config);

            const channelList = Array.from(channels.values()).map(c => c.toString()).join(', ');

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Allowed Channels Updated')
                .setDescription(`Reputation can now only be given in: ${channelList}`)
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error setting channels:', error);
            await message.reply('❌ An error occurred while updating configuration.');
        }
    },

    async configSetLogChannel(message, args, db) {
        if (args.length === 0 || args[0] === 'clear') {
            // Clear log channel
            try {
                const config = await db.getGuildConfig(message.guild.id);
                config.reputation_log_channel = null;
                await db.updateGuildConfig(message.guild.id, config);

                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('✅ Log Channel Cleared')
                    .setDescription('Reputation actions will no longer be logged to a channel.')
                    .setFooter({ text: 'Reputation System' })
                    .setTimestamp();

                return await message.reply({ embeds: [embed] });
            } catch (error) {
                console.error('Error clearing log channel:', error);
                return await message.reply('❌ An error occurred while updating configuration.');
            }
        }

        const channel = message.mentions.channels.first();
        if (!channel) {
            return await message.reply('❌ Please mention a channel or use `clear` to disable logging.');
        }

        try {
            const config = await db.getGuildConfig(message.guild.id);
            config.reputation_log_channel = channel.id;
            await db.updateGuildConfig(message.guild.id, config);

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Log Channel Set')
                .setDescription(`Reputation actions will now be logged to ${channel.toString()}`)
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error setting log channel:', error);
            await message.reply('❌ An error occurred while updating configuration.');
        }
    },

    async configReset(message, db) {
        try {
            const config = await db.getGuildConfig(message.guild.id);
            
            // Reset to defaults
            config.reputation_enabled = true;
            config.reputation_cooldown_days = 7;
            config.reputation_daily_limit = 1;
            config.reputation_reason_required = true;
            config.reputation_min_account_age_days = 7;
            config.reputation_min_server_age_days = 3;
            config.reputation_allowed_channels = [];
            config.reputation_min_reason_length = 5;
            config.reputation_max_reason_length = 200;
            
            await db.updateGuildConfig(message.guild.id, config);

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Configuration Reset')
                .setDescription('Reputation system configuration has been reset to default values.')
                .addFields({
                    name: 'Default Settings',
                    value: '• Enabled: Yes\n• Same-user cooldown: 7 days\n• Daily limit: 1\n• Reason required: Yes\n• Min account age: 7 days\n• Min server time: 3 days\n• Allowed channels: All',
                    inline: false
                })
                .setFooter({ text: 'Reputation System' })
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error resetting config:', error);
            await message.reply('❌ An error occurred while resetting configuration.');
        }
    },

    /**
     * Show help message
     */
    showHelp(message) {
        const isStaff = message.member.permissions.has('ManageMessages');
        const isAdmin = message.member.permissions.has('Administrator');

        const embed = new EmbedBuilder()
            .setColor('#5865f2')
            .setTitle('⭐ Reputation System - Help')
            .setDescription('Give and track reputation/karma points to appreciate helpful community members!')
            .addFields(
                {
                    name: '📝 Commands',
                    value: '`^rep give @user <reason>` - Give reputation to a user\n`^rep check [@user]` - Check your or someone\'s reputation\n`^rep leaderboard` - View the top members\n`^rep history` - View your reputation history\n`^rep info` - Learn more about the system',
                    inline: false
                },
                {
                    name: '📌 Examples',
                    value: '`^rep give @John Helped me fix a bug!`\n`^rep check`\n`^rep check @John`\n`^rep leaderboard`',
                    inline: false
                },
                {
                    name: '⚠️ Rules',
                    value: '• You can give 1 rep per day\n• 7 day cooldown per user\n• Cannot rep yourself or bots\n• Reason must be 5-200 characters',
                    inline: false
                }
            );

        // Add staff commands if user has permissions
        if (isStaff) {
            embed.addFields({
                name: '🛡️ Staff Commands',
                value: '`^rep history @user` - View any user\'s reputation history',
                inline: false
            });
        }

        // Add admin commands if user has permissions
        if (isAdmin) {
            embed.addFields({
                name: '⚙️ Admin Commands',
                value: '`^rep reset @user` - Reset a user\'s reputation to 0\n`^rep roles <add|remove|list>` - Manage role rewards\n`^rep suspicious` - View suspicious trading patterns\n`^rep config` - Configure reputation system settings',
                inline: false
            });
        }

        embed.setFooter({ text: 'Reputation System • Use ^rep info for more details' })
            .setTimestamp();

        return message.reply({ embeds: [embed] });
    }
};

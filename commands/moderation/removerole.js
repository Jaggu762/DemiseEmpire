const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'removerole',
    description: 'Remove one or many roles from multiple users at once',
    aliases: ['takerole', 'roleremove'],
    category: 'Moderation',
    usage: '^removerole @role1 [@role2 ...] @user1 [@user2 ...]',
    permissions: ['ManageRoles'],
    
    async execute(message, args, client, db) {
        // Check permissions
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return message.reply('❌ You need the **Manage Roles** permission to use this command!');
        }
        
        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return message.reply('❌ I need the **Manage Roles** permission to remove roles!');
        }
        
        const roles = message.mentions.roles;
        const users = message.mentions.users;

        if (roles.size === 0 || users.size === 0) {
            return message.reply('❌ Usage: `^removerole @role1 [@role2 ...] @user1 [@user2 ...]`\nYou can target multiple roles and users in one command.');
        }

        const botMember = message.guild.members.me;
        const unmanageableRoles = [];
        const unauthorizedRoles = [];

        const manageableRoles = Array.from(roles.values()).filter(role => {
            if (role.position >= botMember.roles.highest.position) {
                unmanageableRoles.push(role.name);
                return false;
            }
            if (role.position >= message.member.roles.highest.position && message.guild.ownerId !== message.author.id) {
                unauthorizedRoles.push(role.name);
                return false;
            }
            return true;
        });

        if (manageableRoles.length === 0) {
            const issues = [];
            if (unmanageableRoles.length) issues.push(`I cannot manage: ${unmanageableRoles.join(', ')}`);
            if (unauthorizedRoles.length) issues.push(`You cannot manage: ${unauthorizedRoles.join(', ')}`);
            return message.reply(`❌ No manageable roles found. ${issues.join(' ')}`.trim());
        }

        const results = {
            success: [],
            doesntHave: [],
            failed: [],
            skippedBot: unmanageableRoles,
            skippedUser: unauthorizedRoles
        };

        for (const [userId, user] of users) {
            let member;
            try {
                member = await message.guild.members.fetch(userId);
            } catch (error) {
                results.failed.push({ label: `${user.username}`, reason: 'Member not found' });
                continue;
            }

            for (const role of manageableRoles) {
                try {
                    if (!member.roles.cache.has(role.id)) {
                        results.doesntHave.push(`${user.username} → ${role.name}`);
                        continue;
                    }

                    await member.roles.remove(role);
                    results.success.push(`${user.username} → ${role.name}`);
                } catch (error) {
                    results.failed.push({ label: `${user.username} → ${role.name}`, reason: error.message });
                }
            }
        }

        const embed = new EmbedBuilder()
            .setColor(results.success.length > 0 ? '#00ff00' : '#ff0000')
            .setTitle('👥 Role Management')
            .setDescription(`Requested by ${message.author}`)
            .setTimestamp();

        if (results.success.length) {
            embed.addFields({
                name: `✅ Removed (${results.success.length})`,
                value: results.success.slice(0, 25).map(v => `• ${v}`).join('\n'),
                inline: false
            });
        }

        if (results.doesntHave.length) {
            embed.addFields({
                name: `ℹ️ Missing Role (${results.doesntHave.length})`,
                value: results.doesntHave.slice(0, 25).map(v => `• ${v}`).join('\n'),
                inline: false
            });
        }

        if (results.failed.length) {
            embed.addFields({
                name: `❌ Failed (${results.failed.length})`,
                value: results.failed.slice(0, 25).map(f => `• ${f.label}: ${f.reason}`).join('\n'),
                inline: false
            });
        }

        if (results.skippedBot.length || results.skippedUser.length) {
            const notes = [];
            if (results.skippedBot.length) notes.push(`Bot cannot manage: ${results.skippedBot.join(', ')}`);
            if (results.skippedUser.length) notes.push(`You cannot manage: ${results.skippedUser.join(', ')}`);
            embed.addFields({ name: '⚠️ Skipped Roles', value: notes.join('\n'), inline: false });
        }

        await message.reply({ embeds: [embed] });

        const guildConfig = await db.getGuildConfig(message.guild.id);
        if (guildConfig.mod_log_channel && results.success.length > 0) {
            const logChannel = message.guild.channels.cache.get(guildConfig.mod_log_channel);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('📝 Roles Removed')
                    .addFields(
                        { name: 'Roles', value: manageableRoles.map(r => r.toString()).join(', '), inline: false },
                        { name: 'Removed By', value: `${message.author}`, inline: true },
                        { name: 'Users', value: users.size.toString(), inline: true }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] });
            }
        }
    }
};

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'reactionrole',
    description: 'Create and manage self-assignable role panels',
    aliases: ['rr', 'reactionroles', 'rolereaction'],
    category: 'Moderation',
    usage: '^reactionrole create "Title" "Description" @role:emoji ...',
    permissions: ['ManageRoles'],
    
    async execute(message, args, client, db) {
        const subCommand = args[0]?.toLowerCase();
        ensureStorage(db);
        
        if (!subCommand) {
            return showReactionRoleInfo(message);
        }
        
        switch (subCommand) {
            case 'create':
                return createReactionRolePanel(message, client, db);
            case 'add':
                return addRolesToPanel(message, args.slice(1), client, db);
            case 'remove':
            case 'rm':
                return removeRolesFromPanel(message, args.slice(1), db);
            case 'list':
                return listReactionRoles(message, db);
            case 'delete':
            case 'del':
                return deleteReactionRole(message, args.slice(1), db);
            case 'help':
            case 'info':
                return showReactionRoleInfo(message);
            default:
                return showReactionRoleInfo(message);
        }
    }
};

function ensureStorage(db) {
    if (!db.data.reactionRoles) db.data.reactionRoles = {};
}

function showReactionRoleInfo(message) {
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('🎭 Reaction Role System')
        .setDescription('Create interactive role panels with buttons (up to 25 roles).')
        .addFields(
            { name: '📝 Step 1: Create Panel', value: '`^rr create "Title" "Description"`\nExample: `^rr create "Game Roles" "Pick your favorite games!"`', inline: false },
            { name: '➕ Step 2: Add Roles', value: '`^rr add <panelId> @role emoji`\nExample: `^rr add rr_1234567890 @Roblox 🎮`\n*Get panel ID from ^rr list*', inline: false },
            { name: '➖ Remove Roles', value: '`^rr remove <panelId> @role`\nExample: `^rr remove rr_1234567890 @Roblox`', inline: false },
            { name: '📋 Manage', value: '`^rr list` - View all panels\n`^rr delete <panelId>` - Delete a panel', inline: false },
            { name: '💡 Quick Start', value: '```\n^rr create "Game Roles" "Pick your games!"\n^rr list  (copy the panel ID)\n^rr add rr_1234567890 @Roblox 🎮\n^rr add rr_1234567890 @Minecraft ⛏️\n^rr add rr_1234567890 @GTA 🚗\n```\nThe panel updates automatically!', inline: false }
        )
        .setFooter({ text: 'Users toggle roles by clicking buttons • Panels auto-update when you add/remove roles' });
    return message.reply({ embeds: [embed] });
}

async function createReactionRolePanel(message, client, db) {
    if (!hasManageRoles(message)) return;

    const parsed = parseCreateInput(message.content);
    if (parsed.error) {
        return message.reply(parsed.error);
    }

    const { title, description, roleTokens } = parsed;
    if (roleTokens.length > 25) {
        return message.reply('❌ Too many roles. Maximum 25 per panel.');
    }

    let roles = [];
    if (roleTokens.length > 0) {
        const validation = validateRoles(message, roleTokens);
        if (validation.errors.length) {
            return message.reply(`❌ ${validation.errors.join('\n')}`);
        }
        roles = validation.roles;
    }

    const panelId = `rr_${Date.now()}`;

    let rolesList = '';
    if (roles.length > 0) {
        rolesList = '\n\n**React to get these roles:**\n' + roles.map((r, i) => `${i + 1}. ${r.emoji || '🎯'} <@&${r.roleId}>`).join('\n');
    } else {
        rolesList = '\n\n*No roles added yet. Use `^rr add <panelId> @role emoji` to add roles.*';
    }

    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(title)
        .setDescription(description + rolesList)
        .setFooter({ text: 'Click buttons below to toggle roles' })
        .setTimestamp();

    const components = roles.length > 0 ? buildRoleButtons(roles) : [];
    const panelMessage = await message.channel.send({ embeds: [embed], components });

    const panelData = {
        id: panelId,
        guildId: message.guild.id,
        channelId: message.channel.id,
        messageId: panelMessage.id,
        createdBy: message.author.id,
        title,
        description,
        roles,
        createdAt: Date.now()
    };

    db.data.reactionRoles[panelId] = panelData;
    db.save();

    const confirm = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Reaction Role Panel Created')
        .setDescription(`Your panel is now active! Copy the ID below to add/remove roles later.`)
        .addFields(
            { name: '🆔 Panel ID', value: `\`${panelId}\``, inline: false },
            { name: 'Roles', value: roles.length.toString(), inline: true },
            { name: 'Channel', value: `${message.channel}`, inline: true }
        )
        .setFooter({ text: 'Use ^rr add <panelId> @role:emoji to add more roles' });

    await message.reply({ embeds: [confirm] });
}

async function addRolesToPanel(message, args, client, db) {
    if (!hasManageRoles(message)) return;
    if (args.length < 2) {
        return message.reply('❌ Usage: `^rr add <panelId> @role emoji`\n\n**Example:**\n`^rr add rr_1234567890 @Roblox 🎮`\n\n💡 Use `^rr list` to see your panel IDs.');
    }

    const panelId = args[0];
    const panel = db.data.reactionRoles[panelId];
    if (!panel || panel.guildId !== message.guild.id) {
        return message.reply('❌ Panel not found for this server.\n\n💡 Use `^rr list` to see available panel IDs.');
    }

    // Parse role and emoji from args
    const roleMention = message.mentions.roles.first();
    if (!roleMention) {
        return message.reply('❌ Please mention a valid role. Example: `^rr add ${panelId} @Roblox 🎮`');
    }

    // Find emoji in args (anything after the role mention)
    const emojiArg = args.slice(1).find(arg => !arg.includes('<@&'));
    const emoji = emojiArg || '🎯';

    if (panel.roles.length >= 25) {
        return message.reply('❌ This panel already has 25 roles (maximum).');
    }

    const existing = new Set(panel.roles.map(r => r.roleId));
    if (existing.has(roleMention.id)) {
        return message.reply(`❌ ${roleMention} is already in this panel.`);
    }

    const botMember = message.guild.members.me;
    if (roleMention.position >= botMember.roles.highest.position) {
        return message.reply(`❌ I cannot manage ${roleMention.name} (higher than my top role).`);
    }
    if (roleMention.position >= message.member.roles.highest.position && message.guild.ownerId !== message.author.id) {
        return message.reply(`❌ You cannot manage ${roleMention.name} (higher than your top role).`);
    }

    panel.roles.push({ roleId: roleMention.id, roleName: roleMention.name, emoji });
    db.data.reactionRoles[panelId] = panel;
    db.save();

    await refreshPanelMessage(message, panel);
    await message.reply(`✅ Added ${emoji} ${roleMention} to panel!`);
}

async function removeRolesFromPanel(message, args, db) {
    if (!hasManageRoles(message)) return;
    if (args.length < 2) {
        return message.reply('❌ Usage: `^rr remove <panelId> @role [@role2 ...]`\n\n**Example:**\n`^rr remove rr_1234567890 @Roblox @Minecraft`\n\n💡 Use `^rr list` to see your panel IDs.');
    }

    const panelId = args[0];
    const panel = db.data.reactionRoles[panelId];
    if (!panel || panel.guildId !== message.guild.id) {
        return message.reply('❌ Panel not found for this server.\n\n💡 Use `^rr list` to see available panel IDs.');
    }

    const roleIdsToRemove = extractRoleIds(args.slice(1));
    if (!roleIdsToRemove.length) {
        return message.reply('❌ Please mention at least one role to remove.');
    }

    const before = panel.roles.length;
    panel.roles = panel.roles.filter(r => !roleIdsToRemove.has(r.roleId));
    const removedCount = before - panel.roles.length;

    db.data.reactionRoles[panelId] = panel;
    db.save();

    await refreshPanelMessage(message, panel);
    await message.reply(`✅ Removed ${removedCount} role(s) from panel ${panelId}.`);
}

async function listReactionRoles(message, db) {
    const panels = Object.values(db.data.reactionRoles).filter(p => p.guildId === message.guild.id);
    if (!panels.length) {
        return message.reply('❌ No reaction role panels found in this server.\n\n**First time?** Create a panel first:\n`^rr create "Game Roles" "Pick your games!" @Roblox:🎮 @Minecraft:⛏️`');
    }

    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('🎭 Reaction Role Panels')
        .setDescription(`Found ${panels.length} panel(s) in this server.\n\n💡 Copy the panel ID to add/remove roles or delete a panel.`)
        .setFooter({ text: 'Use ^rr delete <panelId> to remove a panel' });

    for (const panel of panels.slice(0, 10)) {
        let rolePreview = '';
        if (panel.roles.length > 0) {
            const roleList = panel.roles.slice(0, 3).map(r => `${r.emoji} ${r.roleName}`).join(', ');
            const more = panel.roles.length > 3 ? ` +${panel.roles.length - 3} more` : '';
            rolePreview = `\n**Roles:** ${roleList}${more}`;
        } else {
            rolePreview = '\n*No roles yet*';
        }
        embed.addFields({
            name: `📋 ${panel.title}`,
            value: `**ID:** \`${panel.id}\`\n**Channel:** <#${panel.channelId}>${rolePreview}`,
            inline: false
        });
    }

    await message.reply({ embeds: [embed] });
}

async function deleteReactionRole(message, args, db) {
    if (!hasManageRoles(message)) return;
    if (!args.length) {
        return message.reply('❌ Usage: `^rr delete <panelId>`\n\n**Example:**\n`^rr delete rr_1234567890`\n\n💡 Use `^rr list` to see your panel IDs.');
    }

    const panelId = args[0];
    const panel = db.data.reactionRoles[panelId];
    if (!panel || panel.guildId !== message.guild.id) {
        return message.reply('❌ Panel not found for this server.\n\n💡 Use `^rr list` to see available panel IDs.');
    }

    try {
        const channel = message.guild.channels.cache.get(panel.channelId);
        if (channel) {
            const panelMessage = await channel.messages.fetch(panel.messageId).catch(() => null);
            if (panelMessage) await panelMessage.delete();
        }
    } catch (error) {
        // message might already be gone
    }

    delete db.data.reactionRoles[panelId];
    db.save();

    await message.reply(`✅ Deleted panel ${panelId}.`);
}

function hasManageRoles(message) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        message.reply('❌ You need the **Manage Roles** permission to use this command.');
        return false;
    }
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
        message.reply('❌ I need the **Manage Roles** permission to manage reaction roles.');
        return false;
    }
    return true;
}

function parseCreateInput(content) {
    const match = content.match(/(reactionrole|rr|reactionroles|rolereaction)\s+create\s+"([^"]+)"\s+"([^"]+)"\s*(.*)/i);
    if (!match) {
        return { error: '❌ Usage: `^rr create "Title" "Description"`\n\n**Example:**\n`^rr create "Game Roles" "Pick your favorite games!"`\n\nAfter creating, use `^rr list` to get the panel ID, then add roles with `^rr add <panelId> @role emoji`' };
    }
    const [, , title, description, remainder] = match;
    const roleTokens = remainder ? remainder.split(/\s+/).filter(Boolean) : [];
    return { title, description, roleTokens };
}

function extractRoleIds(tokens) {
    const set = new Set();
    for (const token of tokens) {
        const roleIdMatch = token.match(/<@&(\d+)>/);
        if (roleIdMatch) set.add(roleIdMatch[1]);
    }
    return set;
}

function validateRoles(message, roleTokens, existing = new Set()) {
    const botMember = message.guild.members.me;
    const roles = [];
    const errors = [];
    const used = new Set(existing);

    for (const token of roleTokens) {
        const [rolePart, emojiPart] = token.split(':');
        const roleIdMatch = rolePart?.match(/<@&(\d+)>/);
        if (!roleIdMatch) {
            errors.push(`Invalid role token: ${token}`);
            continue;
        }
        const roleId = roleIdMatch[1];
        if (used.has(roleId)) {
            errors.push(`Duplicate role skipped: <@&${roleId}>`);
            continue;
        }
        const role = message.guild.roles.cache.get(roleId);
        if (!role) {
            errors.push(`Role not found: <@&${roleId}>`);
            continue;
        }
        if (role.position >= botMember.roles.highest.position) {
            errors.push(`I cannot manage ${role.name} (higher than my top role).`);
            continue;
        }
        if (role.position >= message.member.roles.highest.position && message.guild.ownerId !== message.author.id) {
            errors.push(`You cannot manage ${role.name} (higher than your top role).`);
            continue;
        }

        roles.push({ roleId, roleName: role.name, emoji: emojiPart || '🎯' });
        used.add(roleId);
    }

    return { roles, errors };
}

function buildRoleButtons(roles) {
    const rows = [];
    for (let i = 0; i < roles.length; i += 5) {
        const row = new ActionRowBuilder();
        for (const role of roles.slice(i, i + 5)) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`rr_${role.roleId}`)
                    .setEmoji(role.emoji)
                    .setStyle(ButtonStyle.Primary)
            );
        }
        rows.push(row);
    }
    return rows;
}

async function refreshPanelMessage(message, panel) {
    const channel = message.guild.channels.cache.get(panel.channelId);
    if (!channel) return;

    const msg = await channel.messages.fetch(panel.messageId).catch(() => null);
    if (!msg) return;

    let rolesList = '';
    if (panel.roles.length > 0) {
        rolesList = '\n\n**React to get these roles:**\n' + panel.roles.map((r, i) => `${i + 1}. ${r.emoji || '🎯'} <@&${r.roleId}>`).join('\n');
    } else {
        rolesList = '\n\n*No roles added yet. Use `^rr add <panelId> @role emoji` to add roles.*';
    }

    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(panel.title)
        .setDescription(panel.description + rolesList)
        .setFooter({ text: 'Click buttons below to toggle roles' })
        .setTimestamp(panel.createdAt);

    const components = panel.roles.length > 0 ? buildRoleButtons(panel.roles) : [];
    await msg.edit({ embeds: [embed], components });
}

const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'djmode',
    description: 'Manage AI DJ mode: toggle and set profile (gaming, chill, party, focus, edm, lofi)',
    aliases: ['dj','djprofile'],
    category: 'music',
    async execute(message, args, client, db) {
        try {
            if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild) &&
                !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return message.reply('❌ You need Manage Server or Administrator to toggle DJ mode.');
            }
            if (!db) {
                const Database = require('../../utils/database');
                const dbInstance = new Database();
                db = await dbInstance.initialize();
            }
            const sub = (args[0] || '').toLowerCase();
            const cfg = await db.getGuildConfig(message.guild.id);

            // Set profile
            if (sub === 'profile') {
                const profile = (args[1] || '').toLowerCase();
                const allowed = ['gaming','chill','party','focus','edm','lofi','default'];
                if (!allowed.includes(profile)) {
                    return message.reply(`❌ Invalid profile. Use one of: ${allowed.join(', ')}`);
                }
                await db.updateGuildConfig(message.guild.id, { dj_mode_profile: profile });
                const embed = new EmbedBuilder()
                    .setColor('#0061ff')
                    .setTitle('🎧 DJ Mode Profile')
                    .setDescription(`Profile set to **${profile}**`)
                    .setTimestamp();
                return message.channel.send({ embeds: [embed] });
            }

            // Toggle
            let enable;
            if (!sub) enable = null; // toggle
            else if (['on','enable','true'].includes(sub)) enable = true;
            else if (['off','disable','false'].includes(sub)) enable = false;
            else if (sub === 'status') {
                const embed = new EmbedBuilder()
                    .setColor('#0061ff')
                    .setTitle('🎧 DJ Mode Status')
                    .addFields(
                        { name: 'Enabled', value: String(cfg.dj_mode_enabled), inline: true },
                        { name: 'Profile', value: cfg.dj_mode_profile || 'default', inline: true }
                    )
                    .setTimestamp();
                return message.channel.send({ embeds: [embed] });
            } else {
                return message.reply('❌ Use `djmode [on|off|status]` or `djmode profile <gaming|chill|party|focus|edm|lofi|default>`');
            }

            const newVal = enable === null ? !cfg.dj_mode_enabled : enable;
            await db.updateGuildConfig(message.guild.id, { dj_mode_enabled: newVal });

            const embed = new EmbedBuilder()
                .setColor('#0061ff')
                .setTitle('🎧 DJ Mode')
                .setDescription(`AI DJ mode is now **${newVal ? 'ON' : 'OFF'}** (profile: **${cfg.dj_mode_profile || 'default'}**)`)
                .setTimestamp();
            return message.channel.send({ embeds: [embed] });
        } catch (e) {
            console.error('djmode command error:', e);
            return message.reply('❌ Failed to toggle DJ mode.');
        }
    }
};

const { PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'setmusicchannel',
    description: 'Set or disable the channel where users can type "play <song>" without prefix',
    aliases: ['setmc', 'setmusic'],
    category: 'Admin',

    async execute(message, args, client, db) {
        // Permission check
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) &&
            !message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return message.reply('❌ You need **Administrator** or **Manage Server** permission to use this command!');
        }

        // Ensure DB
        if (!db) {
            try {
                const Database = require('../../utils/database');
                const dbInstance = new Database();
                db = await dbInstance.initialize();
            } catch (e) {
                return message.reply('❌ Database is not available right now.');
            }
        }

        // Show current config if no args
        if (!args.length) {
            const cfg = await db.getGuildConfig(message.guild.id);
            const current = cfg.music_channel ? `<#${cfg.music_channel}>` : 'Not set';

            const embed = new EmbedBuilder()
                .setColor('#0061ff')
                .setTitle('🎵 Music Channel Configuration')
                .setDescription('Set a text channel where users can type `play <song>` without the prefix.')
                .addFields(
                    { name: 'Current music channel', value: current, inline: true },
                    { name: 'Set', value: `^setmusicchannel #channel`, inline: true },
                    { name: 'Disable', value: `^setmusicchannel off`, inline: true }
                )
                .setFooter({ text: 'DTEmpire V2 • Music Autoplay' });

            return message.reply({ embeds: [embed] });
        }

        const first = args[0].toLowerCase();

        // Disable shortcut
        if (first === 'off' || first === 'disable' || first === 'none') {
            await db.updateGuildConfig(message.guild.id, { music_channel: null });
            return message.reply('✅ Music channel autoplay disabled.');
        }

        // Expect a channel mention
        const channel = message.mentions.channels.first();
        if (!channel) {
            return message.reply('❌ Please mention a valid text channel. Example: `^setmusicchannel #music`');
        }

        await db.updateGuildConfig(message.guild.id, { music_channel: channel.id });
        return message.reply(`✅ Set music channel to ${channel}. Users can now type 
\n• 
` + 'play <song or url>' + `
\nwithout the prefix in that channel.`);
    }
};

const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'event',
    description: 'Create a quick event announcement (without Discord scheduled events)',
    aliases: ['events', 'createevent'],
    category: 'Utility',

    async execute(message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return message.reply('❌ You need Manage Server permissions to create events.');
        }

        if (args.length === 0) {
            return message.reply('❌ Usage: `^event <title> | <when> | <description> | [#channel]`\nExample: `^event Movie Night | Friday 7PM | We watch Interstellar | #events`');
        }

        // Parse segments split by |
        const raw = args.join(' ');
        const parts = raw.split('|').map(p => p.trim()).filter(Boolean);

        const [title, when, desc, channelPart] = parts;
        if (!title || !when || !desc) {
            return message.reply('❌ Please provide at least title, when, and description.\nExample: `^event Movie Night | Friday 7PM | We watch Interstellar | #events`');
        }

        const targetChannel = message.mentions.channels.first() || message.guild.channels.cache.get(channelPart) || message.channel;
        if (!targetChannel || !targetChannel.isTextBased()) {
            return message.reply('❌ Please mention a valid text channel for the event (or leave empty to use this channel).');
        }

        const embed = new EmbedBuilder()
            .setColor('#00b0f4')
            .setTitle(`📅 ${title}`)
            .setDescription(desc)
            .addFields(
                { name: '🕒 When', value: when, inline: true },
                { name: '📍 Where', value: targetChannel.toString(), inline: true },
                { name: '👥 Host', value: `<@${message.author.id}>`, inline: true }
            )
            .setFooter({ text: 'Created via ^event (not a Discord scheduled event)' })
            .setTimestamp();

        await targetChannel.send({ embeds: [embed] });
        if (targetChannel.id !== message.channel.id) {
            await message.reply(`✅ Event posted in ${targetChannel}`);
        }
    }
};

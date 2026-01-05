const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'poll',
    description: 'Create interactive polls with voting buttons',
    aliases: ['vote', 'survey'],
    category: 'Utility',
    usage: '^poll create <question> | <option1> | <option2> | ...',
    
    async execute(message, args, client, db) {
        const subCommand = args[0]?.toLowerCase();
        
        if (!subCommand || subCommand === 'create') {
            await createPoll(message, args.slice(1), client, db);
        } else {
            message.reply('❌ Usage: `^poll create <question> | <option1> | <option2> | ...`\nExample: `^poll create Best programming language? | JavaScript | Python | Java | C++`');
        }
    }
};

async function createPoll(message, args, client, db) {
    if (args.length === 0) {
        return message.reply('❌ Usage: `^poll create <question> | <option1> | <option2> | ...`\nExample: `^poll create Best programming language? | JavaScript | Python | Java | C++`\n\n**Note:** Separate question and options with `|`');
    }
    
    const fullText = args.join(' ');
    const parts = fullText.split('|').map(p => p.trim());
    
    if (parts.length < 3) {
        return message.reply('❌ You need at least a question and 2 options!\nUsage: `^poll create <question> | <option1> | <option2> | ...`');
    }
    
    const question = parts[0];
    const options = parts.slice(1);
    
    if (options.length > 10) {
        return message.reply('❌ Maximum 10 options allowed!');
    }
    
    // Initialize poll storage if not exists
    if (!client.polls) client.polls = new Map();
    
    const pollId = `poll_${Date.now()}_${message.author.id}`;
    const pollData = {
        id: pollId,
        question: question,
        options: options,
        votes: {},
        voters: new Set(),
        createdBy: message.author.id,
        createdAt: Date.now(),
        guildId: message.guild.id,
        channelId: message.channel.id
    };
    
    // Initialize vote counts
    options.forEach((option, index) => {
        pollData.votes[index] = 0;
    });
    
    // Create embed
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📊 Poll')
        .setDescription(`**${question}**\n\n${options.map((opt, i) => `**${i + 1}.** ${opt}\n0 votes (0%)`).join('\n')}`)
        .setFooter({ text: `Poll by ${message.author.username} • Click buttons to vote` })
        .setTimestamp();
    
    // Create buttons (max 5 per row, max 2 rows = 10 options)
    const rows = [];
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    
    for (let i = 0; i < options.length; i += 5) {
        const row = new ActionRowBuilder();
        const chunk = options.slice(i, i + 5);
        
        chunk.forEach((option, index) => {
            const actualIndex = i + index;
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${pollId}_${actualIndex}`)
                    .setLabel(`${actualIndex + 1}`)
                    .setEmoji(emojis[actualIndex])
                    .setStyle(ButtonStyle.Primary)
            );
        });
        
        rows.push(row);
    }
    
    // Add end poll button
    const controlRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`${pollId}_end`)
                .setLabel('End Poll')
                .setEmoji('🔒')
                .setStyle(ButtonStyle.Danger)
        );
    
    rows.push(controlRow);
    
    // Send poll
    const pollMessage = await message.channel.send({ embeds: [embed], components: rows });
    
    // Store poll data
    pollData.messageId = pollMessage.id;
    client.polls.set(pollId, pollData);
    
    // Save to database
    if (!db.data.polls) db.data.polls = {};
    db.data.polls[pollId] = {
        ...pollData,
        voters: Array.from(pollData.voters)
    };
    db.save();
    
    // Create collector
    const collector = pollMessage.createMessageComponentCollector({ time: 24 * 60 * 60 * 1000 }); // 24 hours
    
    collector.on('collect', async () => {
        // Interaction is fully handled in the global interactionCreate handler.
        // Do nothing here to avoid double acknowledgments.
        return;
    });
    
    collector.on('end', async (collected, reason) => {
        if (reason === 'time') {
            await endPoll(pollMessage, pollData, client, db);
        }
    });
    
    // Delete command message
    try {
        await message.delete();
    } catch (error) {
        // Ignore if can't delete
    }
}

async function endPoll(pollMessage, poll, client, db) {
    // Disable all buttons
    const disabledRows = pollMessage.components.map(row => {
        const newRow = ActionRowBuilder.from(row);
        newRow.components.forEach(button => button.setDisabled(true));
        return newRow;
    });
    
    // Calculate results
    const totalVotes = Object.values(poll.votes).reduce((a, b) => a + b, 0);
    const sortedOptions = poll.options
        .map((opt, i) => ({ option: opt, votes: poll.votes[i], index: i }))
        .sort((a, b) => b.votes - a.votes);
    
    const winner = sortedOptions[0];
    
    // Create final embed
    const finalEmbed = EmbedBuilder.from(pollMessage.embeds[0])
        .setColor('#ff0000')
        .setTitle('📊 Poll Ended')
        .setFooter({ text: `Poll ended • ${totalVotes} total votes` });
    
    if (totalVotes > 0) {
        finalEmbed.addFields({
            name: '🏆 Winner',
            value: `**${winner.option}** with ${winner.votes} votes (${Math.round((winner.votes / totalVotes) * 100)}%)`,
            inline: false
        });
    }
    
    await pollMessage.edit({ embeds: [finalEmbed], components: disabledRows });
    
    // Remove from active polls
    client.polls.delete(poll.id);
}

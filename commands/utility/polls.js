const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Store active polls in memory (in production, use database)
const activePolls = new Map();

module.exports = {
    name: 'polls',
    description: 'Create and manage polls with voting',
    aliases: ['poll', 'vote'],
    category: 'Utility',
    
    async execute(message, args, client, db) {
        const subCommand = args[0]?.toLowerCase();
        
        if (!subCommand) {
            return showPollHelp(message);
        }
        
        switch (subCommand) {
            case 'create':
                await createPoll(message, args.slice(1), client);
                break;
            case 'end':
                await endPoll(message, args.slice(1), client);
                break;
            case 'results':
                await showResults(message, args.slice(1), client);
                break;
            case 'list':
                await listPolls(message, client);
                break;
            default:
                showPollHelp(message);
        }
    }
};

async function createPoll(message, args, client) {
    // Parse command: ^polls create "Question?" "Option 1" "Option 2" "Option 3" [duration]
    const matches = args.join(' ').match(/"([^"]+)"/g);
    
    if (!matches || matches.length < 3) {
        return message.reply('❌ Usage: `^polls create "Question?" "Option 1" "Option 2" [duration_minutes]`\n\nExample: `^polls create "Best pizza topping?" "Pepperoni" "Mushrooms" "Pineapple" 60`\n\n**Note:** Use quotes around each option. Duration is optional (default: 60 minutes)');
    }
    
    const question = matches[0].replace(/"/g, '');
    const options = matches.slice(1).map(opt => opt.replace(/"/g, ''));
    
    if (options.length < 2) {
        return message.reply('❌ You need at least 2 options for a poll!');
    }
    
    if (options.length > 10) {
        return message.reply('❌ Maximum 10 options allowed!');
    }
    
    // Get duration (default 60 minutes)
    const durationMatch = args.join(' ').match(/\d+$/);
    const duration = durationMatch ? parseInt(durationMatch[0]) : 60;
    
    if (duration < 1 || duration > 10080) {
        return message.reply('❌ Duration must be between 1 minute and 1 week (10080 minutes)!');
    }
    
    // Create poll embed
    const pollEmbed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📊 Poll: ' + question)
        .setDescription('Vote by clicking the buttons below!')
        .setFooter({ text: `Poll by ${message.author.username} • Ends in ${duration} minutes | Suggested By davidbarnett0587` })
        .setTimestamp(Date.now() + duration * 60 * 1000);
    
    // Add options to embed
    let optionsText = '';
    options.forEach((option, index) => {
        optionsText += `**${index + 1}.** ${option}\n`;
    });
    pollEmbed.addFields({ name: 'Options', value: optionsText, inline: false });
    
    // Create buttons (max 5 per row, max 2 rows = 10 buttons)
    const rows = [];
    const buttonsPerRow = Math.min(5, options.length);
    
    for (let i = 0; i < options.length; i += 5) {
        const row = new ActionRowBuilder();
        const endIndex = Math.min(i + 5, options.length);
        
        for (let j = i; j < endIndex; j++) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`poll_vote_${j}`)
                    .setLabel(`${j + 1}`)
                    .setStyle(ButtonStyle.Primary)
            );
        }
        
        rows.push(row);
    }
    
    // Send poll
    const pollMessage = await message.channel.send({ embeds: [pollEmbed], components: rows });
    
    // Store poll data
    const pollId = pollMessage.id;
    const pollData = {
        id: pollId,
        channelId: message.channel.id,
        guildId: message.guild.id,
        question,
        options,
        votes: new Map(),
        voters: new Set(),
        createdBy: message.author.id,
        createdAt: Date.now(),
        endsAt: Date.now() + duration * 60 * 1000,
        messageId: pollMessage.id,
        active: true
    };
    
    activePolls.set(pollId, pollData);
    
    // Set up vote collector
    const filter = i => i.customId.startsWith('poll_vote_');
    const timeoutMs = Math.min(duration * 60 * 1000, 2147483647); // Cap at max 32-bit integer
    const collector = pollMessage.createMessageComponentCollector({ filter, time: timeoutMs });
    
    collector.on('collect', async i => {
        const optionIndex = parseInt(i.customId.split('_')[2]);
        const poll = activePolls.get(pollId);
        
        if (!poll || !poll.active) {
            return i.reply({ content: '❌ This poll has ended!', ephemeral: true });
        }
        
        // Check if user already voted
        if (poll.voters.has(i.user.id)) {
            return i.reply({ content: '❌ You have already voted in this poll!', ephemeral: true });
        }
        
        // Record vote
        poll.voters.add(i.user.id);
        
        if (!poll.votes.has(optionIndex)) {
            poll.votes.set(optionIndex, []);
        }
        poll.votes.get(optionIndex).push(i.user.id);
        
        activePolls.set(pollId, poll);
        
        await i.reply({ content: `✅ You voted for: **${poll.options[optionIndex]}**`, ephemeral: true });
        
        // Update embed with current results
        await updatePollEmbed(pollMessage, poll);
    });
    
    collector.on('end', async () => {
        const poll = activePolls.get(pollId);
        if (poll && poll.active) {
            poll.active = false;
            activePolls.set(pollId, poll);
            await endPollAndShowResults(pollMessage, poll);
        }
    });
    
    await message.reply(`✅ Poll created! Poll ID: \`${pollId}\``);
}

async function updatePollEmbed(pollMessage, poll) {
    const totalVotes = poll.voters.size;
    
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📊 Poll: ' + poll.question)
        .setDescription('Vote by clicking the buttons below!')
        .setFooter({ text: `Total votes: ${totalVotes} • Ends at` })
        .setTimestamp(poll.endsAt);
    
    // Add options with vote counts
    let optionsText = '';
    poll.options.forEach((option, index) => {
        const votes = poll.votes.get(index)?.length || 0;
        const percentage = totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(1) : 0;
        const barLength = Math.round((votes / Math.max(totalVotes, 1)) * 20);
        const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
        
        optionsText += `**${index + 1}.** ${option}\n${bar} ${votes} votes (${percentage}%)\n\n`;
    });
    
    embed.addFields({ name: 'Options', value: optionsText || 'No votes yet', inline: false });
    
    try {
        await pollMessage.edit({ embeds: [embed] });
    } catch (error) {
        console.error('Error updating poll embed:', error);
    }
}

async function endPollAndShowResults(pollMessage, poll) {
    // Disable all buttons
    const disabledRows = [];
    const buttonsPerRow = Math.min(5, poll.options.length);
    
    for (let i = 0; i < poll.options.length; i += 5) {
        const row = new ActionRowBuilder();
        const endIndex = Math.min(i + 5, poll.options.length);
        
        for (let j = i; j < endIndex; j++) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`poll_vote_${j}`)
                    .setLabel(`${j + 1}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );
        }
        
        disabledRows.push(row);
    }
    
    // Calculate winner
    let maxVotes = 0;
    let winnerIndex = -1;
    
    poll.options.forEach((option, index) => {
        const votes = poll.votes.get(index)?.length || 0;
        if (votes > maxVotes) {
            maxVotes = votes;
            winnerIndex = index;
        }
    });
    
    const totalVotes = poll.voters.size;
    
    const resultsEmbed = new EmbedBuilder()
        .setColor('#ff9900')
        .setTitle('📊 Poll Results: ' + poll.question)
        .setDescription(`**Poll has ended!**\\n\\nTotal Votes: **${totalVotes}**`)
        .setFooter({ text: 'Poll ended | Suggested By davidbarnett0587' })
        .setTimestamp();
    
    // Add results
    let resultsText = '';
    poll.options.forEach((option, index) => {
        const votes = poll.votes.get(index)?.length || 0;
        const percentage = totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(1) : 0;
        const barLength = Math.round((votes / Math.max(totalVotes, 1)) * 20);
        const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
        const isWinner = index === winnerIndex && totalVotes > 0;
        
        resultsText += `${isWinner ? '🏆 ' : ''}**${index + 1}.** ${option}\n${bar} ${votes} votes (${percentage}%)\n\n`;
    });
    
    resultsEmbed.addFields({ name: 'Final Results', value: resultsText, inline: false });
    
    if (winnerIndex >= 0 && totalVotes > 0) {
        resultsEmbed.addFields({ 
            name: '🏆 Winner', 
            value: `**${poll.options[winnerIndex]}** with ${maxVotes} votes!`, 
            inline: false 
        });
    }
    
    try {
        await pollMessage.edit({ embeds: [resultsEmbed], components: disabledRows });
    } catch (error) {
        console.error('Error ending poll:', error);
    }
}

async function endPoll(message, args, client) {
    const pollId = args[0];
    
    if (!pollId) {
        return message.reply('❌ Usage: `^polls end <poll_id>`\n\nUse `^polls list` to see active polls.');
    }
    
    const poll = activePolls.get(pollId);
    
    if (!poll) {
        return message.reply('❌ Poll not found! Use `^polls list` to see active polls.');
    }
    
    // Check if user is poll creator or has manage messages permission
    if (poll.createdBy !== message.author.id && !message.member.permissions.has('ManageMessages')) {
        return message.reply('❌ You can only end polls you created, or you need Manage Messages permission!');
    }
    
    if (!poll.active) {
        return message.reply('❌ This poll has already ended!');
    }
    
    // End poll
    poll.active = false;
    activePolls.set(pollId, poll);
    
    try {
        const channel = await client.channels.fetch(poll.channelId);
        const pollMessage = await channel.messages.fetch(poll.messageId);
        await endPollAndShowResults(pollMessage, poll);
        
        await message.reply('✅ Poll ended successfully!');
    } catch (error) {
        console.error('Error ending poll:', error);
        await message.reply('❌ Error ending poll. The message may have been deleted.');
    }
}

async function showResults(message, args, client) {
    const pollId = args[0];
    
    if (!pollId) {
        return message.reply('❌ Usage: `^polls results <poll_id>`\n\nUse `^polls list` to see all polls.');
    }
    
    const poll = activePolls.get(pollId);
    
    if (!poll) {
        return message.reply('❌ Poll not found!');
    }
    
    const totalVotes = poll.voters.size;
    
    // Calculate winner
    let maxVotes = 0;
    let winnerIndex = -1;
    
    poll.options.forEach((option, index) => {
        const votes = poll.votes.get(index)?.length || 0;
        if (votes > maxVotes) {
            maxVotes = votes;
            winnerIndex = index;
        }
    });
    
    const embed = new EmbedBuilder()
        .setColor(poll.active ? '#0099ff' : '#ff9900')
        .setTitle('📊 Poll Results: ' + poll.question)
        .setDescription(`**Status:** ${poll.active ? '🟢 Active' : '🔴 Ended'}\\n\\nTotal Votes: **${totalVotes}**`)
        .setFooter({ text: poll.active ? 'Poll is still active' : 'Poll ended' })
        .setTimestamp(poll.active ? poll.endsAt : undefined);
    
    // Add results
    let resultsText = '';
    poll.options.forEach((option, index) => {
        const votes = poll.votes.get(index)?.length || 0;
        const percentage = totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(1) : 0;
        const barLength = Math.round((votes / Math.max(totalVotes, 1)) * 20);
        const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
        const isWinner = index === winnerIndex && totalVotes > 0;
        
        resultsText += `${isWinner && !poll.active ? '🏆 ' : ''}**${index + 1}.** ${option}\n${bar} ${votes} votes (${percentage}%)\n\n`;
    });
    
    embed.addFields({ name: poll.active ? 'Current Results' : 'Final Results', value: resultsText, inline: false });
    
    if (winnerIndex >= 0 && totalVotes > 0 && !poll.active) {
        embed.addFields({ 
            name: '🏆 Winner', 
            value: `**${poll.options[winnerIndex]}** with ${maxVotes} votes!`, 
            inline: false 
        });
    }
    
    await message.reply({ embeds: [embed] });
}

async function listPolls(message, client) {
    const guildPolls = Array.from(activePolls.values()).filter(poll => poll.guildId === message.guild.id);
    
    if (guildPolls.length === 0) {
        return message.reply('❌ No polls found in this server!');
    }
    
    const activeList = guildPolls.filter(p => p.active);
    const endedList = guildPolls.filter(p => !p.active);
    
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📊 Server Polls')
        .setDescription(`Total polls: ${guildPolls.length}`)
        .setFooter({ text: `Use ^polls results <poll_id> to view details` });
    
    if (activeList.length > 0) {
        let activeText = '';
        activeList.forEach(poll => {
            const timeLeft = Math.max(0, poll.endsAt - Date.now());
            const minutesLeft = Math.floor(timeLeft / (60 * 1000));
            activeText += `**ID:** \`${poll.id}\`\n**Question:** ${poll.question}\n**Votes:** ${poll.voters.size}\n**Ends in:** ${minutesLeft} minutes\n\n`;
        });
        
        embed.addFields({ name: '🟢 Active Polls', value: activeText.slice(0, 1024), inline: false });
    }
    
    if (endedList.length > 0) {
        let endedText = '';
        endedList.slice(0, 5).forEach(poll => {
            endedText += `**ID:** \`${poll.id}\`\n**Question:** ${poll.question}\n**Votes:** ${poll.voters.size}\n\n`;
        });
        
        embed.addFields({ name: '🔴 Recent Ended Polls', value: endedText.slice(0, 1024), inline: false });
    }
    
    await message.reply({ embeds: [embed] });
}

async function showPollHelp(message) {
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📊 Polls System Help')
        .setDescription('Create and manage polls for your server!')
        .addFields(
            { name: '📝 Create Poll', value: '`^polls create "Question?" "Option 1" "Option 2" [duration]`\n\nExample: `^polls create "Best color?" "Red" "Blue" "Green" 60`\n\n**Duration:** in minutes (default: 60, max: 10080)', inline: false },
            { name: '🛑 End Poll', value: '`^polls end <poll_id>`\n\nManually end an active poll', inline: false },
            { name: '📊 View Results', value: '`^polls results <poll_id>`\n\nView current or final results of a poll', inline: false },
            { name: '📋 List Polls', value: '`^polls list`\n\nView all active and recent polls in this server', inline: false },
            { name: '📌 Notes', value: '• Each user can vote once per poll\n• Polls automatically end after duration expires\n• Results update in real-time\n• Maximum 10 options per poll', inline: false }
        )
        .setFooter({ text: 'Engage your community with polls!' });
    
    await message.reply({ embeds: [embed] });
}

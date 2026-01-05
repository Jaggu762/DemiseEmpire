const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

// Store suggestion data (in production, use database)
const suggestionChannels = new Map();
const suggestions = new Map();
let suggestionCounter = 1;

module.exports = {
    name: 'suggest',
    description: 'Submit suggestions with voting system',
    aliases: ['suggestion'],
    category: 'Utility',
    
    async execute(message, args, client, db) {
        const subCommand = args[0]?.toLowerCase();
        
        // If no subcommand or not 'setchannel', treat as a suggestion
        if (!subCommand || subCommand !== 'setchannel') {
            await submitSuggestion(message, args, client, db);
        } else if (subCommand === 'setchannel') {
            await setSuggestChannel(message, args.slice(1), client, db);
        }
    }
};

async function setSuggestChannel(message, args, client, db) {
    // Check permissions
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return message.reply('❌ You need **Manage Channels** permission to set the suggestion channel!');
    }
    
    const channel = message.mentions.channels.first() || message.channel;
    
    // Store suggestion channel
    suggestionChannels.set(message.guild.id, channel.id);
    
    // Save to database
    try {
        await db.setGuildConfig(message.guild.id, 'suggestion_channel', channel.id);
    } catch (error) {
        console.error('Error saving suggestion channel:', error);
    }
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Suggestion Channel Set!')
        .setDescription(`Suggestions will now be sent to ${channel}`)
        .addFields(
            { name: '📝 How to use', value: 'Members can use `^suggest <your suggestion>` in any channel!', inline: false },
            { name: '📊 Voting', value: 'Each suggestion will have ⬆️ upvote and ⬇️ downvote buttons', inline: false }
        )
        .setFooter({ text: `Set by ${message.author.username}` });
    
    await message.reply({ embeds: [embed] });
}

async function submitSuggestion(message, args, client, db) {
    const guildId = message.guild.id;
    
    // Check if suggestion channel is set
    let suggestionChannelId = suggestionChannels.get(guildId);
    
    // Try to load from database if not in memory
    if (!suggestionChannelId) {
        try {
            const config = await db.getGuildConfig(guildId);
            if (config && config.suggestion_channel) {
                suggestionChannelId = config.suggestion_channel;
                suggestionChannels.set(guildId, suggestionChannelId);
            }
        } catch (error) {
            console.error('Error loading suggestion channel:', error);
        }
    }
    
    if (!suggestionChannelId) {
        return message.reply('❌ Suggestion channel has not been set! Ask an admin to use `^suggest setchannel #channel`');
    }
    
    // Get suggestion text
    const suggestionText = args.join(' ');
    
    if (!suggestionText || suggestionText.length < 10) {
        return message.reply('❌ Please provide a suggestion! (Minimum 10 characters)\n\n**Usage:** `^suggest <your suggestion>`\n**Example:** `^suggest Add a music trivia game to the bot`');
    }
    
    if (suggestionText.length > 1000) {
        return message.reply('❌ Suggestion is too long! Maximum 1000 characters.');
    }
    
    // Get suggestion channel
    let suggestionChannel;
    try {
        suggestionChannel = await client.channels.fetch(suggestionChannelId);
    } catch (error) {
        return message.reply('❌ Suggestion channel not found! Ask an admin to set it again with `^suggest setchannel #channel`');
    }
    
    // Create suggestion ID
    const suggestionId = `${guildId}-${suggestionCounter++}`;
    
    // Create suggestion embed
    const suggestionEmbed = new EmbedBuilder()
        .setColor('#0099ff')
        .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
        .setTitle(`💡 Suggestion #${suggestionCounter - 1}`)
        .setDescription(suggestionText)
        .addFields(
            { name: '📊 Votes', value: '⬆️ 0 | ⬇️ 0', inline: true },
            { name: '📝 Status', value: '🟡 Pending', inline: true },
            { name: '👤 Submitted by', value: `${message.author}`, inline: true }
        )
        .setFooter({ text: `ID: ${suggestionId}` })
        .setTimestamp();
    
    // Create voting buttons
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`suggest_upvote_${suggestionId}`)
                .setLabel('0')
                .setEmoji('⬆️')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`suggest_downvote_${suggestionId}`)
                .setLabel('0')
                .setEmoji('⬇️')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`suggest_approve_${suggestionId}`)
                .setLabel('Approve')
                .setEmoji('✅')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`suggest_deny_${suggestionId}`)
                .setLabel('Deny')
                .setEmoji('❌')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`suggest_consider_${suggestionId}`)
                .setLabel('Consider')
                .setEmoji('🤔')
                .setStyle(ButtonStyle.Secondary)
        );
    
    // Send suggestion to suggestion channel
    const suggestionMsg = await suggestionChannel.send({ embeds: [suggestionEmbed], components: [row] });
    
    // Store suggestion data
    const suggestionData = {
        id: suggestionId,
        number: suggestionCounter - 1,
        guildId: message.guild.id,
        channelId: suggestionChannel.id,
        messageId: suggestionMsg.id,
        authorId: message.author.id,
        suggestion: suggestionText,
        upvotes: new Set(),
        downvotes: new Set(),
        status: 'pending',
        createdAt: Date.now()
    };
    
    suggestions.set(suggestionId, suggestionData);
    
    // Set up vote collector
    const filter = i => i.customId.startsWith('suggest_');
    const collector = suggestionMsg.createMessageComponentCollector({ filter, time: 30 * 24 * 60 * 60 * 1000 }); // 30 days
    
    collector.on('collect', async i => {
        const suggestion = suggestions.get(suggestionId);
        if (!suggestion) return;
        
        const action = i.customId.split('_')[1];
        
        if (action === 'upvote') {
            // Toggle upvote
            if (suggestion.upvotes.has(i.user.id)) {
                suggestion.upvotes.delete(i.user.id);
                await i.reply({ content: '⬆️ Upvote removed!', ephemeral: true });
            } else {
                suggestion.upvotes.add(i.user.id);
                suggestion.downvotes.delete(i.user.id); // Remove downvote if exists
                await i.reply({ content: '⬆️ Upvoted!', ephemeral: true });
            }
        } else if (action === 'downvote') {
            // Toggle downvote
            if (suggestion.downvotes.has(i.user.id)) {
                suggestion.downvotes.delete(i.user.id);
                await i.reply({ content: '⬇️ Downvote removed!', ephemeral: true });
            } else {
                suggestion.downvotes.add(i.user.id);
                suggestion.upvotes.delete(i.user.id); // Remove upvote if exists
                await i.reply({ content: '⬇️ Downvoted!', ephemeral: true });
            }
        } else if (action === 'approve' || action === 'deny' || action === 'consider') {
            // Check permissions
            if (!i.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                return i.reply({ content: '❌ You need **Manage Messages** permission to manage suggestions!', ephemeral: true });
            }
            
            suggestion.status = action === 'approve' ? 'approved' : action === 'deny' ? 'denied' : 'considering';
            suggestion.reviewedBy = i.user.id;
            suggestion.reviewedAt = Date.now();
            
            await i.reply({ 
                content: `✅ Suggestion ${action === 'approve' ? 'approved' : action === 'deny' ? 'denied' : 'marked as under consideration'}!`, 
                ephemeral: true 
            });
            
            // Notify author
            try {
                const author = await client.users.fetch(suggestion.authorId);
                const statusEmoji = action === 'approve' ? '✅' : action === 'deny' ? '❌' : '🤔';
                const statusText = action === 'approve' ? 'approved' : action === 'deny' ? 'denied' : 'being considered';
                
                await author.send(`${statusEmoji} Your suggestion in **${message.guild.name}** has been ${statusText}!\n\n**Suggestion:** ${suggestion.suggestion}\n**Reviewed by:** ${i.user.username}`);
            } catch (error) {
                // User has DMs disabled
            }
        }
        
        suggestions.set(suggestionId, suggestion);
        await updateSuggestionEmbed(suggestionMsg, suggestion);
    });
    
    // Confirm submission to user
    const confirmEmbed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Suggestion Submitted!')
        .setDescription(`Your suggestion has been sent to ${suggestionChannel}`)
        .addFields(
            { name: '💡 Suggestion', value: suggestionText.slice(0, 200) + (suggestionText.length > 200 ? '...' : ''), inline: false },
            { name: '🔗 View', value: `[Click here](${suggestionMsg.url})`, inline: true },
            { name: '📊 Voting', value: 'Members can now vote on your suggestion!', inline: false }
        );
    
    await message.reply({ embeds: [confirmEmbed] });
    
    // Delete original command message if not in suggestion channel
    if (message.channel.id !== suggestionChannelId) {
        try {
            setTimeout(() => message.delete().catch(() => {}), 5000);
        } catch (error) {
            // No permission to delete
        }
    }
}

async function updateSuggestionEmbed(suggestionMsg, suggestion) {
    const upvoteCount = suggestion.upvotes.size;
    const downvoteCount = suggestion.downvotes.size;
    const totalVotes = upvoteCount + downvoteCount;
    const upvotePercent = totalVotes > 0 ? ((upvoteCount / totalVotes) * 100).toFixed(0) : 0;
    
    // Status colors and text
    const statusData = {
        pending: { color: '#0099ff', emoji: '🟡', text: 'Pending' },
        approved: { color: '#00ff00', emoji: '✅', text: 'Approved' },
        denied: { color: '#ff0000', emoji: '❌', text: 'Denied' },
        considering: { color: '#ffaa00', emoji: '🤔', text: 'Under Consideration' }
    };
    
    const status = statusData[suggestion.status] || statusData.pending;
    
    const embed = new EmbedBuilder()
        .setColor(status.color)
        .setAuthor({ name: suggestionMsg.embeds[0].author.name, iconURL: suggestionMsg.embeds[0].author.iconURL })
        .setTitle(`💡 Suggestion #${suggestion.number}`)
        .setDescription(suggestion.suggestion)
        .addFields(
            { name: '📊 Votes', value: `⬆️ ${upvoteCount} (${upvotePercent}%) | ⬇️ ${downvoteCount}`, inline: true },
            { name: '📝 Status', value: `${status.emoji} ${status.text}`, inline: true },
            { name: '👤 Submitted by', value: `<@${suggestion.authorId}>`, inline: true }
        )
        .setFooter({ text: `ID: ${suggestion.id}` })
        .setTimestamp(suggestion.createdAt);
    
    if (suggestion.reviewedBy) {
        embed.addFields({ name: '👨‍⚖️ Reviewed by', value: `<@${suggestion.reviewedBy}>`, inline: true });
    }
    
    // Update button labels with vote counts
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`suggest_upvote_${suggestion.id}`)
                .setLabel(`${upvoteCount}`)
                .setEmoji('⬆️')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`suggest_downvote_${suggestion.id}`)
                .setLabel(`${downvoteCount}`)
                .setEmoji('⬇️')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`suggest_approve_${suggestion.id}`)
                .setLabel('Approve')
                .setEmoji('✅')
                .setStyle(ButtonStyle.Success)
                .setDisabled(suggestion.status !== 'pending'),
            new ButtonBuilder()
                .setCustomId(`suggest_deny_${suggestion.id}`)
                .setLabel('Deny')
                .setEmoji('❌')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(suggestion.status !== 'pending'),
            new ButtonBuilder()
                .setCustomId(`suggest_consider_${suggestion.id}`)
                .setLabel('Consider')
                .setEmoji('🤔')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(suggestion.status !== 'pending')
        );
    
    try {
        await suggestionMsg.edit({ embeds: [embed], components: [row] });
    } catch (error) {
        console.error('Error updating suggestion embed:', error);
    }
}

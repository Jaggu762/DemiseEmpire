const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'suggest',
    description: 'Submit server suggestions with upvote/downvote',
    aliases: ['suggestion'],
    category: 'Utility',
    usage: '^suggest <your suggestion>',
    
    async execute(message, args, client, db) {
        if (args.length === 0) {
            return message.reply('❌ Usage: `^suggest <your suggestion>`\nExample: `^suggest Add a new music channel for community requests`');
        }
        
        const suggestion = args.join(' ');
        
        if (suggestion.length < 10) {
            return message.reply('❌ Your suggestion must be at least 10 characters long!');
        }
        
        if (suggestion.length > 1000) {
            return message.reply('❌ Your suggestion must be less than 1000 characters!');
        }
        
        // Get guild config to check for suggestion channel
        const guildConfig = await db.getGuildConfig(message.guild.id);
        const suggestionChannel = guildConfig.suggestion_channel ? 
            message.guild.channels.cache.get(guildConfig.suggestion_channel) : 
            message.channel;
        
        // Initialize suggestions storage if not exists
        if (!client.suggestions) client.suggestions = new Map();
        if (!db.data.suggestions) db.data.suggestions = {};
        
        const suggestionId = `suggest_${Date.now()}_${message.author.id}`;
        
        // Get suggestion count for this user in this guild
        const userSuggestions = Object.values(db.data.suggestions).filter(
            s => s.userId === message.author.id && s.guildId === message.guild.id
        );
        const suggestionNumber = userSuggestions.length + 1;
        
        // Create embed
        const embed = new EmbedBuilder()
            .setColor('#ffaa00')
            .setAuthor({ 
                name: `Suggestion from ${message.author.username}`, 
                iconURL: message.author.displayAvatarURL() 
            })
            .setDescription(suggestion)
            .addFields(
                { name: '👍 Upvotes', value: '0', inline: true },
                { name: '👎 Downvotes', value: '0', inline: true },
                { name: '📊 Status', value: '🟡 Pending', inline: true }
            )
            .setFooter({ text: `Suggestion #${suggestionNumber} • React to vote` })
            .setTimestamp();
        
        // Create buttons
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`${suggestionId}_upvote`)
                    .setLabel('Upvote')
                    .setEmoji('👍')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`${suggestionId}_downvote`)
                    .setLabel('Downvote')
                    .setEmoji('👎')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`${suggestionId}_approve`)
                    .setLabel('Approve')
                    .setEmoji('✅')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`${suggestionId}_deny`)
                    .setLabel('Deny')
                    .setEmoji('❌')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`${suggestionId}_consider`)
                    .setLabel('Consider')
                    .setEmoji('🤔')
                    .setStyle(ButtonStyle.Primary)
            );
        
        // Send suggestion
        const suggestionMessage = await suggestionChannel.send({ embeds: [embed], components: [row] });
        
        // Store suggestion data
        const suggestionData = {
            id: suggestionId,
            messageId: suggestionMessage.id,
            channelId: suggestionChannel.id,
            guildId: message.guild.id,
            userId: message.author.id,
            username: message.author.username,
            suggestion: suggestion,
            upvotes: [],
            downvotes: [],
            status: 'pending',
            createdAt: Date.now(),
            number: suggestionNumber
        };
        
        client.suggestions.set(suggestionId, suggestionData);
        db.data.suggestions[suggestionId] = suggestionData;
        db.save();
        
        // Notify user
        const confirmEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Suggestion Submitted!')
            .setDescription(`Your suggestion has been posted in ${suggestionChannel}`)
            .addFields({ name: 'Suggestion', value: suggestion.substring(0, 200) + (suggestion.length > 200 ? '...' : ''), inline: false });
        
        await message.reply({ embeds: [confirmEmbed] });
        
        // Delete command message if not in suggestion channel
        if (message.channel.id !== suggestionChannel.id) {
            try {
                await message.delete();
            } catch (error) {
                // Ignore if can't delete
            }
        }
        
        // Create collector
        const collector = suggestionMessage.createMessageComponentCollector({ time: 30 * 24 * 60 * 60 * 1000 }); // 30 days
        
        collector.on('collect', async (interaction) => {
            const suggestion = client.suggestions.get(suggestionId);
            if (!suggestion) {
                return interaction.reply({ content: '❌ Suggestion data not found!', ephemeral: true });
            }
            
            const action = interaction.customId.split('_').pop();
            
            // Handle voting
            if (action === 'upvote' || action === 'downvote') {
                const userId = interaction.user.id;
                
                // Check if user already voted
                const hasUpvoted = suggestion.upvotes.includes(userId);
                const hasDownvoted = suggestion.downvotes.includes(userId);
                
                if (action === 'upvote') {
                    if (hasUpvoted) {
                        // Remove upvote
                        suggestion.upvotes = suggestion.upvotes.filter(id => id !== userId);
                        await interaction.reply({ content: '👍 Upvote removed!', ephemeral: true });
                    } else {
                        // Add upvote and remove downvote if exists
                        if (hasDownvoted) {
                            suggestion.downvotes = suggestion.downvotes.filter(id => id !== userId);
                        }
                        suggestion.upvotes.push(userId);
                        await interaction.reply({ content: '👍 Upvoted!', ephemeral: true });
                    }
                } else if (action === 'downvote') {
                    if (hasDownvoted) {
                        // Remove downvote
                        suggestion.downvotes = suggestion.downvotes.filter(id => id !== userId);
                        await interaction.reply({ content: '👎 Downvote removed!', ephemeral: true });
                    } else {
                        // Add downvote and remove upvote if exists
                        if (hasUpvoted) {
                            suggestion.upvotes = suggestion.upvotes.filter(id => id !== userId);
                        }
                        suggestion.downvotes.push(userId);
                        await interaction.reply({ content: '👎 Downvoted!', ephemeral: true });
                    }
                }
                
                // Update storage
                client.suggestions.set(suggestionId, suggestion);
                db.data.suggestions[suggestionId] = suggestion;
                db.save();
                
                // Update embed
                await updateSuggestionEmbed(suggestionMessage, suggestion);
            } 
            // Handle staff actions
            else if (action === 'approve' || action === 'deny' || action === 'consider') {
                // Check permissions
                if (!interaction.member.permissions.has('ManageMessages')) {
                    return interaction.reply({ content: '❌ You need Manage Messages permission to manage suggestions!', ephemeral: true });
                }
                
                if (action === 'approve') {
                    suggestion.status = 'approved';
                    await interaction.reply({ content: '✅ Suggestion approved!', ephemeral: true });
                } else if (action === 'deny') {
                    suggestion.status = 'denied';
                    await interaction.reply({ content: '❌ Suggestion denied!', ephemeral: true });
                } else if (action === 'consider') {
                    suggestion.status = 'considering';
                    await interaction.reply({ content: '🤔 Suggestion marked as under consideration!', ephemeral: true });
                }
                
                suggestion.reviewedBy = interaction.user.id;
                suggestion.reviewedAt = Date.now();
                
                // Update storage
                client.suggestions.set(suggestionId, suggestion);
                db.data.suggestions[suggestionId] = suggestion;
                db.save();
                
                // Update embed
                await updateSuggestionEmbed(suggestionMessage, suggestion);
                
                // Notify suggestion author
                try {
                    const author = await client.users.fetch(suggestion.userId);
                    const notifyEmbed = new EmbedBuilder()
                        .setColor(action === 'approve' ? '#00ff00' : action === 'deny' ? '#ff0000' : '#ffaa00')
                        .setTitle(`Suggestion ${action === 'approve' ? 'Approved' : action === 'deny' ? 'Denied' : 'Under Consideration'}!`)
                        .setDescription(`Your suggestion in **${interaction.guild.name}** has been ${action === 'approve' ? 'approved' : action === 'deny' ? 'denied' : 'marked as under consideration'}!`)
                        .addFields({ name: 'Your Suggestion', value: suggestion.suggestion.substring(0, 200) + (suggestion.suggestion.length > 200 ? '...' : ''), inline: false });
                    
                    await author.send({ embeds: [notifyEmbed] });
                } catch (error) {
                    // User has DMs disabled
                }
            }
        });
    }
};

async function updateSuggestionEmbed(message, suggestion) {
    const statusEmojis = {
        'pending': '🟡',
        'approved': '✅',
        'denied': '❌',
        'considering': '🤔'
    };
    
    const statusNames = {
        'pending': 'Pending',
        'approved': 'Approved',
        'denied': 'Denied',
        'considering': 'Under Consideration'
    };
    
    const statusColors = {
        'pending': '#ffaa00',
        'approved': '#00ff00',
        'denied': '#ff0000',
        'considering': '#0099ff'
    };
    
    const upvoteCount = suggestion.upvotes.length;
    const downvoteCount = suggestion.downvotes.length;
    const totalVotes = upvoteCount + downvoteCount;
    const ratio = totalVotes > 0 ? Math.round((upvoteCount / totalVotes) * 100) : 0;
    
    const updatedEmbed = EmbedBuilder.from(message.embeds[0])
        .setColor(statusColors[suggestion.status])
        .setFields(
            { name: '👍 Upvotes', value: `${upvoteCount}`, inline: true },
            { name: '👎 Downvotes', value: `${downvoteCount}`, inline: true },
            { name: '📊 Status', value: `${statusEmojis[suggestion.status]} ${statusNames[suggestion.status]}`, inline: true },
            { name: '📈 Approval Rating', value: `${ratio}%`, inline: true },
            { name: '🗳️ Total Votes', value: `${totalVotes}`, inline: true }
        );
    
    if (suggestion.reviewedBy) {
        updatedEmbed.addFields({ 
            name: '👤 Reviewed By', 
            value: `<@${suggestion.reviewedBy}>`, 
            inline: true 
        });
    }
    
    await message.edit({ embeds: [updatedEmbed] });
}

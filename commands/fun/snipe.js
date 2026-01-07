const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'snipe',
    description: 'Show recently deleted/edited messages and ghost pings',
    aliases: ['s', 'deleted', 'ghostping'],
    category: 'Fun',
    
    async execute(message, args, client) {
        const snipeType = args[0]?.toLowerCase();
        
        // Get snipes for this channel (in-memory)
        let channelSnipes = client.snipes.get(message.channel.id);
        
        // Handle both array and single object cases
        if (!channelSnipes) {
            channelSnipes = [];
        } else if (!Array.isArray(channelSnipes)) {
            // Convert single object to array
            channelSnipes = [channelSnipes];
        }
        
        // Filter out invalid snipes
        channelSnipes = channelSnipes.filter(snipe => 
            snipe && 
            snipe.author && 
            typeof snipe.timestamp === 'number' &&
            snipe.timestamp > 0
        );
        
        // Check for ghost pings (mentions that were deleted)
        let ghostPings = [];
        if (channelSnipes.length > 0) {
            ghostPings = channelSnipes.filter(snipe => {
                // Check if message contains mentions
                const content = snipe.content || '';
                return (
                    content.includes('@everyone') || 
                    content.includes('@here') || 
                    content.includes('<@') ||
                    content.includes('<@&') // Role mentions
                );
            });
        }
        
        // Handle different snipe types
        if (snipeType === 'ghost' || snipeType === 'ping') {
            // Show ghost pings only
            if (ghostPings.length === 0) {
                return message.reply('✅ No ghost pings detected! No one pinged you recently.');
            }
            
            const ghost = ghostPings[0]; // Most recent ghost ping
            
            // Safety check
            if (!ghost || !ghost.content) {
                return message.reply('❌ Failed to retrieve ghost ping data.');
            }
            
            // Determine who was pinged
            const content = ghost.content || '';
            let pinnedInfo = '❓ Unknown ping type';
            
            if (content.includes('@everyone')) {
                pinnedInfo = '🔔 @everyone was pinged';
            } else if (content.includes('@here')) {
                pinnedInfo = '🔔 @here was pinged';
            } else if (content.includes(`<@${message.author.id}>`)) {
                pinnedInfo = `✋ You were directly pinged`;
            } else if (content.match(/<@&(\d+)>/)) {
                const roleMatch = content.match(/<@&(\d+)>/);
                pinnedInfo = `👥 Role <@&${roleMatch[1]}> was pinged (you're in it)`;
            }
            
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('👻 Ghost Ping Caught!')
                .setDescription(`**Who pinged you:** <@${ghost.author || 'Unknown'}>\n**When:** <t:${Math.floor((ghost.timestamp || Date.now()) / 1000)}:R>`)
                .addFields(
                    { name: '🎯 Ping Type', value: pinnedInfo, inline: false },
                    { name: '📝 What they said', value: ghost.content.substring(0, 1024) || 'No content', inline: false }
                );
            
            embed.setFooter({ text: `They tried to hide it, but we caught it! 😏` })
                .setTimestamp(ghost.timestamp || Date.now());
            
            return message.reply({ embeds: [embed] });
            
        } else if (snipeType === 'bulk') {
            // Show multiple deleted messages
            if (channelSnipes.length === 0) {
                return message.reply('❌ No recently deleted messages found!');
            }
            
            const embeds = [];
            const maxSnipes = Math.min(channelSnipes.length, 5);
            
            for (let i = 0; i < maxSnipes; i++) {
                const snipe = channelSnipes[i];
                if (!snipe) continue; // Skip if undefined
                
                const embed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle(`🗑️ Deleted Message #${i + 1}`)
                    .setDescription(`Message by <@${snipe.author || 'Unknown'}>`)
                    .addFields(
                        { name: '📝 Content', value: snipe.content || 'No content', inline: false }
                    )
                    .setFooter({ 
                        text: `Deleted ${formatTime(Date.now() - (snipe.timestamp || Date.now()))} ago` 
                    })
                    .setTimestamp(snipe.timestamp || Date.now());
                
                embeds.push(embed);
            }
            
            if (embeds.length === 0) {
                return message.reply('❌ No valid deleted messages found!');
            }
            
            // Send first embed
            await message.reply({ embeds: [embeds[0]] });
            
            // Send remaining embeds
            for (let i = 1; i < embeds.length; i++) {
                await message.channel.send({ embeds: [embeds[i]] });
            }
            
        } else if (snipeType === 'list' || snipeType === 'all') {
            // List all recent deletions
            if (channelSnipes.length === 0) {
                return message.reply('❌ No recently deleted messages found!');
            }
            
            const snipeList = channelSnipes.map((snipe, index) => {
                if (!snipe) return `${index + 1}. Invalid entry`;
                
                const timeAgo = formatTime(Date.now() - (snipe.timestamp || Date.now()));
                const contentPreview = snipe.content ? 
                    (snipe.content.substring(0, 50) + (snipe.content.length > 50 ? '...' : '')) : 
                    'No content';
                
                return `${index + 1}. <@${snipe.author || 'Unknown'}>: "${contentPreview}" (${timeAgo} ago)`;
            }).join('\n');
            
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('📋 Recent Deleted Messages')
                .setDescription(snipeList)
                .setFooter({ text: `Total: ${channelSnipes.length} deleted messages` });
            
            return message.reply({ embeds: [embed] });
            
        } else {
            // Show most recent deleted message (default)
            if (channelSnipes.length === 0) {
                return message.reply('✅ No recently deleted messages found! No one pinged you either.');
            }
            
            const snipe = channelSnipes[0]; // Most recent
            
            // Safety check
            if (!snipe || !snipe.author) {
                return message.reply('❌ Failed to retrieve deleted message data.');
            }
            
            // Check if this was a ghost ping
            const content = snipe.content || '';
            const isGhostPing = content && (
                content.includes('@everyone') || 
                content.includes('@here') || 
                content.includes(`<@${message.author.id}>`) ||
                content.includes('<@&')
            );
            
            let titleText = isGhostPing ? '👻 Ghost Ping Caught!' : '🗑️ Deleted Message';
            let descriptionText = isGhostPing ? 
                `**Who pinged you:** <@${snipe.author}>\n**When:** <t:${Math.floor((snipe.timestamp || Date.now()) / 1000)}:R>` :
                `Message from <@${snipe.author}> (${formatTime(Date.now() - (snipe.timestamp || Date.now()))} ago)`;
            
            const embed = new EmbedBuilder()
                .setColor(isGhostPing ? '#ff0000' : '#ff9900')
                .setTitle(titleText)
                .setDescription(descriptionText)
                .addFields(
                    { name: '📝 Message Content', value: content.substring(0, 1024) || 'No content', inline: false }
                )
                .setFooter({ 
                    text: isGhostPing ? `They tried to hide it, but we caught it! 😏` : `Deleted ${formatTime(Date.now() - (snipe.timestamp || Date.now()))} ago`
                })
                .setTimestamp(snipe.timestamp || Date.now());
            
            return message.reply({ embeds: [embed] });
        }
    }
};

function formatTime(ms) {
    if (ms <= 0) return 'just now';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

function extractMentions(content) {
    if (!content) return [];
    
    const mentions = [];
    
    // Check for @everyone
    if (content.includes('@everyone')) mentions.push('@everyone');
    
    // Check for @here
    if (content.includes('@here')) mentions.push('@here');
    
    // Extract user mentions (<@123456789> or <@!123456789>)
    const userMentions = content.match(/<@!?(\d+)>/g) || [];
    mentions.push(...userMentions);
    
    // Extract role mentions (<@&123456789>)
    const roleMentions = content.match(/<@&(\d+)>/g) || [];
    mentions.push(...roleMentions);
    
    return mentions;
}
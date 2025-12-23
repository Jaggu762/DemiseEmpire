const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'snipe',
    description: 'Show recently deleted/edited messages and ghost pings',
    aliases: ['s', 'deleted', 'ghostping'],
    category: 'Fun',
    
    async execute(message, args, client) {
        const snipeType = args[0]?.toLowerCase();
        
        // Get snipes for this channel (in-memory)
        const channelSnipes = client.snipes.get(message.channel.id) || [];
        
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
            const mentions = extractMentions(ghost.content);
            
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('👻 Ghost Ping Detected!')
                .setDescription(`Someone pinged you and deleted the message!`)
                .addFields(
                    { name: '👤 Deleted by', value: `<@${ghost.author}>`, inline: true },
                    { name: '📅 Time', value: `<t:${Math.floor(ghost.timestamp / 1000)}:R>`, inline: true },
                    { name: '🔔 Mentions Found', value: mentions.join(', ') || 'Everyone/Here ping', inline: false }
                );
            
            if (ghost.content && !ghost.content.includes('@everyone') && !ghost.content.includes('@here')) {
                embed.addFields({ name: '📝 Message Content', value: ghost.content.substring(0, 500), inline: false });
            }
            
            embed.setFooter({ text: 'Ghost ping detected!', iconURL: 'https://i.imgur.com/7jblalF.png' })
                .setTimestamp(ghost.timestamp);
            
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
                const embed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle(`🗑️ Deleted Message #${i + 1}`)
                    .setDescription(`Message by <@${snipe.author}>`)
                    .addFields(
                        { name: '📝 Content', value: snipe.content || 'No content', inline: false }
                    )
                    .setFooter({ text: `Deleted ${formatTime(Date.now() - snipe.timestamp)} ago` })
                    .setTimestamp(snipe.timestamp);
                
                embeds.push(embed);
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
                const timeAgo = formatTime(Date.now() - snipe.timestamp);
                const contentPreview = snipe.content ? 
                    (snipe.content.substring(0, 50) + (snipe.content.length > 50 ? '...' : '')) : 
                    'No content';
                
                return `${index + 1}. <@${snipe.author}>: "${contentPreview}" (${timeAgo} ago)`;
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
            
            // Check if this was a ghost ping
            const isGhostPing = snipe.content && (
                snipe.content.includes('@everyone') || 
                snipe.content.includes('@here') || 
                snipe.content.includes(`<@${message.author.id}>`) ||
                snipe.content.includes('<@&')
            );
            
            const embed = new EmbedBuilder()
                .setColor(isGhostPing ? '#ff0000' : '#ff9900')
                .setTitle(isGhostPing ? '👻 Ghost Ping Detected!' : '🗑️ Deleted Message')
                .setDescription(`Message deleted by <@${snipe.author}>`)
                .addFields(
                    { name: '📝 Content', value: snipe.content || 'No content', inline: false }
                )
                .setFooter({ 
                    text: isGhostPing ? 'Someone pinged you and deleted it!' : `Deleted ${formatTime(Date.now() - snipe.timestamp)} ago`
                })
                .setTimestamp(snipe.timestamp);
            
            return message.reply({ embeds: [embed] });
        }
    }
};

function formatTime(ms) {
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
// commands/info/getguilds.js
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'getguilds',
    description: 'Display info about multiple servers',
    aliases: ['multiguild', 'serverbatch'],
    category: 'Info',
    
    async execute(message, args, client, db) {
        try {
            if (args.length === 0) {
                return showHelp(message, client);
            }
            
            const guilds = client.guilds.cache;
            const results = [];
            
            // Process each argument
            for (const arg of args) {
                let foundGuild = null;
                
                // Try to find by ID
                foundGuild = guilds.get(arg);
                
                // If not found by ID, try to find by name
                if (!foundGuild) {
                    foundGuild = guilds.find(g => 
                        g.name.toLowerCase().includes(arg.toLowerCase())
                    );
                }
                
                if (foundGuild) {
                    await foundGuild.members.fetch().catch(() => {});
                    
                    const owner = await foundGuild.fetchOwner().catch(() => ({ user: { tag: 'Unknown' } }));
                    const botMember = foundGuild.members.cache.get(client.user.id);
                    const botJoinedAt = botMember ? botMember.joinedAt : null;
                    
                    results.push({
                        name: foundGuild.name,
                        id: foundGuild.id,
                        owner: owner.user.tag,
                        members: foundGuild.memberCount,
                        created: foundGuild.createdAt,
                        botJoined: botJoinedAt,
                        icon: foundGuild.iconURL({ dynamic: true, size: 256 }),
                        features: foundGuild.features,
                        premiumTier: foundGuild.premiumTier,
                        premiumCount: foundGuild.premiumSubscriptionCount || 0
                    });
                }
            }
            
            if (results.length === 0) {
                return message.reply('❌ No matching servers found. Please check your input.');
            }
            
            // Create embeds for each server
            for (const guildData of results) {
                const embed = createGuildEmbed(guildData, client);
                await message.channel.send({ embeds: [embed] });
                
                // Add a small delay between embeds
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // Send summary
            const summaryEmbed = new EmbedBuilder()
                .setColor('#43B581')
                .setTitle('📊 Search Results Summary')
                .setDescription(`Found **${results.length}** matching server(s)`)
                .addFields(
                    {
                        name: '🔍 Search Terms',
                        value: args.map(arg => `\`${arg}\``).join(', '),
                        inline: false
                    },
                    {
                        name: '📋 Found Servers',
                        value: results.map(g => `• **${g.name}** (${g.members} members)`).join('\n'),
                        inline: false
                    }
                )
                .setFooter({ text: 'DTEmpire Server Information System' })
                .setTimestamp();
            
            await message.channel.send({ embeds: [summaryEmbed] });
            
        } catch (error) {
            console.error('Getguilds command error:', error);
            message.reply('❌ An error occurred while fetching server information.');
        }
    }
};

// Helper function to create guild embed
function createGuildEmbed(guildData, client) {
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(guildData.name)
        .setThumbnail(guildData.icon)
        .setDescription(`Created on <t:${Math.floor(guildData.created.getTime() / 1000)}:D>`)
        .addFields(
            {
                name: '👑 Owner',
                value: guildData.owner,
                inline: true
            },
            {
                name: '🆔 Server ID',
                value: `\`${guildData.id}\``,
                inline: true
            },
            {
                name: '👥 Members',
                value: guildData.members.toString(),
                inline: true
            }
        );
    
    if (guildData.botJoined) {
        embed.addFields({
            name: '🤖 Bot Joined',
            value: `<t:${Math.floor(guildData.botJoined.getTime() / 1000)}:R>`,
            inline: true
        });
    }
    
    // Add premium info if available
    if (guildData.premiumTier > 0) {
        embed.addFields({
            name: '🚀 Nitro Boost',
            value: `Tier ${guildData.premiumTier} with ${guildData.premiumCount} boosters`,
            inline: true
        });
    }
    
    // Add features if any
    if (guildData.features && guildData.features.length > 0) {
        embed.addFields({
            name: '✨ Server Features',
            value: guildData.features.slice(0, 5).map(f => `• ${f}`).join('\n'),
            inline: false
        });
    }
    
    embed.setFooter({ text: `DTEmpire • Requested by ${client.user.username}` });
    
    return embed;
}

// Help function
function showHelp(message, client) {
    const embed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle('❓ getguilds Command Help')
        .setDescription('Display information about multiple servers')
        .addFields(
            {
                name: '📝 Syntax',
                value: `\`${client.botInfo.prefix}getguilds <server1> [server2] [server3]...\``,
                inline: false
            },
            {
                name: '🎯 Parameters',
                value: '`<server>` - Can be either:\n• Server ID (e.g., `123456789012345678`)\n• Server name (partial match, e.g., `"Manish"`)\n\n**Note:** You can specify multiple servers separated by spaces.',
                inline: false
            },
            {
                name: '📋 Examples',
                value: [
                    `\`${client.botInfo.prefix}getguilds Manish's Sanctuary\``,
                    `\`${client.botInfo.prefix}getguilds 123456789012345678 987654321098765432\``,
                    `\`${client.botInfo.prefix}getguilds "WorldMC" "Haven"\``
                ].join('\n'),
                inline: false
            },
            {
                name: 'ℹ️ Notes',
                value: '• The bot must be in the server for this to work\n• Partial server name matching is supported\n• Maximum of 5 servers per command\n• Results are displayed in separate embeds',
                inline: false
            }
        )
        .setFooter({ text: 'DTEmpire Server Information System' });
    
    return message.reply({ embeds: [embed] });
}
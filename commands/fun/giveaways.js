const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const ms = require('ms');

module.exports = {
    name: 'giveaway',
    description: 'Manage giveaways in your server',
    aliases: ['ga', 'giveaways'],
    category: 'Fun',
    
    async execute(message, args, client, db) {
        const subCommand = args[0]?.toLowerCase();
        
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return message.reply('❌ You need Manage Server permissions to use this command!');
        }
        
        // Check if db is available
        if (!db) {
            return message.reply('❌ Database not available. Please try again.');
        }
        
        // Initialize giveaways if not exists
        if (!db.data.giveaways) {
            db.data.giveaways = {};
            db.save();
        }
        
        if (!subCommand) {
            // Show help
            const embed = new EmbedBuilder()
                .setColor('#0061ff')
                .setTitle('🎉 Giveaway Management')
                .setDescription('Create and manage giveaways in your server!')
                .addFields(
                    { name: '🎁 Create Giveaway', value: '`^giveaway create <duration> <winners> <prize>`\nExample: `^giveaway create 1h 1 Discord Nitro`', inline: false },
                    { name: '📋 List Giveaways', value: '`^giveaway list` - Show active giveaways', inline: false },
                    { name: '🔚 End Giveaway', value: '`^giveaway end <message_id>` - End a giveaway early', inline: false },
                    { name: '🔄 Reroll', value: '`^giveaway reroll <message_id>` - Reroll winners', inline: false },
                    { name: '❌ Delete', value: '`^giveaway delete <message_id>` - Delete a giveaway', inline: false }
                )
                .setFooter({ text: 'Giveaway System | DTEmpire v2.6.9' });
            
            return message.reply({ embeds: [embed] });
        }
        
        switch (subCommand) {
            case 'create':
            case 'start':
                await handleCreateGiveaway(message, args, db);
                break;
                
            case 'list':
                await handleListGiveaways(message, db);
                break;
                
            case 'end':
                await handleEndGiveaway(message, args, client, db);
                break;
                
            case 'reroll':
                await handleRerollGiveaway(message, args, db);
                break;
                
            case 'delete':
                await handleDeleteGiveaway(message, args, client, db);
                break;
                
            default:
                message.reply('❌ Invalid subcommand! Use `.giveaway` for help.');
        }
    }
};

async function handleCreateGiveaway(message, args, db) {
    if (args.length < 4) {
        return message.reply('❌ Usage: `^giveaway create <duration> <winners> <prize>`');
    }
    
    const duration = ms(args[1]);
    const winners = parseInt(args[2]);
    const prize = args.slice(3).join(' ');
    
    if (!duration || duration < 10000) {
        return message.reply('❌ Please provide a valid duration (minimum 10 seconds)!');
    }
    
    if (isNaN(winners) || winners < 1 || winners > 50) {
        return message.reply('❌ Please provide a valid number of winners (1-50)!');
    }
    
    const endTime = Date.now() + duration;
    const giveawayId = Date.now().toString();
    
    // Create giveaway embed
    const giveawayEmbed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🎉 **GIVEAWAY** 🎉')
        .setDescription(`**Prize:** ${prize}\n**Winners:** ${winners}\n**Hosted by:** ${message.author}\n\nClick the button below to enter!`)
        .addFields(
            { name: '⏰ Ends In', value: `<t:${Math.floor(endTime / 1000)}:R>`, inline: true },
            { name: '👥 Entries', value: '0', inline: true },
            { name: '🎁 Winners', value: winners.toString(), inline: true }
        )
        .setFooter({ text: 'Ends at', iconURL: message.guild.iconURL() })
        .setTimestamp(endTime);
    
    // Create enter button
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`giveaway_enter_${giveawayId}`)
                .setLabel('🎉 Enter Giveaway')
                .setStyle(ButtonStyle.Success)
        );
    
    // Send giveaway message
    const giveawayMessage = await message.channel.send({
        content: '🎉 **NEW GIVEAWAY!** 🎉',
        embeds: [giveawayEmbed],
        components: [row]
    });
    
    // Save to database
    db.data.giveaways[giveawayId] = {
        id: giveawayId,
        guildId: message.guild.id,
        channelId: message.channel.id,
        messageId: giveawayMessage.id,
        prize: prize,
        winners: winners,
        endTime: endTime,
        ended: false,
        entries: [],
        hostId: message.author.id,
        createdAt: Date.now()
    };
    
    // Store message ID reference
    db.data.giveaways[giveawayMessage.id] = giveawayId;
    
    db.save();
    
    message.reply('✅ Giveaway created!').then(msg => {
        setTimeout(() => msg.delete(), 3000);
    });
    
    // Schedule auto-end
    setTimeout(async () => {
        if (db.data.giveaways[giveawayId] && !db.data.giveaways[giveawayId].ended) {
            const giveaway = db.data.giveaways[giveawayId];
            await endGiveaway(giveaway, message.client, db, false);
        }
    }, duration);
}

async function handleListGiveaways(message, db) {
    const activeGiveaways = Object.values(db.data.giveaways)
        .filter(g => typeof g === 'object' && g.id && !g.ended && g.guildId === message.guild.id);
    
    if (activeGiveaways.length === 0) {
        return message.reply('❌ No active giveaways!');
    }
    
    const giveawayList = activeGiveaways.map((ga, index) => {
        return `${index + 1}. **${ga.prize}** - ${ga.winners} winner(s) - Ends <t:${Math.floor(ga.endTime / 1000)}:R> [Jump to Giveaway](https://discord.com/channels/${ga.guildId}/${ga.channelId}/${ga.messageId})`;
    }).join('\n');
    
    const listEmbed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🎉 Active Giveaways')
        .setDescription(giveawayList)
        .setFooter({ text: `Total: ${activeGiveaways.length} giveaways` });
    
    message.reply({ embeds: [listEmbed] });
}

async function handleEndGiveaway(message, args, client, db) {
    if (args.length < 2) {
        return message.reply('❌ Please provide a giveaway message ID!');
    }
    
    const endMessageId = args[1];
    const giveawayToEnd = Object.values(db.data.giveaways)
        .find(g => typeof g === 'object' && g.id && g.messageId === endMessageId && g.guildId === message.guild.id);
    
    if (!giveawayToEnd) {
        return message.reply('❌ Giveaway not found!');
    }
    
    if (giveawayToEnd.ended) {
        return message.reply('❌ This giveaway has already ended!');
    }
    
    // End the giveaway
    await endGiveaway(giveawayToEnd, client, db, true);
    message.reply('✅ Giveaway ended early!');
}

async function handleRerollGiveaway(message, args, db) {
    if (args.length < 2) {
        return message.reply('❌ Please provide a giveaway message ID!');
    }
    
    const rerollMessageId = args[1];
    const giveawayToReroll = Object.values(db.data.giveaways)
        .find(g => typeof g === 'object' && g.id && g.messageId === rerollMessageId && g.guildId === message.guild.id && g.ended);
    
    if (!giveawayToReroll) {
        return message.reply('❌ Ended giveaway not found!');
    }
    
    // Reroll winners
    const entries = giveawayToReroll.entries || [];
    if (entries.length === 0) {
        return message.reply('❌ No entries to reroll!');
    }
    
    const newWinners = [];
    const winnerCount = Math.min(giveawayToReroll.winners, entries.length);
    const availableEntries = [...entries];
    
    for (let i = 0; i < winnerCount; i++) {
        const winnerIndex = Math.floor(Math.random() * availableEntries.length);
        newWinners.push(availableEntries[winnerIndex]);
        availableEntries.splice(winnerIndex, 1);
    }
    
    // Send reroll announcement
    const rerollEmbed = new EmbedBuilder()
        .setColor('#ff9900')
        .setTitle('🔄 Giveaway Rerolled!')
        .setDescription(`**Prize:** ${giveawayToReroll.prize}\n**New Winners:** ${newWinners.map(w => `<@${w}>`).join(', ')}`)
        .setFooter({ text: `Rerolled by ${message.author.tag}` })
        .setTimestamp();
    
    message.channel.send({ embeds: [rerollEmbed] });
}

async function handleDeleteGiveaway(message, args, client, db) {
    if (args.length < 2) {
        return message.reply('❌ Please provide a giveaway message ID!');
    }
    
    const deleteMessageId = args[1];
    const giveawayKey = Object.keys(db.data.giveaways)
        .find(key => {
            const g = db.data.giveaways[key];
            return typeof g === 'object' && g.id && g.messageId === deleteMessageId && g.guildId === message.guild.id;
        });
    
    if (!giveawayKey) {
        return message.reply('❌ Giveaway not found!');
    }
    
    const giveawayToDelete = db.data.giveaways[giveawayKey];
    
    // Try to delete the message
    try {
        const channel = message.guild.channels.cache.get(giveawayToDelete.channelId);
        if (channel) {
            const giveawayMsg = await channel.messages.fetch(giveawayToDelete.messageId).catch(() => null);
            if (giveawayMsg) {
                await giveawayMsg.delete();
            }
        }
    } catch (error) {
        console.error('Error deleting giveaway message:', error);
    }
    
    // Delete from database
    delete db.data.giveaways[giveawayKey];
    delete db.data.giveaways[giveawayToDelete.messageId]; // Remove the reference
    
    // Also remove any other references
    for (const key in db.data.giveaways) {
        if (db.data.giveaways[key] === giveawayKey || db.data.giveaways[key] === giveawayToDelete.id) {
            delete db.data.giveaways[key];
        }
    }
    
    db.save();
    
    message.reply('✅ Giveaway deleted!');
}

async function endGiveaway(giveaway, client, db, early = false) {
    if (!giveaway || giveaway.ended) return;
    
    const entries = giveaway.entries || [];
    const winners = [];
    const winnerCount = Math.min(giveaway.winners, entries.length);
    const availableEntries = [...entries];
    
    // Select winners
    for (let i = 0; i < winnerCount; i++) {
        const winnerIndex = Math.floor(Math.random() * availableEntries.length);
        winners.push(availableEntries[winnerIndex]);
        availableEntries.splice(winnerIndex, 1);
    }
    
    // Update database
    giveaway.ended = true;
    
    // Ensure giveaway exists in database
    if (db.data.giveaways[giveaway.id]) {
        db.data.giveaways[giveaway.id] = giveaway;
    }
    
    // Save to database
    db.save();
    
    // Get channel and message
    const channel = client.channels.cache.get(giveaway.channelId);
    if (!channel) {
        console.error(`Channel ${giveaway.channelId} not found for giveaway ${giveaway.id}`);
        return;
    }
    
    try {
        const giveawayMsg = await channel.messages.fetch(giveaway.messageId).catch(() => null);
        
        if (!giveawayMsg) {
            console.error(`Message ${giveaway.messageId} not found for giveaway ${giveaway.id}`);
            return;
        }
        
        // Create ended embed
        const endedEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('🎉 **GIVEAWAY ENDED** 🎉')
            .setDescription(`**Prize:** ${giveaway.prize}\n**Winners:** ${winners.length > 0 ? winners.map(w => `<@${w}>`).join(', ') : 'No one entered!'}\n**Hosted by:** <@${giveaway.hostId}>`)
            .addFields(
                { name: '👥 Total Entries', value: entries.length.toString(), inline: true },
                { name: '🎁 Winners', value: winners.length.toString(), inline: true },
                { name: '⏰ Ended', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: early ? 'Ended Early' : 'Giveaway Ended', iconURL: client.user.displayAvatarURL() })
            .setTimestamp();
        
        // Update message
        await giveawayMsg.edit({
            content: '🎉 **GIVEAWAY ENDED** 🎉',
            embeds: [endedEmbed],
            components: [] // Remove buttons
        });
        
        // Announce winners
        if (winners.length > 0) {
            const winnerAnnouncement = winners.map(w => `<@${w}>`).join(', ');
            await channel.send({
                content: `🎉 **Congratulations ${winnerAnnouncement}!** You won **${giveaway.prize}**!\n${giveawayMsg.url}`
            });
        }
        
    } catch (error) {
        console.error('Error ending giveaway:', error);
    }
}

// Add button interaction handler
module.exports.handleButtonInteraction = async function(interaction, client, db) {
    if (!interaction.isButton() || !interaction.customId.startsWith('giveaway_enter_')) return;
    
    if (!db) {
        return interaction.reply({ 
            content: '❌ Database error. Please try again.',
            flags: 64 
        });
    }
    
    const giveawayId = interaction.customId.replace('giveaway_enter_', '');
    const giveaway = db.data.giveaways[giveawayId];
    
    if (!giveaway || giveaway.ended) {
        return interaction.reply({ 
            content: '❌ This giveaway has ended or does not exist!',
            flags: 64 
        });
    }
    
    if (giveaway.endTime < Date.now()) {
        giveaway.ended = true;
        db.save();
        return interaction.reply({ 
            content: '❌ This giveaway has ended!',
            flags: 64 
        });
    }
    
    // Check if user already entered
    if (giveaway.entries.includes(interaction.user.id)) {
        return interaction.reply({ 
            content: '❌ You have already entered this giveaway!',
            flags: 64 
        });
    }
    
    // Add user to entries
    giveaway.entries.push(interaction.user.id);
    
    // Update entry count in embed
    try {
        const channel = client.channels.cache.get(giveaway.channelId);
        if (channel) {
            const giveawayMsg = await channel.messages.fetch(giveaway.messageId);
            const embed = EmbedBuilder.from(giveawayMsg.embeds[0]);
            
            // Update entry count
            embed.data.fields[1].value = giveaway.entries.length.toString();
            
            await giveawayMsg.edit({ embeds: [embed] });
        }
    } catch (error) {
        console.error('Error updating giveaway embed:', error);
    }
    
    // Save to database
    db.save();
    
    return interaction.reply({ 
        content: '✅ You have entered the giveaway! Good luck! 🎉',
        flags: 64 
    });
};

// Add giveaway checker function for index.js
module.exports.checkGiveaways = async function(client, db) {
    if (!db || !db.data || !db.data.giveaways) return;
    
    const now = Date.now();
    const giveaways = Object.values(db.data.giveaways)
        .filter(g => typeof g === 'object' && g.id && !g.ended && g.endTime < now);
    
    console.log(`[Giveaway] Checking ${giveaways.length} expired giveaways`);
    
    for (const giveaway of giveaways) {
        try {
            await endGiveaway(giveaway, client, db, false);
        } catch (error) {
            console.error('[Giveaway] Error ending giveaway:', error);
        }
    }
};
const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'birthday',
    description: 'Set your birthday for auto-celebrations',
    aliases: ['bday', 'bd'],
    category: 'Utility',
    usage: '^birthday set <DD/MM> or ^birthday set <DD/MM/YYYY>',
    
    async execute(message, args, client, db) {
        const subCommand = args[0]?.toLowerCase();
        
        if (!subCommand) {
            return showBirthdayInfo(message, client, db);
        }
        
        switch (subCommand) {
            case 'set':
                await setBirthday(message, args.slice(1), client, db);
                break;
            case 'remove':
            case 'delete':
                await removeBirthday(message, client, db);
                break;
            case 'list':
            case 'upcoming':
                await listUpcomingBirthdays(message, client, db, args.slice(1));
                break;
            case 'check':
                await checkBirthday(message, args.slice(1), client, db);
                break;
            case 'setchannel':
            case 'channel':
                await setBirthdayChannel(message, args.slice(1), db);
                break;
            case 'today':
                await showTodayBirthdays(message, client, db);
                break;
            default:
                message.reply('❌ Unknown subcommand. Use: set, remove, list, upcoming, check, setchannel, today');
        }
    }
};

async function showBirthdayInfo(message, client, db) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    // Get user birthday
    const birthday = await db.getUserBirthday(userId, guildId);
    
    const embed = new EmbedBuilder()
        .setColor('#ff69b4')
        .setTitle('🎂 Birthday System')
        .setDescription('Set your birthday and get automatic celebrations!')
        .addFields(
            { name: '🎈 Commands', value: '`^birthday set <DD/MM>` - Set your birthday\n`^birthday set <DD/MM/YYYY>` - Set with year\n`^birthday remove` - Remove your birthday\n`^birthday list [days]` - Upcoming (default 30)\n`^birthday check @user` - Check someone\'s birthday\n`^birthday setchannel #channel` - Set announcement channel\n`^birthday today` - See today\'s birthdays', inline: false }
        );
    
    if (birthday) {
        const date = new Date(birthday.date);
        const displayDate = birthday.showYear ? 
            `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}` : 
            `${date.getDate()}/${date.getMonth() + 1}`;
        
        embed.addFields({ 
            name: '🎂 Your Birthday', 
            value: displayDate, 
            inline: true 
        });
        
        // Calculate days until birthday
        const now = new Date();
        const nextBirthday = new Date(now.getFullYear(), date.getMonth(), date.getDate());
        if (nextBirthday < now) {
            nextBirthday.setFullYear(now.getFullYear() + 1);
        }
        
        const daysUntil = Math.ceil((nextBirthday - now) / (1000 * 60 * 60 * 24));
        
        if (daysUntil === 0) {
            embed.addFields({ name: '🎉 Status', value: '**🎊 TODAY IS YOUR BIRTHDAY! 🎊**', inline: true });
        } else if (daysUntil === 1) {
            embed.addFields({ name: '⏰ Days Until', value: 'Tomorrow! 🎉', inline: true });
        } else {
            embed.addFields({ name: '⏰ Days Until', value: `${daysUntil} days`, inline: true });
        }
        
        if (birthday.showYear) {
            const age = now.getFullYear() - date.getFullYear();
            const nextAge = nextBirthday.getFullYear() === now.getFullYear() ? age : age + 1;
            embed.addFields({ name: '🎂 Turning', value: `${nextAge} years old`, inline: true });
        }
    } else {
        embed.addFields({ name: '❌ No Birthday Set', value: 'Use `^birthday set <DD/MM>` to set your birthday!', inline: false });
    }
    
    await message.reply({ embeds: [embed] });
}

async function setBirthday(message, args, client, db) {
    if (args.length === 0) {
        return message.reply('❌ Usage: `^birthday set <DD/MM>` or `^birthday set <DD/MM/YYYY>`\nExamples:\n`^birthday set 15/03` - March 15th\n`^birthday set 15/03/1995` - March 15th, 1995');
    }
    
    const dateString = args[0];
    const parts = dateString.split('/');
    
    if (parts.length < 2 || parts.length > 3) {
        return message.reply('❌ Invalid date format! Use `DD/MM` or `DD/MM/YYYY`\nExamples: `15/03` or `15/03/1995`');
    }
    
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const year = parts.length === 3 ? parseInt(parts[2]) : null;
    
    // Validate date
    if (isNaN(day) || isNaN(month) || day < 1 || day > 31 || month < 1 || month > 12) {
        return message.reply('❌ Invalid date! Day must be 1-31 and month must be 1-12.');
    }
    
    if (year !== null) {
        if (isNaN(year) || year < 1900 || year > new Date().getFullYear()) {
            return message.reply('❌ Invalid year! Year must be between 1900 and current year.');
        }
    }
    
    // Check if date is valid
    const testDate = new Date(year || 2000, month - 1, day);
    if (testDate.getDate() !== day || testDate.getMonth() !== month - 1) {
        return message.reply('❌ Invalid date! This date doesn\'t exist.');
    }
    
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    // Create birthday date object (use 2000 as default year if not provided)
    const birthdayDate = new Date(year || 2000, month - 1, day);
    
    // Save birthday
    await db.setUserBirthday(userId, guildId, {
        date: birthdayDate.getTime(),
        day: day,
        month: month,
        year: year,
        showYear: year !== null,
        setAt: Date.now()
    });
    
    // Calculate age if year provided
    let ageInfo = '';
    if (year) {
        const age = new Date().getFullYear() - year;
        ageInfo = `\nYou will turn **${age + (new Date() < new Date(new Date().getFullYear(), month - 1, day) ? 0 : 1)}** on your next birthday!`;
    }
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🎂 Birthday Set!')
        .setDescription(`Your birthday has been set to **${day}/${month}${year ? `/${year}` : ''}**!${ageInfo}\n\nYou will receive a special birthday message on your birthday! 🎉`)
        .setFooter({ text: 'Happy early birthday! 🎈' });
    
    await message.reply({ embeds: [embed] });
}

async function removeBirthday(message, client, db) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    const birthday = await db.getUserBirthday(userId, guildId);
    
    if (!birthday) {
        return message.reply('❌ You don\'t have a birthday set!');
    }
    
    await db.removeUserBirthday(userId, guildId);
    
    const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('🗑️ Birthday Removed')
        .setDescription('Your birthday has been removed from the system.')
        .setFooter({ text: 'You can set it again anytime with ^birthday set' });
    
    await message.reply({ embeds: [embed] });
}

async function listUpcomingBirthdays(message, client, db, args = []) {
    const guildId = message.guild.id;
    const range = parseInt(args[0]) || 30;
    const maxRange = Math.min(Math.max(range, 1), 365);
    
    // Get all birthdays for this guild
    const birthdays = await db.getAllBirthdays(guildId);
    
    if (birthdays.length === 0) {
        return message.reply('❌ No birthdays set in this server yet!');
    }
    
    // Calculate days until each birthday
    const now = new Date();
    const birthdaysWithDays = birthdays.map(bday => {
        const bdayDate = new Date(bday.date);
        const nextBirthday = new Date(now.getFullYear(), bdayDate.getMonth(), bdayDate.getDate());
        
        if (nextBirthday < now) {
            nextBirthday.setFullYear(now.getFullYear() + 1);
        }
        
        const daysUntil = Math.ceil((nextBirthday - now) / (1000 * 60 * 60 * 24));
        
        return {
            ...bday,
            daysUntil: daysUntil,
            nextBirthday: nextBirthday
        };
    });
    
    // Sort by days until birthday and filter within requested range
    birthdaysWithDays.sort((a, b) => a.daysUntil - b.daysUntil);
    const filtered = birthdaysWithDays.filter(b => b.daysUntil <= maxRange);
    
    // Take top 10 from filtered list (or fallback to unfiltered if none)
    const source = filtered.length > 0 ? filtered : birthdaysWithDays;
    const upcomingBirthdays = source.slice(0, 10);
    
    const embed = new EmbedBuilder()
        .setColor('#ff69b4')
        .setTitle('🎂 Upcoming Birthdays')
        .setDescription(`Next ${upcomingBirthdays.length} birthdays in this server (within ${filtered.length > 0 ? maxRange : 'all'} days):`)
        .setFooter({ text: `Total birthdays set: ${birthdays.length}` });
    
    for (const bday of upcomingBirthdays) {
        try {
            const user = await client.users.fetch(bday.userId);
            const bdayDate = new Date(bday.date);
            const displayDate = `${bdayDate.getDate()}/${bdayDate.getMonth() + 1}`;
            
            let daysText = '';
            if (bday.daysUntil === 0) {
                daysText = '🎉 **TODAY!**';
            } else if (bday.daysUntil === 1) {
                daysText = '🎊 **Tomorrow!**';
            } else {
                daysText = `In ${bday.daysUntil} days`;
            }
            
            let ageText = '';
            if (bday.showYear && bday.year) {
                const age = bday.nextBirthday.getFullYear() - bday.year;
                ageText = ` (turning ${age})`;
            }
            
            embed.addFields({
                name: `${user.username}`,
                value: `📅 ${displayDate}${ageText}\n⏰ ${daysText}`,
                inline: true
            });
        } catch (error) {
            // Skip if user not found
        }
    }
    
    await message.reply({ embeds: [embed] });
}

async function checkBirthday(message, args, client, db) {
    const guildId = message.guild.id;
    const target = args[0] || message.author.id;
    const targetId = extractUserId(target);
    if (!targetId) {
        return message.reply('❌ Please mention a user or provide a valid user ID to check.');
    }

    const bday = await db.getUserBirthday(targetId, guildId);
    if (!bday) {
        return message.reply('❌ That user has not set a birthday.');
    }

    let user;
    try {
        user = await client.users.fetch(targetId);
    } catch (error) {
        // no-op
    }

    const now = new Date();
    const nextBirthday = new Date(now.getFullYear(), bday.month - 1, bday.day);
    if (nextBirthday < now) nextBirthday.setFullYear(now.getFullYear() + 1);
    const daysUntil = Math.ceil((nextBirthday - now) / (1000 * 60 * 60 * 24));

    const dateLabel = `${bday.day}/${bday.month}${bday.showYear && bday.year ? `/${bday.year}` : ''}`;
    const ageText = bday.showYear && bday.year ? `Turning ${nextBirthday.getFullYear() - bday.year}` : 'Year hidden';

    const embed = new EmbedBuilder()
        .setColor('#00bcd4')
        .setTitle(`🎂 ${user ? user.username : 'User'}'s Birthday`)
        .addFields(
            { name: '📅 Date', value: dateLabel, inline: true },
            { name: '⏰ Days Until', value: daysUntil === 0 ? '🎉 Today!' : `${daysUntil} day(s)`, inline: true }
        );

    if (bday.showYear && bday.year) {
        embed.addFields({ name: '🎈 Age', value: ageText, inline: true });
    }

    await message.reply({ embeds: [embed] });
}

async function setBirthdayChannel(message, args, db) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        return message.reply('❌ You need the **Manage Server** permission to set the birthday channel.');
    }

    const channel = message.mentions.channels.first() || (args[0] && message.guild.channels.cache.get(args[0]));
    if (!channel) {
        return message.reply('❌ Please mention a channel or provide a valid channel ID.');
    }

    await db.updateGuildConfig(message.guild.id, { birthday_channel: channel.id });
    await message.reply(`✅ Birthday announcements will be sent in ${channel}.`);
}

function extractUserId(text) {
    const mentionMatch = text.match(/<@!?(\d+)>/);
    if (mentionMatch) return mentionMatch[1];
    if (/^\d{15,20}$/.test(text)) return text;
    return null;
}

async function showTodayBirthdays(message, client, db) {
    const guildId = message.guild.id;
    
    // Get today's birthdays
    const birthdays = await db.getTodayBirthdays(guildId);
    
    if (birthdays.length === 0) {
        return message.reply('🎂 No birthdays today!');
    }
    
    const embed = new EmbedBuilder()
        .setColor('#ff69b4')
        .setTitle('🎉 Today\'s Birthdays!')
        .setDescription(`Let's celebrate ${birthdays.length} birthday${birthdays.length > 1 ? 's' : ''} today! 🎊`)
        .setFooter({ text: 'Happy Birthday! 🎂' });
    
    for (const bday of birthdays) {
        try {
            const user = await client.users.fetch(bday.userId);
            
            let ageText = '';
            if (bday.showYear && bday.year) {
                const age = new Date().getFullYear() - bday.year;
                ageText = ` - **${age} years old!**`;
            }
            
            embed.addFields({
                name: `🎂 ${user.username}`,
                value: `<@${user.id}>${ageText}\n🎈 Happy Birthday! 🎊`,
                inline: false
            });
        } catch (error) {
            // Skip if user not found
        }
    }
    
    await message.reply({ embeds: [embed] });
}

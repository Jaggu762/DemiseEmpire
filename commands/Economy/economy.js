const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

// Game configuration
const PROPERTIES = {
    houses: [
        { id: 'small_house', name: 'Small House', price: 50000, daily_rent: 500, slots: 1 },
        { id: 'medium_house', name: 'Medium House', price: 150000, daily_rent: 1500, slots: 2 },
        { id: 'large_house', name: 'Large House', price: 300000, daily_rent: 3000, slots: 3 },
        { id: 'mansion', name: 'Mansion', price: 1000000, daily_rent: 10000, slots: 5 }
    ],
    shops: [
        { id: 'small_shop', name: 'Small Shop', price: 75000, daily_profit: 750, type: 'retail' },
        { id: 'medium_shop', name: 'Medium Shop', price: 200000, daily_profit: 2000, type: 'retail' },
        { id: 'large_shop', name: 'Large Shop', price: 500000, daily_profit: 5000, type: 'retail' },
        { id: 'mall', name: 'Shopping Mall', price: 2000000, daily_profit: 20000, type: 'commercial' }
    ],
    lands: [
        { id: 'small_land', name: 'Small Land Plot', price: 100000, max_properties: 1 },
        { id: 'medium_land', name: 'Medium Land Plot', price: 300000, max_properties: 3 },
        { id: 'large_land', name: 'Large Land Plot', price: 750000, max_properties: 5 },
        { id: 'estate', name: 'Estate', price: 2000000, max_properties: 10 }
    ],
    businesses: [
        { id: 'cafe', name: 'Coffee Shop', price: 500000, daily_profit: 5000, employees: 3 },
        { id: 'restaurant', name: 'Restaurant', price: 1000000, daily_profit: 10000, employees: 5 },
        { id: 'hotel', name: 'Hotel', price: 3000000, daily_profit: 30000, employees: 10 },
        { id: 'factory', name: 'Factory', price: 5000000, daily_profit: 50000, employees: 20 }
    ]
};

const JOBS = [
    { id: 'bank_teller', name: 'Bank Teller', salary: 500, level: 1, xp_required: 0 },
    { id: 'bank_manager', name: 'Bank Manager', salary: 1500, level: 2, xp_required: 100 },
    { id: 'investment_banker', name: 'Investment Banker', salary: 5000, level: 3, xp_required: 500 },
    { id: 'bank_director', name: 'Bank Director', salary: 15000, level: 4, xp_required: 2000 },
    { id: 'ceo', name: 'CEO', salary: 50000, level: 5, xp_required: 10000 }
];

const LOTTERY_TICKET_PRICE = 1000;
const LOTTERY_JACKPOT_BASE = 100000;
const MAX_LOTTERY_TICKETS = 5;

module.exports = {
    name: 'economy',
    description: 'Advanced economy system with properties, jobs, and lottery',
    aliases: ['eco', 'money', 'rich'],
    category: 'Economy',
    
    async execute(message, args, client, db) {
        const subCommand = args[0]?.toLowerCase();
        
        if (!subCommand) {
            return showEconomyDashboard(message, client, db);
        }
        
        switch (subCommand) {
            case 'work':
                await workJob(message, client, db);
                break;
            case 'jobs':
                await showJobs(message, client, db);
                break;
            case 'apply':
                await applyJob(message, args.slice(1), client, db);
                break;
            case 'properties':
                await showProperties(message, client, db);
                break;
            case 'buy':
                await buyProperty(message, args.slice(1), client, db);
                break;
            case 'sell':
                await sellProperty(message, args.slice(1), client, db);
                break;
            case 'lottery':
                await lotteryInfo(message, client, db);
                break;
            case 'buyticket':
                await buyLotteryTicket(message, args.slice(1), client, db);
                break;
            case 'bank':
                await bankManagement(message, args.slice(1), client, db);
                break;
            case 'leaderboard':
                await showLeaderboard(message, client, db);
                break;
            case 'profile':
                await showProfile(message, client, db);
                break;
            case 'steal':
                await stealMoney(message, client, db);
                break;
            case 'pay':
                await payMoney(message, args.slice(1), client, db);
                break;
            case 'race':
                await horseRace(message, args.slice(1), client, db);
                break;
            case 'football':
                await footballBet(message, args.slice(1), client, db);
                break;
            case 'gamble':
                await gambleMoney(message, args.slice(1), client, db);
                break;
            case 'help':
                await showHelp(message);
                break;
            default:
                message.reply('❌ Unknown subcommand. Use `^economy help` for available commands.');
        }
    }
};

// ========== HELPER FUNCTIONS ==========

async function showEconomyDashboard(message, client, db) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    // Get user economy
    const economy = await db.getUserEconomy(userId, guildId);
    const job = await db.getUserJob(userId, guildId);
    const properties = await db.getUserProperties(userId, guildId);
    
    // Calculate daily income from properties
    let dailyIncome = 0;
    let totalProperties = 0;
    
    properties.houses.forEach(house => {
        const houseConfig = PROPERTIES.houses.find(h => h.id === house.id);
        if (houseConfig) dailyIncome += houseConfig.daily_rent;
    });
    
    properties.shops.forEach(shop => {
        const shopConfig = PROPERTIES.shops.find(s => s.id === shop.id);
        if (shopConfig) dailyIncome += shopConfig.daily_profit;
    });
    
    properties.businesses.forEach(business => {
        const businessConfig = PROPERTIES.businesses.find(b => b.id === business.id);
        if (businessConfig) dailyIncome += businessConfig.daily_profit;
    });
    
    totalProperties = properties.houses.length + properties.shops.length + properties.lands.length + properties.businesses.length;
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('💰 Economy Dashboard')
        .setDescription(`Welcome to DTEmpire Economy System, ${message.author.username}!`)
        .addFields(
            { name: '💼 Current Job', value: `${job.job_type === 'unemployed' ? 'Unemployed' : JOBS.find(j => j.id === job.job_type)?.name || 'Unknown'}`, inline: true },
            { name: '📊 Job Level', value: `${job.job_level}`, inline: true },
            { name: '💰 Salary', value: `$${job.salary}/day`, inline: true },
            { name: '💵 Wallet', value: `$${economy.wallet.toLocaleString()}`, inline: true },
            { name: '🏦 Bank', value: `$${economy.bank.toLocaleString()}`, inline: true },
            { name: '💰 Total', value: `$${economy.total.toLocaleString()}`, inline: true },
            { name: '🏘️ Properties', value: `${totalProperties} owned`, inline: true },
            { name: '📈 Daily Income', value: `$${dailyIncome.toLocaleString()}/day`, inline: true },
            { name: '📊 Net Worth', value: `$${(economy.total + properties.total_property_value).toLocaleString()}`, inline: true }
        )
        .setFooter({ text: 'Use ^economy help for all commands' });
    
    // Create buttons for quick actions
    const row = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId('eco_work')
            .setLabel('💼 Work')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('eco_properties')
            .setLabel('🏘️ Properties')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('eco_lottery')
            .setLabel('🎫 Lottery')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('eco_bank')
            .setLabel('🏦 Bank')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('eco_jobs')
            .setLabel('👔 Jobs')
            .setStyle(ButtonStyle.Secondary)
    );

// Add second row for more buttons
const row2 = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId('eco_leaderboard')
            .setLabel('📊 Leaderboard')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('eco_profile')
            .setLabel('👤 Profile')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('eco_help')
            .setLabel('❓ Help')
            .setStyle(ButtonStyle.Secondary)
    );
    
    
    const dashboardMessage = await message.reply({ embeds: [embed], components: [row, row2] });
    
    // Create collector for buttons
    const filter = i => i.user.id === message.author.id;
    const collector = dashboardMessage.createMessageComponentCollector({ filter, time: 60000 });
    
    
    
    collector.on('end', () => {
        const disabledRow = ActionRowBuilder.from(row);
        disabledRow.components.forEach(c => c.setDisabled(true));
        dashboardMessage.edit({ components: [disabledRow] }).catch(() => {});
    });
}

async function workJob(message, client, db) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    // Get user job
    const job = await db.getUserJob(userId, guildId);
    
    if (job.job_type === 'unemployed') {
        return message.reply('❌ You need a job first! Use `^economy jobs` to see available jobs and `^economy apply <job>` to apply.');
    }
    
    // Check cooldown (8 hours)
    const now = Date.now();
    const cooldown = 8 * 60 * 60 * 1000; // 8 hours
    
    if (job.last_work && (now - job.last_work) < cooldown) {
        const remaining = cooldown - (now - job.last_work);
        const hours = Math.floor(remaining / (60 * 60 * 1000));
        const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
        
        return message.reply(`⏰ You can work again in ${hours}h ${minutes}m. Work every 8 hours!`);
    }
    
    // Calculate salary with random bonus
    const baseSalary = job.salary;
    const bonus = Math.floor(Math.random() * baseSalary * 0.3); // Up to 30% bonus
    const totalSalary = baseSalary + bonus;
    
    // Update user economy
    const economy = await db.getUserEconomy(userId, guildId);
    economy.wallet += totalSalary;
    economy.experience += 10; // XP for working
    await db.updateUserEconomy(userId, guildId, economy);
    
    // Update job
    job.last_work = now;
    job.experience += 10;
    
    // Check for level up
    const currentJob = JOBS.find(j => j.id === job.job_type);
    if (currentJob && job.experience >= currentJob.xp_required) {
        // Find next job
        const nextJob = JOBS.find(j => j.level === currentJob.level + 1);
        if (nextJob) {
            job.job_type = nextJob.id;
            job.job_level = nextJob.level;
            job.salary = nextJob.salary;
        }
    }
    
    await db.updateUserJob(userId, guildId, job);
    
    // Log transaction
    await db.addTransaction(userId, guildId, 'work', totalSalary, {
        job: job.job_type,
        bonus: bonus
    });
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('💼 Work Completed!')
        .setDescription(`Great work, ${message.author.username}! You've earned your salary.`)
        .addFields(
            { name: 'Job', value: currentJob.name, inline: true },
            { name: 'Base Salary', value: `$${baseSalary.toLocaleString()}`, inline: true },
            { name: 'Bonus', value: `$${bonus.toLocaleString()}`, inline: true },
            { name: 'Total Earned', value: `$${totalSalary.toLocaleString()}`, inline: false },
            { name: 'XP Gained', value: '10 XP', inline: true },
            { name: 'Next Work', value: '8 hours', inline: true }
        )
        .setFooter({ text: 'Keep working to level up your job!' });
    
    await message.reply({ embeds: [embed] });
}

async function showJobs(message, client, db) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    const userJob = await db.getUserJob(userId, guildId);
    
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('💼 Available Jobs')
        .setDescription('Apply for a job using `^economy apply <job_id>`')
        .setFooter({ text: `Your current job: ${userJob.job_type === 'unemployed' ? 'Unemployed' : JOBS.find(j => j.id === userJob.job_type)?.name || 'Unknown'}` });
    
    JOBS.forEach(job => {
        const canApply = userJob.job_level >= job.level - 1;
        
        embed.addFields({
            name: `${job.name} ${userJob.job_type === job.id ? '✅' : ''}`,
            value: `**ID:** \`${job.id}\`\n**Level:** ${job.level}\n**Salary:** $${job.salary}/day\n**XP Required:** ${job.xp_required}\n**Status:** ${canApply ? '✅ Available' : '🔒 Need Level ' + (job.level - 1)}`,
            inline: false
        });
    });
    
    await message.reply({ embeds: [embed] });
}

async function applyJob(message, args, client, db) {
    if (args.length === 0) {
        return message.reply('❌ Usage: `^economy apply <job_id>`\nExample: `^economy apply bank_teller`');
    }
    
    const jobId = args[0].toLowerCase();
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    const job = JOBS.find(j => j.id === jobId);
    if (!job) {
        return message.reply('❌ Invalid job ID. Use `^economy jobs` to see available jobs.');
    }
    
    const userJob = await db.getUserJob(userId, guildId);
    
    // Check requirements
    if (userJob.job_level < job.level - 1) {
        return message.reply(`❌ You need to be at level ${job.level - 1} to apply for this job.`);
    }
    
    // Apply for job
    userJob.job_type = job.id;
    userJob.job_level = job.level;
    userJob.salary = job.salary;
    userJob.experience = 0;
    
    await db.updateUserJob(userId, guildId, userJob);
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Job Application Successful!')
        .setDescription(`Congratulations, ${message.author.username}!`)
        .addFields(
            { name: 'New Job', value: job.name, inline: true },
            { name: 'Level', value: `${job.level}`, inline: true },
            { name: 'Daily Salary', value: `$${job.salary}`, inline: true },
            { name: 'XP Required for Next', value: `${job.xp_required} XP`, inline: false },
            { name: 'Start Working', value: 'Use `^economy work` to start earning!', inline: false }
        );
    
    await message.reply({ embeds: [embed] });
}

async function showProperties(message, client, db) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    const properties = await db.getUserProperties(userId, guildId);
    
    const embed = new EmbedBuilder()
        .setColor('#ff9900')
        .setTitle('🏘️ Your Properties')
        .setDescription('Manage your real estate empire!');
    
    // Calculate total property value
    let totalValue = 0;
    let totalDailyIncome = 0;
    
    // Houses
    if (properties.houses.length > 0) {
        let housesValue = '';
        properties.houses.forEach(house => {
            const config = PROPERTIES.houses.find(h => h.id === house.id);
            if (config) {
                housesValue += `• ${config.name} - Value: $${config.price.toLocaleString()} | Rent: $${config.daily_rent}/day\n`;
                totalValue += config.price;
                totalDailyIncome += config.daily_rent;
            }
        });
        embed.addFields({ name: `🏠 Houses (${properties.houses.length})`, value: housesValue || 'None', inline: false });
    }
    
    // Shops
    if (properties.shops.length > 0) {
        let shopsValue = '';
        properties.shops.forEach(shop => {
            const config = PROPERTIES.shops.find(s => s.id === shop.id);
            if (config) {
                shopsValue += `• ${config.name} - Value: $${config.price.toLocaleString()} | Profit: $${config.daily_profit}/day\n`;
                totalValue += config.price;
                totalDailyIncome += config.daily_profit;
            }
        });
        embed.addFields({ name: `🛍️ Shops (${properties.shops.length})`, value: shopsValue || 'None', inline: false });
    }
    
    // Lands
    if (properties.lands.length > 0) {
        let landsValue = '';
        properties.lands.forEach(land => {
            const config = PROPERTIES.lands.find(l => l.id === land.id);
            if (config) {
                landsValue += `• ${config.name} - Value: $${config.price.toLocaleString()}\n`;
                totalValue += config.price;
            }
        });
        embed.addFields({ name: `🌳 Lands (${properties.lands.length})`, value: landsValue || 'None', inline: false });
    }
    
    // Businesses
    if (properties.businesses.length > 0) {
        let businessesValue = '';
        properties.businesses.forEach(business => {
            const config = PROPERTIES.businesses.find(b => b.id === business.id);
            if (config) {
                businessesValue += `• ${config.name} - Value: $${config.price.toLocaleString()} | Profit: $${config.daily_profit}/day\n`;
                totalValue += config.price;
                totalDailyIncome += config.daily_profit;
            }
        });
        embed.addFields({ name: `🏢 Businesses (${properties.businesses.length})`, value: businessesValue || 'None', inline: false });
    }
    
    if (totalValue === 0) {
        embed.addFields({ name: 'No Properties', value: 'You don\'t own any properties yet! Use `^economy buy` to purchase properties.', inline: false });
    }
    
    embed.addFields(
        { name: '💰 Total Property Value', value: `$${totalValue.toLocaleString()}`, inline: true },
        { name: '📈 Daily Income', value: `$${totalDailyIncome.toLocaleString()}`, inline: true },
        { name: '🏦 Next Collection', value: 'Use `^economy bank collect` daily', inline: true }
    );
    
    embed.setFooter({ text: 'Use ^economy buy to purchase more properties!' });
    
    await message.reply({ embeds: [embed] });
}

async function buyProperty(message, args, client, db) {
    if (args.length === 0) {
        // Show available properties for purchase
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🏘️ Available Properties')
            .setDescription('Use `^economy buy <type> <id>` to purchase\nExample: `^economy buy house small_house`');
        
        // Houses
        let housesList = '';
        PROPERTIES.houses.forEach(house => {
            housesList += `• **${house.name}** (\`${house.id}\`) - $${house.price.toLocaleString()} | Rent: $${house.daily_rent}/day | Slots: ${house.slots}\n`;
        });
        embed.addFields({ name: '🏠 Houses', value: housesList, inline: false });
        
        // Shops
        let shopsList = '';
        PROPERTIES.shops.forEach(shop => {
            shopsList += `• **${shop.name}** (\`${shop.id}\`) - $${shop.price.toLocaleString()} | Profit: $${shop.daily_profit}/day\n`;
        });
        embed.addFields({ name: '🛍️ Shops', value: shopsList, inline: false });
        
        // Lands
        let landsList = '';
        PROPERTIES.lands.forEach(land => {
            landsList += `• **${land.name}** (\`${land.id}\`) - $${land.price.toLocaleString()} | Max Properties: ${land.max_properties}\n`;
        });
        embed.addFields({ name: '🌳 Lands', value: landsList, inline: false });
        
        // Businesses
        let businessesList = '';
        PROPERTIES.businesses.forEach(business => {
            businessesList += `• **${business.name}** (\`${business.id}\`) - $${business.price.toLocaleString()} | Profit: $${business.daily_profit}/day\n`;
        });
        embed.addFields({ name: '🏢 Businesses', value: businessesList, inline: false });
        
        return message.reply({ embeds: [embed] });
    }
    
    const type = args[0].toLowerCase();
    const propertyId = args[1]?.toLowerCase();
    
    if (!propertyId) {
        return message.reply('❌ Please specify a property ID. Use `^economy buy` to see available properties.');
    }
    
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    // Find the property
    let property;
    let propertyList;
    
    switch (type) {
        case 'house':
            propertyList = PROPERTIES.houses;
            break;
        case 'shop':
            propertyList = PROPERTIES.shops;
            break;
        case 'land':
            propertyList = PROPERTIES.lands;
            break;
        case 'business':
            propertyList = PROPERTIES.businesses;
            break;
        default:
            return message.reply('❌ Invalid property type. Use: house, shop, land, or business');
    }
    
    property = propertyList.find(p => p.id === propertyId);
    if (!property) {
        return message.reply('❌ Invalid property ID. Use `^economy buy` to see available properties.');
    }
    
    // Check if user can afford it
    const economy = await db.getUserEconomy(userId, guildId);
    if (economy.wallet < property.price) {
        return message.reply(`❌ You need $${property.price.toLocaleString()} to buy this property. You have $${economy.wallet.toLocaleString()}.`);
    }
    
    // Check land requirements for houses
    if (type === 'house') {
        const properties = await db.getUserProperties(userId, guildId);
        
        // Count total houses
        const totalHouses = properties.houses.length;
        
        // Check if user has enough land space
        const totalLandSlots = properties.lands.reduce((total, land) => {
            const landConfig = PROPERTIES.lands.find(l => l.id === land.id);
            return total + (landConfig?.max_properties || 0);
        }, 0);
        
        if (totalHouses >= totalLandSlots) {
            return message.reply('❌ You don\'t have enough land space! Buy more land first.');
        }
    }
    
    // Deduct money
    economy.wallet -= property.price;
    await db.updateUserEconomy(userId, guildId, economy);
    
    // Add property
    const userProperties = await db.getUserProperties(userId, guildId);
    userProperties[`${type}s`].push({
        id: property.id,
        purchased_at: Date.now(),
        value: property.price
    });
    
    // Update total property value
    userProperties.total_property_value += property.price;
    
    await db.updateUserProperties(userId, guildId, userProperties);
    
    // Log transaction
    await db.addTransaction(userId, guildId, 'buy', -property.price, {
        property_type: type,
        property_id: property.id,
        property_name: property.name
    });
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Property Purchased!')
        .setDescription(`Congratulations on your new ${property.name}!`)
        .addFields(
            { name: 'Property', value: property.name, inline: true },
            { name: 'Type', value: type.charAt(0).toUpperCase() + type.slice(1), inline: true },
            { name: 'Price', value: `$${property.price.toLocaleString()}`, inline: true },
            { name: 'Daily Income', value: `$${(property.daily_rent || property.daily_profit || 0).toLocaleString()}`, inline: true },
            { name: 'Remaining Balance', value: `$${economy.wallet.toLocaleString()}`, inline: false }
        );
    
    await message.reply({ embeds: [embed] });
}

async function sellProperty(message, args, client, db) {
    if (args.length < 2) {
        return message.reply('❌ Usage: `^economy sell <type> <index>`\nExample: `^economy sell house 0`\nUse `^economy properties` to see your properties.');
    }
    
    const type = args[0].toLowerCase();
    const index = parseInt(args[1]);
    
    if (isNaN(index) || index < 0) {
        return message.reply('❌ Please provide a valid property index.');
    }
    
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    // Get user properties
    const userProperties = await db.getUserProperties(userId, guildId);
    const propertyArray = userProperties[`${type}s`];
    
    if (!propertyArray || propertyArray.length === 0) {
        return message.reply(`❌ You don't own any ${type}s.`);
    }
    
    if (index >= propertyArray.length) {
        return message.reply(`❌ Invalid index. You have ${propertyArray.length} ${type}(s).`);
    }
    
    // Get the property
    const property = propertyArray[index];
    
    // Find property configuration
    let propertyConfig;
    switch (type) {
        case 'house':
            propertyConfig = PROPERTIES.houses.find(h => h.id === property.id);
            break;
        case 'shop':
            propertyConfig = PROPERTIES.shops.find(s => s.id === property.id);
            break;
        case 'land':
            propertyConfig = PROPERTIES.lands.find(l => l.id === property.id);
            break;
        case 'business':
            propertyConfig = PROPERTIES.businesses.find(b => b.id === property.id);
            break;
    }
    
    if (!propertyConfig) {
        return message.reply('❌ Property configuration not found.');
    }
    
    // Calculate sell price (80% of original price)
    const sellPrice = Math.floor(propertyConfig.price * 0.8);
    
    // Remove property from array
    propertyArray.splice(index, 1);
    userProperties[`${type}s`] = propertyArray;
    
    // Update total property value
    userProperties.total_property_value -= propertyConfig.price;
    
    await db.updateUserProperties(userId, guildId, userProperties);
    
    // Add money to wallet
    const economy = await db.getUserEconomy(userId, guildId);
    economy.wallet += sellPrice;
    await db.updateUserEconomy(userId, guildId, economy);
    
    // Log transaction
    await db.addTransaction(userId, guildId, 'sell', sellPrice, {
        property_type: type,
        property_id: property.id,
        property_name: propertyConfig.name
    });
    
    const embed = new EmbedBuilder()
        .setColor('#ff9900')
        .setTitle('💰 Property Sold!')
        .setDescription(`You sold your ${propertyConfig.name}.`)
        .addFields(
            { name: 'Property', value: propertyConfig.name, inline: true },
            { name: 'Original Price', value: `$${propertyConfig.price.toLocaleString()}`, inline: true },
            { name: 'Sell Price', value: `$${sellPrice.toLocaleString()}`, inline: true },
            { name: 'New Balance', value: `$${economy.wallet.toLocaleString()}`, inline: false }
        );
    
    await message.reply({ embeds: [embed] });
}

async function lotteryInfo(message, client, db) {
    const guildId = message.guild.id;
    
    // Get active tickets
    const activeTickets = await db.getActiveLotteryTickets(guildId);
    const totalPot = LOTTERY_JACKPOT_BASE + (activeTickets.length * LOTTERY_TICKET_PRICE);
    
    const embed = new EmbedBuilder()
        .setColor('#ff00ff')
        .setTitle('🎫 Lottery Information')
        .setDescription('Test your luck and win big!')
        .addFields(
            { name: '🎟️ Ticket Price', value: `$${LOTTERY_TICKET_PRICE.toLocaleString()}`, inline: true },
            { name: '💰 Current Jackpot', value: `$${totalPot.toLocaleString()}`, inline: true },
            { name: '🎯 Active Tickets', value: `${activeTickets.length}`, inline: true },
            { name: '📝 How to Play', value: 'Buy tickets with `^economy buyticket <number>` (1-100)\nDrawing happens when 100 tickets are sold\nWinning number is randomly generated', inline: false },
            { name: '🎲 Your Tickets', value: 'Use `^economy profile` to see your tickets', inline: false }
        )
        .setFooter({ text: 'Good luck!' });
    
    await message.reply({ embeds: [embed] });
}

async function buyLotteryTicket(message, args, client, db) {
    if (args.length === 0) {
        return message.reply('❌ Usage: `^economy buyticket <number>` (1-100)');
    }
    
    const ticketNumber = parseInt(args[0]);
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    if (isNaN(ticketNumber) || ticketNumber < 1 || ticketNumber > 100) {
        return message.reply('❌ Please choose a number between 1 and 100.');
    }
    
    // Check if user already has too many tickets
    const activeTickets = await db.getActiveLotteryTickets(guildId);
    const userTickets = activeTickets.filter(t => t.user_id === userId);
    
    if (userTickets.length >= MAX_LOTTERY_TICKETS) {
        return message.reply(`❌ You can only buy ${MAX_LOTTERY_TICKETS} tickets.`);
    }
    
    // Check if number is already taken
    const numberTaken = activeTickets.some(t => t.ticket_number === ticketNumber);
    if (numberTaken) {
        return message.reply('❌ This number is already taken. Choose another number.');
    }
    
    // Check if user can afford it
    const economy = await db.getUserEconomy(userId, guildId);
    if (economy.wallet < LOTTERY_TICKET_PRICE) {
        return message.reply(`❌ You need $${LOTTERY_TICKET_PRICE} to buy a ticket. You have $${economy.wallet}.`);
    }
    
    // Deduct money
    economy.wallet -= LOTTERY_TICKET_PRICE;
    await db.updateUserEconomy(userId, guildId, economy);
    
    // Buy ticket
    await db.buyLotteryTicket(userId, guildId, ticketNumber, LOTTERY_TICKET_PRICE);
    
    // Log transaction
    await db.addTransaction(userId, guildId, 'lottery', -LOTTERY_TICKET_PRICE, {
        ticket_number: ticketNumber
    });
    
    const embed = new EmbedBuilder()
        .setColor('#ff00ff')
        .setTitle('🎫 Lottery Ticket Purchased!')
        .setDescription(`Good luck, ${message.author.username}!`)
        .addFields(
            { name: 'Your Number', value: `#${ticketNumber}`, inline: true },
            { name: 'Ticket Price', value: `$${LOTTERY_TICKET_PRICE}`, inline: true },
            { name: 'Your Tickets', value: `${userTickets.length + 1}/${MAX_LOTTERY_TICKETS}`, inline: true },
            { name: 'Current Jackpot', value: `$${(LOTTERY_JACKPOT_BASE + (activeTickets.length + 1) * LOTTERY_TICKET_PRICE).toLocaleString()}`, inline: false },
            { name: 'Drawing', value: 'When 100 tickets are sold', inline: true }
        );
    
    // Check if we should draw lottery (100 tickets sold)
    if (activeTickets.length + 1 >= 100) {
        embed.addFields({ name: '🎉 JACKPOT READY!', value: 'Lottery will be drawn soon!', inline: false });
        // In a real implementation, you'd trigger the lottery draw here
    }
    
    await message.reply({ embeds: [embed] });
}

async function bankManagement(message, args, client, db) {
    const subCommand = args[0]?.toLowerCase();
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    if (!subCommand) {
        // Show bank info
        const economy = await db.getUserEconomy(userId, guildId);
        const properties = await db.getUserProperties(userId, guildId);
        
        // Calculate daily income
        let dailyIncome = 0;
        properties.houses.forEach(house => {
            const houseConfig = PROPERTIES.houses.find(h => h.id === house.id);
            if (houseConfig) dailyIncome += houseConfig.daily_rent;
        });
        
        properties.shops.forEach(shop => {
            const shopConfig = PROPERTIES.shops.find(s => s.id === shop.id);
            if (shopConfig) dailyIncome += shopConfig.daily_profit;
        });
        
        properties.businesses.forEach(business => {
            const businessConfig = PROPERTIES.businesses.find(b => b.id === business.id);
            if (businessConfig) dailyIncome += businessConfig.daily_profit;
        });
        
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🏦 Bank Management')
            .setDescription('Manage your finances and collect daily income')
            .addFields(
                { name: '💵 Wallet', value: `$${economy.wallet.toLocaleString()}`, inline: true },
                { name: '🏦 Bank Balance', value: `$${economy.bank.toLocaleString()}`, inline: true },
                { name: '💰 Total', value: `$${economy.total.toLocaleString()}`, inline: true },
                { name: '📈 Daily Income', value: `$${dailyIncome.toLocaleString()}`, inline: true },
                { name: '🏘️ Property Value', value: `$${properties.total_property_value.toLocaleString()}`, inline: true },
                { name: '💰 Net Worth', value: `$${(economy.total + properties.total_property_value).toLocaleString()}`, inline: true }
            )
            .setFooter({ text: 'Use: ^economy bank deposit/withdraw/collect' });
        
        return message.reply({ embeds: [embed] });
    }
    
    switch (subCommand) {
        case 'deposit':
            await depositMoney(message, args.slice(1), client, db);
            break;
        case 'withdraw':
            await withdrawMoney(message, args.slice(1), client, db);
            break;
        case 'collect':
            await collectRent(message, client, db);
            break;
        default:
            message.reply('❌ Unknown subcommand. Use: deposit, withdraw, collect');
    }
}

async function depositMoney(message, args, client, db) {
    const amount = args[0];
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    if (!amount || amount.toLowerCase() === 'all') {
        // Deposit all
        const economy = await db.getUserEconomy(userId, guildId);
        const depositAmount = economy.wallet;
        
        if (depositAmount <= 0) {
            return message.reply('❌ You have no money in your wallet to deposit.');
        }
        
        economy.wallet = 0;
        economy.bank += depositAmount;
        await db.updateUserEconomy(userId, guildId, economy);
        
        // Log transaction
        await db.addTransaction(userId, guildId, 'deposit', depositAmount);
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('💰 Deposit Successful')
            .setDescription(`Deposited all your money to the bank.`)
            .addFields(
                { name: 'Amount Deposited', value: `$${depositAmount.toLocaleString()}`, inline: true },
                { name: 'New Bank Balance', value: `$${economy.bank.toLocaleString()}`, inline: true },
                { name: 'Wallet', value: `$${economy.wallet.toLocaleString()}`, inline: true }
            );
        
        return message.reply({ embeds: [embed] });
    }
    
    const depositAmount = parseInt(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
        return message.reply('❌ Please specify a valid amount to deposit.');
    }
    
    const economy = await db.getUserEconomy(userId, guildId);
    if (economy.wallet < depositAmount) {
        return message.reply(`❌ You only have $${economy.wallet.toLocaleString()} in your wallet.`);
    }
    
    economy.wallet -= depositAmount;
    economy.bank += depositAmount;
    await db.updateUserEconomy(userId, guildId, economy);
    
    // Log transaction
    await db.addTransaction(userId, guildId, 'deposit', depositAmount);
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('💰 Deposit Successful')
        .setDescription(`Deposited money to your bank account.`)
        .addFields(
            { name: 'Amount Deposited', value: `$${depositAmount.toLocaleString()}`, inline: true },
            { name: 'New Bank Balance', value: `$${economy.bank.toLocaleString()}`, inline: true },
            { name: 'Remaining Wallet', value: `$${economy.wallet.toLocaleString()}`, inline: true }
        );
    
    await message.reply({ embeds: [embed] });
}

async function withdrawMoney(message, args, client, db) {
    const amount = args[0];
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    if (!amount || amount.toLowerCase() === 'all') {
        // Withdraw all
        const economy = await db.getUserEconomy(userId, guildId);
        const withdrawAmount = economy.bank;
        
        if (withdrawAmount <= 0) {
            return message.reply('❌ You have no money in your bank to withdraw.');
        }
        
        economy.bank = 0;
        economy.wallet += withdrawAmount;
        await db.updateUserEconomy(userId, guildId, economy);
        
        // Log transaction
        await db.addTransaction(userId, guildId, 'withdraw', withdrawAmount);
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('💰 Withdrawal Successful')
            .setDescription(`Withdrew all your money from the bank.`)
            .addFields(
                { name: 'Amount Withdrawn', value: `$${withdrawAmount.toLocaleString()}`, inline: true },
                { name: 'New Wallet Balance', value: `$${economy.wallet.toLocaleString()}`, inline: true },
                { name: 'Bank Balance', value: `$${economy.bank.toLocaleString()}`, inline: true }
            );
        
        return message.reply({ embeds: [embed] });
    }
    
    const withdrawAmount = parseInt(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
        return message.reply('❌ Please specify a valid amount to withdraw.');
    }
    
    const economy = await db.getUserEconomy(userId, guildId);
    if (economy.bank < withdrawAmount) {
        return message.reply(`❌ You only have $${economy.bank.toLocaleString()} in your bank.`);
    }
    
    economy.bank -= withdrawAmount;
    economy.wallet += withdrawAmount;
    await db.updateUserEconomy(userId, guildId, economy);
    
    // Log transaction
    await db.addTransaction(userId, guildId, 'withdraw', withdrawAmount);
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('💰 Withdrawal Successful')
        .setDescription(`Withdrew money from your bank account.`)
        .addFields(
            { name: 'Amount Withdrawn', value: `$${withdrawAmount.toLocaleString()}`, inline: true },
            { name: 'New Wallet Balance', value: `$${economy.wallet.toLocaleString()}`, inline: true },
            { name: 'Remaining Bank', value: `$${economy.bank.toLocaleString()}`, inline: true }
        );
    
    await message.reply({ embeds: [embed] });
}

async function collectRent(message, client, db) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    const properties = await db.getUserProperties(userId, guildId);
    const economy = await db.getUserEconomy(userId, guildId);
    
    // Check if 24 hours have passed since last collection
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    
    if (properties.last_rent_collection && (now - properties.last_rent_collection) < oneDay) {
        const remaining = oneDay - (now - properties.last_rent_collection);
        const hours = Math.floor(remaining / (60 * 60 * 1000));
        const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
        
        return message.reply(`⏰ You can collect rent again in ${hours}h ${minutes}m.`);
    }
    
    // Calculate total rent/profit
    let totalIncome = 0;
    let details = [];
    
    properties.houses.forEach(house => {
        const houseConfig = PROPERTIES.houses.find(h => h.id === house.id);
        if (houseConfig) {
            totalIncome += houseConfig.daily_rent;
            details.push(`🏠 ${houseConfig.name}: $${houseConfig.daily_rent}`);
        }
    });
    
    properties.shops.forEach(shop => {
        const shopConfig = PROPERTIES.shops.find(s => s.id === shop.id);
        if (shopConfig) {
            totalIncome += shopConfig.daily_profit;
            details.push(`🛍️ ${shopConfig.name}: $${shopConfig.daily_profit}`);
        }
    });
    
    properties.businesses.forEach(business => {
        const businessConfig = PROPERTIES.businesses.find(b => b.id === business.id);
        if (businessConfig) {
            totalIncome += businessConfig.daily_profit;
            details.push(`🏢 ${businessConfig.name}: $${businessConfig.daily_profit}`);
        }
    });
    
    if (totalIncome === 0) {
        return message.reply('❌ You don\'t have any properties that generate income!');
    }
    
    // Add income to wallet
    economy.wallet += totalIncome;
    await db.updateUserEconomy(userId, guildId, economy);
    
    // Update last collection time
    properties.last_rent_collection = now;
    await db.updateUserProperties(userId, guildId, properties);
    
    // Log transaction
    await db.addTransaction(userId, guildId, 'rent', totalIncome, {
        properties: details.length
    });
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('💰 Daily Income Collected!')
        .setDescription(`Collected rent and profits from your properties.`)
        .addFields(
            { name: 'Total Collected', value: `$${totalIncome.toLocaleString()}`, inline: true },
            { name: 'Properties', value: `${details.length}`, inline: true },
            { name: 'New Wallet', value: `$${economy.wallet.toLocaleString()}`, inline: true },
            { name: 'Next Collection', value: '24 hours', inline: false }
        );
    
    // Add details if not too many
    if (details.length <= 10) {
        embed.addFields({ name: '📊 Breakdown', value: details.join('\n'), inline: false });
    }
    
    await message.reply({ embeds: [embed] });
}

async function showLeaderboard(message, client, db) {
    const guildId = message.guild.id;
    
    // Get all economies
    const allEconomies = await db.getAllEconomy(guildId);
    
    // Get all users' properties to calculate net worth
    const leaderboard = [];
    
    for (const economy of allEconomies) {
        try {
            const properties = await db.getUserProperties(economy.user_id, guildId);
            const netWorth = economy.total + (properties.total_property_value || 0);
            
            leaderboard.push({
                user_id: economy.user_id,
                wallet: economy.wallet,
                bank: economy.bank,
                total: economy.total,
                property_value: properties.total_property_value || 0,
                net_worth: netWorth
            });
        } catch (error) {
            console.error(`Error getting properties for user ${economy.user_id}:`, error);
        }
    }
    
    // Sort by net worth
    leaderboard.sort((a, b) => b.net_worth - a.net_worth);
    
    const embed = new EmbedBuilder()
        .setColor('#ffd700')
        .setTitle('🏆 Economy Leaderboard')
        .setDescription(`Top 10 richest players in ${message.guild.name}`)
        .setFooter({ text: 'Updated in real-time' });
    
    for (let i = 0; i < Math.min(10, leaderboard.length); i++) {
        const entry = leaderboard[i];
        try {
            const user = await client.users.fetch(entry.user_id);
            const rankEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            
            embed.addFields({
                name: `${rankEmoji} ${user.username}`,
                value: `**Net Worth:** $${entry.net_worth.toLocaleString()}\n**Wallet:** $${entry.wallet.toLocaleString()} | **Bank:** $${entry.bank.toLocaleString()}\n**Properties:** $${entry.property_value.toLocaleString()}`,
                inline: false
            });
        } catch (error) {
            console.error(`Error fetching user ${entry.user_id}:`, error);
            embed.addFields({
                name: `${i + 1}. Unknown User`,
                value: `**Net Worth:** $${entry.net_worth.toLocaleString()}`,
                inline: false
            });
        }
    }
    
    if (leaderboard.length === 0) {
        embed.setDescription('No economy data available yet.');
    }
    
    await message.reply({ embeds: [embed] });
}

async function showProfile(message, client, db) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    const targetUser = message.mentions.users.first() || message.author;
    const targetUserId = targetUser.id;
    
    // Get user data
    const economy = await db.getUserEconomy(targetUserId, guildId);
    const job = await db.getUserJob(targetUserId, guildId);
    const properties = await db.getUserProperties(targetUserId, guildId);
    
    // Get recent transactions
    const transactions = await db.getUserTransactions(targetUserId, guildId, 5);
    
    // Get lottery tickets
    const activeTickets = await db.getActiveLotteryTickets(guildId);
    const userTickets = activeTickets.filter(t => t.user_id === targetUserId);
    
    // Calculate net worth
    const netWorth = economy.total + (properties.total_property_value || 0);
    
    // Calculate daily income
    let dailyIncome = 0;
    properties.houses.forEach(house => {
        const houseConfig = PROPERTIES.houses.find(h => h.id === house.id);
        if (houseConfig) dailyIncome += houseConfig.daily_rent;
    });
    
    properties.shops.forEach(shop => {
        const shopConfig = PROPERTIES.shops.find(s => s.id === shop.id);
        if (shopConfig) dailyIncome += shopConfig.daily_profit;
    });
    
    properties.businesses.forEach(business => {
        const businessConfig = PROPERTIES.businesses.find(b => b.id === business.id);
        if (businessConfig) dailyIncome += businessConfig.daily_profit;
    });
    
    const embed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle(`📊 ${targetUser.username}'s Economy Profile`)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
            { name: '💼 Job', value: `${job.job_type === 'unemployed' ? 'Unemployed' : JOBS.find(j => j.id === job.job_type)?.name || 'Unknown'} (Level ${job.job_level})`, inline: true },
            { name: '💰 Salary', value: `$${job.salary}/day`, inline: true },
            { name: '📈 XP', value: `${job.experience}`, inline: true },
            { name: '💵 Wallet', value: `$${economy.wallet.toLocaleString()}`, inline: true },
            { name: '🏦 Bank', value: `$${economy.bank.toLocaleString()}`, inline: true },
            { name: '💰 Total Cash', value: `$${economy.total.toLocaleString()}`, inline: true },
            { name: '🏘️ Properties', value: `${properties.houses.length + properties.shops.length + properties.lands.length + properties.businesses.length}`, inline: true },
            { name: '📈 Property Value', value: `$${properties.total_property_value.toLocaleString()}`, inline: true },
            { name: '💰 Net Worth', value: `$${netWorth.toLocaleString()}`, inline: true },
            { name: '📊 Daily Income', value: `$${dailyIncome.toLocaleString()}`, inline: true },
            { name: '🎫 Lottery Tickets', value: `${userTickets.length} active`, inline: true },
            { name: '📅 Member Since', value: `<t:${Math.floor(message.guild.members.cache.get(targetUserId)?.joinedTimestamp / 1000) || 0}:R>`, inline: true }
        );
    
    // Add recent transactions if any
    if (transactions.length > 0) {
        let transactionsText = '';
        transactions.forEach(t => {
            const timeAgo = Math.floor((Date.now() - t.timestamp) / (60 * 1000));
            const hours = Math.floor(timeAgo / 60);
            const minutes = timeAgo % 60;
            const timeStr = hours > 0 ? `${hours}h ${minutes}m ago` : `${minutes}m ago`;
            
            transactionsText += `• **${t.type}**: $${t.amount.toLocaleString()} (${timeStr})\n`;
        });
        
        embed.addFields({ name: '📝 Recent Transactions', value: transactionsText, inline: false });
    }
    
    // Add lottery tickets if any
    if (userTickets.length > 0) {
        const ticketNumbers = userTickets.map(t => `#${t.ticket_number}`).join(', ');
        embed.addFields({ name: '🎫 Active Lottery Tickets', value: ticketNumbers, inline: false });
    }
    
    await message.reply({ embeds: [embed] });
}

async function showHelp(message) {
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('💰 Economy System Help')
        .setDescription('All commands for the advanced economy system')
        .addFields(
            { name: '📊 Dashboard', value: '`^economy` - View your economy dashboard', inline: false },
            { name: '💼 Jobs', value: '`^economy jobs` - View available jobs\n`^economy apply <job_id>` - Apply for a job\n`^economy work` - Work and earn salary', inline: false },
            { name: '🏘️ Properties', value: '`^economy properties` - View your properties\n`^economy buy` - View available properties\n`^economy buy <type> <id>` - Buy a property\n`^economy sell <type> <index>` - Sell a property', inline: false },
            { name: '🏦 Bank', value: '`^economy bank` - View bank balance\n`^economy bank deposit <amount/all>` - Deposit money\n`^economy bank withdraw <amount/all>` - Withdraw money\n`^economy bank collect` - Collect daily rent', inline: false },
            { name: '🎫 Lottery', value: '`^economy lottery` - View lottery info\n`^economy buyticket <number>` - Buy lottery ticket (1-100)', inline: false },
            { name: '🎮 Games & Activities', value: '`^economy steal @user` - Steal money (50% success, 1h cooldown)\n`^economy pay @user <amount>` - Send money to others\n`^economy race <amount>` - Horse race betting (3x)\n`^economy football <amount> <red/blue>` - Team match betting\n`^economy gamble <amount>` - Test your luck (2x)', inline: false },
            { name: '📊 Leaderboards', value: '`^economy leaderboard` - View top 10 richest players', inline: false },
            { name: '👤 Profile', value: '`^economy profile [@user]` - View economy profile', inline: false }
        )
        .setFooter({ text: 'Build your empire and become the richest!' });
    
    await message.reply({ embeds: [embed] });
}

// ========== NEW ECONOMY FEATURES ==========

async function stealMoney(message, client, db) {
    const targetUser = message.mentions.users.first();
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    if (!targetUser) {
        return message.reply('❌ Usage: `^economy steal @user`\nExample: `^economy steal @John`');
    }
    
    if (targetUser.id === userId) {
        return message.reply('❌ You can\'t steal from yourself!');
    }
    
    if (targetUser.bot) {
        return message.reply('❌ You can\'t steal from bots!');
    }
    
    // Check cooldown (1 hour)
    if (!client.cooldowns) client.cooldowns = new Map();
    if (!client.cooldowns.has('steal')) client.cooldowns.set('steal', new Map());
    
    const now = Date.now();
    const cooldownAmount = 60 * 60 * 1000; // 1 hour
    const timestamps = client.cooldowns.get('steal');
    
    if (timestamps.has(userId)) {
        const expirationTime = timestamps.get(userId) + cooldownAmount;
        
        if (now < expirationTime) {
            const timeLeft = expirationTime - now;
            const minutes = Math.floor(timeLeft / (60 * 1000));
            return message.reply(`⏰ You can steal again in ${minutes} minutes.`);
        }
    }
    
    // Get both users' economy
    const userEconomy = await db.getUserEconomy(userId, guildId);
    const targetEconomy = await db.getUserEconomy(targetUser.id, guildId);
    
    if (targetEconomy.wallet < 100) {
        return message.reply('❌ This user doesn\'t have enough money in their wallet to steal from!');
    }
    
    // 50% success rate
    const success = Math.random() < 0.5;
    
    if (success) {
        // Steal between 10% and 30% of target's wallet
        const stealPercentage = Math.random() * 0.2 + 0.1; // 10% to 30%
        const stolenAmount = Math.floor(targetEconomy.wallet * stealPercentage);
        
        // Update both economies
        userEconomy.wallet += stolenAmount;
        targetEconomy.wallet -= stolenAmount;
        
        await db.updateUserEconomy(userId, guildId, userEconomy);
        await db.updateUserEconomy(targetUser.id, guildId, targetEconomy);
        
        // Log transactions
        await db.addTransaction(userId, guildId, 'steal_success', stolenAmount, { target: targetUser.id });
        await db.addTransaction(targetUser.id, guildId, 'stolen_from', -stolenAmount, { thief: userId });
        
        // Set cooldown
        timestamps.set(userId, now);
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('💰 Steal Successful!')
            .setDescription(`You successfully stole from ${targetUser.username}!`)
            .addFields(
                { name: '💵 Amount Stolen', value: `$${stolenAmount.toLocaleString()}`, inline: true },
                { name: '💼 Your New Balance', value: `$${userEconomy.wallet.toLocaleString()}`, inline: true },
                { name: '⏰ Next Steal', value: '1 hour', inline: true }
            )
            .setFooter({ text: 'Crime doesn\'t always pay!' });
        
        await message.reply({ embeds: [embed] });
        
        // Notify victim
        try {
            const victimEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🚨 You\'ve Been Robbed!')
                .setDescription(`${message.author.username} stole $${stolenAmount.toLocaleString()} from you in ${message.guild.name}!`)
                .addFields(
                    { name: '💼 Your New Balance', value: `$${targetEconomy.wallet.toLocaleString()}`, inline: true }
                );
            
            await targetUser.send({ embeds: [victimEmbed] });
        } catch (error) {
            // User has DMs disabled
        }
    } else {
        // Failed - lose money as fine
        const fineAmount = Math.floor(userEconomy.wallet * 0.1); // 10% fine
        
        if (fineAmount > 0) {
            userEconomy.wallet -= fineAmount;
            await db.updateUserEconomy(userId, guildId, userEconomy);
            
            // Log transaction
            await db.addTransaction(userId, guildId, 'steal_failed', -fineAmount);
        }
        
        // Set cooldown
        timestamps.set(userId, now);
        
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('🚨 Steal Failed!')
            .setDescription('You got caught trying to steal!')
            .addFields(
                { name: '⚖️ Fine', value: `$${fineAmount.toLocaleString()}`, inline: true },
                { name: '💼 Your Balance', value: `$${userEconomy.wallet.toLocaleString()}`, inline: true },
                { name: '⏰ Next Attempt', value: '1 hour', inline: true }
            )
            .setFooter({ text: 'Better luck next time!' });
        
        await message.reply({ embeds: [embed] });
    }
}

async function payMoney(message, args, client, db) {
    const targetUser = message.mentions.users.first();
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    if (!targetUser) {
        return message.reply('❌ Usage: `^economy pay @user <amount>`\nExample: `^economy pay @John 1000`');
    }
    
    if (targetUser.id === userId) {
        return message.reply('❌ You can\'t pay yourself!');
    }
    
    if (targetUser.bot) {
        return message.reply('❌ You can\'t pay bots!');
    }
    
    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount <= 0) {
        return message.reply('❌ Please specify a valid amount to pay.');
    }
    
    // Get both users' economy
    const userEconomy = await db.getUserEconomy(userId, guildId);
    const targetEconomy = await db.getUserEconomy(targetUser.id, guildId);
    
    if (userEconomy.wallet < amount) {
        return message.reply(`❌ You don't have enough money! You have $${userEconomy.wallet.toLocaleString()}.`);
    }
    
    // Transfer money
    userEconomy.wallet -= amount;
    targetEconomy.wallet += amount;
    
    await db.updateUserEconomy(userId, guildId, userEconomy);
    await db.updateUserEconomy(targetUser.id, guildId, targetEconomy);
    
    // Log transactions
    await db.addTransaction(userId, guildId, 'pay_sent', -amount, { recipient: targetUser.id });
    await db.addTransaction(targetUser.id, guildId, 'pay_received', amount, { sender: userId });
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('💸 Payment Sent!')
        .setDescription(`You sent money to ${targetUser.username}`)
        .addFields(
            { name: '💵 Amount', value: `$${amount.toLocaleString()}`, inline: true },
            { name: '💼 Your New Balance', value: `$${userEconomy.wallet.toLocaleString()}`, inline: true },
            { name: '📤 Recipient', value: targetUser.username, inline: true }
        );
    
    await message.reply({ embeds: [embed] });
    
    // Notify recipient
    try {
        const recipientEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('💰 Payment Received!')
            .setDescription(`${message.author.username} sent you $${amount.toLocaleString()} in ${message.guild.name}!`)
            .addFields(
                { name: '💼 Your New Balance', value: `$${targetEconomy.wallet.toLocaleString()}`, inline: true }
            );
        
        await targetUser.send({ embeds: [recipientEmbed] });
    } catch (error) {
        // User has DMs disabled
    }
}

async function horseRace(message, args, client, db) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    if (args.length === 0) {
        return message.reply('❌ Usage: `^economy race <amount>`\nExample: `^economy race 500`\n\nBet on horse racing! Win 3x your bet!');
    }
    
    const betAmount = parseInt(args[0]);
    if (isNaN(betAmount) || betAmount <= 0) {
        return message.reply('❌ Please specify a valid bet amount.');
    }
    
    if (betAmount < 100) {
        return message.reply('❌ Minimum bet is $100.');
    }
    
    const economy = await db.getUserEconomy(userId, guildId);
    
    if (economy.wallet < betAmount) {
        return message.reply(`❌ You don't have enough money! You have $${economy.wallet.toLocaleString()}.`);
    }
    
    // Horse names
    const horses = ['⚡ Lightning', '🔥 Blaze', '💨 Thunder', '🌟 Star', '👑 Champion'];
    
    // Create race embed
    const raceEmbed = new EmbedBuilder()
        .setColor('#ffa500')
        .setTitle('🐎 Horse Race Starting!')
        .setDescription(`Your bet: $${betAmount.toLocaleString()}\n\nHorses:\n${horses.map((h, i) => `${i + 1}. ${h}`).join('\n')}\n\n🏁 Race in progress...`)
        .setFooter({ text: 'Good luck!' });
    
    const raceMessage = await message.reply({ embeds: [raceEmbed] });
    
    // Simulate race (2 seconds)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Random winner
    const winnerIndex = Math.floor(Math.random() * horses.length);
    const yourHorse = Math.floor(Math.random() * horses.length);
    const won = yourHorse === winnerIndex;
    
    if (won) {
        const winAmount = betAmount * 3;
        economy.wallet += winAmount - betAmount; // Net profit is 2x bet
        
        await db.updateUserEconomy(userId, guildId, economy);
        await db.addTransaction(userId, guildId, 'race_win', winAmount - betAmount, { bet: betAmount });
        
        const winEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🏆 You Won!')
            .setDescription(`**Winner:** ${horses[winnerIndex]}\n**Your Horse:** ${horses[yourHorse]}\n\n🎉 Congratulations!`)
            .addFields(
                { name: '💰 Bet Amount', value: `$${betAmount.toLocaleString()}`, inline: true },
                { name: '🏆 Winnings', value: `$${winAmount.toLocaleString()}`, inline: true },
                { name: '📈 Profit', value: `$${(winAmount - betAmount).toLocaleString()}`, inline: true },
                { name: '💼 New Balance', value: `$${economy.wallet.toLocaleString()}`, inline: false }
            );
        
        await raceMessage.edit({ embeds: [winEmbed] });
    } else {
        economy.wallet -= betAmount;
        
        await db.updateUserEconomy(userId, guildId, economy);
        await db.addTransaction(userId, guildId, 'race_loss', -betAmount);
        
        const loseEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('😔 You Lost!')
            .setDescription(`**Winner:** ${horses[winnerIndex]}\n**Your Horse:** ${horses[yourHorse]}\n\nBetter luck next time!`)
            .addFields(
                { name: '💸 Lost', value: `$${betAmount.toLocaleString()}`, inline: true },
                { name: '💼 New Balance', value: `$${economy.wallet.toLocaleString()}`, inline: true }
            );
        
        await raceMessage.edit({ embeds: [loseEmbed] });
    }
}

async function footballBet(message, args, client, db) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    if (args.length < 2) {
        return message.reply('❌ Usage: `^economy football <amount> <red/blue>`\nExample: `^economy football 1000 red`\n\nBet on team matches! Win 2x your bet!');
    }
    
    const betAmount = parseInt(args[0]);
    const team = args[1].toLowerCase();
    
    if (isNaN(betAmount) || betAmount <= 0) {
        return message.reply('❌ Please specify a valid bet amount.');
    }
    
    if (betAmount < 100) {
        return message.reply('❌ Minimum bet is $100.');
    }
    
    if (team !== 'red' && team !== 'blue') {
        return message.reply('❌ Please choose either `red` or `blue` team.');
    }
    
    const economy = await db.getUserEconomy(userId, guildId);
    
    if (economy.wallet < betAmount) {
        return message.reply(`❌ You don't have enough money! You have $${economy.wallet.toLocaleString()}.`);
    }
    
    // Create match embed
    const matchEmbed = new EmbedBuilder()
        .setColor('#ffa500')
        .setTitle('⚽ Football Match Starting!')
        .setDescription(`Your bet: $${betAmount.toLocaleString()} on **${team.toUpperCase()} TEAM**\n\n🔴 **Red Team** vs 🔵 **Blue Team**\n\n⚽ Match in progress...`)
        .setFooter({ text: 'Good luck!' });
    
    const matchMessage = await message.reply({ embeds: [matchEmbed] });
    
    // Simulate match (3 seconds)
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Random winner (50/50)
    const winner = Math.random() < 0.5 ? 'red' : 'blue';
    const won = team === winner;
    
    // Random scores
    const redScore = Math.floor(Math.random() * 4) + (winner === 'red' ? 1 : 0);
    const blueScore = Math.floor(Math.random() * 4) + (winner === 'blue' ? 1 : 0);
    
    // Make sure winner has higher score
    const finalRedScore = winner === 'red' ? Math.max(redScore, blueScore + 1) : redScore;
    const finalBlueScore = winner === 'blue' ? Math.max(blueScore, redScore + 1) : blueScore;
    
    if (won) {
        const winAmount = betAmount * 2;
        economy.wallet += winAmount - betAmount; // Net profit is 1x bet
        
        await db.updateUserEconomy(userId, guildId, economy);
        await db.addTransaction(userId, guildId, 'football_win', winAmount - betAmount, { bet: betAmount, team: team });
        
        const winEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🏆 Your Team Won!')
            .setDescription(`**Final Score:**\n🔴 Red Team: ${finalRedScore}\n🔵 Blue Team: ${finalBlueScore}\n\n🎉 ${team.toUpperCase()} TEAM WINS!`)
            .addFields(
                { name: '💰 Bet Amount', value: `$${betAmount.toLocaleString()}`, inline: true },
                { name: '🏆 Winnings', value: `$${winAmount.toLocaleString()}`, inline: true },
                { name: '📈 Profit', value: `$${(winAmount - betAmount).toLocaleString()}`, inline: true },
                { name: '💼 New Balance', value: `$${economy.wallet.toLocaleString()}`, inline: false }
            );
        
        await matchMessage.edit({ embeds: [winEmbed] });
    } else {
        economy.wallet -= betAmount;
        
        await db.updateUserEconomy(userId, guildId, economy);
        await db.addTransaction(userId, guildId, 'football_loss', -betAmount, { team: team });
        
        const loseEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('😔 Your Team Lost!')
            .setDescription(`**Final Score:**\n🔴 Red Team: ${finalRedScore}\n🔵 Blue Team: ${finalBlueScore}\n\n${winner.toUpperCase()} TEAM WINS!\n\nBetter luck next time!`)
            .addFields(
                { name: '💸 Lost', value: `$${betAmount.toLocaleString()}`, inline: true },
                { name: '💼 New Balance', value: `$${economy.wallet.toLocaleString()}`, inline: true }
            );
        
        await matchMessage.edit({ embeds: [loseEmbed] });
    }
}

async function gambleMoney(message, args, client, db) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    if (args.length === 0) {
        return message.reply('❌ Usage: `^economy gamble <amount>`\nExample: `^economy gamble 1000`\n\nTest your luck! Win 2x your bet or lose it all!');
    }
    
    const betAmount = parseInt(args[0]);
    if (isNaN(betAmount) || betAmount <= 0) {
        return message.reply('❌ Please specify a valid bet amount.');
    }
    
    if (betAmount < 50) {
        return message.reply('❌ Minimum bet is $50.');
    }
    
    const economy = await db.getUserEconomy(userId, guildId);
    
    if (economy.wallet < betAmount) {
        return message.reply(`❌ You don't have enough money! You have $${economy.wallet.toLocaleString()}.`);
    }
    
    // Create gamble embed
    const gambleEmbed = new EmbedBuilder()
        .setColor('#ffa500')
        .setTitle('🎰 Rolling the dice...')
        .setDescription(`Bet: $${betAmount.toLocaleString()}\n\n🎲 Testing your luck...`)
        .setFooter({ text: '50/50 chance!' });
    
    const gambleMessage = await message.reply({ embeds: [gambleEmbed] });
    
    // Wait for suspense (2 seconds)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 50% chance to win
    const won = Math.random() < 0.5;
    
    if (won) {
        const winAmount = betAmount * 2;
        economy.wallet += winAmount - betAmount; // Net profit is 1x bet
        
        await db.updateUserEconomy(userId, guildId, economy);
        await db.addTransaction(userId, guildId, 'gamble_win', winAmount - betAmount, { bet: betAmount });
        
        const winEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🎉 You Won!')
            .setDescription('Lady Luck is on your side!')
            .addFields(
                { name: '💰 Bet Amount', value: `$${betAmount.toLocaleString()}`, inline: true },
                { name: '🏆 Winnings', value: `$${winAmount.toLocaleString()}`, inline: true },
                { name: '📈 Profit', value: `$${(winAmount - betAmount).toLocaleString()}`, inline: true },
                { name: '💼 New Balance', value: `$${economy.wallet.toLocaleString()}`, inline: false }
            );
        
        await gambleMessage.edit({ embeds: [winEmbed] });
    } else {
        economy.wallet -= betAmount;
        
        await db.updateUserEconomy(userId, guildId, economy);
        await db.addTransaction(userId, guildId, 'gamble_loss', -betAmount);
        
        const loseEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('😔 You Lost!')
            .setDescription('Better luck next time!')
            .addFields(
                { name: '💸 Lost', value: `$${betAmount.toLocaleString()}`, inline: true },
                { name: '💼 New Balance', value: `$${economy.wallet.toLocaleString()}`, inline: true }
            )
            .setFooter({ text: 'Don\'t gamble more than you can afford to lose!' });
        
        await gambleMessage.edit({ embeds: [loseEmbed] });
    }
}

// ========== EXPORTS FOR BUTTON HANDLERS ==========
module.exports.workJob = workJob;
module.exports.showProperties = showProperties;
module.exports.lotteryInfo = lotteryInfo;
module.exports.bankManagement = bankManagement;
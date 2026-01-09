const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionsBitField } = require('discord.js');

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
    { id: 'intern', name: 'Intern', salary: 5000, level: 1, xp_required: 0 },
    { id: 'associate', name: 'Associate', salary: 25000, level: 3, xp_required: 300 },
    { id: 'specialist', name: 'Specialist', salary: 75000, level: 5, xp_required: 1000 },
    { id: 'coordinator', name: 'Coordinator', salary: 150000, level: 7, xp_required: 2100 },
    { id: 'manager', name: 'Manager', salary: 300000, level: 9, xp_required: 3600 },
    { id: 'director', name: 'Director', salary: 500000, level: 11, xp_required: 5500 },
    { id: 'vp', name: 'Vice President', salary: 750000, level: 13, xp_required: 7800 },
    { id: 'senior_vp', name: 'Senior Vice President', salary: 1000000, level: 15, xp_required: 10500 },
    { id: 'president', name: 'President', salary: 1250000, level: 17, xp_required: 13500 },
    { id: 'cfo', name: 'Chief Financial Officer', salary: 1400000, level: 19, xp_required: 16500 },
    { id: 'ceo', name: 'Chief Executive Officer (CEO)', salary: 1500000, level: 21, xp_required: 20000 }
];

const LOTTERY_TICKET_PRICE = 1000;
const AUTO_TICKET_PRICE = 2000; // price per auto-applied ticket per round
const LOTTERY_JACKPOT_BASE = 100000; // initial base for first round
const ROLLOVER_INCREMENT = 10000; // added each rollover round (1x, 2x, 3x ...)
const MAX_LOTTERY_TICKETS = 5;
const LOTTERY_TIMER_MS = 10 * 60 * 1000; // 10 minutes from first ticket purchase

// Banking system constants
const BANK_INTEREST_RATE = 0.01; // 1% daily interest on bank balance
const FD_INTEREST_RATE = 0.03; // 3% daily interest on fixed deposits (higher rate)
const LOAN_INTEREST_RATE = 0.05; // 5% monthly interest on loans
const LOAN_MAX_PERCENT = 0.8; // can borrow up to 80% of property value
const LOAN_DEFAULT_DAYS = 7; // auto-default after 7 days
const LOAN_GARNISH_RATE = 0.2; // 20% of net salary auto-applied to loans
const TRANSACTION_FEE_THRESHOLD = 50000; // fees apply for transactions over this amount
const TRANSACTION_FEE_PERCENT = 0.02; // 2% fee on large transactions
const TAX_RATES = {
    job_salary: 0.10, // 10% tax on job income
    property_income: 0.08, // 8% tax on property/business income
    gambling: 0.15, // 15% tax on gambling winnings
    trading: 0.05, // 5% tax on trading (pay/steal)
    lottery: 0.20 // 20% tax on lottery winnings
};
const TAX_GIVEAWAY_THRESHOLD = 500000; // start giveaway when tax pool reaches this
const TAX_GIVEAWAY_INCREMENT = 500000; // increase threshold by this each time (500k -> 1M -> 1.5M)

// In-memory timers to auto-draw lottery after the first ticket
const lotteryTimers = new Map(); // guildId -> setTimeout handle
const lotteryStartTimes = new Map(); // guildId -> timestamp when timer started
const accumulatedJackpots = new Map(); // legacy, no longer used in calc (kept for compatibility)
const lastLotteryResults = new Map(); // guildId -> { timestamp, winningNumber, pot, winnerUserId|null, rolledOver:boolean }
const carryPots = new Map(); // guildId -> carried pot from previous round
const rolloverCounts = new Map(); // guildId -> consecutive rollovers since last win

async function computeCurrentPot(guildId, ticketsCount, db) {
    // Load from memory first, fallback to database if not in memory
    let carry = carryPots.get(guildId);
    let roll = rolloverCounts.get(guildId);
    
    if (carry === undefined && db) {
        ensureAutoLotteryMethods(db);
        const saved = await db.getLotteryJackpot(guildId);
        carry = saved.carryPot || 0;
        roll = saved.rolloverCount || 0;
        // Sync to memory
        if (carry > 0) carryPots.set(guildId, carry);
        if (roll > 0) rolloverCounts.set(guildId, roll);
    }
    
    carry = carry || 0;
    roll = roll || 0;
    
    if (carry > 0) {
        // Example: Round 2: carry + 1*10k + tickets; Round 3: carry + 2*10k + tickets
        return carry + (Math.max(roll, 1) * ROLLOVER_INCREMENT) + (ticketsCount * LOTTERY_TICKET_PRICE);
    } else {
        // First round: base + tickets
        return LOTTERY_JACKPOT_BASE + (ticketsCount * LOTTERY_TICKET_PRICE);
    }
}

function ensureAutoLotteryMethods(db) {
    if (!db) return;
    if (!db.data) db.data = {};
    if (!db.data.autoLottery) db.data.autoLottery = {};

    if (typeof db.setAutoTicket !== 'function') {
        db.setAutoTicket = async function(userId, guildId, number, enabled = true) {
            const key = `auto_${userId}_${guildId}`;
            db.data.autoLottery[key] = {
                user_id: userId,
                guild_id: guildId,
                number: number,
                enabled: !!enabled,
                created_at: Date.now()
            };
            if (typeof db.save === 'function') db.save();
            return db.data.autoLottery[key];
        };
    }

    if (typeof db.getAutoTicket !== 'function') {
        db.getAutoTicket = async function(userId, guildId) {
            const key = `auto_${userId}_${guildId}`;
            return db.data.autoLottery[key] || null;
        };
    }

    if (typeof db.removeAutoTicket !== 'function') {
        db.removeAutoTicket = async function(userId, guildId) {
            const key = `auto_${userId}_${guildId}`;
            if (db.data.autoLottery[key]) {
                delete db.data.autoLottery[key];
                if (typeof db.save === 'function') db.save();
                return true;
            }
            return false;
        };
    }

    if (typeof db.getAutoTicketsForGuild !== 'function') {
        db.getAutoTicketsForGuild = async function(guildId) {
            return Object.values(db.data.autoLottery).filter(s => s.guild_id === guildId && s.enabled);
        };
    }

    // Timer persistence methods
    if (!db.data.lotteryTimers) db.data.lotteryTimers = {};

    if (typeof db.setLotteryTimerStart !== 'function') {
        db.setLotteryTimerStart = async function(guildId, startTime) {
            if (!db.data.lotteryTimers) db.data.lotteryTimers = {};
            db.data.lotteryTimers[guildId] = { startTime, updatedAt: Date.now() };
            if (typeof db.save === 'function') db.save();
        };
    }

    if (typeof db.getLotteryTimerStart !== 'function') {
        db.getLotteryTimerStart = async function(guildId) {
            if (!db.data.lotteryTimers) return null;
            return db.data.lotteryTimers[guildId] || null;
        };
    }

    if (typeof db.clearLotteryTimerStart !== 'function') {
        db.clearLotteryTimerStart = async function(guildId) {
            if (db.data.lotteryTimers && db.data.lotteryTimers[guildId]) {
                delete db.data.lotteryTimers[guildId];
                if (typeof db.save === 'function') db.save();
            }
        };
    }

    // Jackpot persistence methods
    if (!db.data.lotteryJackpots) db.data.lotteryJackpots = {};

    if (typeof db.setLotteryJackpot !== 'function') {
        db.setLotteryJackpot = async function(guildId, carryPot, rolloverCount) {
            if (!db.data.lotteryJackpots) db.data.lotteryJackpots = {};
            db.data.lotteryJackpots[guildId] = { 
                carryPot: carryPot || 0, 
                rolloverCount: rolloverCount || 0,
                updatedAt: Date.now() 
            };
            if (typeof db.save === 'function') db.save();
        };
    }

    if (typeof db.getLotteryJackpot !== 'function') {
        db.getLotteryJackpot = async function(guildId) {
            if (!db.data.lotteryJackpots || !db.data.lotteryJackpots[guildId]) {
                return { carryPot: 0, rolloverCount: 0 };
            }
            return db.data.lotteryJackpots[guildId];
        };
    }

    if (typeof db.clearLotteryJackpot !== 'function') {
        db.clearLotteryJackpot = async function(guildId) {
            if (db.data.lotteryJackpots && db.data.lotteryJackpots[guildId]) {
                delete db.data.lotteryJackpots[guildId];
                if (typeof db.save === 'function') db.save();
            }
        };
    }
}

async function applyAutoSubscriptions({ guildId, client, db, guildName }) {
    ensureAutoLotteryMethods(db);
    // Fetch subscriptions and attempt to buy tickets for new round
    const subs = await db.getAutoTicketsForGuild(guildId);
    if (!subs || subs.length === 0) return false;

    // Ensure we start from a clean round (should be right after draw)
    const existing = await db.getActiveLotteryTickets(guildId);
    const taken = new Set(existing.map(t => t.ticket_number));

    let created = 0;
    // Sort deterministically by user_id to avoid random conflicts
    for (const sub of subs.sort((a, b) => (a.user_id > b.user_id ? 1 : -1))) {
        const number = sub.number;
        if (taken.has(number)) {
            // Number already taken by another subscription; skip
            continue;
        }
        // Charge user and create ticket if affordable
        const economy = await db.getUserEconomy(sub.user_id, guildId);
        if (!economy || economy.wallet < AUTO_TICKET_PRICE) {
            // Insufficient funds: record a failed transaction and skip
            await db.addTransaction(sub.user_id, guildId, 'autoticket_failed_insufficient_funds', 0, { ticket_number: number });
            continue;
        }
        economy.wallet -= AUTO_TICKET_PRICE;
        await db.updateUserEconomy(sub.user_id, guildId, economy);
        try {
            await db.buyLotteryTicket(sub.user_id, guildId, number, AUTO_TICKET_PRICE);
            await db.addTransaction(sub.user_id, guildId, 'autoticket', -AUTO_TICKET_PRICE, { ticket_number: number });
            taken.add(number);
            created++;
        } catch (err) {
            // Refund on DB failure
            const econ2 = await db.getUserEconomy(sub.user_id, guildId);
            econ2.wallet += AUTO_TICKET_PRICE;
            await db.updateUserEconomy(sub.user_id, guildId, econ2);
        }
    }

    // If we created any tickets and no timer, schedule next draw
    if (created > 0 && !lotteryTimers.has(guildId)) {
        scheduleLotteryTimer({ guildId, client, db, guildName });
    }
    return created > 0;
}

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
            case 'daily':
            case 'checkin':
                await dailyCheckIn(message, client, db);
                break;
            case 'streak':
                await showDailyStatus(message, client, db);
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
            case 'lotteryresult':
                await lotteryResult(message, client, db);
                break;
            case 'forcelottery':
                await forceLottery(message, client, db);
                break;
            case 'autoticket':
                await setAutoTicketCommand(message, args.slice(1), client, db);
                break;
            case 'cancelautoticket':
                await cancelAutoTicketCommand(message, client, db);
                break;
            case 'autoticketstatus':
                await autoTicketStatusCommand(message, client, db);
                break;
            case 'buyticket':
                await buyLotteryTicket(message, args.slice(1), client, db);
                break;
            case 'bank':
                await bankManagement(message, args.slice(1), client, db);
                break;
            case 'fd':
                await fixedDepositCommand(message, args.slice(1), client, db);
                break;
            case 'loan':
                await loanCommand(message, args.slice(1), client, db);
                break;
            case 'taxgiveaway':
                await taxGiveawayCommand(message, args.slice(1), client, db);
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
function getPropertyArrayKey(type) {
    switch (type) {
        case 'house': return 'houses';
        case 'shop': return 'shops';
        case 'land': return 'lands';
        case 'business': return 'businesses';
        default: return null;
    }
}

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
    
    // Check for loan default before proceeding
    const defaultInfo = await handleLoanDefault(userId, guildId, db);
    
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
    
    // Calculate salary with random bonus (up to 1,500,000)
    const baseSalary = job.salary;
    const maxBonus = Math.min(1500000, baseSalary);
    const bonus = Math.floor(Math.random() * maxBonus); // Random from 0 to 1,500,000 (or base if lower)
    const totalSalary = baseSalary + bonus;
    
    // Deduct income tax
    const incomeTax = await deductIncomeTax(userId, guildId, totalSalary, 'job_salary', db);
    const salaryAfterTax = totalSalary - incomeTax;
    
    const economy = await db.getUserEconomy(userId, guildId);
    
    // Auto-garnish a portion of salary to repay loans
    let garnishPaid = 0;
    let loanRemaining = null;
    let loanDaysLeft = null;
    if (db.data && db.data.loans) {
        const loanKey = `loan_${userId}_${guildId}`;
        const loan = db.data.loans[loanKey];
        if (loan && loan.amount > 0) {
            const monthsElapsed = Math.floor((Date.now() - loan.taken_at) / (30 * 24 * 60 * 60 * 1000));
            const totalInterest = Math.floor(loan.amount * LOAN_INTEREST_RATE * monthsElapsed);
            const totalDue = loan.amount + totalInterest;
            const remaining = Math.max(0, totalDue - loan.repaid);
            loanDaysLeft = Math.max(0, LOAN_DEFAULT_DAYS - Math.floor((Date.now() - loan.taken_at) / (24 * 60 * 60 * 1000)));
            const garnishBase = Math.floor(salaryAfterTax * LOAN_GARNISH_RATE);
            garnishPaid = Math.min(remaining, garnishBase);
            
            if (garnishPaid > 0) {
                loan.repaid += garnishPaid;
                if (loan.repaid >= totalDue) {
                    delete db.data.loans[loanKey];
                }
                if (typeof db.save === 'function') db.save();
                loanRemaining = Math.max(0, totalDue - loan.repaid);
            }
        }
    }
    
    const takeHome = salaryAfterTax - garnishPaid;
    economy.wallet += takeHome;
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
        bonus: bonus,
        tax: incomeTax,
        loan_payment: garnishPaid
    });

    if (garnishPaid > 0) {
        await db.addTransaction(userId, guildId, 'loan_payment_garnish', -garnishPaid, {
            source: 'work',
            loan_remaining: loanRemaining,
            days_until_default: loanDaysLeft
        });
    }
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('💼 Work Completed!')
        .setDescription(`Great work, ${message.author.username}! You've earned your salary.`)
        .addFields(
            { name: 'Job', value: currentJob.name, inline: true },
            { name: 'Base Salary', value: `$${baseSalary.toLocaleString()}`, inline: true },
            { name: 'Bonus', value: `$${bonus.toLocaleString()}`, inline: true },
            { name: 'Gross Income', value: `$${totalSalary.toLocaleString()}`, inline: true },
            { name: '📊 Income Tax (10%)', value: `-$${incomeTax.toLocaleString()}`, inline: true },
            { name: '💳 Loan Payment', value: `-$${garnishPaid.toLocaleString()}`, inline: true },
            { name: 'Take-Home', value: `$${takeHome.toLocaleString()}`, inline: true },
            { name: 'XP Gained', value: '10 XP', inline: true },
            { name: 'Next Work', value: '8 hours', inline: true }
        )
        .setFooter({ text: 'Keep working to level up your job!' });
    
    if (garnishPaid > 0 && loanRemaining !== null) {
        embed.addFields({ name: 'Loan Remaining', value: `$${loanRemaining.toLocaleString()}`, inline: true });
    }

    if (loanDaysLeft !== null) {
        embed.addFields({ name: 'Days Until Default', value: `${loanDaysLeft} day(s)`, inline: true });
    }
    
    if (defaultInfo) {
        embed.addFields({ name: '⚠️ Loan Default', value: `Loan defaulted after ${LOAN_DEFAULT_DAYS} days. Properties were repossessed.`, inline: false });
    }
    
    await message.reply({ embeds: [embed] });
}

async function showJobs(message, client, db) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    const userJob = await db.getUserJob(userId, guildId);
    const userEconomy = await db.getUserEconomy(userId, guildId);
    const playerLevel = userEconomy?.level || 1;
    
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('💼 Available Jobs')
        .setDescription('Apply for a job using `^economy apply <job_id>`')
        .setFooter({ text: `Your current job: ${userJob.job_type === 'unemployed' ? 'Unemployed' : JOBS.find(j => j.id === userJob.job_type)?.name || 'Unknown'} | Player Level: ${playerLevel}` });
    
    JOBS.forEach(job => {
        const canApply = playerLevel >= job.level;
        
        embed.addFields({
            name: `${job.name} ${userJob.job_type === job.id ? '✅' : ''}`,
            value: `**ID:** \`${job.id}\`\n**Required Player Level:** ${job.level}\n**Salary:** $${job.salary}/day\n**XP Required:** ${job.xp_required}\n**Status:** ${canApply ? '✅ Available' : '🔒 Need Player Level ' + job.level}`,
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
    const userEconomy = await db.getUserEconomy(userId, guildId);
    const playerLevel = userEconomy?.level || 1;
    
    // Check requirements
    if (playerLevel < job.level) {
        return message.reply(`❌ You need to be at player level **${job.level}** to apply for **${job.name}**. Your level: **${playerLevel}**.`);
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

// ========== DAILY CHECK-IN ==========
async function dailyCheckIn(message, client, db) {
    const userId = message.author.id;
    const guildId = message.guild.id;

    const config = await db.getGuildConfig(guildId);
    const economy = await db.getUserEconomy(userId, guildId);

    const now = Date.now();
    const lastDaily = economy.last_daily || 0;
    const cooldown = 24 * 60 * 60 * 1000; // 24h

    if (now - lastDaily < cooldown) {
        const remaining = cooldown - (now - lastDaily);
        const hrs = Math.floor(remaining / (1000 * 60 * 60));
        const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        return message.reply(`⏳ You already checked in today. Come back in **${hrs}h ${mins}m**.`);
    }

    // Determine streak
    const withinStreakWindow = now - lastDaily <= cooldown * 2; // 48h gap keeps streak
    const newStreak = withinStreakWindow ? (economy.daily_streak || 0) + 1 : 1;

    const baseCoins = config.daily_amount || 50;
    const coinBonus = Math.floor(baseCoins * Math.min(newStreak, 30) * 0.05); // up to +150% at 30 streak
    const coinsAwarded = baseCoins + coinBonus;

    const xpAwarded = 50 + Math.floor(Math.random() * 51); // 50-100 XP
    const pointsAwarded = 1 + Math.floor(newStreak / 7); // +1 every week streak

    // Update economy
    economy.wallet += coinsAwarded;
    economy.xp = (economy.xp || 0) + xpAwarded;
    economy.reputation = (economy.reputation || 0) + pointsAwarded;
    economy.daily_streak = newStreak;
    economy.last_daily = now;
    economy.updated_at = now;
    await db.updateUserEconomy(userId, guildId, economy);

    // Log transaction
    await db.addTransaction(userId, guildId, 'daily', coinsAwarded, { streak: newStreak, xp: xpAwarded, points: pointsAwarded });

    const embed = new EmbedBuilder()
        .setColor('#00c853')
        .setTitle('✅ Daily Check-In')
        .setDescription(`Thanks for checking in, ${message.author.username}!`)
        .addFields(
            { name: '🪙 Coins', value: `+${coinsAwarded.toLocaleString()}`, inline: true },
            { name: '📈 XP', value: `+${xpAwarded.toLocaleString()}`, inline: true },
            { name: '⭐ Points', value: `+${pointsAwarded}`, inline: true },
            { name: '🔥 Streak', value: `${newStreak} day${newStreak === 1 ? '' : 's'}`, inline: true },
            { name: 'Wallet', value: `$${economy.wallet.toLocaleString()}`, inline: true },
            { name: 'Total XP', value: `${economy.xp.toLocaleString()}`, inline: true }
        )
        .setFooter({ text: 'Check in every day to grow your streak!' })
        .setTimestamp();

    await message.reply({ embeds: [embed] });
}

// View-only daily status (does not claim)
async function showDailyStatus(message, client, db) {
    const userId = message.author.id;
    const guildId = message.guild.id;

    const config = await db.getGuildConfig(guildId);
    const economy = await db.getUserEconomy(userId, guildId);

    const now = Date.now();
    const cooldown = 24 * 60 * 60 * 1000; // 24h
    const lastDaily = economy.last_daily || 0;
    const nextAvailableMs = lastDaily ? (lastDaily + cooldown) : 0;
    const nextAvailableSec = nextAvailableMs ? Math.floor(nextAvailableMs / 1000) : null;
    const availableNow = !lastDaily || now >= nextAvailableMs;

    const streak = economy.daily_streak || 0;
    const baseCoins = config.daily_amount || 50;
    const coinBonus = Math.floor(baseCoins * Math.min(streak + 1, 30) * 0.05); // preview next claim bonus
    const nextCoins = baseCoins + coinBonus;

    const embed = new EmbedBuilder()
        .setColor('#00c853')
        .setTitle('📅 Daily Check-In Status')
        .setDescription(`Here\'s your current daily streak and next reward estimate.`)
        .addFields(
            { name: '🔥 Streak', value: `${streak} day${streak === 1 ? '' : 's'}`, inline: true },
            { name: '🪙 Next Reward (est.)', value: `~${nextCoins.toLocaleString()} coins`, inline: true },
            availableNow
                ? { name: '⏳ Next Check-In', value: 'Available now', inline: true }
                : { name: '⏳ Next Check-In', value: `<t:${nextAvailableSec}:R>`, inline: true },
            lastDaily
                ? { name: '✅ Last Check-In', value: `<t:${Math.floor(lastDaily / 1000)}:F>`, inline: true }
                : { name: '✅ Last Check-In', value: 'No record yet', inline: true },
            { name: '💵 Wallet', value: `$${(economy.wallet || 0).toLocaleString()}`, inline: true }
        )
        .setFooter({ text: 'Use ^economy daily or ^economy checkin to claim (UTC)' })
        .setTimestamp();

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
    const typeKey = getPropertyArrayKey(type);
    if (!typeKey) {
        return message.reply('❌ Invalid property type.');
    }
    if (!Array.isArray(userProperties[typeKey])) userProperties[typeKey] = [];
    userProperties[typeKey].push({
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
    const typeKey = getPropertyArrayKey(type);
    if (!typeKey) {
        return message.reply('❌ Invalid property type. Use: house, shop, land, or business');
    }
    const propertyArray = userProperties[typeKey] || [];
    
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
    
    // Calculate appreciation based on holding time
    // Properties appreciate 0.1% per day held
    const daysBought = Math.max(1, Math.floor((Date.now() - property.purchased_at) / (24 * 60 * 60 * 1000)));
    const appreciationRate = Math.min(0.5, 0.001 * daysBought); // Cap at 50% max appreciation
    const sellPrice = Math.floor(propertyConfig.price * (1 + appreciationRate));
    const appreciationGain = sellPrice - propertyConfig.price;
    
    // Remove property from array
    propertyArray.splice(index, 1);
    userProperties[typeKey] = propertyArray;
    
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
            { name: 'Days Held', value: `${daysBought} days`, inline: true },
            { name: 'Appreciation', value: `+${(appreciationRate * 100).toFixed(2)}% ($${appreciationGain.toLocaleString()})`, inline: true },
            { name: 'Sell Price', value: `$${sellPrice.toLocaleString()}`, inline: true },
            { name: 'New Balance', value: `$${economy.wallet.toLocaleString()}`, inline: false }
        );
    
    await message.reply({ embeds: [embed] });
}

async function lotteryInfo(message, client, db) {
    const guildId = message.guild.id;
    
    // Ensure DB methods exist
    ensureAutoLotteryMethods(db);
    
    // Auto-resume orphaned timer if needed
    await resumeOrphanedTimers(guildId, client, db, message.guild.name);
    
    // Get active tickets
    const activeTickets = await db.getActiveLotteryTickets(guildId);
    const totalPot = await computeCurrentPot(guildId, activeTickets.length, db);
    const uniquePlayers = new Set(activeTickets.map(t => t.user_id)).size;
    
    const embed = new EmbedBuilder()
        .setColor('#ff00ff')
        .setTitle('🎫 Lottery Information')
        .setDescription('Test your luck and win big!')
        .addFields(
            { name: '🎟️ Ticket Price', value: `$${LOTTERY_TICKET_PRICE.toLocaleString()}`, inline: true },
            { name: '💰 Current Jackpot', value: `$${totalPot.toLocaleString()}`, inline: true },
            { name: '🎯 Active Tickets', value: `${activeTickets.length}`, inline: true },
            { name: '👥 Unique Players', value: `${uniquePlayers}`, inline: true },
            { name: '📝 How to Play', value: 'Buy tickets with `^economy buyticket <number>` (1-100)\nDrawing starts when the **first ticket** is bought and runs **10 minutes** later. More tickets can be bought during the 10-minute window, but the timer does not reset.\nA random number (1-100) is drawn; matching ticket(s) can win.', inline: false },
            { name: '🎲 Your Tickets', value: 'Use `^economy profile` to see your tickets', inline: false }
        );

    // Show time remaining if timer is active
    if (lotteryTimers.has(guildId) && lotteryStartTimes.has(guildId)) {
        const startTime = lotteryStartTimes.get(guildId);
        const endTime = startTime + LOTTERY_TIMER_MS;
        const remaining = endTime - Date.now();
        if (remaining > 0) {
            const minutes = Math.floor(remaining / (60 * 1000));
            const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
            embed.addFields({ name: '⏰ Draw In', value: `${minutes}m ${seconds}s`, inline: true });
        } else {
            embed.addFields({ name: '⏰ Draw In', value: 'Drawing soon...', inline: true });
        }
    } else if (activeTickets.length > 0) {
        embed.addFields({ name: '⏰ Draw In', value: 'Timer paused - buy a ticket to restart or use ^economy forcelottery', inline: false });
    } else {
        embed.addFields({ name: '⏰ Draw In', value: 'Timer will start on first ticket', inline: true });
    }

    embed.setFooter({ text: 'Good luck!' });
    
    await message.channel.send({ embeds: [embed] });
}

async function lotteryResult(message, client, db) {
    const guildId = message.guild.id;
    const last = lastLotteryResults.get(guildId) || null;

    // Compute current jackpot (includes any rollover + current tickets)
    const activeTickets = await db.getActiveLotteryTickets(guildId);
    const currentPot = await computeCurrentPot(guildId, activeTickets.length, db);

    const embed = new EmbedBuilder()
        .setColor('#8b5cf6')
        .setTitle('🎰 Lottery Result')
        .setFooter({ text: 'Use ^economy lottery to see details and countdown' });

    if (!last) {
        embed.setDescription('No recent lottery draw found.');
        embed.addFields(
            { name: '💰 Current Prize Pool', value: `$${currentPot.toLocaleString()}`, inline: true },
            { name: '🎟️ Active Tickets', value: `${activeTickets.length}`, inline: true }
        );
        return message.reply({ embeds: [embed] });
    }

    const when = new Date(last.timestamp).toUTCString();
    const winnerField = last.winnerUserId ? `<@${last.winnerUserId}>` : 'No winner';

    embed.addFields(
        { name: '🕒 Last Draw (UTC)', value: when, inline: false },
        { name: '🎯 Winning Number', value: `#${last.winningNumber}`, inline: true },
        { name: '💰 Last Pot', value: `$${last.pot.toLocaleString()}`, inline: true },
        { name: '🏆 Winner', value: winnerField, inline: true }
    );

    if (!last.winnerUserId) {
        // No winner last time: show rollover info and current pool
        const carry = carryPots.get(guildId) || last.pot || 0;
        embed.addFields(
            { name: '♻️ Rolled Over', value: `$${carry.toLocaleString()}`, inline: true },
            { name: '💰 Current Prize Pool', value: `$${currentPot.toLocaleString()}`, inline: true },
            { name: '🎟️ Active Tickets', value: `${activeTickets.length}`, inline: true }
        );
    } else {
        embed.addFields(
            { name: '💰 Current Prize Pool', value: `$${currentPot.toLocaleString()}`, inline: true },
            { name: '🎟️ Active Tickets', value: `${activeTickets.length}`, inline: true }
        );
    }

    return message.channel.send({ embeds: [embed] });
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

    // Attempt to buy ticket
    let purchaseSucceeded = false;
    try {
        await db.buyLotteryTicket(userId, guildId, ticketNumber, LOTTERY_TICKET_PRICE);
        purchaseSucceeded = true;
    } catch (err) {
        // Roll back wallet if DB operation failed
        economy.wallet += LOTTERY_TICKET_PRICE;
        await db.updateUserEconomy(userId, guildId, economy);
        return message.reply('❌ Could not purchase the ticket due to a database error. You were not charged.');
    }

    // Re-fetch to validate count actually increased
    const updatedTickets = await db.getActiveLotteryTickets(guildId);
    const updatedUserTickets = updatedTickets.filter(t => t.user_id === userId);
    const countIncreased = updatedUserTickets.length > userTickets.length;

    if (!countIncreased) {
        // Refund because the ticket did not persist
        economy.wallet += LOTTERY_TICKET_PRICE;
        await db.updateUserEconomy(userId, guildId, economy);
        await db.addTransaction(userId, guildId, 'lottery_refund', LOTTERY_TICKET_PRICE, { ticket_number: ticketNumber, reason: 'ticket_not_persisted' });
        return message.reply('❌ Ticket was not recorded. Refunded your $1000. Please try a different number.');
    }

    // Log transaction
    await db.addTransaction(userId, guildId, 'lottery', -LOTTERY_TICKET_PRICE, {
        ticket_number: ticketNumber
    });
    
    const currentJackpot = await computeCurrentPot(guildId, updatedTickets.length, db);
    
    const embed = new EmbedBuilder()
        .setColor('#ff00ff')
        .setTitle('🎫 Lottery Ticket Purchased!')
        .setDescription(`Good luck, ${message.author.username}!`)
        .addFields(
            { name: 'Your Number', value: `#${ticketNumber}`, inline: true },
            { name: 'Ticket Price', value: `$${LOTTERY_TICKET_PRICE}`, inline: true },
            { name: 'Your Tickets', value: `${updatedUserTickets.length}/${MAX_LOTTERY_TICKETS}`, inline: true },
            { name: 'Current Jackpot', value: `$${currentJackpot.toLocaleString()}`, inline: false },
            { name: 'Drawing', value: 'Draw runs 10 minutes after the first ticket. Timer does not reset.', inline: true }
        );
    
    // Schedule draw if no timer is running (handles first ticket or bot restart)
    if (!lotteryTimers.has(guildId) && updatedTickets.length > 0) {
        scheduleLotteryTimer({ guildId, client, db, guildName: message.guild.name });
    }

    const uniquePlayers = new Set(updatedTickets.map(t => t.user_id)).size;

    // Status messaging
    if (lotteryTimers.has(guildId)) {
        embed.addFields({ name: '⏳ Waiting', value: 'Draw will run 10 minutes after the first ticket. Timer does not reset.', inline: false });
    }
    if (uniquePlayers >= 1 && updatedTickets.length === 1) {
        embed.addFields({ name: '👥 Players', value: '1 player joined. Others can still buy before the draw.', inline: false });
    }
    
    await message.reply({ embeds: [embed] });
}

async function setAutoTicketCommand(message, args, client, db) {
    ensureAutoLotteryMethods(db);
    if (args.length === 0) {
        return message.reply('❌ Usage: `^economy autoticket <number>` (1-100)');
    }
    const ticketNumber = parseInt(args[0]);
    if (isNaN(ticketNumber) || ticketNumber < 1 || ticketNumber > 100) {
        return message.reply('❌ Please choose a number between 1 and 100.');
    }
    const userId = message.author.id;
    const guildId = message.guild.id;

    await db.setAutoTicket(userId, guildId, ticketNumber, true);

    // Try to apply one ticket immediately for the current round if available
    let appliedNow = false;
    try {
        const activeTickets = await db.getActiveLotteryTickets(guildId);
        const numberTaken = activeTickets.some(t => t.ticket_number === ticketNumber);
        if (!numberTaken) {
            const economy = await db.getUserEconomy(userId, guildId);
            if (economy.wallet >= AUTO_TICKET_PRICE) {
                economy.wallet -= AUTO_TICKET_PRICE;
                await db.updateUserEconomy(userId, guildId, economy);
                try {
                    await db.buyLotteryTicket(userId, guildId, ticketNumber, AUTO_TICKET_PRICE);
                    await db.addTransaction(userId, guildId, 'autoticket', -AUTO_TICKET_PRICE, { ticket_number: ticketNumber, immediate: true });
                    appliedNow = true;
                    if (!lotteryTimers.has(guildId)) {
                        scheduleLotteryTimer({ guildId, client, db, guildName: message.guild.name });
                    }
                } catch (err) {
                    // refund on failure
                    const econ2 = await db.getUserEconomy(userId, guildId);
                    econ2.wallet += AUTO_TICKET_PRICE;
                    await db.updateUserEconomy(userId, guildId, econ2);
                }
            }
        }
    } catch (_) {}

    const embed = new EmbedBuilder()
        .setColor('#22c55e')
        .setTitle('✅ Auto-Ticket Enabled')
        .setDescription('We will auto-buy your number every round, even if you are offline.')
        .addFields(
            { name: 'Number', value: `#${ticketNumber}`, inline: true },
            { name: 'Price per Round', value: `$${AUTO_TICKET_PRICE.toLocaleString()}`, inline: true },
            { name: 'Applied Now', value: appliedNow ? 'Yes — 1 ticket purchased' : 'No — Will apply next round', inline: true },
            { name: 'Note', value: 'Requires wallet funds. Subscriptions reset after a jackpot winner.' }
        );
    
    // Check if user has sufficient funds for next round
    const userEconomy = await db.getUserEconomy(userId, guildId);
    if (userEconomy.wallet < AUTO_TICKET_PRICE && !appliedNow) {
        embed.addFields(
            { name: '⚠️ Low Wallet Warning', value: `You have $${userEconomy.wallet.toLocaleString()} but need $${AUTO_TICKET_PRICE.toLocaleString()} for the next round. Your auto-ticket will not apply until you earn more!`, inline: false }
        );
    }
    
    await message.reply({ embeds: [embed] });
}

async function cancelAutoTicketCommand(message, client, db) {
    ensureAutoLotteryMethods(db);
    const userId = message.author.id;
    const guildId = message.guild.id;
    const existing = await db.getAutoTicket(userId, guildId);
    if (!existing) return message.reply('ℹ️ You don\'t have an active auto-ticket.');

    await db.removeAutoTicket(userId, guildId);
    const embed = new EmbedBuilder()
        .setColor('#f43f5e')
        .setTitle('🛑 Auto-Ticket Disabled')
        .setDescription('Your auto-ticket subscription has been cancelled.');
    await message.reply({ embeds: [embed] });
}

async function autoTicketStatusCommand(message, client, db) {
    ensureAutoLotteryMethods(db);
    const userId = message.author.id;
    const guildId = message.guild.id;
    const existing = await db.getAutoTicket(userId, guildId);
    const activeTickets = await db.getActiveLotteryTickets(guildId);
    const currentPot = await computeCurrentPot(guildId, activeTickets.length, db);
    const userEconomy = await db.getUserEconomy(userId, guildId);

    const embed = new EmbedBuilder().setColor('#3b82f6').setTitle('🎟️ Auto-Ticket Status');
    if (!existing) {
        embed.setDescription('You do not have an active auto-ticket.').addFields(
            { name: 'How to Enable', value: '`^economy autoticket <number>` (2k per round)' },
            { name: 'Current Prize Pool', value: `$${currentPot.toLocaleString()}`, inline: true }
        );
    } else {
        embed.setDescription('Auto-ticket is active.').addFields(
            { name: 'Number', value: `#${existing.number}`, inline: true },
            { name: 'Price per Round', value: `$${AUTO_TICKET_PRICE.toLocaleString()}`, inline: true },
            { name: 'Since', value: `<t:${Math.floor(existing.created_at/1000)}:R>`, inline: true }
        );
        
        // Check wallet status
        if (userEconomy.wallet < AUTO_TICKET_PRICE) {
            embed.addFields(
                { name: '⚠️ Insufficient Funds', value: `You have $${userEconomy.wallet.toLocaleString()} but need $${AUTO_TICKET_PRICE.toLocaleString()} for the next round. Your auto-ticket will NOT apply!`, inline: false }
            );
        } else {
            embed.addFields(
                { name: '✅ Wallet Status', value: `Ready! You have $${userEconomy.wallet.toLocaleString()}`, inline: false }
            );
        }
    }
    await message.reply({ embeds: [embed] });
}

// Determine if lottery should draw now: 2+ tickets OR 1 ticket older than 5 minutes
function clearLotteryTimer(guildId, db = null) {
    if (lotteryTimers.has(guildId)) {
        clearTimeout(lotteryTimers.get(guildId));
        lotteryTimers.delete(guildId);
    }
    lotteryStartTimes.delete(guildId);
    
    // Clear from DB
    if (db && typeof db.clearLotteryTimerStart === 'function') {
        db.clearLotteryTimerStart(guildId).catch(() => {});
    }
}

async function resumeOrphanedTimers(guildId, client, db, guildName) {
    // Check if there are active tickets but no timer running
    if (lotteryTimers.has(guildId)) return; // timer already running
    
    const activeTickets = await db.getActiveLotteryTickets(guildId);
    if (activeTickets.length === 0) return; // no tickets
    
    // Check if we have a saved start time
    const saved = await db.getLotteryTimerStart(guildId);
    if (!saved || !saved.startTime) {
        // No saved timer, start a new one
        scheduleLotteryTimer({ guildId, client, db, guildName });
        return;
    }
    
    const elapsed = Date.now() - saved.startTime;
    const remaining = LOTTERY_TIMER_MS - elapsed;
    
    if (remaining <= 0) {
        // Timer expired while bot was offline, draw now
        await handleLotteryDraw({ guildId, client, db, tickets: activeTickets, guildName });
        clearLotteryTimer(guildId, db);
    } else {
        // Resume timer with remaining time
        lotteryStartTimes.set(guildId, saved.startTime);
        const timer = setTimeout(async () => {
            try {
                const tickets = await db.getActiveLotteryTickets(guildId);
                if (tickets && tickets.length >= 1) {
                    await handleLotteryDraw({ guildId, client, db, tickets, guildName });
                }
            } catch (err) {}
            finally {
                clearLotteryTimer(guildId, db);
            }
        }, remaining);
        lotteryTimers.set(guildId, timer);
    }
}

function scheduleLotteryTimer({ guildId, client, db, guildName }) {
    if (lotteryTimers.has(guildId)) return; // already scheduled
    
    const startTime = Date.now();
    lotteryStartTimes.set(guildId, startTime);
    
    // Persist start time to DB
    if (db && typeof db.setLotteryTimerStart === 'function') {
        db.setLotteryTimerStart(guildId, startTime).catch(() => {});
    }
    
    const timer = setTimeout(async () => {
        try {
            const tickets = await db.getActiveLotteryTickets(guildId);
            if (tickets && tickets.length >= 1) {
                // draw after 10 minutes from first ticket, regardless of count
                await handleLotteryDraw({ guildId, client, db, tickets, guildName });
            }
        } catch (err) {
            // swallow errors; timer will be cleared regardless
        } finally {
            clearLotteryTimer(guildId, db);
        }
    }, LOTTERY_TIMER_MS);
    lotteryTimers.set(guildId, timer);
}

async function forceLottery(message, client, db) {
    // Check if user has administrator permission
    if (!message.member.permissions.has('Administrator')) {
        return message.reply('❌ You need Administrator permission to force a lottery draw.');
    }

    const guildId = message.guild.id;
    const activeTickets = await db.getActiveLotteryTickets(guildId);

    if (activeTickets.length === 0) {
        return message.reply('❌ There are no active lottery tickets to draw.');
    }

    await message.reply('🎲 Forcing lottery draw now...');

    // Clear any existing timer
    clearLotteryTimer(guildId, db);

    // Trigger the draw
    await handleLotteryDraw({ 
        guildId, 
        client, 
        db, 
        tickets: activeTickets, 
        guildName: message.guild.name 
    });
}

async function handleLotteryDraw({ guildId, client, db, embed = null, tickets, guildName }) {
    if (!tickets || tickets.length === 0) return;

    // Draw: pick random winning number 1-100
    const winningNumber = Math.floor(Math.random() * 100) + 1;
    const matchingTickets = tickets.filter(t => t.ticket_number === winningNumber);
    const winnerTicket = matchingTickets.length > 0 ? matchingTickets[Math.floor(Math.random() * matchingTickets.length)] : null;
    const finalPot = await computeCurrentPot(guildId, tickets.length, db);

    // Mark this round as drawn for all tickets (even if no winner)
    if (typeof db.drawLottery === 'function') {
        try {
            await db.drawLottery(guildId, winningNumber);
        } catch (err) {/* ignore */}
    }

    if (winnerTicket) {
        const winnerUserId = winnerTicket.user_id;
        if (typeof db.payoutLotteryWinner === 'function') {
            try {
                await db.payoutLotteryWinner(guildId, winnerUserId, finalPot);
            } catch (err) {/* ignore */}
        }

        // Store last result (winner)
        lastLotteryResults.set(guildId, {
            timestamp: Date.now(),
            winningNumber,
            pot: finalPot,
            winnerUserId,
            rolledOver: false
        });

        // Reset rollover state since someone won
        carryPots.delete(guildId);
        rolloverCounts.delete(guildId);
        ensureAutoLotteryMethods(db);
        await db.clearLotteryJackpot(guildId);

        // DM winner
        try {
            const winnerUser = await client.users.fetch(winnerUserId);
            await winnerUser.send(`🎉 Lottery Result in ${guildName}: Winning number #${winningNumber}. You won $${finalPot.toLocaleString()}!`);
        } catch (notifyErr) {/* ignore DM failures */}

        if (embed) {
            embed.addFields({ name: '🎉 JACKPOT DRAWN!', value: `Winning Number: #${winningNumber}\nWinner: <@${winnerUserId}>\nPot: $${finalPot.toLocaleString()}`, inline: false });
        }

        // Clear all auto-subscriptions in this guild after a win (reset)
        ensureAutoLotteryMethods(db);
        try {
            const subs = await db.getAutoTicketsForGuild(guildId);
            for (const s of subs) {
                await db.removeAutoTicket(s.user_id, guildId);
            }
        } catch (_) {}
    } else {
        // No winner - carry full pot forward and increment rollover count
        const newRolloverCount = (rolloverCounts.get(guildId) || 0) + 1;
        carryPots.set(guildId, finalPot);
        rolloverCounts.set(guildId, newRolloverCount);
        ensureAutoLotteryMethods(db);
        await db.setLotteryJackpot(guildId, finalPot, newRolloverCount);

        // Store last result (rollover)
        lastLotteryResults.set(guildId, {
            timestamp: Date.now(),
            winningNumber,
            pot: finalPot,
            winnerUserId: null,
            rolledOver: true
        });

        if (embed) {
            embed.addFields({ name: '🎲 No Winner', value: `Winning Number: #${winningNumber}\nNo matching tickets this round.\n💰 Jackpot rolls over: $${finalPot.toLocaleString()} will be added to next round!`, inline: false });
        }
    }

    // After draw, auto-apply subscriptions for the new round
    try {
        ensureAutoLotteryMethods(db);
        await applyAutoSubscriptions({ guildId, client, db, guildName });
    } catch (_) {}
}

async function bankManagement(message, args, client, db) {
    const subCommand = args[0]?.toLowerCase();
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    if (!subCommand) {
        // Show bank info
        const economy = await db.getUserEconomy(userId, guildId);
        const properties = await db.getUserProperties(userId, guildId);
        
        // Apply any pending interest
        const pendingInterest = await applyBankInterest(userId, guildId, db);
        
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
                { name: '💰 Net Worth', value: `$${(economy.total + properties.total_property_value).toLocaleString()}`, inline: true },
                { name: '💸 Bank Interest (1% daily)', value: `Accrued: $${pendingInterest.toLocaleString()}`, inline: false }
            )
            .setFooter({ text: 'Use: ^economy bank deposit/withdraw/collect | New: fd (fixed deposits), loan (loans)' });
        
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

// ========== INTEREST & BANKING FEATURES ==========

async function applyBankInterest(userId, guildId, db) {
    const economy = await db.getUserEconomy(userId, guildId);
    const lastInterestTime = economy.last_interest_time || Date.now();
    const now = Date.now();
    const daysPassed = Math.floor((now - lastInterestTime) / (24 * 60 * 60 * 1000));
    
    if (daysPassed > 0 && economy.bank > 0) {
        const interest = Math.floor(economy.bank * BANK_INTEREST_RATE * daysPassed);
        economy.bank += interest;
        economy.last_interest_time = now;
        await db.updateUserEconomy(userId, guildId, economy);
        return interest;
    }
    return 0;
}

async function applyFixedDepositInterest(userId, guildId, db) {
    if (!db.data.fixedDeposits) return 0;
    
    const fdKey = `fd_${userId}_${guildId}`;
    const fd = db.data.fixedDeposits[fdKey];
    
    if (!fd || fd.amount <= 0 || fd.locked_until > Date.now()) {
        return 0; // No FD or still locked
    }
    
    const daysPassed = Math.floor((Date.now() - fd.created_at) / (24 * 60 * 60 * 1000));
    if (daysPassed > 0) {
        const interest = Math.floor(fd.amount * FD_INTEREST_RATE * daysPassed);
        const totalAmount = fd.amount + interest;
        
        const economy = await db.getUserEconomy(userId, guildId);
        economy.bank += totalAmount;
        await db.updateUserEconomy(userId, guildId, economy);
        
        delete db.data.fixedDeposits[fdKey];
        if (typeof db.save === 'function') db.save();
        
        return interest;
    }
    return 0;
}

async function deductIncomeTax(userId, guildId, income, incomeType, db) {
    const taxRate = TAX_RATES[incomeType] || 0.05;
    const taxAmount = Math.floor(income * taxRate);
    
    if (!db.data.serverTaxPool) db.data.serverTaxPool = {};
    if (!db.data.serverTaxPool[guildId]) {
        db.data.serverTaxPool[guildId] = { amount: 0, next_giveaway_threshold: TAX_GIVEAWAY_THRESHOLD };
    }
    
    db.data.serverTaxPool[guildId].amount += taxAmount;
    
    // Check if we've reached giveaway threshold
    const taxPool = db.data.serverTaxPool[guildId];
    if (taxPool.amount >= taxPool.next_giveaway_threshold) {
        taxPool.giveaway_pending = true;
        taxPool.pending_pool = taxPool.amount;
        taxPool.amount = 0; // Reset for next cycle
        taxPool.next_giveaway_threshold += TAX_GIVEAWAY_INCREMENT;
    }
    
    if (typeof db.save === 'function') db.save();
    
    return taxAmount;
}

async function deductTransactionFee(amount, db) {
    if (amount > TRANSACTION_FEE_THRESHOLD) {
        return Math.floor(amount * TRANSACTION_FEE_PERCENT);
    }
    return 0;
}

async function fixedDepositCommand(message, args, client, db) {
    const subCommand = args[0]?.toLowerCase();
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    if (!subCommand || !['create', 'view', 'withdraw'].includes(subCommand)) {
        return message.reply('❌ Usage: `^economy fd <create|view|withdraw>` <amount> <days>');
    }
    
    if (subCommand === 'create') {
        const amount = parseInt(args[1]);
        const days = parseInt(args[2]);
        
        if (isNaN(amount) || isNaN(days) || amount <= 0 || days <= 0) {
            return message.reply('❌ Usage: `^economy fd create <amount> <days>`');
        }
        
        if (days > 365) {
            return message.reply('❌ Maximum FD period is 365 days.');
        }
        
        const economy = await db.getUserEconomy(userId, guildId);
        if (economy.bank < amount) {
            return message.reply(`❌ You only have $${economy.bank.toLocaleString()} in your bank.`);
        }
        
        economy.bank -= amount;
        await db.updateUserEconomy(userId, guildId, economy);
        
        if (!db.data.fixedDeposits) db.data.fixedDeposits = {};
        const fdKey = `fd_${userId}_${guildId}`;
        
        const lockedUntil = Date.now() + (days * 24 * 60 * 60 * 1000);
        const expectedInterest = Math.floor(amount * FD_INTEREST_RATE * days);
        
        db.data.fixedDeposits[fdKey] = {
            user_id: userId,
            guild_id: guildId,
            amount: amount,
            created_at: Date.now(),
            locked_until: lockedUntil,
            days: days,
            expected_interest: expectedInterest
        };
        
        if (typeof db.save === 'function') db.save();
        
        const embed = new EmbedBuilder()
            .setColor('#4169E1')
            .setTitle('💎 Fixed Deposit Created')
            .addFields(
                { name: 'Amount Locked', value: `$${amount.toLocaleString()}`, inline: true },
                { name: 'Period', value: `${days} days`, inline: true },
                { name: 'Interest Rate', value: `${(FD_INTEREST_RATE * 100)}% daily`, inline: true },
                { name: 'Expected Returns', value: `$${expectedInterest.toLocaleString()}`, inline: true },
                { name: 'Total Maturity', value: `$${(amount + expectedInterest).toLocaleString()}`, inline: true },
                { name: 'Unlock Date', value: `<t:${Math.floor(lockedUntil / 1000)}:F>`, inline: false }
            );
        
        await message.reply({ embeds: [embed] });
    } else if (subCommand === 'view') {
        if (!db.data.fixedDeposits) {
            return message.reply('❌ You have no active fixed deposits.');
        }
        
        const fdKey = `fd_${userId}_${guildId}`;
        const fd = db.data.fixedDeposits[fdKey];
        
        if (!fd) {
            return message.reply('❌ You have no active fixed deposits.');
        }
        
        const timeRemaining = fd.locked_until - Date.now();
        const daysLeft = Math.ceil(timeRemaining / (24 * 60 * 60 * 1000));
        
        const embed = new EmbedBuilder()
            .setColor('#4169E1')
            .setTitle('💎 Fixed Deposit Info')
            .addFields(
                { name: 'Locked Amount', value: `$${fd.amount.toLocaleString()}`, inline: true },
                { name: 'Days Left', value: `${daysLeft}`, inline: true },
                { name: 'Expected Interest', value: `$${fd.expected_interest.toLocaleString()}`, inline: true },
                { name: 'Maturity Amount', value: `$${(fd.amount + fd.expected_interest).toLocaleString()}`, inline: false }
            );
        
        await message.reply({ embeds: [embed] });
    } else if (subCommand === 'withdraw') {
        if (!db.data.fixedDeposits) {
            return message.reply('❌ You have no active fixed deposits.');
        }
        
        const fdKey = `fd_${userId}_${guildId}`;
        const fd = db.data.fixedDeposits[fdKey];
        
        if (!fd) {
            return message.reply('❌ You have no active fixed deposits.');
        }
        
        if (fd.locked_until > Date.now()) {
            const timeRemaining = fd.locked_until - Date.now();
            const daysLeft = Math.ceil(timeRemaining / (24 * 60 * 60 * 1000));
            return message.reply(`⏰ Your FD is locked for ${daysLeft} more days. Come back when it matures.`);
        }
        
        const interest = await applyFixedDepositInterest(userId, guildId, db);
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('💎 FD Withdrawn')
            .addFields(
                { name: 'Principal', value: `$${fd.amount.toLocaleString()}`, inline: true },
                { name: 'Interest Earned', value: `$${interest.toLocaleString()}`, inline: true },
                { name: 'Total Received', value: `$${(fd.amount + interest).toLocaleString()}`, inline: true }
            );
        
        await message.reply({ embeds: [embed] });
    }
}

async function handleLoanDefault(userId, guildId, db) {
    if (!db.data || !db.data.loans) return null;
    const loanKey = `loan_${userId}_${guildId}`;
    const loan = db.data.loans[loanKey];
    if (!loan || loan.amount <= 0) return null;

    const daysElapsed = (Date.now() - loan.taken_at) / (24 * 60 * 60 * 1000);
    if (daysElapsed < LOAN_DEFAULT_DAYS) return null;

    const properties = await db.getUserProperties(userId, guildId);
    const seizedValue = properties.total_property_value || 0;

    properties.houses = [];
    properties.shops = [];
    properties.lands = [];
    properties.businesses = [];
    properties.total_property_value = 0;
    await db.updateUserProperties(userId, guildId, properties);

    delete db.data.loans[loanKey];
    if (typeof db.save === 'function') db.save();

    await db.addTransaction(userId, guildId, 'loan_default', -loan.amount, {
        seized_value: seizedValue,
        days_elapsed: Math.floor(daysElapsed)
    });

    return { seizedValue };
}

async function loanCommand(message, args, client, db) {
    const subCommand = args[0]?.toLowerCase();
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    if (!subCommand || !['apply', 'repay', 'status'].includes(subCommand)) {
        return message.reply('❌ Usage: `^economy loan <apply|repay|status>` [amount]');
    }

    const defaultInfo = await handleLoanDefault(userId, guildId, db);
    if (defaultInfo) {
        return message.reply(`⚠️ Loan defaulted after ${LOAN_DEFAULT_DAYS} days. Properties repossessed (value: $${defaultInfo.seizedValue.toLocaleString()}). Loan cleared.`);
    }
    
    if (subCommand === 'apply') {
        const amount = parseInt(args[1]);
        
        if (isNaN(amount) || amount <= 0) {
            return message.reply('❌ Please specify a valid loan amount.');
        }
        
        const properties = await db.getUserProperties(userId, guildId);
        const maxLoanAmount = Math.floor(properties.total_property_value * LOAN_MAX_PERCENT);
        
        if (amount > maxLoanAmount) {
            return message.reply(`❌ You can borrow up to $${maxLoanAmount.toLocaleString()} based on your property value of $${properties.total_property_value.toLocaleString()}.`);
        }
        
        if (!db.data.loans) db.data.loans = {};
        const loanKey = `loan_${userId}_${guildId}`;
        
        if (db.data.loans[loanKey] && db.data.loans[loanKey].amount > 0) {
            return message.reply('❌ You already have an active loan. Repay it first.');
        }
        
        const economy = await db.getUserEconomy(userId, guildId);
        economy.wallet += amount;
        await db.updateUserEconomy(userId, guildId, economy);
        
        db.data.loans[loanKey] = {
            user_id: userId,
            guild_id: guildId,
            amount: amount,
            taken_at: Date.now(),
            interest_rate: LOAN_INTEREST_RATE,
            repaid: 0
        };
        
        if (typeof db.save === 'function') db.save();
        await db.addTransaction(userId, guildId, 'loan_disbursed', amount, {
            interest_rate: LOAN_INTEREST_RATE,
            default_after_days: LOAN_DEFAULT_DAYS
        });
        
        const embed = new EmbedBuilder()
            .setColor('#ff9900')
            .setTitle('🏦 Loan Approved')
            .addFields(
                { name: 'Loan Amount', value: `$${amount.toLocaleString()}`, inline: true },
                { name: 'Interest Rate', value: `${(LOAN_INTEREST_RATE * 100)}% monthly`, inline: true },
                { name: 'Status', value: 'Received to wallet', inline: false },
                { name: '⚠️ Note', value: 'Your properties are locked until loan is repaid.', inline: false }
            );
        
        await message.reply({ embeds: [embed] });
    } else if (subCommand === 'repay') {
        const repayAmount = parseInt(args[1]);
        
        if (isNaN(repayAmount) || repayAmount <= 0) {
            return message.reply('❌ Please specify a repayment amount.');
        }
        
        if (!db.data.loans) {
            return message.reply('❌ You have no active loans.');
        }
        
        const loanKey = `loan_${userId}_${guildId}`;
        const loan = db.data.loans[loanKey];
        
        if (!loan || loan.amount <= 0) {
            return message.reply('❌ You have no active loans.');
        }
        
        const economy = await db.getUserEconomy(userId, guildId);
        
        if (economy.wallet < repayAmount) {
            return message.reply(`❌ You only have $${economy.wallet.toLocaleString()} in your wallet.`);
        }
        
        const monthsElapsed = Math.floor((Date.now() - loan.taken_at) / (30 * 24 * 60 * 60 * 1000));
        const totalInterest = Math.floor(loan.amount * LOAN_INTEREST_RATE * monthsElapsed);
        const totalDue = loan.amount + totalInterest;
        const remaining = Math.max(0, totalDue - loan.repaid);
        
        if (repayAmount > remaining) {
            return message.reply(`❌ You only owe $${remaining.toLocaleString()}. You can't overpay.`);
        }
        
        economy.wallet -= repayAmount;
        loan.repaid += repayAmount;
        
        const isFullyPaid = loan.repaid >= totalDue;
        if (isFullyPaid) {
            delete db.data.loans[loanKey];
        }
        
        await db.updateUserEconomy(userId, guildId, economy);
        if (typeof db.save === 'function') db.save();
        await db.addTransaction(userId, guildId, 'loan_repayment', -repayAmount, {
            remaining: Math.max(0, totalDue - loan.repaid),
            fully_paid: isFullyPaid
        });
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('💳 Loan Repayment Processed')
            .addFields(
                { name: 'Amount Paid', value: `$${repayAmount.toLocaleString()}`, inline: true },
                { name: 'Remaining', value: isFullyPaid ? '✅ Fully Paid' : `$${(remaining - repayAmount).toLocaleString()}`, inline: true },
                { name: 'Status', value: isFullyPaid ? '✅ Loan Cleared - Properties Unlocked' : '⏳ Active Loan', inline: false }
            );
        
        await message.reply({ embeds: [embed] });
    } else if (subCommand === 'status') {
        if (!db.data.loans) {
            return message.reply('❌ You have no active loans.');
        }
        
        const loanKey = `loan_${userId}_${guildId}`;
        const loan = db.data.loans[loanKey];
        
        if (!loan || loan.amount <= 0) {
            return message.reply('❌ You have no active loans.');
        }
        
        const monthsElapsed = Math.floor((Date.now() - loan.taken_at) / (30 * 24 * 60 * 60 * 1000));
        const totalInterest = Math.floor(loan.amount * LOAN_INTEREST_RATE * monthsElapsed);
        const totalDue = loan.amount + totalInterest;
        const remaining = Math.max(0, totalDue - loan.repaid);
        const daysUntilDefault = Math.max(0, LOAN_DEFAULT_DAYS - Math.floor((Date.now() - loan.taken_at) / (24 * 60 * 60 * 1000)));
        const defaultTimestamp = loan.taken_at + (LOAN_DEFAULT_DAYS * 24 * 60 * 60 * 1000);
        
        const embed = new EmbedBuilder()
            .setColor('#ff9900')
            .setTitle('🏦 Loan Status')
            .addFields(
                { name: 'Principal', value: `$${loan.amount.toLocaleString()}`, inline: true },
                { name: 'Months Elapsed', value: `${monthsElapsed}`, inline: true },
                { name: 'Total Interest', value: `$${totalInterest.toLocaleString()}`, inline: true },
                { name: 'Total Due', value: `$${totalDue.toLocaleString()}`, inline: true },
                { name: 'Already Paid', value: `$${loan.repaid.toLocaleString()}`, inline: true },
                { name: 'Remaining Balance', value: `$${remaining.toLocaleString()}`, inline: true },
                { name: 'Days Until Default', value: `${daysUntilDefault} day(s)`, inline: true },
                { name: 'Default On', value: `<t:${Math.floor(defaultTimestamp / 1000)}:R>`, inline: true },
                { name: '⚠️ Status', value: 'Properties are locked until fully repaid', inline: false }
            );
        
        await message.reply({ embeds: [embed] });
    }
}

async function taxGiveawayCommand(message, args, client, db) {
    const guildId = message.guild.id;
    const subCommand = args[0]?.toLowerCase();
    
    // Admin check
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        return message.reply('❌ Only server administrators can manage tax giveaways.');
    }
    
    if (!subCommand || !['setchannel', 'status', 'trigger'].includes(subCommand)) {
        return message.reply('❌ Usage: `^economy taxgiveaway <setchannel|status|trigger>` [#channel]');
    }
    
    if (!db.data.serverTaxPool) db.data.serverTaxPool = {};
    if (!db.data.serverTaxPool[guildId]) {
        db.data.serverTaxPool[guildId] = { amount: 0, next_giveaway_threshold: TAX_GIVEAWAY_THRESHOLD };
    }
    
    if (subCommand === 'setchannel') {
        const channel = message.mentions.channels.first();
        
        if (!channel) {
            return message.reply('❌ Please mention a channel: `^economy taxgiveaway setchannel #channel`');
        }
        
        db.data.serverTaxPool[guildId].giveaway_channel = channel.id;
        if (typeof db.save === 'function') db.save();
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Tax Giveaway Channel Set')
            .setDescription(`All tax collection giveaways will be announced in ${channel.toString()}.`)
            .addFields(
                { name: 'Threshold', value: `$${db.data.serverTaxPool[guildId].next_giveaway_threshold.toLocaleString()}`, inline: true }
            );
        
        await message.reply({ embeds: [embed] });
    } else if (subCommand === 'status') {
        const taxPool = db.data.serverTaxPool[guildId];
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('📊 Tax Giveaway Status')
            .addFields(
                { name: 'Current Tax Pool', value: `$${taxPool.amount.toLocaleString()}`, inline: true },
                { name: 'Next Giveaway Threshold', value: `$${taxPool.next_giveaway_threshold.toLocaleString()}`, inline: true },
                { name: 'Progress', value: `${Math.floor((taxPool.amount / taxPool.next_giveaway_threshold) * 100)}%`, inline: true },
                { name: 'Giveaway Channel', value: taxPool.giveaway_channel ? `<#${taxPool.giveaway_channel}>` : '❌ Not Set', inline: false }
            );
        
        if (taxPool.giveaway_pending) {
            embed.addFields({ name: '🎁 Pending Giveaway', value: `$${taxPool.pending_pool.toLocaleString()} waiting to be triggered`, inline: false });
        }
        
        await message.reply({ embeds: [embed] });
    } else if (subCommand === 'trigger') {
        const taxPool = db.data.serverTaxPool[guildId];
        
        if (!taxPool.giveaway_pending) {
            return message.reply('❌ No pending tax giveaway. Taxes must reach the threshold first.');
        }
        
        if (!taxPool.giveaway_channel) {
            return message.reply('❌ Giveaway channel not set. Use: `^economy taxgiveaway setchannel #channel`');
        }
        
        try {
            const giveawayChannel = await client.channels.fetch(taxPool.giveaway_channel);
            const giveawayAmount = taxPool.pending_pool;
            
            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🎁 TAX COLLECTION GIVEAWAY!')
                .setDescription(`React with 🎉 within 30 seconds to participate and win!`)
                .addFields(
                    { name: '💰 Prize Pool', value: `$${giveawayAmount.toLocaleString()}`, inline: true },
                    { name: '⏱️ Duration', value: '30 seconds', inline: true },
                    { name: '🏆 Winner', value: 'Will be randomly selected from reactions', inline: false }
                )
                .setFooter({ text: 'Tax collected from server transactions' });
            
            const giveawayMsg = await giveawayChannel.send({ embeds: [embed] });
            await giveawayMsg.react('🎉');
            
            // Collect reactions for 30 seconds
            const filter = (reaction, user) => reaction.emoji.name === '🎉' && !user.bot;
            const collected = await giveawayMsg.awaitReactions({ filter, time: 30000, max: 100 });
            
            const reactions = giveawayMsg.reactions.cache.get('🎉');
            if (!reactions || reactions.count <= 1) {
                // No winners, keep the pot
                const resultEmbed = new EmbedBuilder()
                    .setColor('#FF6347')
                    .setTitle('❌ No Winners')
                    .setDescription(`No one reacted in time. The giveaway pool of $${giveawayAmount.toLocaleString()} will carry over to the next threshold.`)
                    .addFields(
                        { name: 'Next Threshold', value: `$${taxPool.next_giveaway_threshold.toLocaleString()}`, inline: true }
                    );
                
                taxPool.giveaway_pending = false;
                taxPool.amount += giveawayAmount; // Carry over
                
                await giveawayChannel.send({ embeds: [resultEmbed] });
            } else {
                // Select random winner
                const users = (await reactions.users.fetch()).filter(u => !u.bot);
                const winner = users.random();
                
                // Add money to winner
                const winnerEconomy = await db.getUserEconomy(winner.id, guildId);
                winnerEconomy.wallet += giveawayAmount;
                await db.updateUserEconomy(winner.id, guildId, winnerEconomy);
                
                const resultEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('🎊 GIVEAWAY WINNER!')
                    .setDescription(`🏆 ${winner.toString()} has won the tax collection giveaway!`)
                    .addFields(
                        { name: '💰 Prize', value: `$${giveawayAmount.toLocaleString()}`, inline: true },
                        { name: '✅ Status', value: 'Money has been sent to winner wallet', inline: true }
                    );
                
                taxPool.giveaway_pending = false;
                
                await giveawayChannel.send({ embeds: [resultEmbed] });
            }
            
            if (typeof db.save === 'function') db.save();
        } catch (error) {
            console.error('Giveaway error:', error);
            return message.reply('❌ Error triggering giveaway. Please check channel permissions.');
        }
    }
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
        const typeLabels = {
            work: 'Salary',
            loan_payment_garnish: 'Loan Payment (Work)',
            loan_repayment: 'Loan Repayment',
            loan_disbursed: 'Loan Received',
            loan_default: 'Loan Default',
            deposit: 'Deposit',
            withdraw: 'Withdraw',
            rent: 'Rent',
            buy: 'Purchase',
            sell: 'Sale'
        };
        const typeIcons = {
            work: '💼',
            loan_payment_garnish: '💳',
            loan_repayment: '💳',
            loan_disbursed: '🏦',
            loan_default: '⚠️',
            deposit: '🏦',
            withdraw: '🏦',
            rent: '🏠',
            buy: '🛒',
            sell: '💵'
        };

        const formatTransaction = (t) => {
            const icon = typeIcons[t.type] || '📝';
            const label = typeLabels[t.type] || t.type;
            const amountStr = `${t.amount >= 0 ? '+' : '-'}$${Math.abs(t.amount).toLocaleString()}`;
            const timeStr = t.timestamp ? `<t:${Math.floor(t.timestamp / 1000)}:R>` : 'recently';
            const meta = t.metadata || {};
            const parts = [];

            if (t.type === 'work') {
                const net = t.amount - (meta.tax || 0) - (meta.loan_payment || 0);
                parts.push(`net $${net.toLocaleString()}`);
                if (meta.loan_payment) parts.push(`loan $${meta.loan_payment.toLocaleString()}`);
                if (meta.tax) parts.push(`tax $${meta.tax.toLocaleString()}`);
            }

            if (t.type === 'loan_payment_garnish' && meta.loan_remaining !== undefined) {
                parts.push(`left $${meta.loan_remaining.toLocaleString()}`);
            }

            if (t.type === 'loan_repayment' && meta.remaining !== undefined) {
                parts.push(`left $${meta.remaining.toLocaleString()}`);
            }

            if (t.type === 'loan_disbursed' && meta.default_after_days !== undefined) {
                parts.push(`${meta.default_after_days}d to default`);
            }

            const detail = parts.length > 0 ? ` — ${parts.join(' | ')}` : '';
            return `• ${icon} **${label}**: ${amountStr} (${timeStr})${detail}`;
        };

        const transactionsText = transactions.map(formatTransaction).join('\n');
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
            { name: '💼 Jobs', value: '`^economy jobs` - View available jobs\n`^economy apply <job_id>` - Apply for a job\n`^economy work` - Work and earn salary (with 10% income tax)', inline: false },
            { name: '📅 Daily Check-In', value: '`^economy daily` / `^economy checkin` / `^economy streak` - Claim daily rewards and view your streak (UTC, 24h cooldown)', inline: false },
            { name: '🏘️ Properties', value: '`^economy properties` - View your properties\n`^economy buy` - View available properties\n`^economy buy <type> <id>` - Buy a property\n`^economy sell <type> <index>` - Sell a property', inline: false },
            { name: '🏦 Bank & Interest', value: '`^economy bank` - View bank balance (earns 1% daily interest)\n`^economy bank deposit <amount/all>` - Deposit money\n`^economy bank withdraw <amount/all>` - Withdraw money\n`^economy bank collect` - Collect daily rent', inline: false },
            { name: '💎 Fixed Deposits (FD)', value: '`^economy fd create <amount> <days>` - Lock funds for higher interest (3% daily)\n`^economy fd view` - View your FD\n`^economy fd withdraw` - Withdraw when matured (max 365 days)', inline: false },
            { name: '💳 Loans', value: '`^economy loan apply <amount>` - Borrow up to 80% of property value (5% monthly interest)\n`^economy loan repay <amount>` - Repay loan EMI\n`^economy loan status` - View loan details (properties locked until paid)', inline: false },
            { name: '🎫 Lottery', value: '`^economy lottery` - View lottery info\n`^economy buyticket <number>` - Buy lottery ticket (1-100)\n`^economy lotteryresult` - View last draw and current prize pool\n`^economy forcelottery` - Admin: force draw now\n`^economy autoticket <number>` - Auto-buy your number every round (2k/round)\n`^economy cancelautoticket` - Cancel auto-ticket\n`^economy autoticketstatus` - View auto-ticket status\nDraw starts on the first ticket and runs 10 minutes later. If no one wins, the jackpot rolls over and accumulates (+10k per rollover). Lottery winnings: 20% tax.', inline: false },
            { name: '🎮 Games & Activities', value: '`^economy steal @user` - Steal money (50% success, 1h cooldown, 5% tax on income)\n`^economy pay @user <amount>` - Send money to others (2% transaction fee for large transfers, 5% tax)\n`^economy race <amount>` - Horse race betting (3x)\n`^economy football <amount> <red/blue>` - Team match betting\n`^economy gamble <amount>` - Test your luck (2x, 15% tax on winnings)', inline: false },
            { name: '📊 Taxes & Giveaways', value: '`^economy taxgiveaway setchannel #channel` - Admin: set tax giveaway channel\n`^economy taxgiveaway status` - View tax pool and giveaway threshold\n`^economy taxgiveaway trigger` - Admin: start giveaway when threshold reached\nEvery 500k collected in taxes auto-triggers a 30-second giveaway (winner takes all!)', inline: false },
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

    // Check if user has minimum wallet
    const userEconomy = await db.getUserEconomy(userId, guildId);
    if (userEconomy.wallet < 10000) {
        return message.reply('❌ You need at least $10,000 in your wallet to attempt stealing! (Collateral requirement)');
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

    // Get target's economy
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

        // Notify victim (ignore if DMs closed)
        try {
            const victimEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🚨 You\'ve Been Robbed!')
                .setDescription(`${message.author.username} stole $${stolenAmount.toLocaleString()} from you in ${message.guild.name}!`)
                .addFields({ name: '💼 Your New Balance', value: `$${targetEconomy.wallet.toLocaleString()}`, inline: true });

            await targetUser.send({ embeds: [victimEmbed] });
        } catch (error) {
            // User has DMs disabled
        }
    } else {
        // Failed attempt: apply a fine between 10% of wallet (min $100)
        const fineAmount = Math.min(
            userEconomy.wallet,
            Math.max(100, Math.floor(userEconomy.wallet * 0.1))
        );

        userEconomy.wallet -= fineAmount;
        await db.updateUserEconomy(userId, guildId, userEconomy);
        
        // Add fine to tax pool (penalty/fine goes to server)
        if (!db.data.serverTaxPool) db.data.serverTaxPool = {};
        if (!db.data.serverTaxPool[guildId]) {
            db.data.serverTaxPool[guildId] = { amount: 0, next_giveaway_threshold: TAX_GIVEAWAY_THRESHOLD };
        }
        
        db.data.serverTaxPool[guildId].amount += fineAmount;
        
        // Check if we've reached giveaway threshold
        const taxPool = db.data.serverTaxPool[guildId];
        if (taxPool.amount >= taxPool.next_giveaway_threshold) {
            taxPool.giveaway_pending = true;
            taxPool.pending_pool = taxPool.amount;
            taxPool.amount = 0; // Reset for next cycle
            taxPool.next_giveaway_threshold += TAX_GIVEAWAY_INCREMENT;
        }
        
        if (typeof db.save === 'function') db.save();
        
        await db.addTransaction(userId, guildId, 'steal_failed', -fineAmount, { fine_to_pool: true });

        // Set cooldown
        timestamps.set(userId, now);

        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('🚨 Steal Failed!')
            .setDescription('You got caught trying to steal! Fine goes to server tax pool.')
            .addFields(
                { name: '⚖️ Fine (Penalty)', value: `$${fineAmount.toLocaleString()}`, inline: true },
                { name: '💼 Your Balance', value: `$${userEconomy.wallet.toLocaleString()}`, inline: true },
                { name: '⏰ Next Attempt', value: '1 hour', inline: true },
                { name: '📊 Tax Pool', value: `Fine added to server giveaway pool!`, inline: false }
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
    
    // Calculate transaction fee
    const transactionFee = await deductTransactionFee(amount, db);
    const incomeTax = await deductIncomeTax(userId, guildId, amount, 'trading', db);
    
    // Transfer money (target receives full amount, sender pays fee + tax)
    const totalCost = amount + transactionFee + incomeTax;
    
    if (userEconomy.wallet < totalCost) {
        return message.reply(`❌ You need $${totalCost.toLocaleString()} to complete this payment (amount + fees + tax). You have $${userEconomy.wallet.toLocaleString()}.`);
    }
    
    userEconomy.wallet -= totalCost;
    targetEconomy.wallet += amount;
    
    await db.updateUserEconomy(userId, guildId, userEconomy);
    await db.updateUserEconomy(targetUser.id, guildId, targetEconomy);
    
    // Log transactions
    await db.addTransaction(userId, guildId, 'pay_sent', -totalCost, { recipient: targetUser.id, fee: transactionFee, tax: incomeTax });
    await db.addTransaction(targetUser.id, guildId, 'pay_received', amount, { sender: userId });
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('💸 Payment Sent!')
        .setDescription(`You sent money to ${targetUser.username}`)
        .addFields(
            { name: '💵 Amount', value: `$${amount.toLocaleString()}`, inline: true },
            { name: '📊 Transaction Fee (2%)', value: `$${transactionFee.toLocaleString()}`, inline: true },
            { name: '💼 Income Tax (5%)', value: `$${incomeTax.toLocaleString()}`, inline: true },
            { name: '💸 Total Paid', value: `$${totalCost.toLocaleString()}`, inline: true },
            { name: '✅ Your New Balance', value: `$${userEconomy.wallet.toLocaleString()}`, inline: true },
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
module.exports.showJobs = showJobs;
module.exports.showProperties = showProperties;
module.exports.lotteryInfo = lotteryInfo;
module.exports.bankManagement = bankManagement;
module.exports.showLeaderboard = showLeaderboard;
module.exports.showProfile = showProfile;
module.exports.dailyCheckIn = dailyCheckIn;

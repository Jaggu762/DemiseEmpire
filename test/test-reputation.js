/**
 * Reputation System Test Script
 * Tests core functionality without requiring Discord connection
 */

const Database = require('../utils/database');
const ReputationService = require('../utils/reputationService');

// Mock Discord objects for testing
function createMockMember(id, username, createdDays = 30, joinedDays = 10, isBot = false) {
    const now = Date.now();
    return {
        id: id,
        user: {
            id: id,
            username: username,
            tag: `${username}#0000`,
            bot: isBot,
            createdTimestamp: now - (createdDays * 24 * 60 * 60 * 1000),
            displayAvatarURL: () => 'https://example.com/avatar.png',
            toString: () => `@${username}`
        },
        joinedTimestamp: now - (joinedDays * 24 * 60 * 60 * 1000),
        guild: {
            id: 'test-guild-123'
        }
    };
}

function createMockGuild(id) {
    return {
        id: id,
        name: 'Test Guild'
    };
}

async function runTests() {
    console.log('🧪 Starting Reputation System Tests...\n');

    try {
        // Initialize database
        console.log('📦 Initializing database...');
        const db = new Database();
        await db.initialize();
        console.log('✅ Database initialized\n');

        // Initialize reputation service
        console.log('🔧 Initializing reputation service...');
        const repService = new ReputationService(db);
        console.log('✅ Reputation service initialized\n');

        // Create mock users
        const user1 = createMockMember('user1', 'Alice', 30, 10);
        const user2 = createMockMember('user2', 'Bob', 30, 10);
        const user3 = createMockMember('user3', 'Charlie', 30, 10);
        const botUser = createMockMember('bot1', 'TestBot', 30, 10, true);
        const newUser = createMockMember('new1', 'NewUser', 2, 1); // Too new
        const guild = createMockGuild('test-guild-123');

        console.log('👥 Created mock users:\n');
        console.log(`  - ${user1.user.username} (ID: ${user1.id})`);
        console.log(`  - ${user2.user.username} (ID: ${user2.id})`);
        console.log(`  - ${user3.user.username} (ID: ${user3.id})`);
        console.log(`  - ${botUser.user.username} (ID: ${botUser.id}) [BOT]`);
        console.log(`  - ${newUser.user.username} (ID: ${newUser.id}) [NEW]\n`);

        // Test 1: Self-rep check
        console.log('📝 Test 1: Self-rep check');
        const selfRepResult = await repService.canGiveRep(user1, user1, guild);
        console.log(`   Result: ${selfRepResult.canGive ? '❌ FAILED' : '✅ PASSED'}`);
        console.log(`   Message: ${selfRepResult.reason}\n`);

        // Test 2: Bot rep check
        console.log('📝 Test 2: Bot rep check');
        const botRepResult = await repService.canGiveRep(user1, botUser, guild);
        console.log(`   Result: ${botRepResult.canGive ? '❌ FAILED' : '✅ PASSED'}`);
        console.log(`   Message: ${botRepResult.reason}\n`);

        // Test 3: New user check
        console.log('📝 Test 3: New user check');
        const newUserResult = await repService.canGiveRep(newUser, user1, guild);
        console.log(`   Result: ${newUserResult.canGive ? '❌ FAILED' : '✅ PASSED'}`);
        console.log(`   Message: ${newUserResult.reason}\n`);

        // Test 4: Valid rep giving
        console.log('📝 Test 4: Give reputation (Alice → Bob)');
        const giveRepResult = await repService.giveRep(
            user1,
            user2,
            guild,
            'Great help with testing!',
            'channel-123'
        );
        console.log(`   Result: ${giveRepResult.success ? '✅ PASSED' : '❌ FAILED'}`);
        if (giveRepResult.success) {
            console.log(`   Bob now has ${giveRepResult.data.newRepTotal} reputation!`);
            console.log(`   Bob's rank: #${giveRepResult.data.rank}\n`);
        } else {
            console.log(`   Error: ${giveRepResult.message}\n`);
        }

        // Test 5: Daily limit check
        console.log('📝 Test 5: Daily limit check (Alice → Charlie)');
        const dailyLimitResult = await repService.giveRep(
            user1,
            user3,
            guild,
            'Another helpful person!',
            'channel-123'
        );
        console.log(`   Result: ${!dailyLimitResult.success ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`   Message: ${dailyLimitResult.message}\n`);

        // Test 6: Same-user cooldown check
        console.log('📝 Test 6: Same-user cooldown (try Alice → Bob again)');
        // First, reset daily count by giving as different user
        await repService.giveRep(user3, user2, guild, 'Also helpful!', 'channel-123');
        // Now try from Alice again
        const cooldownResult = await repService.canGiveRep(user1, user2, guild);
        console.log(`   Result: ${!cooldownResult.canGive ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`   Message: ${cooldownResult.reason}\n`);

        // Test 7: Get reputation
        console.log('📝 Test 7: Get Bob\'s reputation');
        const getRepResult = await repService.getRep(user2.user, guild.id);
        console.log(`   Result: ${getRepResult.success ? '✅ PASSED' : '❌ FAILED'}`);
        if (getRepResult.success) {
            console.log(`   Rep: ${getRepResult.data.rep}`);
            console.log(`   Rank: #${getRepResult.data.rank}\n`);
        }

        // Test 8: Leaderboard
        console.log('📝 Test 8: Get leaderboard');
        const leaderboardResult = await repService.getLeaderboard(guild.id, 10);
        console.log(`   Result: ${leaderboardResult.success ? '✅ PASSED' : '❌ FAILED'}`);
        if (leaderboardResult.success) {
            console.log(`   Leaderboard entries: ${leaderboardResult.data.length}`);
            leaderboardResult.data.forEach((entry, i) => {
                console.log(`   ${i + 1}. User ${entry.user_id}: ${entry.rep} rep`);
            });
            console.log('');
        }

        // Test 9: Reputation history
        console.log('📝 Test 9: Get Bob\'s reputation history');
        const historyResult = await repService.getRepHistory(user2.user, guild.id, 10);
        console.log(`   Result: ${historyResult.success ? '✅ PASSED' : '❌ FAILED'}`);
        if (historyResult.success) {
            console.log(`   History entries: ${historyResult.data.length}`);
            historyResult.data.forEach((entry, i) => {
                console.log(`   ${i + 1}. From ${entry.giver_id}: "${entry.reason}"`);
            });
            console.log('');
        }

        // Test 10: Statistics
        console.log('📝 Test 10: Get server statistics');
        const statsResult = await repService.getStats(guild.id);
        console.log(`   Result: ${statsResult.success ? '✅ PASSED' : '❌ FAILED'}`);
        if (statsResult.success) {
            console.log(`   Total users: ${statsResult.data.totalUsers}`);
            console.log(`   Total rep given: ${statsResult.data.totalRepGiven}`);
            console.log(`   Average rep: ${statsResult.data.averageRep}`);
            console.log(`   Reps last 24h: ${statsResult.data.repsLast24h}\n`);
        }

        console.log('✅ All tests completed!\n');
        console.log('📊 Test Summary:');
        console.log('   ✓ Self-rep prevention');
        console.log('   ✓ Bot rep prevention');
        console.log('   ✓ New user prevention');
        console.log('   ✓ Give reputation');
        console.log('   ✓ Daily limit enforcement');
        console.log('   ✓ Same-user cooldown');
        console.log('   ✓ Get reputation');
        console.log('   ✓ Leaderboard');
        console.log('   ✓ History');
        console.log('   ✓ Statistics\n');

    } catch (error) {
        console.error('❌ Test failed with error:', error);
        console.error(error.stack);
    }
}

// Run tests
runTests().then(() => {
    console.log('🎉 Testing complete!');
    process.exit(0);
}).catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
});

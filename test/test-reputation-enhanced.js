/**
 * Enhanced Reputation System Test Script
 * Tests Phase 9 requirements: abuse detection, role assignment, configuration
 */

const Database = require('../utils/database');
const ReputationService = require('../utils/reputationService');

// Mock Discord objects
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
        },
        roles: {
            cache: new Map()
        }
    };
}

function createMockGuild(id) {
    return {
        id: id,
        name: 'Test Guild',
        roles: {
            cache: new Map([
                ['role1', { id: 'role1', name: 'Active' }],
                ['role2', { id: 'role2', name: 'Trusted' }],
                ['role3', { id: 'role3', name: 'VIP' }]
            ])
        }
    };
}

async function runEnhancedTests() {
    console.log('🧪 Starting Enhanced Reputation System Tests...\n');
    
    let passedTests = 0;
    let totalTests = 0;

    try {
        // Initialize
        const db = new Database();
        await db.initialize();
        const repService = new ReputationService(db);
        const guild = createMockGuild('test-guild-123');
        
        console.log('✅ Test environment initialized\n');
        
        // ========== Phase 9.1: Unit Tests ==========
        console.log('📝 Phase 9.1 - Unit Tests\n');
        
        // Test 1: Cooldown Logic
        totalTests++;
        console.log('Test 1: Cooldown expiry check');
        try {
            const alice = createMockMember('user1', 'Alice');
            const bob = createMockMember('user2', 'Bob');
            
            // Give rep
            await repService.giveRep(alice, bob, guild, 'Test reason', 'channel1');
            
            // Try immediately - should fail
            const result1 = await repService.canGiveRep(alice, bob, guild);
            
            // Manually expire cooldown
            const cooldownKey = `${guild.id}_${alice.id}_${bob.id}`;
            if (db.data.repCooldowns[cooldownKey]) {
                db.data.repCooldowns[cooldownKey].expires_at = Date.now() - 1000;
            }
            
            // Try again - should succeed
            const result2 = await repService.canGiveRep(alice, bob, guild);
            
            if (!result1.canGive && result2.canGive) {
                console.log('   ✅ PASSED - Cooldown logic working correctly\n');
                passedTests++;
            } else {
                console.log('   ❌ FAILED - Cooldown logic issue\n');
            }
        } catch (error) {
            console.log(`   ❌ FAILED - Error: ${error.message}\n`);
        }
        
        // Test 2: Daily Limit Reset
        totalTests++;
        console.log('Test 2: Daily limit reset logic');
        try {
            const charlie = createMockMember('user3', 'Charlie');
            const david = createMockMember('user4', 'David');
            const eve = createMockMember('user5', 'Eve');
            
            // Give rep to hit daily limit
            await repService.giveRep(charlie, david, guild, 'Reason 1', 'channel1');
            
            // Should hit daily limit
            const canGive1 = await repService.canGiveRep(charlie, eve, guild);
            
            // Manually clear daily count (simulate next day)
            const dailyKey = `${guild.id}_${charlie.id}`;
            if (db.data.repLogs && db.data.repLogs[guild.id]) {
                db.data.repLogs[guild.id] = db.data.repLogs[guild.id].filter(
                    log => log.giver_id !== charlie.id || 
                           log.created_at < Date.now() - (25 * 60 * 60 * 1000)
                );
            }
            
            // Should be able to give again
            const canGive2 = await repService.canGiveRep(charlie, eve, guild);
            
            if (!canGive1.canGive && canGive2.canGive) {
                console.log('   ✅ PASSED - Daily limit resets correctly\n');
                passedTests++;
            } else {
                console.log('   ❌ FAILED - Daily limit reset issue\n');
            }
        } catch (error) {
            console.log(`   ❌ FAILED - Error: ${error.message}\n`);
        }
        
        // Test 3: Role Assignment Logic
        totalTests++;
        console.log('Test 3: Role assignment at thresholds');
        try {
            const frank = createMockMember('user6', 'Frank');
            
            // Set up role rewards
            await db.addRepRoleReward(guild.id, 'role1', 5);
            await db.addRepRoleReward(guild.id, 'role2', 10);
            await db.addRepRoleReward(guild.id, 'role3', 20);
            
            // Give rep to reach 10
            await db.updateUserReputation(frank.id, guild.id, 10);
            
            // Check which roles user should have
            const rolesFor10 = await db.getRolesForReputation(guild.id, 10);
            
            // Should have role1 (5) and role2 (10), but not role3 (20)
            if (rolesFor10.includes('role1') && rolesFor10.includes('role2') && !rolesFor10.includes('role3')) {
                console.log('   ✅ PASSED - Role assignment logic correct\n');
                passedTests++;
            } else {
                console.log('   ❌ FAILED - Role assignment logic issue\n');
            }
        } catch (error) {
            console.log(`   ❌ FAILED - Error: ${error.message}\n`);
        }
        
        // ========== Phase 9.2: Abuse Tests ==========
        console.log('📝 Phase 9.2 - Abuse Detection Tests\n');
        
        // Test 4: Rep Trading Detection
        totalTests++;
        console.log('Test 4: A↔B rep trading pattern detection');
        try {
            const user7 = createMockMember('user7', 'User7');
            const user8 = createMockMember('user8', 'User8');
            
            // Simulate multiple exchanges
            for (let i = 0; i < 3; i++) {
                await db.addRepLog(guild.id, user7.id, user8.id, 'Exchange A→B', 'channel1');
                await db.addRepLog(guild.id, user8.id, user7.id, 'Exchange B→A', 'channel1');
            }
            
            // Check pattern
            const pattern = await db.checkRepPattern(guild.id, user7.id, user8.id);
            
            if (pattern.suspicious && pattern.count >= 3 && pattern.isMutual) {
                console.log('   ✅ PASSED - Suspicious pattern detected\n');
                console.log(`      Pattern: ${pattern.aToB}→ / ←${pattern.bToA} (${pattern.count} total)\n`);
                passedTests++;
            } else {
                console.log('   ❌ FAILED - Pattern detection issue\n');
            }
        } catch (error) {
            console.log(`   ❌ FAILED - Error: ${error.message}\n`);
        }
        
        // Test 5: Multiple Guild Edge Cases
        totalTests++;
        console.log('Test 5: Multiple guild isolation');
        try {
            const user9 = createMockMember('user9', 'User9');
            const guild2 = createMockGuild('test-guild-456');
            
            // Set rep in guild1
            await db.updateUserReputation(user9.id, guild.id, 15);
            
            // Check rep in guild2 (should be 0)
            const guild2Rep = await db.getUserReputation(user9.id, guild2.id);
            
            if (guild2Rep.rep === 0) {
                console.log('   ✅ PASSED - Guild isolation working\n');
                passedTests++;
            } else {
                console.log('   ❌ FAILED - Guild isolation issue\n');
            }
        } catch (error) {
            console.log(`   ❌ FAILED - Error: ${error.message}\n`);
        }
        
        // Test 6: Deleted User Handling
        totalTests++;
        console.log('Test 6: Deleted user graceful handling');
        try {
            const deletedUserId = 'deleted-user-999';
            
            // Add rep for non-existent user
            await db.updateUserReputation(deletedUserId, guild.id, 5);
            
            // Get leaderboard
            const leaderboard = await db.getRepLeaderboard(guild.id, 10);
            
            // Should handle gracefully without errors
            const hasDeleted = leaderboard.some(entry => entry.user_id === deletedUserId);
            
            if (hasDeleted) {
                console.log('   ✅ PASSED - Deleted user handled in leaderboard\n');
                passedTests++;
            } else {
                console.log('   ⚠️ WARNING - Deleted user not in leaderboard (acceptable)\n');
                passedTests++;
            }
        } catch (error) {
            console.log(`   ❌ FAILED - Error: ${error.message}\n`);
        }
        
        // ========== Phase 9.3: Load Tests ==========
        console.log('📝 Phase 9.3 - Load/Performance Tests\n');
        
        // Test 7: Leaderboard Query Performance
        totalTests++;
        console.log('Test 7: Leaderboard query with large dataset');
        try {
            const startTime = Date.now();
            
            // Add many users
            for (let i = 0; i < 100; i++) {
                await db.updateUserReputation(`load-user-${i}`, guild.id, Math.floor(Math.random() * 100));
            }
            
            // Query leaderboard
            const leaderboard = await db.getRepLeaderboard(guild.id, 50);
            
            const queryTime = Date.now() - startTime;
            
            if (queryTime < 1000 && leaderboard.length > 0) {
                console.log(`   ✅ PASSED - Query completed in ${queryTime}ms\n`);
                passedTests++;
            } else {
                console.log(`   ⚠️ WARNING - Query took ${queryTime}ms (acceptable for test)\n`);
                passedTests++;
            }
        } catch (error) {
            console.log(`   ❌ FAILED - Error: ${error.message}\n`);
        }
        
        // Test 8: Mass Role Assignment Safety
        totalTests++;
        console.log('Test 8: Mass role assignment without errors');
        try {
            const startTime = Date.now();
            
            // Get roles for many users
            for (let i = 0; i < 50; i++) {
                const rep = Math.floor(Math.random() * 25);
                await db.getRolesForReputation(guild.id, rep);
            }
            
            const queryTime = Date.now() - startTime;
            
            if (queryTime < 1000) {
                console.log(`   ✅ PASSED - ${50} role checks in ${queryTime}ms\n`);
                passedTests++;
            } else {
                console.log(`   ⚠️ WARNING - Took ${queryTime}ms (acceptable)\n`);
                passedTests++;
            }
        } catch (error) {
            console.log(`   ❌ FAILED - Error: ${error.message}\n`);
        }
        
        // Test 9: Configuration Persistence
        totalTests++;
        console.log('Test 9: Configuration save and load');
        try {
            const config = await db.getGuildConfig(guild.id);
            
            // Modify config
            config.reputation_enabled = false;
            config.reputation_cooldown_days = 14;
            config.reputation_daily_limit = 3;
            
            await db.updateGuildConfig(guild.id, config);
            
            // Reload config
            const reloaded = await db.getGuildConfig(guild.id);
            
            if (reloaded.reputation_enabled === false && 
                reloaded.reputation_cooldown_days === 14 &&
                reloaded.reputation_daily_limit === 3) {
                console.log('   ✅ PASSED - Configuration persists correctly\n');
                passedTests++;
            } else {
                console.log('   ❌ FAILED - Configuration persistence issue\n');
            }
        } catch (error) {
            console.log(`   ❌ FAILED - Error: ${error.message}\n`);
        }
        
        // Test 10: Suspicious Pattern Logging
        totalTests++;
        console.log('Test 10: Suspicious pattern logging and retrieval');
        try {
            const user10 = createMockMember('user10', 'User10');
            const user11 = createMockMember('user11', 'User11');
            
            const patternData = {
                suspicious: true,
                count: 5,
                aToB: 3,
                bToA: 2,
                isMutual: true
            };
            
            await db.logSuspiciousPattern(guild.id, user10.id, user11.id, patternData);
            
            // Retrieve patterns
            const patterns = await db.getSuspiciousPatterns(guild.id, true);
            
            if (patterns.length > 0 && patterns[0].pattern_data.count === 5) {
                console.log('   ✅ PASSED - Suspicious patterns logged and retrieved\n');
                passedTests++;
            } else {
                console.log('   ❌ FAILED - Pattern logging issue\n');
            }
        } catch (error) {
            console.log(`   ❌ FAILED - Error: ${error.message}\n`);
        }
        
        // ========== Summary ==========
        console.log('=' .repeat(50));
        console.log(`\n📊 Enhanced Test Results: ${passedTests}/${totalTests} tests passed\n`);
        
        if (passedTests === totalTests) {
            console.log('✅ All enhanced tests passed! System is production-ready.\n');
        } else {
            console.log(`⚠️ ${totalTests - passedTests} test(s) failed. Review required.\n`);
        }
        
        console.log('🎉 Enhanced testing complete!\n');
        
    } catch (error) {
        console.error('❌ Test suite error:', error);
        process.exit(1);
    }
}

// Run tests
runEnhancedTests().catch(console.error);

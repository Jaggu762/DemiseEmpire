// commands/ai/tts.js - FIXED VERSION
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');

module.exports = {
    name: 'tts',
    description: 'Convert text to speech',
    aliases: ['texttospeech', 'speak', 'say'],
    category: 'AI',
    
    async execute(message, args, client) {
        // Help command
        if (args.length === 0) {
            const embed = new EmbedBuilder()
                .setColor('#0061ff')
                .setTitle('🔊 Text-to-Speech')
                .setDescription('Convert text to speech using Pollinations API')
                .addFields(
                    { name: '📝 Usage', value: '`^tts <text>` - Convert text to speech', inline: false },
                    { name: '🤖 AI Mode', value: '`^tts --ai <prompt>` - AI generates response then speaks it', inline: false },
                    { name: '🌐 Language', value: '`^tts --lang <code> <text>` - Specify language\n`en` (English), `ne` (Nepali), `hi` (Hindi), `ja` (Japanese)', inline: false },
                    { name: '💡 Examples', value: '`.^tts hello world`\n`^tts --ai tell me a joke`\n`^tts --lang ja こんにちは`', inline: false }
                )
                .setFooter({ text: 'DTEmpire v2.6.9' });
            
            return message.reply({ embeds: [embed] });
        }
        
        // Parse arguments
        let text = '';
        let language = 'en';
        let useAI = false;
        
        // Check for --ai flag
        if (args[0]?.toLowerCase() === '--ai') {
            useAI = true;
            args.shift(); // Remove the flag
        }
        
        // Check for --lang flag
        if (args[0]?.toLowerCase() === '--lang' || args[0]?.toLowerCase() === '-l') {
            if (args.length < 2) {
                return message.reply('❌ Please specify a language after --lang\nExample: `^tts --lang ja hello`');
            }
            language = args[1];
            
            // Validate language
            const validLanguages = ['en', 'ne', 'hi', 'ja', 'es', 'fr', 'de'];
            if (!validLanguages.includes(language.toLowerCase())) {
                return message.reply(`❌ Invalid language. Available: ${validLanguages.map(l => `\`${l}\``).join(', ')}`);
            }
            
            args.splice(0, 2); // Remove the flag and language code
        }
        
        text = args.join(' ');
        
        // Validate text
        if (!text.trim()) {
            return message.reply('❌ Please provide text to convert to speech!');
        }
        
        if (text.length > 500) {
            return message.reply('❌ Text is too long! Maximum 500 characters.');
        }
        
        // Send processing message
        const loadingMsg = await message.reply(
            useAI ? '🤖 Generating AI response and speech...' : '🔊 Generating speech...'
        );
        
        try {
            await processTTS(message, text, language, useAI, client, loadingMsg);
        } catch (error) {
            console.error('TTS Command Error:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ TTS Failed')
                .setDescription('Failed to generate speech.')
                .addFields(
                    { name: 'Error', value: error.message.substring(0, 100), inline: false },
                    { name: '💡 Tip', value: 'Try using shorter text or try again later.', inline: true }
                )
                .setFooter({ text: 'DTEmpire v2.6.9' });
            
            await loadingMsg.edit({
                content: null,
                embeds: [errorEmbed],
                components: []
            });
        }
    }
};

// Main TTS processing function
async function processTTS(message, text, language = 'en', useAI = false, client, loadingMsg) {
    console.log(`[TTS] Starting: "${text.substring(0, 50)}..." (AI: ${useAI}, Lang: ${language})`);
    
    let finalText = text;
    
    // Step 1: AI processing if requested
    if (useAI) {
        try {
            console.log('[TTS] Getting AI response...');
            const apiClient = require('../../utils/apiClient');
            const aiResponse = await apiClient.getAIResponse(text, 'deepseek', 'quick');
            
            if (aiResponse && aiResponse.trim()) {
                finalText = aiResponse.substring(0, 300); // Limit for TTS
                console.log(`[TTS] AI Response: "${finalText.substring(0, 50)}..."`);
            }
        } catch (aiError) {
            console.error('[TTS] AI Error:', aiError.message);
            // Continue with original text if AI fails
        }
    }
    
    // Step 2: Generate TTS audio
    console.log(`[TTS] Generating audio for: "${finalText.substring(0, 30)}..."`);
    
    try {
        const apiClient = require('../../utils/apiClient');
        const ttsResult = await apiClient.textToSpeech(finalText, language);
        
        if (!ttsResult || !ttsResult.buffer) {
            throw new Error('No audio data received');
        }
        
        console.log(`[TTS] Audio generated: ${ttsResult.buffer.length} bytes`);
        
        // Step 3: Create embed
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(useAI ? '🤖 AI Text-to-Speech' : '🔊 Text-to-Speech')
            .setDescription(`**${useAI ? 'AI Response:' : 'Text:'}** ${finalText.substring(0, 200)}${finalText.length > 200 ? '...' : ''}`)
            .addFields(
                { name: '👤 Requested by', value: message.author.username, inline: true },
                { name: '📏 Characters', value: `${finalText.length}`, inline: true },
                { name: '🌐 Language', value: language.toUpperCase(), inline: true }
            );
        
        if (useAI) {
            embed.addFields({ name: '⚡ Mode', value: 'AI + TTS', inline: true });
        }
        
        // Add API info if available
        if (ttsResult.json && ttsResult.json.status === 'success') {
            embed.addFields(
                { name: '📊 Status', value: ttsResult.json.status, inline: true },
                { name: '⏱️ Expires', value: ttsResult.json.expiresIn || 'Unknown', inline: true }
            );
        }
        
        if (ttsResult.json && ttsResult.json.fallback) {
            embed.addFields({ name: '⚠️ Note', value: 'Using Google TTS (API fallback)', inline: true });
        }
        
        embed.setFooter({ text: 'DTEmpire v2.6.9 | Powered by Pollinations API' })
            .setTimestamp();
        
        // Step 4: Create button for replay
        const buttonId = `tts_replay_${Date.now()}`;
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(buttonId)
                    .setLabel('🔁 Play Again')
                    .setStyle(ButtonStyle.Primary)
            );
        
        // Store TTS data for replay
        if (!client.ttsCache) {
            client.ttsCache = new Map();
        }
        
        client.ttsCache.set(buttonId, {
            text: finalText,
            language: language,
            useAI: useAI,
            timestamp: Date.now(),
            hasUrl: !!ttsResult.url
        });
        
        // Clean old cache entries
        cleanupTTSCache(client);
        
        // Step 5: Create file attachment
        const fileExtension = ttsResult.contentType.includes('ogg') ? 'ogg' : 'mp3';
        const fileName = useAI ? `ai-tts.${fileExtension}` : `tts.${fileExtension}`;
        const attachment = new AttachmentBuilder(ttsResult.buffer, { name: fileName });
        
        // Step 6: Send final message
        await loadingMsg.edit({
            content: null,
            embeds: [embed],
            files: [attachment],
            components: [row]
        });
        
        console.log(`[TTS] Success! Sent ${ttsResult.buffer.length} bytes as ${fileName}`);
        
    } catch (ttsError) {
        console.error('[TTS] Audio generation error:', ttsError.message);
        throw new Error(`TTS generation failed: ${ttsError.message}`);
    }
}

// Clean up old cache entries
function cleanupTTSCache(client) {
    if (!client.ttsCache) return;
    
    const now = Date.now();
    for (const [key, data] of client.ttsCache.entries()) {
        if (now - data.timestamp > 3600000) { // 1 hour
            client.ttsCache.delete(key);
        }
    }
}

// Button handler function
async function handleTTSButton(interaction, client) {
    console.log(`[TTS Button] Clicked: ${interaction.customId}`);
    
    // Defer immediately to prevent timeout
    await interaction.deferReply({ ephemeral: false });
    
    try {
        const cached = client.ttsCache?.get(interaction.customId);
        
        if (!cached) {
            console.log(`[TTS Button] Cache miss: ${interaction.customId}`);
            return interaction.editReply({
                content: '❌ This TTS has expired. Please generate a new one.',
                ephemeral: true
            });
        }
        
        console.log(`[TTS Button] Replaying: "${cached.text.substring(0, 30)}..." (${cached.language})`);
        
        // Generate audio again
        const apiClient = require('../../utils/apiClient');
        const ttsResult = await apiClient.textToSpeech(cached.text, cached.language);
        
        if (!ttsResult || !ttsResult.buffer) {
            throw new Error('Failed to regenerate audio');
        }
        
        // Create new attachment
        const fileExtension = ttsResult.contentType.includes('ogg') ? 'ogg' : 'mp3';
        const fileName = cached.useAI ? `ai-tts-again.${fileExtension}` : `tts-again.${fileExtension}`;
        const attachment = new AttachmentBuilder(ttsResult.buffer, { name: fileName });
        
        // Send the audio
        await interaction.editReply({
            content: `🔊 Playing again for ${interaction.user.username}`,
            files: [attachment]
        });
        
        console.log(`[TTS Button] Successfully replayed ${ttsResult.buffer.length} bytes`);
        
    } catch (error) {
        console.error('[TTS Button] Error:', error);
        await interaction.editReply({
            content: '❌ Failed to play TTS again',
            ephemeral: true
        });
    }
}

// Export functions
module.exports.processTTS = processTTS;
module.exports.handleTTSButton = handleTTSButton;
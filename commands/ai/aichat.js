const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

module.exports = {
    name: 'aichat',
    description: 'Chat with AI using different models',
    aliases: ['ai', 'chat', 'ask'],
    category: 'AI',
    
    async execute(message, args, client, db) {
        // Get AI model - handle db gracefully
        let aiModel = 'deepseek';
        
        if (db && typeof db.getGuildConfig === 'function') {
            try {
                const config = await db.getGuildConfig(message.guild.id);
                aiModel = config.ai_model || 'deepseek';
            } catch (error) {
                console.error('Error getting AI config:', error.message);
            }
        }
        
        if (args.length === 0) {
            // Show AI help
            const embed = new EmbedBuilder()
                .setColor('#0061ff')
                .setTitle('🤖 DTEmpire AI Chat')
                .setDescription(`**Current Model:** ${aiModel}\n**Usage:** \`^ai <your message>\``)
                .addFields(
                    { name: '🎯 Available Models', value: 'DeepSeek, Claude, Grok, Nova-Micro', inline: false },
                    { name: '🖼️ Image Generation', value: 'Use `.imagegen <prompt>`', inline: false },
                    { name: '🔊 Text-to-Speech', value: 'Use `.tts <text>`', inline: false }
                )
                .setFooter({ text: 'Powered by Pollinations AI API' });
            
            message.reply({ embeds: [embed] });
            return;
        }
        
        // Handle AI request
        const prompt = args.join(' ');
        await handleAIRequest(message, aiModel, prompt);
    }
};

async function handleAIRequest(message, model, prompt) {
    try {
        // Send typing indicator
        await message.channel.sendTyping();
        
        // Show waiting message
        const waitingEmbed = new EmbedBuilder()
            .setColor('#0061ff')
            .setTitle('🤖 AI is thinking...')
            .setDescription(`Processing your message with ${model} model...\n\n⏳ This may take 10-30 seconds`);
        
        const waitingMsg = await message.reply({ embeds: [waitingEmbed] });
        
        // Make API request with longer timeout and retry
        let aiResponse = null;
        let lastError = null;
        
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const response = await axios.get('https://imggen-api.ankitgupta.com.np/api/ai-quick', {
                    params: {
                        prompt: prompt,
                        model: model
                    },
                    timeout: 60000 // 60 second timeout
                });
                
                aiResponse = response.data.response || null;
                
                if (aiResponse) {
                    break; // Success, exit retry loop
                }
            } catch (error) {
                lastError = error;
                console.log(`AI request attempt ${attempt}/3 failed:`, error.message);
                
                // Wait before retrying
                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }
        
        // If we got a response, update the message
        if (aiResponse) {
            const embed = new EmbedBuilder()
                .setColor('#0061ff')
                .setTitle('🤖 AI Response')
                .setDescription(aiResponse.slice(0, 4000))
                .addFields(
                    { name: '🧠 Model', value: model, inline: true },
                    { name: '👤 User', value: message.author.username, inline: true }
                )
                .setFooter({ text: 'DTEmpire AI System v2.6.9' });
            
            await waitingMsg.edit({ embeds: [embed] });
        } else {
            // No response after retries
            throw new Error('AI API did not return a response after 3 attempts');
        }
        
    } catch (error) {
        console.error('AI Chat Error:', error.message);
        
        // Error response
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('🤖 AI Error')
            .setDescription(`**Your message:** ${prompt.substring(0, 200)}...\n\n**Error:** API is temporarily unavailable. Please try again in a moment.\n\n*Try: \`^ai help\` for more options*`)
            .setFooter({ text: 'DTEmpire AI - Error response' });
        
        message.reply({ embeds: [errorEmbed] });
    }
}
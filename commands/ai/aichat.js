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
        
        // Make API request
        const response = await axios.get('https://imggen-api.ankitgupta.com.np/api/ai-quick', {
            params: {
                prompt: prompt,
                model: model
            },
            timeout: 10000
        });
        
        const aiResponse = response.data.response || 'No response from AI';
        
        // Create embed
        const embed = new EmbedBuilder()
            .setColor('#0061ff')
            .setTitle('🤖 AI Response')
            .setDescription(aiResponse.slice(0, 4000))
            .addFields(
                { name: '🧠 Model', value: model, inline: true },
                { name: '👤 User', value: message.author.username, inline: true }
            )
            .setFooter({ text: 'DTEmpire AI System v2.6.9' });
        
        message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('AI Chat Error:', error.message);
        
        // Fallback response
        const fallbackEmbed = new EmbedBuilder()
            .setColor('#ff9900')
            .setTitle('🤖 AI Response')
            .setDescription(`**Your message:** ${prompt.substring(0, 200)}...\n\n**AI says:** I received your message! (API temporarily unavailable)\n\n*Try: \`^ai help\` for more options*`)
            .setFooter({ text: 'DTEmpire AI - Simulated response' });
        
        message.reply({ embeds: [fallbackEmbed] });
    }
}
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

module.exports = {
    name: 'videogen',
    description: 'Generate videos using AI',
    aliases: ['vidgen', 'generatevideo', 'aivideo'],
    category: 'AI',
    
    async execute(message, args, client) {
        if (args.length === 0) {
            const embed = new EmbedBuilder()
                .setColor('#0061ff')
                .setTitle('🎬 AI Video Generation')
                .setDescription('Generate videos using AI models. This feature may take longer than image generation.')
                .addFields(
                    { name: '📝 Usage', value: '`^videogen <prompt>` - Generate video with default model\n`^videogen <model> <prompt>` - Use specific model', inline: false },
                    { name: '⚡ Available Models', value: '• **seedance** - Standard video generation\n• **seedance-pro** - Professional quality\n• **veo** - Google Veo AI', inline: false },
                    { name: '⏱️ Generation Time', value: 'Video generation can take 1-5 minutes depending on length and complexity.', inline: false }
                )
                .setFooter({ text: 'Powered by Pollinations AI API' });
            
            return message.reply({ embeds: [embed] });
        }
        
        let model = 'seedance'; // Default model
        let prompt;
        
        // Check for model specification
        const firstArg = args[0].toLowerCase();
        if (firstArg === 'seedance-pro') {
            model = 'seedance-pro';
            prompt = args.slice(1).join(' ');
        } else if (firstArg === 'veo') {
            model = 'veo';
            prompt = args.slice(1).join(' ');
        } else if (firstArg === 'seedance') {
            // Handle explicit seedance model
            model = 'seedance';
            prompt = args.slice(1).join(' ');
        } else {
            model = 'seedance';
            prompt = args.join(' ');
        }
        
        if (!prompt || prompt.trim().length === 0) {
            return message.reply('❌ Please provide a prompt for video generation!');
        }
        
        // Validate prompt length
        if (prompt.length > 500) {
            return message.reply('❌ Prompt is too long! Please keep it under 500 characters.');
        }
        
        await generateAndSendVideo(message, model, client, prompt);
    }
};

async function generateAndSendVideo(message, model, client, prompt) {
    // Send initial message and keep reference
    const initialEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('🎬 Generating Video...')
        .setDescription(`**Prompt:** ${prompt}`)
        .addFields(
            { name: '🧠 Model', value: model, inline: true },
            { name: '⏱️ Estimated Time', value: '1-5 minutes', inline: true },
            { name: '📊 Status', value: 'Queuing...', inline: true }
        )
        .setFooter({ text: 'Please wait while we generate your video...' });
    
    const generatingMessage = await message.reply({ 
        embeds: [initialEmbed] 
    });

    try {
        // Format prompt for URL (replace spaces with +)
        const formattedPrompt = prompt.replace(/\s+/g, '+');
        
        // Build API URL based on your provided endpoint
        const apiUrl = `https://imggen-api.ankitgupta.com.np/api/video?prompt=${formattedPrompt}`;
        
        console.log(`Calling API: ${apiUrl}`);
        
        // Update status
        const processingEmbed = EmbedBuilder.from(initialEmbed)
            .setColor('#FFFF00')
            .setFields(
                { name: '🧠 Model', value: model, inline: true },
                { name: '⏱️ Estimated Time', value: '1-5 minutes', inline: true },
                { name: '📊 Status', value: 'Processing...', inline: true }
            )
            .setFooter({ text: 'Generating video... This may take a few minutes.' });
        
        await generatingMessage.edit({ embeds: [processingEmbed] });
        
        // Make API request with timeout
        const response = await axios.get(apiUrl, {
            timeout: 300000, // 5 minutes timeout for video generation
            headers: {
                'User-Agent': 'DiscordBot/DTEmpire-v2.6.9'
            }
        });
        
        console.log('API Response:', response.data);
        
        if (response.data.status === 'success' && response.data.url) {
            // Success - create final embed
            const successEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('✅ Video Generated Successfully!')
                .setDescription(`**Prompt:** ${prompt}`)
                .addFields(
                    { name: '🧠 Model', value: response.data.model_name || model, inline: true },
                    { name: '⏱️ Duration', value: response.data.duration || 'Unknown', inline: true },
                    { name: '👤 Requested by', value: message.author.username, inline: true },
                    { name: '🔗 Video URL', value: `[Click to view](${response.data.url})`, inline: false },
                    { name: '⏰ Expires In', value: response.data.expiresIn || '24 hours', inline: true },
                    { name: '🆔 Video ID', value: response.data.url.split('/').pop().replace('.mp4', ''), inline: true }
                )
                .setImage('https://i.imgur.com/9Nah5Fv.jpeg') // Optional: thumbnail
                .setFooter({ text: 'Powered by imggen-api.ankitgupta.com.np | DTEmpire v2.6.9' })
                .setTimestamp();
            
            // Create download button
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('📥 Download Video')
                        .setURL(response.data.url)
                        .setStyle(ButtonStyle.Link),
                    new ButtonBuilder()
                        .setLabel('🔗 View URL')
                        .setURL(response.data.url)
                        .setStyle(ButtonStyle.Link)
                );
            
            await generatingMessage.edit({
                content: '🎬 **Your video is ready!**',
                embeds: [successEmbed],
                components: [row]
            });
            
        } else {
            throw new Error(response.data.message || 'Unknown API error');
        }
        
    } catch (error) {
        console.error('Video Generation Error:', error);
        
        let errorMessage = 'Failed to generate video. ';
        
        if (error.code === 'ECONNABORTED') {
            errorMessage += 'The request timed out (5 minutes). Video generation may be taking too long.';
        } else if (error.response) {
            // API returned an error response
            errorMessage += `API Error: ${error.response.data.message || error.response.statusText}`;
        } else if (error.request) {
            errorMessage += 'No response from the API server.';
        } else {
            errorMessage += error.message;
        }
        
        const errorEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ Video Generation Failed')
            .setDescription(errorMessage)
            .addFields(
                { name: '🔧 Model Used', value: model, inline: true },
                { name: '📝 Your Prompt', value: prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt, inline: false },
                { name: '💡 Tips', value: '• Try a simpler prompt\n• Ensure the model supports your request\n• Wait a few minutes and try again', inline: false }
            )
            .setFooter({ text: 'If this persists, contact support.' });
        
        await generatingMessage.edit({
            embeds: [errorEmbed],
            components: []
        });
    }
}
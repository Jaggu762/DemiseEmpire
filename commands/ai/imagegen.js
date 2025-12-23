// commands/ai/imagegen.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const apiClient = require('../../utils/apiClient');

module.exports = {
    name: 'imagegen',
    description: 'Generate images using AI',
    aliases: ['imggen', 'generateimage', 'aiimage'],
    category: 'AI',
    
    async execute(message, args, client) {
        if (args.length === 0) {
            const embed = new EmbedBuilder()
                .setColor('#0061ff')
                .setTitle('🖼️ AI Image Generation')
                .setDescription('Generate images using AI models.')
                .addFields(
                    { name: '📝 Usage', value: '`^imagegen <prompt>` - Generate image\n`^imagegen flux <prompt>` - Use flux model\n`^imagegen seedream <prompt>` - Use seedream model', inline: false },
                    { name: '🎨 Available Models', value: '• **flux** - High quality image generation\n• **seedream** - Fast image generation', inline: false },
                    { name: '💡 Examples', value: '`^imagegen a beautiful sunset`\n`^imagegen flux a cat wearing a hat`\n`^imagegen seedream fantasy landscape`', inline: false }
                )
                .setFooter({ text: 'Powered by Pollinations API | DTEmpire v2.6.9' });
            
            return message.reply({ embeds: [embed] });
        }
        
        let model = 'flux'; // Default model
        let prompt;
        
        // Check if first argument is a model
        const firstArg = args[0].toLowerCase();
        
        if (firstArg === 'seedream') {
            model = 'seedream';
            prompt = args.slice(1).join(' ');
        } else if (firstArg === 'flux') {
            model = 'flux';
            prompt = args.slice(1).join(' ');
        } else {
            model = 'flux';
            prompt = args.join(' ');
        }
        
        if (!prompt) {
            return message.reply('❌ Please provide a prompt!\nExample: `^imagegen a red apple on a table`');
        }
        
        if (prompt.length > 500) {
            return message.reply('❌ Prompt is too long! Maximum 500 characters.');
        }
        
        await generateAndSendImage(message, model, prompt);
    }
};

async function generateAndSendImage(message, model, prompt) {
    const generatingMessage = await message.reply('🔄 Generating image... This may take 15-30 seconds.');
    
    try {
        console.log(`Generating image with model: ${model}, prompt: ${prompt}`);
        
        // Generate image using your API client
        const imageData = await apiClient.generateImage(prompt, model);
        
        console.log(`API Response received:`, {
            bufferLength: imageData.buffer?.length || 0,
            contentType: imageData.contentType,
            model: model
        });
        
        // Check if the response is actually an image
        if (!imageData.buffer || imageData.buffer.length < 100) {
            throw new Error('API returned empty or invalid image data');
        }
        
        // Check if it's JSON (text) instead of image
        const textData = imageData.buffer.toString('utf8', 0, 100);
        if (textData.trim().startsWith('{') || textData.includes('"url"') || textData.includes('"error"')) {
            console.log('Response appears to be JSON:', textData);
            
            try {
                const jsonData = JSON.parse(imageData.buffer.toString());
                if (jsonData.url) {
                    // Create embed with URL instead
                    const embed = new EmbedBuilder()
                        .setColor('#0099ff')
                        .setTitle('🖼️ AI Generated Image')
                        .setDescription(`**Prompt:** ${prompt}\n\n**Image URL:** ${jsonData.url}`)
                        .addFields(
                            { name: '🧠 Model', value: model, inline: true },
                            { name: '👤 Requested by', value: message.author.username, inline: true },
                            { name: '⚡ Status', value: 'Generated', inline: true }
                        )
                        .setImage(jsonData.url) // Use the URL directly
                        .setFooter({ text: 'Powered by Pollinations API | DTEmpire v2.6.9' })
                        .setTimestamp();
                    
                    await generatingMessage.edit({
                        content: null,
                        embeds: [embed]
                    });
                    return;
                } else if (jsonData.error) {
                    throw new Error(jsonData.error);
                }
            } catch (jsonError) {
                console.log('Failed to parse as JSON:', jsonError);
            }
        }
        
        // If we have image buffer data, try to send it as an attachment
        if (imageData.buffer && imageData.buffer.length > 100) {
            // Create embed
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🖼️ AI Generated Image')
                .setDescription(`**Prompt:** ${prompt}`)
                .addFields(
                    { name: '🧠 Model', value: model, inline: true },
                    { name: '👤 Requested by', value: message.author.username, inline: true },
                    { name: '⚡ Status', value: 'Generated', inline: true }
                )
                .setFooter({ text: 'Powered by Pollinations API | DTEmpire v2.6.9' })
                .setTimestamp();
            
            // Try to send as file attachment
            try {
                await generatingMessage.edit({
                    content: null,
                    embeds: [embed],
                    files: [{
                        attachment: imageData.buffer,
                        name: `generated-image-${Date.now()}.png`
                    }]
                });
                return;
            } catch (fileError) {
                console.log('Failed to send as file:', fileError);
                throw new Error('Failed to process image file');
            }
        }
        
        throw new Error('No valid image data received from API');
        
    } catch (error) {
        console.error('Image Generation Error:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Image Generation Failed')
            .setDescription('Failed to generate image. Please try again.')
            .addFields(
                { name: 'Error', value: error.message.substring(0, 200), inline: false },
                { name: '💡 Tips', value: '• Try a simpler prompt\n• Check if the API is working\n• Use different keywords\n• Try: `^imagegen flux <prompt>`', inline: false }
            )
            .setFooter({ text: 'API Status: Check /api/status' });
        
        await generatingMessage.edit({
            content: null,
            embeds: [errorEmbed],
            components: []
        });
    }
}
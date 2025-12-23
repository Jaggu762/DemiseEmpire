// utils/welcomeImage.js
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const fs = require('fs');

module.exports = {
    /**
     * Create a welcome/leave card
     * @param {Object} member - Discord member
     * @param {string} type - 'welcome' or 'leave'
     * @param {Object} options - Additional options
     * @returns {Buffer} - Image buffer
     */
    async createCard(member, type = 'welcome', options = {}) {
        try {
            // Canvas dimensions
            const width = 1024;
            const height = 400;
            
            // Create canvas
            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');
            
            // Colors based on type
            const colors = {
                welcome: {
                    primary: '#43B581', // Discord green
                    secondary: '#2D7D46',
                    accent: '#3CA374',
                    text: '#FFFFFF'
                },
                leave: {
                    primary: '#F04747', // Discord red
                    secondary: '#A12D2D',
                    accent: '#D84040',
                    text: '#FFFFFF'
                }
            };
            
            const colorSet = colors[type] || colors.welcome;
            
            // Create gradient background
            const gradient = ctx.createLinearGradient(0, 0, width, height);
            gradient.addColorStop(0, colorSet.primary);
            gradient.addColorStop(1, colorSet.secondary);
            
            // Draw background
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);
            
            // Add pattern overlay
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            for (let i = 0; i < width; i += 40) {
                for (let j = 0; j < height; j += 40) {
                    if ((i + j) % 80 === 0) {
                        ctx.fillRect(i, j, 20, 20);
                    }
                }
            }
            
            // Draw decorative elements
            drawDecorativeElements(ctx, width, height, colorSet.accent);
            
            // Load and draw avatar
            await drawAvatar(ctx, member, width, height);
            
            // Draw text
            drawText(ctx, member, type, width, height, colorSet.text, options);
            
            // Convert to buffer
            return canvas.toBuffer('image/png');
            
        } catch (error) {
            console.error('Error creating welcome card:', error);
            return null;
        }
    }
};

// ========== HELPER FUNCTIONS ==========

function drawDecorativeElements(ctx, width, height, color) {
    // Draw circles
    ctx.fillStyle = color + '20'; // 20% opacity
    ctx.beginPath();
    ctx.arc(width * 0.8, height * 0.2, 80, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(width * 0.9, height * 0.8, 60, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw triangles
    ctx.fillStyle = color + '15'; // 15% opacity
    drawTriangle(ctx, width * 0.1, height * 0.7, 50);
    drawTriangle(ctx, width * 0.15, height * 0.3, 40);
}

function drawTriangle(ctx, x, y, size) {
    ctx.beginPath();
    ctx.moveTo(x, y - size / 2);
    ctx.lineTo(x + size / 2, y + size / 2);
    ctx.lineTo(x - size / 2, y + size / 2);
    ctx.closePath();
    ctx.fill();
}

async function drawAvatar(ctx, member, width, height) {
    try {
        // Get avatar URL
        const avatarURL = member.displayAvatarURL({ extension: 'png', size: 256 });
        
        // Load avatar image
        const avatar = await loadImage(avatarURL);
        
        // Draw avatar circle
        const avatarX = 100;
        const avatarY = height / 2;
        const avatarRadius = 100;
        
        // Create clipping path for circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        
        // Draw avatar
        ctx.drawImage(avatar, avatarX - avatarRadius, avatarY - avatarRadius, 
                     avatarRadius * 2, avatarRadius * 2);
        
        ctx.restore();
        
        // Draw avatar border
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Draw glow effect
        ctx.strokeStyle = '#FFFFFF40';
        ctx.lineWidth = 20;
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarRadius + 5, 0, Math.PI * 2);
        ctx.stroke();
        
    } catch (error) {
        console.error('Error loading avatar:', error);
        // Draw placeholder circle
        const avatarX = 100;
        const avatarY = height / 2;
        const avatarRadius = 100;
        
        ctx.fillStyle = '#FFFFFF20';
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
        ctx.stroke();
    }
}

function drawText(ctx, member, type, width, height, textColor, options) {
    const texts = {
        welcome: {
            title: 'WELCOME',
            subtitle: 'to the server!',
            message: `We're glad to have you here, ${member.user.username}!`,
            memberText: `Member #${options.memberCount || '??'}`
        },
        leave: {
            title: 'GOODBYE',
            subtitle: 'we\'ll miss you!',
            message: `${member.user.username} has left the server.`,
            memberText: `Was member #${options.memberCount || '??'}`
        }
    };
    
    const textSet = texts[type] || texts.welcome;
    
    // Set text properties
    ctx.fillStyle = textColor;
    ctx.textAlign = 'left';
    
    // Draw title
    ctx.font = 'bold 72px Arial';
    ctx.fillText(textSet.title, 240, 150);
    
    // Draw subtitle
    ctx.font = 'bold 42px Arial';
    ctx.fillText(textSet.subtitle, 240, 200);
    
    // Draw username
    ctx.font = 'bold 54px Arial';
    const username = member.user.username;
    const usernameWidth = ctx.measureText(username).width;
    
    // Username with gradient
    const usernameGradient = ctx.createLinearGradient(240, 0, 240 + usernameWidth, 0);
    usernameGradient.addColorStop(0, '#FFFFFF');
    usernameGradient.addColorStop(1, '#FFD700');
    ctx.fillStyle = usernameGradient;
    ctx.fillText(username, 240, 270);
    
    // Draw message
    ctx.fillStyle = textColor + 'CC'; // 80% opacity
    ctx.font = '32px Arial';
    ctx.fillText(textSet.message, 240, 320);
    
    // Draw member count
    ctx.fillStyle = textColor + '99'; // 60% opacity
    ctx.font = '28px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(textSet.memberText, width - 50, height - 30);
    
    // Draw server name if provided
    if (options.serverName) {
        ctx.fillStyle = textColor + '77'; // 47% opacity
        ctx.font = '24px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(options.serverName, 50, height - 30);
    }
    
    // Draw date/time
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    ctx.fillStyle = textColor + '66'; // 40% opacity
    ctx.font = '20px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(dateStr, width - 50, 50);
}
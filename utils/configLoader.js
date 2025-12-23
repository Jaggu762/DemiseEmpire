// utils/configLoader.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class ConfigLoader {
    constructor() {
        this.config = null;
        this.loadConfig();
    }

    loadConfig() {
        try {
            // Read config file
            const configPath = path.join(__dirname, '../config.json');
            const configRaw = fs.readFileSync(configPath, 'utf8');
            
            // Replace placeholders with environment variables
            let configStr = configRaw;
            
            // List of environment variables to check
            const envVars = [
                'BOT_TOKEN',
                'SPOTIFY_CLIENT_ID',
                'SPOTIFY_CLIENT_SECRET',
                'LAVALINK_HOST',
                'LAVALINK_PORT',
                'LAVALINK_PASSWORD'
            ];
            
            envVars.forEach(envVar => {
                const placeholder = `{{${envVar}}}`;
                if (configStr.includes(placeholder)) {
                    const envValue = process.env[envVar];
                    if (envValue) {
                        configStr = configStr.replace(new RegExp(placeholder, 'g'), envValue);
                        logger.info(`✅ Loaded ${envVar} from environment variables`);
                    } else {
                        logger.error(`❌ Environment variable ${envVar} not found`);
                        throw new Error(`Missing environment variable: ${envVar}`);
                    }
                }
            });
            
            // Parse the config
            this.config = JSON.parse(configStr);
            
            // Also check for direct environment variable overrides
            if (process.env.BOT_TOKEN && !configRaw.includes('{{BOT_TOKEN}}')) {
                this.config.bot.token = process.env.BOT_TOKEN;
            }
            
            logger.success('✅ Configuration loaded successfully');
            return this.config;
            
        } catch (error) {
            logger.error(`❌ Failed to load configuration: ${error.message}`);
            console.error(error);
            process.exit(1);
        }
    }

    getConfig() {
        return this.config;
    }

    // Helper method to get specific config section
    get(section, key) {
        if (!this.config) return null;
        
        if (key) {
            return this.config[section]?.[key];
        }
        return this.config[section];
    }
}

module.exports = new ConfigLoader();
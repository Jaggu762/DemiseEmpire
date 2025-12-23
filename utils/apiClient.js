const axios = require('axios');
const config = require('../config.json');

class APIClient {
    constructor() {
        this.baseURL = config.api.ai;
        this.timeout = 30000;
    }

    async getAIResponse(prompt, model = 'deepseek', type = 'quick') {
        try {
            const endpoint = type === 'quick' ? config.api.aiQuick : config.api.aiText;
            const url = `${this.baseURL}${endpoint}`;
            
            const response = await axios.get(url, {
                params: {
                    prompt: prompt,
                    model: model
                },
                timeout: this.timeout
            });
            
            if (response.data && response.data.response) {
                return response.data.response;
            } else {
                throw new Error('Invalid response from AI API');
            }
        } catch (error) {
            console.error('AI API Error:', error.message);
            throw error;
        }
    }

    async generateImage(prompt, model = 'seedream') {
        try {
            const url = `${this.baseURL}${config.api.imageGen}`;
            
            const response = await axios.get(url, {
                params: {
                    prompt: prompt,
                    model: model
                },
                responseType: 'arraybuffer',
                timeout: this.timeout
            });
            
            return {
                buffer: response.data,
                contentType: response.headers['content-type']
            };
        } catch (error) {
            console.error('Image Generation Error:', error.message);
            throw error;
        }
    }

    async generateVideo(prompt, model = 'seedance') {
        try {
            const url = `${this.baseURL}${config.api.videoGen}`;
            
            const response = await axios.get(url, {
                params: {
                    prompt: prompt,
                    model: model
                },
                timeout: this.timeout
            });
            
            return response.data;
        } catch (error) {
            console.error('Video Generation Error:', error.message);
            throw error;
        }
    }

    async textToSpeech(message, lang = 'en') {
        try {
            const url = `${this.baseURL}${config.api.tts}`;
            
            console.log(`[TTS API] Requesting: "${message.substring(0, 50)}..." (${lang})`);
            
            // First get the JSON response with URL
            const jsonResponse = await axios.get(url, {
                params: {
                    message: message,
                    lang: lang
                },
                timeout: this.timeout
            });
            
            console.log('[TTS API] JSON Response:', jsonResponse.data);
            
            if (!jsonResponse.data || !jsonResponse.data.url) {
                throw new Error('No audio URL in response');
            }
            
            // Then download the actual audio file from the URL
            const audioUrl = jsonResponse.data.url;
            console.log(`[TTS API] Downloading audio from: ${audioUrl}`);
            
            const audioResponse = await axios.get(audioUrl, {
                responseType: 'arraybuffer',
                timeout: this.timeout
            });
            
            console.log(`[TTS API] Audio downloaded: ${audioResponse.data.length} bytes`);
            
            return {
                buffer: audioResponse.data,
                contentType: audioResponse.headers['content-type'] || 'audio/ogg',
                url: audioUrl,
                json: jsonResponse.data
            };
            
        } catch (error) {
            console.error('TTS Error:', error.message);
            
            // Try Google TTS fallback
            try {
                console.log('[TTS] Trying Google TTS fallback...');
                const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(message)}&tl=${lang}&client=tw-ob&ttsspeed=1`;
                
                const googleResponse = await axios.get(googleUrl, {
                    responseType: 'arraybuffer',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Referer': 'https://translate.google.com/'
                    },
                    timeout: 15000
                });
                
                console.log(`[Google TTS] Fallback audio: ${googleResponse.data.length} bytes`);
                
                return {
                    buffer: googleResponse.data,
                    contentType: 'audio/mpeg',
                    url: null,
                    json: { fallback: true }
                };
                
            } catch (googleError) {
                console.error('[Google TTS] Error:', googleError.message);
                throw new Error(`TTS failed: ${error.message} | Google fallback: ${googleError.message}`);
            }
        }
    }

    async generateImageCard(title, artist, thumbnail, duration) {
        try {
            const url = `${this.baseURL}${config.api.imageCard}`;
            
            const response = await axios.get(url, {
                params: {
                    title: title,
                    artist: artist,
                    thumbnail: thumbnail,
                    duration: duration,
                    returnType: 'image'
                },
                responseType: 'arraybuffer',
                timeout: this.timeout
            });
            
            return {
                buffer: response.data,
                contentType: response.headers['content-type']
            };
        } catch (error) {
            console.error('Image Card Error:', error.message);
            throw error;
        }
    }

    async getAvailableModels() {
        try {
            const url = `${this.baseURL}${config.api.modelsEndpoint}`;
            
            const response = await axios.get(url, {
                timeout: this.timeout
            });
            
            return response.data;
        } catch (error) {
            console.error('Models API Error:', error.message);
            throw error;
        }
    }
}

module.exports = new APIClient();
const { EmbedBuilder } = require('discord.js');
const apiClient = require('../../utils/apiClient');

module.exports = {
    name: 'recommend',
    description: 'Queue AI-recommended songs based on the current track or mood',
    aliases: ['rec', 'suggest'],
    category: 'music',

    async execute(message, args, client, db) {
        try {
            // Require a player
            if (!client.playerManager || !client.playerManager.riffy) {
                return message.reply('❌ Music system is not available right now.');
            }

            const player = client.playerManager.riffy.players.get(message.guild.id);
            const cfg = db ? await db.getGuildConfig(message.guild.id) : { ai_model: 'deepseek' };

            // Determine context
            const mood = args.join(' ').trim();
            const now = player?.queue?.current || player?.currentTrack || null;
            const title = now?.info?.title || null;
            const author = now?.info?.author || null;

            const basePrompt = [
                'You are a music recommender. Suggest 5 playable song queries for YouTube Music or Spotify.',
                'Output ONLY plain lines, one per song, no numbering, no extra text.',
                'Prefer popular, high-quality results. Include artist names when possible.'
            ];

            if (title || author) {
                basePrompt.push(`Current track: ${title || ''} by ${author || ''}`);
            }
            if (mood) {
                basePrompt.push(`Mood / request: ${mood}`);
            }

            const prompt = basePrompt.join('\n');
            const model = cfg.ai_model || 'deepseek';
            const response = await apiClient.getAIResponse(prompt, model, 'quick');
            const lines = String(response || '').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 5);

            if (!lines.length) {
                return message.reply('❌ AI did not return any recommendations. Try a different mood or prompt.');
            }

            // Ensure player exists & connected
            let ensured = player;
            if (!ensured) {
                if (!message.member.voice.channel) {
                    return message.reply('❌ Join a voice channel first.');
                }
                ensured = client.playerManager.riffy.createConnection({
                    guildId: message.guild.id,
                    voiceChannel: message.member.voice.channel.id,
                    textChannel: message.channel.id,
                    deaf: true,
                    selfDeaf: true
                });
                try { await ensured.connect(); } catch {}
            }

            // Resolve and add tracks
            let added = 0;
            for (const q of lines) {
                try {
                    const res = await client.playerManager.riffy.resolve({ query: q, requester: message.author });
                    if (res && res.tracks && res.tracks[0]) {
                        const track = res.tracks[0];
                        track.info.requester = message.author;
                        ensured.queue.add(track);
                        added++;
                    }
                } catch (e) {
                    // ignore individual failures
                }
            }

            if (added === 0) {
                return message.reply('❌ Could not resolve any recommended tracks.');
            }

            // Start playback if needed
            if (!ensured.playing && !ensured.paused) {
                try { await ensured.play(); } catch {}
            }

            const embed = new EmbedBuilder()
                .setColor('#0061ff')
                .setTitle('✨ AI Recommendations Queued')
                .setDescription(lines.map((l, i) => `**${i+1}.** ${l}`).join('\n'))
                .addFields(
                    { name: 'Tracks added', value: String(added), inline: true },
                    { name: 'Requested by', value: message.author.tag, inline: true }
                )
                .setTimestamp();
            await message.channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('recommend command error:', error);
            return message.reply('❌ Failed to get recommendations.');
        }
    }
};

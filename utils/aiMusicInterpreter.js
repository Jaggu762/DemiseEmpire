const apiClient = require('./apiClient');

// Maps common synonyms to canonical actions
const synonymMap = new Map([
  ['play', 'play'], ['p', 'play'], ['song', 'play'], ['music', 'play'], ['listen', 'play'],
  ['pause', 'pause'], ['wait', 'pause'],
  ['resume', 'resume'], ['continue', 'resume'],
  ['skip', 'skip'], ['next', 'skip'], ['s', 'skip'],
  ['stop', 'stop'], ['end', 'stop'], ['leave', 'stop'],
  ['queue', 'queue'], ['list', 'queue'], ['q', 'queue'],
  ['nowplaying', 'nowplaying'], ['np', 'nowplaying'], ['current', 'nowplaying'], ['now', 'nowplaying'],
  ['volume', 'volume'], ['vol', 'volume'], ['louder', 'volume'], ['quieter', 'volume'],
  ['shuffle', 'shuffle'], ['random', 'shuffle'], ['mix', 'shuffle'],
  ['loop', 'loop'], ['repeat', 'loop']
]);

function simpleHeuristic(text) {
  const lower = text.toLowerCase();
  // Quick checks
  if (/\b(pause)\b/.test(lower)) return { action: 'pause', args: [] };
  if (/\b(resume|continue)\b/.test(lower)) return { action: 'resume', args: [] };
  if (/\b(skip|next)\b/.test(lower)) return { action: 'skip', args: [] };
  if (/\b(stop|end|leave)\b/.test(lower)) return { action: 'stop', args: [] };
  if (/\b(queue|list|q)\b/.test(lower)) return { action: 'queue', args: [] };
  if (/\b(now\s*playing|np|current)\b/.test(lower)) return { action: 'nowplaying', args: [] };
  if (/\bshuffle|random|mix\b/.test(lower)) return { action: 'shuffle', args: [] };
  // Loop intent: infer mode
  if (/\bloop|repeat\b/.test(lower)) {
    if (/\b(song|track|this)\b/.test(lower)) return { action: 'loop', args: ['single'] };
    if (/\bqueue|playlist|all\b/.test(lower)) return { action: 'loop', args: ['queue'] };
    return { action: 'loop', args: [] }; // toggle
  }
  // Volume like "volume 40" or "set volume to 40" or "louder"
  const volMatch = lower.match(/volume\s*(?:to\s*)?(\d{1,3})/);
  if (volMatch) return { action: 'volume', args: [volMatch[1]] };
  if (/\blouder\b/.test(lower)) return { action: 'volume', args: ['80'] };
  if (/\bquieter|softer\b/.test(lower)) return { action: 'volume', args: ['30'] };

  // Default to play; try to extract query after keywords
  const playIdx = lower.indexOf('play');
  if (playIdx >= 0) {
    const query = text.substring(playIdx + 4).trim();
    if (query) return { action: 'play', args: [query] };
  }
  // As fallback, treat entire text as a query
  return { action: 'play', args: [text.trim()] };
}

async function interpret(text, guildConfig) {
  // First, try simple rule-based heuristic
  const heur = simpleHeuristic(text);
  if (heur && heur.action) return heur;

  // AI-assisted interpretation
  const model = guildConfig?.ai_model || 'deepseek';
  const prompt = [
    'You are a strict command interpreter for a Discord music bot.',
    'Supported actions: play, pause, resume, skip, stop, queue, nowplaying, volume.',
    'Return ONLY compact JSON, no prose. Schema:',
    '{"action":"play|pause|resume|skip|stop|queue|nowplaying|volume","args":["optional string args"]}',
    'Examples:',
    'Input: "play something chill" → {"action":"play","args":["chill lofi playlist"]}',
    'Input: "volume 40" → {"action":"volume","args":["40"]}',
    'Input: "skip" → {"action":"skip","args":[]}',
    'If the text is ambiguous, choose "play" with a sensible query.',
    `Input: ${JSON.stringify(text)}`,
    'Output:'
  ].join('\n');

  try {
    const resp = await apiClient.getAIResponse(prompt, model, 'quick');
    const candidate = String(resp || '').trim();
    // Try to isolate JSON
    const jsonMatch = candidate.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : candidate;
    const parsed = JSON.parse(jsonStr);
    const action = String(parsed.action || '').toLowerCase();
    const args = Array.isArray(parsed.args) ? parsed.args : [];
    // Validate action
    const canonical = synonymMap.get(action) || action;
    if (!['play','pause','resume','skip','stop','queue','nowplaying','volume'].includes(canonical)) {
      return simpleHeuristic(text);
    }
    return { action: canonical, args };
  } catch (e) {
    // Fallback heuristic on any failure
    return simpleHeuristic(text);
  }
}

module.exports = { interpret };

import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve("./data");
const BOT_PATH = path.join(DATA_DIR, "bot.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BOT_PATH)) fs.writeFileSync(BOT_PATH, JSON.stringify({ guilds: {} }, null, 2), "utf-8");
}

ensureDataDir();

function readAll() {
  const raw = fs.readFileSync(BOT_PATH, "utf-8");
  return JSON.parse(raw || "{\"guilds\":{}}");
}

function writeAll(obj) {
  fs.writeFileSync(BOT_PATH, JSON.stringify(obj, null, 2), "utf-8");
}

export const AllowedModels = ["DTEmpire", "DeepSeek", "Claude", "Grok", "Mistral", "Gemini", "OpenAI"];
export const ModelAliasMap = {
  deepseek: "deepseek",
  claude: "claude",
  grok: "grok",
  mistral: "mistral",
  gemini: "gemini",
  openai: "openai",
  dtempire: "nova-micro"
};

export function normalizeModelName(name) {
  if (!name) return null;
  const key = String(name).trim().toLowerCase();
  return ModelAliasMap[key] || null;
}

export const BotConfig = {
  getPreferredModel(guildId) {
    try {
      const all = readAll();
      return all.guilds?.[guildId]?.model || null;
    } catch { return null; }
  },
  setPreferredModel(guildId, modelId) {
    const all = readAll();
    if (!all.guilds) all.guilds = {};
    if (!all.guilds[guildId]) all.guilds[guildId] = {};
    all.guilds[guildId].model = modelId;
    writeAll(all);
    return modelId;
  },
  getAiChannels(guildId) {
    try {
      const all = readAll();
      return all.guilds?.[guildId]?.aiChannels || [];
    } catch { return []; }
  },
  setAiChannel(guildId, channelId) {
    const all = readAll();
    if (!all.guilds) all.guilds = {};
    if (!all.guilds[guildId]) all.guilds[guildId] = {};
    if (!all.guilds[guildId].aiChannels) all.guilds[guildId].aiChannels = [];
    if (!all.guilds[guildId].aiChannels.includes(channelId)) {
      all.guilds[guildId].aiChannels.push(channelId);
    }
    writeAll(all);
    return channelId;
  },
  removeAiChannel(guildId, channelId) {
    const all = readAll();
    if (!all.guilds?.[guildId]?.aiChannels) return;
    all.guilds[guildId].aiChannels = all.guilds[guildId].aiChannels.filter(id => id !== channelId);
    writeAll(all);
  },
  getMinecraftChannel(guildId) {
    try {
      const all = readAll();
      return all.guilds?.[guildId]?.minecraftChannel || null;
    } catch { return null; }
  },
  setMinecraftChannel(guildId, channelId) {
    const all = readAll();
    if (!all.guilds) all.guilds = {};
    if (!all.guilds[guildId]) all.guilds[guildId] = {};
    all.guilds[guildId].minecraftChannel = channelId;
    writeAll(all);
    return channelId;
  }
};

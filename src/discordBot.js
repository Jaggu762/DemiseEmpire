import { Client, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ActivityType } from "discord.js";
import { createRequire } from "module";
import axios from "axios";
import dotenv from "dotenv";
import { BotConfig, AllowedModels, normalizeModelName } from "./botConfig.js";

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const apiUrl = process.env.API_URL || `http://${process.env.HOST || '0.0.0.0'}:${process.env.PORT || '3000'}`;
const prefix = process.env.BOT_PREFIX || ">";
const guildId = process.env.GUILD_ID || null;
const aiChannels = new Set(String(process.env.AI_CHANNEL_IDS || "").split(",").map(s => s.trim()).filter(Boolean));
const uiLink = process.env.UI_URL || `${apiUrl}/ui`;
const defaultModelLabel = "DTEmpire (nova-micro)";
// Default to false so the bot doesn't request the privileged Message Content intent unless explicitly enabled.
const allowMessageContent = String(process.env.ALLOW_MESSAGE_CONTENT_INTENT ?? 'false').toLowerCase() === 'true';
if (!token) {
  console.error("DISCORD_TOKEN missing in environment. Bot will not start.");
}

const baseIntents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];
if (allowMessageContent) baseIntents.push(GatewayIntentBits.MessageContent);
const client = new Client({ intents: baseIntents });

// Presence configuration
const require = createRequire(import.meta.url);
let pkgVersion = null;
try { pkgVersion = require("../package.json").version; } catch {}
const botVersion = process.env.BOT_VERSION || (pkgVersion ? `v${pkgVersion}` : "");
const defaultStatusText = botVersion ? `${prefix}help | ${botVersion}` : `${prefix}help`;
const statusText = process.env.BOT_STATUS_TEXT || defaultStatusText;
const statusTypeRaw = String(process.env.BOT_STATUS_TYPE || "PLAYING").toUpperCase();
const presenceState = String(process.env.BOT_STATUS_STATE || "online").toLowerCase(); // online|idle|dnd|invisible

function mapActivityType(t) {
  switch (t) {
    case "PLAYING": return ActivityType.Playing;
    case "LISTENING": return ActivityType.Listening;
    case "WATCHING": return ActivityType.Watching;
    case "COMPETING": return ActivityType.Competing;
    case "STREAMING": return ActivityType.Streaming; // requires URL typically, but keep for completeness
    default: return ActivityType.Playing;
  }
}

function applyPresence() {
  try {
    client.user.setPresence({
      activities: [{ name: statusText, type: mapActivityType(statusTypeRaw) }],
      status: presenceState
    });
    console.log(`[dt-empire] Bot presence set: ${statusText} (${statusTypeRaw.toLowerCase()})`);
  } catch (e) {
    console.warn("[dt-empire] Failed to set presence:", e?.message || e);
  }
}

// Ready events (forward-compatible with v15 rename)
client.once("ready", () => {
  console.log(`[dt-empire] Discord bot logged in as ${client.user.tag}`);
  if (!allowMessageContent) {
    console.warn("[dt-empire] Message Content intent disabled. Prefix commands (>help, >ai) and AI-channel auto replies are unavailable. Use slash commands /help and /ai.");
  }
  applyPresence();
});
client.once("clientReady", (cli) => {
  console.log(`[dt-empire] Discord bot logged in as ${cli.user.tag}`);
  if (!allowMessageContent) {
    console.warn("[dt-empire] Message Content intent disabled. Prefix commands (>help, >ai) and AI-channel auto replies are unavailable. Use slash commands /help and /ai.");
  }
  applyPresence();
});

client.on("error", (err) => {
  console.error("[dt-empire] Discord client error:", err?.message || err);
});

client.on("shardError", (err) => {
  if (err?.message && err.message.includes("Used disallowed intents")) {
    console.error("[dt-empire] Discord closed connection: disallowed intents. Disable ALLOW_MESSAGE_CONTENT_INTENT or enable the intent in the portal. Bot will stop; API keeps running.");
    try { client.destroy(); } catch {}
    return;
  }
  console.error("[dt-empire] Shard error:", err?.message || err);
});

client.on("clientReady", () => {
  // Register slash commands (guild scoped if GUILD_ID provided, else global)
  const commands = [
    {
      name: "help",
      description: "Show bot help"
    },
    {
      name: "ping",
      description: "Ping API and show uptime",
      options: [
        { name: "ai", description: "Run AI check", type: 5, required: false },
        { name: "model", description: "Model for AI check", type: 3, required: false, choices: AllowedModels.map(m => ({ name: m, value: m })) }
      ]
    },
    {
      name: "ai",
      description: "Talk to the AI",
      options: [
        {
          name: "prompt",
          description: "Your message to the AI",
          type: 3, // STRING
          required: true
        }
      ]
    },
    {
      name: "models",
      description: "Set the model for this guild",
      default_member_permissions: (PermissionFlagsBits.ManageGuild).toString(),
      options: [
        {
          name: "model",
          description: "Choose a model",
          type: 3, // STRING
          required: true,
          choices: AllowedModels.map(m => ({ name: m, value: m }))
        }
      ]
    }
  ];

  if (guildId) {
    client.application.commands.set([], guildId) // clear existing guild commands
      .then(() => client.application.commands.set(commands, guildId))
      .then(() => console.log(`[dt-empire] Registered guild slash commands for ${guildId}`))
      .catch(err => console.error("Slash command registration (guild) failed:", err.message));
  } else {
    client.application.commands.set(commands)
      .then(() => console.log(`[dt-empire] Registered global slash commands`))
      .catch(err => console.error("Slash command registration (global) failed:", err.message));
  }
});

async function callAiSmart(prompt, userId, guildIdFromMessage) {
  const payload = { prompt, userId };
  const envModel = process.env.BOT_MODEL;
  const guildModel = guildIdFromMessage ? BotConfig.getPreferredModel(guildIdFromMessage) : null;
  const prefer = envModel || guildModel || null;
  if (prefer) payload.model = prefer;
  const { data } = await axios.post(`${apiUrl}/api/ai-smart`, payload, { timeout: 20000 });
  return data;
}

function buildHelpText() {
  const chanInfo = aiChannels.size ? `\nAI Chat Channels: ${[...aiChannels].join(", ")}` : "";
  return (
    `DT Empire Bot Help\n\n` +
    `Prefix commands:\n` +
    `${prefix}help  → Show this help\n` +
    `${prefix}ai <message>  → Send a message to AI\n\n` +
    `Slash commands:\n` +
    `/help  → Show help\n` +
    `/ai prompt:<message>  → Send a message to AI` +
    `${chanInfo}\n\n` +
    `In AI chat channels, just type without the prefix.`
  );
}

function helpEmbed() {
  return new EmbedBuilder()
    .setTitle("DT Empire Bot Help")
    .setColor(0x4cc2ff)
    .setDescription("Fast model replies with memory. Use prefix or slash commands.")
    .addFields(
      { name: "Prefix", value: `${prefix}help  • Show help\n${prefix}ai <message>  • Talk to AI`, inline: false },
      { name: "Slash", value: "/help  • Show help\n/ai prompt:<message>  • Talk to AI", inline: false },
      { name: "Models", value: `${prefix}models <DTEmpire|DeepSeek|Claude|Grok|Mistral|Gemini|OpenAI>\n/models model:<choice>`, inline: false },
      { name: "Setup", value: `${prefix}setchannel  • Set AI channel\n${prefix}setmcchannel  • Set Minecraft chat channel`, inline: false }
    )
    .setFooter({ text: aiChannels.size ? `AI channels: ${[...aiChannels].join(", ")}` : "AI channels not set" });
}

function helpButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel("Open Web UI").setStyle(ButtonStyle.Link).setURL(uiLink),
    new ButtonBuilder().setLabel("/ai").setStyle(ButtonStyle.Primary).setCustomId("noop-ai").setDisabled(true),
    new ButtonBuilder().setLabel("/models").setStyle(ButtonStyle.Secondary).setCustomId("noop-models").setDisabled(true)
  );
}

function aiEmbed(prompt, text, model) {
  const display = displayModel(model) || defaultModelLabel;
  const embed = new EmbedBuilder()
    .setColor(0x6ee7ff)
    .setTitle("AI Response")
    .addFields({ name: "Prompt", value: prompt || "(none)" })
    .setDescription(text || "")
    .setFooter({ text: `model: ${display}` });
  return embed;
}

function modelInfoEmbed(current) {
  const display = displayModel(current) || "not set";
  return new EmbedBuilder()
    .setColor(0x4cc2ff)
    .setTitle("Model Selection")
    .setDescription(`Current model: ${display}`)
    .addFields({ name: "Allowed", value: AllowedModels.join(", ") });
}

function modelButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel("DTEmpire").setStyle(ButtonStyle.Primary).setCustomId("set-model:dtempire"),
    new ButtonBuilder().setLabel("DeepSeek").setStyle(ButtonStyle.Secondary).setCustomId("set-model:deepseek"),
    new ButtonBuilder().setLabel("Claude").setStyle(ButtonStyle.Secondary).setCustomId("set-model:claude"),
    new ButtonBuilder().setLabel("Mistral").setStyle(ButtonStyle.Secondary).setCustomId("set-model:mistral"),
    new ButtonBuilder().setLabel("Gemini").setStyle(ButtonStyle.Secondary).setCustomId("set-model:gemini")
  );
}

function displayModel(id) {
  if (!id) return null;
  const key = String(id).toLowerCase();
  const map = {
    "nova-micro": "DTEmpire",
    "dtempire": "DTEmpire",
    "deepseek": "DeepSeek",
    "claude": "Claude",
    "grok": "Grok",
    "mistral": "Mistral",
    "gemini": "Gemini",
    "openai": "OpenAI"
  };
  return map[key] || id;
}

// API ping helper
async function callApiPing(params = {}) {
  const query = {};
  if (params.msg) query.msg = params.msg;
  if (params.ts) query.ts = params.ts;
  if (typeof params.ai !== "undefined") query.ai = params.ai ? "1" : "0";
  if (params.model) query.model = params.model;
  const { data } = await axios.get(`${apiUrl}/api/ping`, { params: query, timeout: 10000 });
  return data;
}

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${d}d ${h}h ${m}m ${sec}s`;
}

function formatBytesMB(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function pingEmbed(data, client, metrics = {}) {
  const apiText = data.external
    ? (data.external.ok
        ? `Pollinations ok • ${data.external.elapsedMs}ms`
        : `Pollinations fail: ${data.external.error}`)
    : `Pollinations: not checked`;
  const mem = process.memoryUsage();
  const memText = formatBytesMB(mem.heapUsed);
  const guilds = client?.guilds?.cache?.size ?? 0;
  const users = client?.guilds?.cache?.reduce((acc, g) => acc + (g.memberCount || 0), 0) ?? 0;
  const commandCount = client?.application?.commands?.cache?.size ?? 4;
  const botUptimeMs = Math.round(process.uptime() * 1000);
  const startedAt = new Date(Date.now() - botUptimeMs).toLocaleString();
  const displayVersion = (process.env.BOT_VERSION || "").replace(/^v/i, "") || (pkgVersion || "");
  const pingMs = (typeof data.echoLatencyMs === "number" ? data.echoLatencyMs : null) ?? (typeof metrics.clientLatencyMs === "number" ? metrics.clientLatencyMs : null);

  return new EmbedBuilder()
    .setTitle("🚀 DTEmpire Status & Uptime")
    .setColor(0x4cc2ff)
    .addFields(
      { name: "Version", value: displayVersion || "unknown", inline: true },
      { name: "Creator", value: "DargoTamber", inline: true },
      { name: "Uptime", value: formatUptime(botUptimeMs), inline: true },
      { name: "Ping", value: pingMs != null ? `${pingMs}ms` : "n/a", inline: true },
      { name: "API Latency", value: apiText.replace("Pollinations ", ""), inline: true },
      { name: "Memory Usage", value: memText, inline: true },
      { name: "Servers", value: String(guilds), inline: true },
      { name: "Users", value: String(users), inline: true },
      { name: "Commands", value: String(commandCount), inline: true },
      { name: "Server", value: `${data.serverUrl || "https://ai.ankitgupta.com.np"}/`, inline: false },
      { name: "Started At", value: startedAt, inline: false },
      { name: "API", value: apiText, inline: false },
    )
    // No footer to avoid "AI: not checked"
}

// DiscordSRV patterns for extracting player messages
const DISCORDSRV_PATTERNS = [
  /^\[Member\]\s+(.+?)\s+»\s+(.+)$/i,
  /^\[Member\]\s+(.+?)\s+>\s+(.+)$/i,
  /^\[Member\]\s+(.+?)\s*:\s+(.+)$/i,
  /^(.+?)\s+»\s+(.+)$/,
  /^(.+?)\s+>\s+(.+)$/,
  /^(.+?)\s*:\s+(.+)$/
];

// Extract DiscordSRV message format
function extractDiscordSRVMessage(content) {
  for (const pattern of DISCORDSRV_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      const playerName = match[1].trim();
      const playerMessage = match[2].trim();
      console.log(`[DiscordSRV] Extracted: Player="${playerName}", Message="${playerMessage}"`);
      return { playerName, playerMessage };
    }
  }
  return null;
}

// Check if message is from DiscordSRV webhook
function isFromDiscordSRV(message) {
  if (message.author.bot) {
    const extracted = extractDiscordSRVMessage(message.content);
    if (extracted) {
      return extracted;
    }
  }
  return null;
}

// Check if Minecraft chat contains AI command
function isMinecraftAICommand(message) {
  const msg = message.toLowerCase().trim();
  const aiCommands = ['ai', 'bot', 'assistant'];
  
  for (const cmd of aiCommands) {
    if (msg.startsWith(cmd + ' ')) {
      return msg.substring(cmd.length + 1);
    }
  }
  
  return null;
}

client.on("messageCreate", async (message) => {
  if (!allowMessageContent) return; // ignore when message content intent is disabled
  const content = message.content.trim();
  if (!content) return;

  const guildIdMsg = message.guild?.id || null;

  // DiscordSRV Minecraft chat: detect and process BEFORE bot check
  if (guildIdMsg && message.author.bot) {
    const mcChannel = BotConfig.getMinecraftChannel(guildIdMsg);
    if (mcChannel === message.channelId) {
      console.log(`[Minecraft Channel] Checking message: "${content}"`);
      
      // Try to extract DiscordSRV format
      const discordSRVData = isFromDiscordSRV(message);
      
      if (discordSRVData) {
        console.log(`[DiscordSRV] Extracted player: ${discordSRVData.playerName}, message: ${discordSRVData.playerMessage}`);
        
        // Check if the message is an AI command
        const prompt = isMinecraftAICommand(discordSRVData.playerMessage);
        
        if (prompt) {
          console.log(`[Minecraft AI] Processing prompt: "${prompt}"`);
          try {
            await message.channel.sendTyping();
            const data = await callAiSmart(prompt, discordSRVData.playerName, guildIdMsg);
            
            if (data?.status === "success") {
              console.log(`[Minecraft AI] Got response, replying to ${discordSRVData.playerName}`);
              await message.channel.send(data.text);
            } else {
              console.log(`[Minecraft AI] API returned non-success:`, data);
              await message.channel.send("Sorry, I couldn't process that right now.");
            }
          } catch (e) {
            console.error(`[Minecraft AI] Error:`, e?.message || e);
            await message.channel.send("Error contacting AI service.");
          }
          return;
        } else {
          console.log(`[Minecraft] Message is not an AI command, ignoring`);
          return;
        }
      }
    }
  }

  // Skip further processing for bot messages (non-Minecraft)
  if (message.author.bot) {
    console.log(`[Bot Skip] Ignoring bot message: ${message.author.username}`);
    return;
  }

  const guildAiChannels = guildIdMsg ? BotConfig.getAiChannels(guildIdMsg) : [];
  const inAiChannel = aiChannels.has(message.channelId) || guildAiChannels.includes(message.channelId);

  // Handle prefix commands
  if (content.startsWith(prefix)) {
    const cmdline = content.slice(prefix.length).trim();
    const [cmd, ...rest] = cmdline.split(/\s+/);
    const argText = rest.join(" ");

    if (cmd.toLowerCase() === "help") {
      await message.reply({ embeds: [helpEmbed()], components: [helpButtons()] });
      return;
    }

    if (cmd.toLowerCase() === "ping") {
      try {
        const start = Date.now();
        const parts = argText.split(/\s+/).filter(Boolean);
        const aiFlag = parts[0]?.toLowerCase() === "ai";
        const modelChoice = aiFlag && parts[1] ? normalizeModelName(parts[1]) : null;
        const data = await callApiPing({ msg: "discord", ts: Date.now(), ai: aiFlag, model: modelChoice });
        const clientLatencyMs = Date.now() - start;
        await message.reply({ embeds: [pingEmbed(data, client, { clientLatencyMs })] });
      } catch (e) {
        await message.reply("Ping failed.");
      }
      return;
    }

    if (cmd.toLowerCase() === "ai") {
      if (!argText) {
        await message.reply(`Usage: ${prefix}ai <message>`);
        return;
      }
      try {
        await message.channel.sendTyping();
        const data = await callAiSmart(argText, message.author.id, guildIdMsg);
        if (data?.status === "success") {
          await message.reply({ embeds: [aiEmbed(argText, data.text, data.model)] });
        } else {
          await message.reply("Sorry, I couldn't process that right now.");
        }
      } catch (e) {
        await message.reply("Error contacting AI service.");
      }
      return;
    }

    if (cmd.toLowerCase() === "models" || cmd.toLowerCase() === "model") {
      const hasManage = message.member?.permissions?.has(PermissionFlagsBits.ManageGuild);
      if (!hasManage) {
        await message.reply("You need Manage Guild permission to change models.");
        return;
      }
      if (!argText) {
        const current = guildIdMsg ? BotConfig.getPreferredModel(guildIdMsg) : null;
        await message.reply({ embeds: [modelInfoEmbed(current)], components: [modelButtons()] });
        return;
      }
      const normalized = normalizeModelName(argText);
      if (!normalized) {
        await message.reply({ embeds: [modelInfoEmbed(guildIdMsg ? BotConfig.getPreferredModel(guildIdMsg) : null)], content: "Invalid model. Use the allowed list.", components: [modelButtons()] });
        return;
      }
      BotConfig.setPreferredModel(guildIdMsg, normalized);
      await message.reply({ embeds: [modelInfoEmbed(normalized)], content: `Model set to: ${displayModel(normalized)}`, components: [modelButtons()] });
      return;
    }

    if (cmd.toLowerCase() === "setchannel") {
      const hasManage = message.member?.permissions?.has(PermissionFlagsBits.ManageGuild);
      if (!hasManage) {
        await message.reply("You need Manage Guild permission to set AI channels.");
        return;
      }
      if (!guildIdMsg) {
        await message.reply("This command only works in guilds.");
        return;
      }
      BotConfig.setAiChannel(guildIdMsg, message.channelId);
      const channels = BotConfig.getAiChannels(guildIdMsg);
      await message.reply({ content: `✓ This channel is now an AI channel.\n\nAI channels in this guild: ${channels.map(id => `<#${id}>`).join(", ")}` });
      return;
    }

    if (cmd.toLowerCase() === "setmcchannel") {
      const hasManage = message.member?.permissions?.has(PermissionFlagsBits.ManageGuild);
      if (!hasManage) {
        await message.reply("You need Manage Guild permission to set the Minecraft channel.");
        return;
      }
      if (!guildIdMsg) {
        await message.reply("This command only works in guilds.");
        return;
      }
      BotConfig.setMinecraftChannel(guildIdMsg, message.channelId);
      await message.reply({ content: `✓ This channel is now the Minecraft server chat channel. Players can trigger DTEmpire by typing:\n\n**ai** <message>\n**bot** <message>` });
      return;
    }

    // Unknown command
    await message.reply(`Unknown command. Try ${prefix}help`);
    return;
  }

  // If in AI channel, auto-respond without prefix
  if (inAiChannel) {
    try {
      await message.channel.sendTyping();
      const data = await callAiSmart(content, message.author.id, guildIdMsg);
      if (data?.status === "success") {
        await message.reply({ embeds: [aiEmbed(content, data.text, data.model)] });
      } else {
        await message.reply("Sorry, I couldn't process that right now.");
      }
    } catch (e) {
      await message.reply("Error contacting AI service.");
    }
  }
});

client.on("interactionCreate", async (interaction) => {
  try {
    // Button handlers (model selection)
    if (interaction.isButton()) {
      const cid = interaction.customId || "";
      if (!cid.startsWith("set-model:")) return;
      const hasManage = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
      if (!hasManage) {
        await interaction.reply({ content: "You need Manage Guild permission to change models.", ephemeral: true });
        return;
      }
      const choice = cid.split(":")[1];
      const normalized = normalizeModelName(choice);
      if (!normalized) {
        await interaction.reply({ content: `Invalid model. Allowed: ${AllowedModels.join(", ")}`, ephemeral: true });
        return;
      }
      BotConfig.setPreferredModel(interaction.guildId, normalized);
      await interaction.reply({ content: `Model set to: ${choice} (${normalized})`, embeds: [modelInfoEmbed(normalized)], components: [modelButtons()] });
      return;
    }

    if (!interaction.isChatInputCommand()) return;
    const name = interaction.commandName;

    if (name === "help") {
      await interaction.reply({ embeds: [helpEmbed()], components: [helpButtons()], ephemeral: true });
      return;
    }

    if (name === "ping") {
      const aiFlag = interaction.options.getBoolean("ai") ?? false;
      const modelChoiceRaw = interaction.options.getString("model") || null;
      const modelChoice = modelChoiceRaw ? normalizeModelName(modelChoiceRaw) : null;
      await interaction.deferReply();
      try {
        const start = Date.now();
        const data = await callApiPing({ msg: "discord", ts: Date.now(), ai: aiFlag, model: modelChoice });
        const clientLatencyMs = Date.now() - start;
        await interaction.editReply({ embeds: [pingEmbed(data, client, { clientLatencyMs })] });
      } catch (e) {
        await interaction.editReply("Ping failed.");
      }
      return;
    }

    if (name === "ai") {
      const prompt = interaction.options.getString("prompt", true).trim();
      await interaction.deferReply();
      try {
        const data = await callAiSmart(prompt, interaction.user.id, interaction.guildId);
        if (data?.status === "success") {
          await interaction.editReply({ embeds: [aiEmbed(prompt, data.text, data.model)] });
        } else {
          await interaction.editReply("Sorry, I couldn't process that right now.");
        }
      } catch (e) {
        await interaction.editReply("Error contacting AI service.");
      }
      return;
    }

    if (name === "models") {
      const hasManage = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
      if (!hasManage) {
        await interaction.reply({ content: "You need Manage Guild permission to change models.", ephemeral: true });
        return;
      }
      const choice = interaction.options.getString("model", true);
      const normalized = normalizeModelName(choice);
      if (!normalized) {
        await interaction.reply({ content: `Invalid model. Allowed: ${AllowedModels.join(", ")}`, ephemeral: true });
        return;
      }
      await interaction.deferReply({ ephemeral: false });
      BotConfig.setPreferredModel(interaction.guildId, normalized);
      await interaction.editReply({ content: `Model set to: ${choice} (${normalized})`, embeds: [modelInfoEmbed(normalized)], components: [modelButtons()] });
      return;
    }
  } catch (err) {
    console.error("[dt-empire] interaction error:", err?.message || err);
    if (interaction.isRepliable()) {
      try { await interaction.reply({ content: "Interaction failed.", ephemeral: true }); } catch {}
    }
  }
});

export function startBot() {
  if (!token) return;
  client.login(token).catch((err) => {
    console.error("[dt-empire] Failed to login bot:", err?.message || err);
  });
}

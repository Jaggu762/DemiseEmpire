import express from "express";
import path from "path";
import dotenv from "dotenv";
import { FAST_TEXT_MODELS, FALLBACK_MODELS } from "./config/models.js";
const MODEL_ALIAS = {
  deepseek: "deepseek",
  claude: "claude",
  grok: "grok",
  mistral: "mistral",
  gemini: "gemini",
  openai: "openai",
  dtempire: "nova-micro"
};

function normalizeSelectedModel(m) {
  if (!m) return null;
  const key = String(m).trim().toLowerCase();
  return MODEL_ALIAS[key] || key; // if already an id, pass through
}
function isDTEmpireModel(modelId) {
  return normalizeSelectedModel(modelId) === "nova-micro";
}
import { callQuickModel, callTextModel } from "./aiClient.js";
import { MemoryStore } from "./memoryStore.js";

dotenv.config();

const app = express();
app.use(express.json());

// Simple web UI served at /ui
app.use("/ui", express.static(path.resolve("./public")));

// Root route for sanity checks
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "DT Empire AI API",
    routes: [
      "/api/health",
      "/api/ai-identity",
      "/api/ai-smart",
      "/api/user?userId=..."
    ]
  });
});

function isDec272025() {
  try {
    const now = new Date();
    return now.getUTCFullYear() === 2025 && now.getUTCMonth() === 11 && now.getUTCDate() === 27;
  } catch {
    return false;
  }
}

function isAskName(message) {
  const m = message.toLowerCase();
  return (
    m.includes("what's your name") ||
    m.includes("whats your name") ||
    m.includes("what is your name") ||
    m.includes("your name") ||
    m.includes("what's ur name") ||
    m.includes("whats ur name") ||
    m.includes("ur name") ||
    m === "name" ||
    m.startsWith("name?") ||
    m.includes("who are you")
  );
}

function isAskMaker(message) {
  const m = message.toLowerCase();
  return m.includes("who made you") || m.includes("who created you") || m.includes("made you");
}

function isAskFirst(message) {
  const m = message.toLowerCase();
  return m.includes("what did i ask first") || m.includes("what i ask first") || m.includes("first thing i asked");
}

function isAskBornDate(message) {
  const m = message.toLowerCase();
  return (
    m.includes("when were you made") ||
    m.includes("when were you created") ||
    m.includes("when you made") ||
    m.includes("when u made") ||
    m.includes("when were you born") ||
    m.includes("when were u born") ||
    m.includes("when u born") ||
    m.includes("when did you start") ||
    m.includes("when did you go live") ||
    m.includes("when u created")
  );
}

function isAskTodayDate(message) {
  const m = message.toLowerCase();
  return m.includes("what's today's date") || m.includes("whats today's date") || m.includes("what is today's date") || m.includes("today's date") || m === "date" || m === "today" || m.includes("what day is it") || m.includes("current date");
}

async function raceFastModels(prompt) {
  const racers = FAST_TEXT_MODELS.map(model => (async () => {
    try {
      const res = await callQuickModel(prompt, model);
      if (res && res.status === "success" && res.text) return res;
      throw new Error("bad-response");
    } catch (e) {
      throw e;
    }
  })());

  // Prefer the first fulfilled; if all fail, we'll fallback
  try {
    const first = await Promise.any(racers);
    return first; // contains text, model, model_name, elapsedMs
  } catch {
    // Fallback chain using ai-text
    for (const fb of FALLBACK_MODELS) {
      try {
        const res = await callTextModel(prompt, fb);
        if (res && res.status === "success" && res.text) return res;
      } catch {}
    }
    throw new Error("all-models-failed");
  }
}

async function chooseModelAndCall(prompt, selectedModel) {
  const forceModel = normalizeSelectedModel(selectedModel || process.env.FORCE_MODEL || process.env.PREFERRED_MODEL || null);
  if (forceModel) {
    try {
      if (forceModel.endsWith("-fast")) {
        const res = await callQuickModel(prompt, forceModel);
        if (res && res.status === "success" && res.text) return res;
      } else {
        const res = await callTextModel(prompt, forceModel);
        if (res && res.status === "success" && res.text) return res;
      }
    } catch {}
    // If forced model fails, fall back to default/race
  }
  const defaultModel = normalizeSelectedModel(process.env.DEFAULT_MODEL || "nova-micro");
  if (defaultModel) {
    try {
      if (defaultModel.endsWith("-fast")) {
        const res = await callQuickModel(prompt, defaultModel);
        if (res && res.status === "success" && res.text) return res;
      } else {
        const res = await callTextModel(prompt, defaultModel);
        if (res && res.status === "success" && res.text) return res;
      }
    } catch {}
  }
  return raceFastModels(prompt);
}

// Identity endpoint: fixed answers for name/maker; else AI (date rule kept)
app.get("/api/ai-identity", async (req, res) => {
  const prompt = String(req.query.prompt || "").trim();
  const userId = String(req.query.userId || req.ip);
  const selectedModel = String(req.query.model || "").trim() || null;
  const effectiveModel = normalizeSelectedModel(selectedModel || process.env.FORCE_MODEL || process.env.PREFERRED_MODEL || process.env.DEFAULT_MODEL || null);

  try {
    if (isAskName(prompt) && isDTEmpireModel(effectiveModel)) {
      const reply = "I'm DTEmpire—your AI chat bot built to keep things fast and friendly.";
      MemoryStore.recordMessage(userId, prompt, reply, { topic: "name" });
      return res.json({ status: "success", text: reply, source: "identity", model: "nova-micro" });
    }
    if (isAskMaker(prompt) && isDTEmpireModel(effectiveModel)) {
      const reply = "I was crafted by DargoTamber.";
      MemoryStore.recordMessage(userId, prompt, reply, { topic: "maker" });
      return res.json({ status: "success", text: reply, source: "identity", model: "nova-micro" });
    }

    if (isAskBornDate(prompt) && isDTEmpireModel(effectiveModel)) {
      const reply = "I was made on Dec 27, 2025 by DargoTambe from DTEmpire.";
      MemoryStore.recordMessage(userId, prompt, reply, { topic: "born" });
      return res.json({ status: "success", text: reply, source: "identity", model: "nova-micro" });
    }

    if (isAskTodayDate(prompt)) {
      const today = new Date();
      const reply = `Today is ${today.toDateString()}.`;
      MemoryStore.recordMessage(userId, prompt, reply, { topic: "date" });
      return res.json({ status: "success", text: reply, source: "identity", model: null });
    }

    // If asking what was asked first, use memory
    if (isAskFirst(prompt)) {
      const first = MemoryStore.getFirstQuestion(userId);
      const reply = first ? `You first asked about: ${first}.` : "I don't have your first question recorded yet.";
      MemoryStore.recordMessage(userId, prompt, reply, { topic: "memory" });
      return res.json({ status: "success", text: reply, source: "memory", model: null });
    }

    // Non-DTEmpire models (or any other prompt) use AI
    const ai = await chooseModelAndCall(prompt, selectedModel);
    MemoryStore.recordMessage(userId, prompt, ai.text, { topic: "general", model: ai.model, elapsedMs: ai.elapsedMs });
    res.json({ status: "success", text: ai.text, model: ai.model, model_name: ai.model_name, elapsedMs: ai.elapsedMs });
  } catch (e) {
    res.status(500).json({ status: "error", message: e.message || "identity-error" });
  }
});

// Smart endpoint: always choose fastest model, report which, maintain memory
app.all("/api/ai-smart", async (req, res) => {
  const prompt = String((req.method === "GET" ? req.query.prompt : req.body?.prompt) || "").trim();
  const userId = String((req.method === "GET" ? req.query.userId : req.body?.userId) || req.ip);
  const selectedModel = String((req.method === "GET" ? req.query.model : req.body?.model) || "").trim() || null;
  const effectiveModel = normalizeSelectedModel(selectedModel || process.env.FORCE_MODEL || process.env.PREFERRED_MODEL || process.env.DEFAULT_MODEL || null);

  if (!prompt) return res.status(400).json({ status: "error", message: "Missing prompt" });

  try {
    // Identity shortcuts inside smart too
    if (isAskName(prompt) && isDTEmpireModel(effectiveModel)) {
      const reply = "I'm DTEmpire—your AI chat bot built to keep things fast and friendly.";
      MemoryStore.recordMessage(userId, prompt, reply, { topic: "name" });
      return res.json({ status: "success", text: reply, source: "identity", model: "nova-micro" });
    }
    if (isAskMaker(prompt) && isDTEmpireModel(effectiveModel)) {
      const reply = "I was crafted by DargoTamber.";
      MemoryStore.recordMessage(userId, prompt, reply, { topic: "maker" });
      return res.json({ status: "success", text: reply, source: "identity", model: "nova-micro" });
    }

    if (isAskBornDate(prompt) && isDTEmpireModel(effectiveModel)) {
      const reply = "I was made on Dec 27, 2025 by DargoTambe from DTEmpire.";
      MemoryStore.recordMessage(userId, prompt, reply, { topic: "born" });
      return res.json({ status: "success", text: reply, source: "identity", model: "nova-micro" });
    }

    if (isAskTodayDate(prompt)) {
      const today = new Date();
      const reply = `Today is ${today.toDateString()}.`;
      MemoryStore.recordMessage(userId, prompt, reply, { topic: "date" });
      return res.json({ status: "success", text: reply, source: "identity", model: null });
    }
    if (isAskFirst(prompt)) {
      const first = MemoryStore.getFirstQuestion(userId);
      const reply = first ? `You first asked about: ${first}.` : "I don't have your first question recorded yet.";
      MemoryStore.recordMessage(userId, prompt, reply, { topic: "memory" });
      return res.json({ status: "success", text: reply, source: "memory", model: null });
    }

    const ai = await chooseModelAndCall(prompt, selectedModel);
    MemoryStore.recordMessage(userId, prompt, ai.text, { topic: "general", model: ai.model, elapsedMs: ai.elapsedMs });
    res.json({ status: "success", text: ai.text, model: ai.model, model_name: ai.model_name, elapsedMs: ai.elapsedMs });
  } catch (e) {
    res.status(500).json({ status: "error", message: e.message || "smart-error" });
  }
});

// Health and memory peek
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", date: new Date().toISOString() });
});
app.get("/api/user", (req, res) => {
  const userId = String(req.query.userId || "").trim();
  if (!userId) return res.status(400).json({ status: "error", message: "Missing userId" });
  const user = MemoryStore.getUser(userId);
  res.json({ status: "success", user });
});

// Lightweight ping for Discord bot uptime checks
app.get("/api/ping", async (req, res) => {
  const msg = String(req.query.msg || "").trim();
  const clientTs = Number(req.query.ts || 0);
  const checkAI = String(req.query.ai || "0").toLowerCase();
  const doAI = checkAI === "1" || checkAI === "true";
  const selectedModel = String(req.query.model || "").trim() || null;

  const now = Date.now();
  const echoLatencyMs = clientTs && Number.isFinite(clientTs) ? Math.max(0, now - clientTs) : null;
  const base = {
    status: "pong",
    server: "listening",
    host: HOST,
    port: PORT,
    serverUrl: process.env.API_URL || null,
    uptimeMs: Math.round(process.uptime() * 1000),
    date: new Date(now).toISOString(),
    echo: msg || null,
    echoLatencyMs
  };

  if (!doAI) return res.json(base);

  try {
    const ai = await chooseModelAndCall("ping", selectedModel);
    return res.json({
      ...base,
      ai: {
        ok: true,
        model: ai.model,
        model_name: ai.model_name,
        elapsedMs: ai.elapsedMs,
        text: ai.text
      }
    });
  } catch (e) {
    return res.json({
      ...base,
      ai: { ok: false, error: e?.message || "ai-check-failed" }
    });
  }
});

const PORT = Number(process.env.PORT || process.env.SERVER_PORT || process.env.PTERO_PORT || 3000);
const HOST = process.env.HOST || process.env.LISTEN_HOST || "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log(`[dt-empire] API listening on http://${HOST}:${PORT}`);
});

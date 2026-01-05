import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve("./data");
const USERS_PATH = path.join(DATA_DIR, "users.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_PATH)) fs.writeFileSync(USERS_PATH, JSON.stringify({}), "utf-8");
}

ensureDataDir();

function readAll() {
  const raw = fs.readFileSync(USERS_PATH, "utf-8");
  return JSON.parse(raw || "{}");
}

function writeAll(obj) {
  fs.writeFileSync(USERS_PATH, JSON.stringify(obj, null, 2), "utf-8");
}

function determineTopic(message) {
  const m = message.toLowerCase();
  if (m.includes("name")) return "name";
  if (m.includes("age")) return "age";
  if (m.includes("who made") || m.includes("creator") || m.includes("made you")) return "maker";
  return "general";
}

export const MemoryStore = {
  recordMessage(userId, message, reply, meta = {}) {
    const all = readAll();
    const user = all[userId] || { messages: [], topics: [], firstTopic: null };
    const topic = meta.topic || determineTopic(message);

    user.messages.push({
      t: new Date().toISOString(),
      prompt: message,
      reply,
      topic,
      model: meta.model || null,
      elapsedMs: meta.elapsedMs || null
    });

    if (!user.firstTopic && topic !== "general") user.firstTopic = topic;
    if (topic !== "general") user.topics.push(topic);

    all[userId] = user;
    writeAll(all);

    return { topic };
  },

  getFirstQuestion(userId) {
    const all = readAll();
    const user = all[userId];
    if (!user || !user.firstTopic) return null;
    return user.firstTopic;
  },

  getUser(userId) {
    const all = readAll();
    return all[userId] || null;
  }
};

export const BASE_URL = process.env.AI_BASE_URL || "https://ai.ankitgupta.com.np";

// Fast text models to race for lowest latency
export const FAST_TEXT_MODELS = [
  "openai-fast",
  "gemini-fast",
  "claude-fast",
  "perplexity-fast"
];

// Fallbacks by priority
export const FALLBACK_MODELS = [
  "nova-micro",
  "gemini",
  "openai"
];

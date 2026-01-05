import axios from "axios";
import { BASE_URL } from "./config/models.js";

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000
});

export async function callQuickModel(prompt, model) {
  const url = `/api/ai-quick`;
  const params = { prompt, model };
  const start = Date.now();
  const { data } = await client.get(url, { params });
  const elapsedMs = Date.now() - start;
  return { ...data, elapsedMs, model };
}

export async function callTextModel(prompt, model) {
  const url = `/api/ai-text`;
  const params = { prompt, model };
  const start = Date.now();
  const { data } = await client.get(url, { params });
  const elapsedMs = Date.now() - start;
  return { ...data, elapsedMs, model };
}

export type ModelProviderId = "openai" | "openrouter" | "groq" | "ollama" | "custom";

export interface ModelProvider {
  id: ModelProviderId;
  label: string;
  description: string;
  baseUrl: string;
  requiresApiKey: boolean;
  fallbackModels: string[];
}

export const MODEL_PROVIDERS: ModelProvider[] = [
  {
    id: "openai",
    label: "OpenAI",
    description: "OpenAI API",
    baseUrl: "https://api.openai.com/v1",
    requiresApiKey: true,
    fallbackModels: ["gpt-5.2", "gpt-5-mini", "gpt-4.1", "gpt-4.1-mini"],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    description: "Hosted models through an OpenAI-compatible gateway",
    baseUrl: "https://openrouter.ai/api/v1",
    requiresApiKey: true,
    fallbackModels: [],
  },
  {
    id: "groq",
    label: "Groq",
    description: "Groq OpenAI-compatible API",
    baseUrl: "https://api.groq.com/openai/v1",
    requiresApiKey: true,
    fallbackModels: [],
  },
  {
    id: "ollama",
    label: "Ollama / local",
    description: "Models available from a local Ollama server",
    baseUrl: "http://localhost:11434/v1",
    requiresApiKey: false,
    fallbackModels: [],
  },
  {
    id: "custom",
    label: "Custom endpoint",
    description: "Any OpenAI-compatible chat-completions API",
    baseUrl: "",
    requiresApiKey: true,
    fallbackModels: [],
  },
];

export const modelProvider = (id?: string): ModelProvider =>
  MODEL_PROVIDERS.find((provider) => provider.id === id) ?? MODEL_PROVIDERS[0];

export const normalizeModelsUrl = (baseUrl: string): string => {
  const normalized = baseUrl.trim().replace(/\/$/, "");
  return normalized.endsWith("/models") ? normalized : `${normalized}/models`;
};

export const isLikelyChatModel = (model: string): boolean =>
  !/(embedding|moderation|whisper|transcri|tts|speech|audio|realtime|image|dall-e)/i.test(model);

export const discoverModels = async (baseUrl: string, apiKey?: string): Promise<string[]> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const headers: Record<string, string> = { accept: "application/json" };
    if (apiKey) headers.authorization = `Bearer ${apiKey}`;
    const response = await fetch(normalizeModelsUrl(baseUrl), { headers, signal: controller.signal });
    if (!response.ok) return [];
    const payload = (await response.json()) as { data?: Array<{ id?: unknown }> };
    return [...new Set(
      (payload.data ?? [])
        .map((item) => (typeof item.id === "string" ? item.id.trim() : ""))
        .filter((model) => Boolean(model) && isLikelyChatModel(model)),
    )].sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
};

export const modelFamily = (model: string): string => {
  const normalized = model.toLowerCase();
  if (normalized.includes("/")) return model.split("/", 1)[0];
  if (normalized.startsWith("gpt-5")) return "GPT-5";
  if (normalized.startsWith("gpt-4.1")) return "GPT-4.1";
  if (normalized.includes("llama")) return "Llama";
  if (normalized.includes("qwen")) return "Qwen";
  if (normalized.includes("gemma")) return "Gemma";
  if (normalized.includes("mistral") || normalized.includes("mixtral")) return "Mistral";
  return "Other";
};

export const modelFamilies = (models: string[]): string[] =>
  [...new Set(models.map(modelFamily))].sort((left, right) => {
    if (left === "Other") return 1;
    if (right === "Other") return -1;
    return left.localeCompare(right);
  });

export const modelsForFamily = (models: string[], family: string): string[] =>
  family === "All models" ? models : models.filter((model) => modelFamily(model) === family);

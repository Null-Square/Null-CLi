export type ModelProviderId = "openai" | "deepseek" | "anthropic" | "glm" | "moonshot" | "qwen";

export interface ModelProvider {
  id: ModelProviderId;
  label: string;
  description: string;
  baseUrl: string;
  requiresApiKey: boolean;
  apiKeyEnvVars: string[];
  fallbackModels: string[];
}

export const MODEL_PROVIDER_IDS: readonly ModelProviderId[] = [
  "openai",
  "deepseek",
  "anthropic",
  "glm",
  "moonshot",
  "qwen",
] as const;

export const MODEL_PROVIDERS: ModelProvider[] = [
  {
    id: "openai",
    label: "OpenAI",
    description: "OpenAI API",
    baseUrl: "https://api.openai.com/v1",
    requiresApiKey: true,
    apiKeyEnvVars: ["NULL_AI_API_KEY", "OPENAI_API_KEY"],
    fallbackModels: ["gpt-5.2", "gpt-5-mini", "gpt-4.1", "gpt-4.1-mini"],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    description: "DeepSeek OpenAI-compatible API",
    baseUrl: "https://api.deepseek.com",
    requiresApiKey: true,
    apiKeyEnvVars: ["NULL_AI_API_KEY", "DEEPSEEK_API_KEY"],
    fallbackModels: ["deepseek-v4-flash", "deepseek-v4-pro", "deepseek-chat", "deepseek-reasoner"],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    description: "Claude via Anthropic's OpenAI-compatible API",
    baseUrl: "https://api.anthropic.com/v1",
    requiresApiKey: true,
    apiKeyEnvVars: ["NULL_AI_API_KEY", "ANTHROPIC_API_KEY"],
    fallbackModels: ["claude-sonnet-4-5-20250929", "claude-haiku-4-5-20251001", "claude-opus-4-8"],
  },
  {
    id: "glm",
    label: "GLM",
    description: "Z.ai / Zhipu GLM OpenAI-compatible API",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    requiresApiKey: true,
    apiKeyEnvVars: ["NULL_AI_API_KEY", "GLM_API_KEY", "ZHIPU_API_KEY", "BIGMODEL_API_KEY"],
    fallbackModels: ["glm-4.7", "glm-4.6", "glm-4.5", "glm-4.5-air", "glm-4.5-flash"],
  },
  {
    id: "moonshot",
    label: "Moonshot",
    description: "Kimi / Moonshot OpenAI-compatible API",
    baseUrl: "https://api.moonshot.ai/v1",
    requiresApiKey: true,
    apiKeyEnvVars: ["NULL_AI_API_KEY", "MOONSHOT_API_KEY"],
    fallbackModels: ["kimi-k2.7-code", "kimi-k2-0905", "moonshot-v1-128k", "moonshot-v1-32k", "moonshot-v1-8k"],
  },
  {
    id: "qwen",
    label: "Qwen",
    description: "Alibaba Cloud DashScope OpenAI-compatible API",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    requiresApiKey: true,
    apiKeyEnvVars: ["NULL_AI_API_KEY", "DASHSCOPE_API_KEY", "QWEN_API_KEY"],
    fallbackModels: ["qwen3-coder-plus", "qwen-max", "qwen-plus", "qwen-turbo", "qwen-long"],
  },
];

const FAMILY_ORDER = [
  "OpenAI",
  "DeepSeek",
  "Qwen",
  "Anthropic",
  "Moonshot",
  "GLM",
  "Other",
];

export const isSupportedModelProviderId = (id?: string): id is ModelProviderId =>
  MODEL_PROVIDER_IDS.includes(id as ModelProviderId);

export const normalizeModelProviderId = (id?: string): ModelProviderId | undefined =>
  isSupportedModelProviderId(id) ? id : undefined;

export const modelProvider = (id?: string): ModelProvider =>
  MODEL_PROVIDERS.find((provider) => provider.id === id) ?? MODEL_PROVIDERS[0];

export const environmentApiKeyForProvider = (
  id?: string,
  env: Record<string, string | undefined> = process.env,
): string | undefined => {
  const provider = modelProvider(id);
  for (const name of provider.apiKeyEnvVars) {
    const value = env[name]?.trim();
    if (value) return value;
  }
  return undefined;
};

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
  if (normalized.includes("deepseek")) return "DeepSeek";
  if (normalized.includes("qwen") || normalized.includes("dashscope") || normalized.includes("modelscope")) return "Qwen";
  if (normalized.includes("anthropic") || normalized.includes("claude")) return "Anthropic";
  if (normalized.includes("moonshot") || normalized.includes("kimi")) return "Moonshot";
  if (normalized.includes("glm") || normalized.includes("z-ai") || normalized.includes("zai/") || normalized.includes("zhipu")) return "GLM";
  if (/(^|\/)(gpt|o[134])/.test(normalized) || normalized.includes("openai")) return "OpenAI";
  return "Other";
};

export const modelFamilies = (models: string[]): string[] =>
  [...new Set(models.map(modelFamily))].sort((left, right) => {
    const leftRank = FAMILY_ORDER.indexOf(left);
    const rightRank = FAMILY_ORDER.indexOf(right);
    const normalizedLeftRank = leftRank === -1 ? FAMILY_ORDER.length : leftRank;
    const normalizedRightRank = rightRank === -1 ? FAMILY_ORDER.length : rightRank;
    if (normalizedLeftRank !== normalizedRightRank) return normalizedLeftRank - normalizedRightRank;
    return left.localeCompare(right);
  });

export const modelsForFamily = (models: string[], family: string): string[] =>
  family === "All models" ? models : models.filter((model) => modelFamily(model) === family);

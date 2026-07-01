export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionOptions {
  apiKey: string;
  baseUrl?: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

interface OpenAiCompatibleResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

const normalizeBaseUrl = (baseUrl?: string): string => {
  const raw = baseUrl || process.env.NULL_AI_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  if (raw.endsWith("/chat/completions")) return raw;
  return `${raw.replace(/\/$/, "")}/chat/completions`;
};

export const createChatCompletion = async (options: ChatCompletionOptions): Promise<string> => {
  const response = await fetch(normalizeBaseUrl(options.baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 1200,
    }),
  });

  const data = (await response.json()) as OpenAiCompatibleResponse;
  if (!response.ok) {
    throw new Error(data.error?.message || `LLM request failed with HTTP ${response.status}`);
  }
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM response did not include message content");
  return content;
};

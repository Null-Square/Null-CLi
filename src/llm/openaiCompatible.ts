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
  stream?: boolean;
  onToken?: (token: string) => void;
}

interface OpenAiCompatibleResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
    delta?: {
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
      stream: options.stream === true,
    }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as OpenAiCompatibleResponse;
    throw new Error(data.error?.message || `LLM request failed with HTTP ${response.status}`);
  }

  if (options.stream === true && options.onToken && response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";

    const handleData = (raw: string): void => {
      const data = raw.trim();
      if (!data || data === "[DONE]") return;
      let parsed: OpenAiCompatibleResponse;
      try {
        parsed = JSON.parse(data) as OpenAiCompatibleResponse;
      } catch {
        return; // ignore keep-alives / non-JSON lines from some providers
      }
      const token = parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.message?.content ?? "";
      if (!token) return;
      content += token;
      options.onToken?.(token);
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let separator = buffer.indexOf("\n\n");
      while (separator >= 0) {
        const event = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        for (const line of event.split(/\r?\n/)) {
          if (line.startsWith("data:")) handleData(line.slice(5));
        }
        separator = buffer.indexOf("\n\n");
      }
    }

    if (buffer.trim()) {
      for (const line of buffer.split(/\r?\n/)) {
        if (line.startsWith("data:")) handleData(line.slice(5));
      }
    }

    if (!content) throw new Error("LLM response did not include message content");
    return content;
  }

  const data = (await response.json()) as OpenAiCompatibleResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM response did not include message content");
  return content;
};

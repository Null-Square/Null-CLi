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

type TokenLimitField = "max_tokens" | "max_completion_tokens";

const normalizeBaseUrl = (baseUrl?: string): string => {
  const raw = baseUrl || process.env.NULL_AI_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  if (raw.endsWith("/chat/completions")) return raw;
  return `${raw.replace(/\/$/, "")}/chat/completions`;
};

export const preferMaxCompletionTokens = (model: string, baseUrl?: string): boolean => {
  const normalizedModel = model.toLowerCase();
  const normalizedBase = (baseUrl || process.env.NULL_AI_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").toLowerCase();
  return (
    normalizedBase.includes("api.openai.com") ||
    /(^|\/)(gpt-5|o1|o3|o4|openai\/gpt-5|openai\/o1|openai\/o3|openai\/o4)/i.test(normalizedModel)
  );
};

const buildRequestBody = (
  options: ChatCompletionOptions,
  tokenLimitField: TokenLimitField,
  includeTemperature: boolean,
): Record<string, unknown> => {
  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
    [tokenLimitField]: options.maxTokens ?? 1200,
    stream: options.stream === true,
  };
  if (includeTemperature) body.temperature = options.temperature ?? 0.2;
  return body;
};

const postCompletion = async (
  options: ChatCompletionOptions,
  tokenLimitField: TokenLimitField,
  includeTemperature: boolean,
): Promise<Response> =>
  fetch(normalizeBaseUrl(options.baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify(buildRequestBody(options, tokenLimitField, includeTemperature)),
  });

const responseErrorMessage = async (response: Response): Promise<string> => {
  const data = (await response.json().catch(() => ({}))) as OpenAiCompatibleResponse;
  return data.error?.message || `LLM request failed with HTTP ${response.status}`;
};

const mentionsUnsupported = (message: string, parameter: string): boolean => {
  const escaped = parameter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `(${escaped}.*not supported|unsupported (parameter|value).*${escaped}|use ['"]?${escaped}['"]?)`,
    "i",
  ).test(message);
};

const readCompletion = async (response: Response, options: ChatCompletionOptions): Promise<string> => {
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

export const createChatCompletion = async (options: ChatCompletionOptions): Promise<string> => {
  let tokenLimitField: TokenLimitField = preferMaxCompletionTokens(options.model, options.baseUrl)
    ? "max_completion_tokens"
    : "max_tokens";
  let includeTemperature = true;
  const attempted = new Set<string>();

  for (;;) {
    const attemptKey = `${tokenLimitField}:${includeTemperature ? "temperature" : "no-temperature"}`;
    attempted.add(attemptKey);
    const response = await postCompletion(options, tokenLimitField, includeTemperature);
    if (response.ok) return readCompletion(response, options);

    const message = await responseErrorMessage(response);
    let nextTokenLimitField: TokenLimitField = tokenLimitField;
    let nextIncludeTemperature: boolean = includeTemperature;

    if (tokenLimitField === "max_tokens" && mentionsUnsupported(message, "max_tokens")) {
      nextTokenLimitField = "max_completion_tokens";
    } else if (
      tokenLimitField === "max_completion_tokens" &&
      mentionsUnsupported(message, "max_completion_tokens")
    ) {
      nextTokenLimitField = "max_tokens";
    } else if (includeTemperature && mentionsUnsupported(message, "temperature")) {
      nextIncludeTemperature = false;
    } else {
      throw new Error(message);
    }

    const nextAttemptKey = `${nextTokenLimitField}:${nextIncludeTemperature ? "temperature" : "no-temperature"}`;
    if (attempted.has(nextAttemptKey)) throw new Error(message);
    tokenLimitField = nextTokenLimitField;
    includeTemperature = nextIncludeTemperature;
  }
};

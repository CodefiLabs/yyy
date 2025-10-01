import { getEnvVar } from './read_env';

const VIBEATHON_API_BASE = getEnvVar('DYAD_DISTRIBUTION_PROXY_URL') ||
  (process.env.NODE_ENV === 'development'
    ? 'http://app.vibeathon.test/api/v1'
    : 'https://app.vibeathon.us/api/v1');

export interface VibeathonApiKeysResponse {
  openai?: string;
  anthropic?: string;
  google?: string;
  xai?: string;
  expiration: string; // ISO date string
}

export interface VibeathonSyncRequest {
  requestId: string;
  originalTimestamp: string;
  requestData: any;
  error: string;
}

export async function fetchFallbackApiKeys(vibeathonApiKey: string): Promise<VibeathonApiKeysResponse> {
  const response = await fetch(`${VIBEATHON_API_BASE}/user/ai-keys`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${vibeathonApiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    let errorMessage = `Failed to fetch API keys: ${response.statusText}`;

    try {
      const errorData = await response.json();
      if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch {
      // Use the default error message if JSON parsing fails
    }

    throw new Error(errorMessage);
  }

  const data = await response.json();

  // Validate the response structure
  if (!data.expiration) {
    throw new Error('Invalid response: missing expiration date');
  }

  return data as VibeathonApiKeysResponse;
}

/**
 * Validates a Vibeathon API key by making a lightweight API call
 * Uses the existing /user/ai-keys endpoint to check if the key is valid
 * @param vibeathonApiKey - The API key to validate
 * @returns true if valid, false otherwise
 */
export async function validateVibeathonApiKey(vibeathonApiKey: string): Promise<boolean> {
  try {
    // Reuse existing endpoint - if it returns data, key is valid
    await fetchFallbackApiKeys(vibeathonApiKey);
    return true;
  } catch {
    return false;
  }
}

export async function fetchVibeathonApi(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const url = `${VIBEATHON_API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  return response;
}

export async function syncFailedRequest(
  apiKey: string,
  syncData: VibeathonSyncRequest
): Promise<void> {
  const response = await fetchVibeathonApi('/sync/failed-request', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(syncData),
  });

  if (!response.ok) {
    let errorMessage = `Failed to sync request: ${response.statusText}`;

    try {
      const errorData = await response.json();
      if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch {
      // Use the default error message if JSON parsing fails
    }

    throw new Error(errorMessage);
  }
}

export function transformToOpenAIFormat(
  model: string,
  messages: any[],
  options: any = {}
) {
  // Standardize all provider requests to OpenAI-compatible format
  const request = {
    model: model,
    messages: messages,
    stream: options.stream ?? true,
    // OpenAI standard parameters
    max_tokens: options.maxTokens || options.max_tokens,
    temperature: options.temperature ?? 0.7,
    top_p: options.top_p,
    frequency_penalty: options.frequency_penalty,
    presence_penalty: options.presence_penalty,
    stop: options.stop,
    // Add Vibeathon-specific metadata
    metadata: {
      original_provider: options.originalProvider || inferProviderFromModel(model),
      request_id: options.requestId || generateRequestId(),
      user_agent: 'Dyad/Distribution',
      timestamp: new Date().toISOString(),
    }
  };

  // Remove undefined values to keep request clean
  return Object.fromEntries(
    Object.entries(request).filter(([_, value]) => value !== undefined)
  );
}

function inferProviderFromModel(model: string): string {
  if (model.startsWith('gpt-') || model.startsWith('o1-')) {
    return 'openai';
  } else if (model.startsWith('claude-')) {
    return 'anthropic';
  } else if (model.startsWith('gemini-')) {
    return 'google';
  } else if (model.startsWith('grok-')) {
    return 'xai';
  }
  return 'unknown';
}

function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function transformAnthropicToOpenAI(request: any): any {
  // Transform Anthropic-specific parameters to OpenAI format
  const transformed = {
    ...request,
    max_tokens: request.max_tokens,
    // Anthropic uses 'system' parameter differently
    messages: request.messages,
  };

  // Handle Anthropic's system message format
  if (request.system) {
    transformed.messages = [
      { role: 'system', content: request.system },
      ...request.messages
    ];
  }

  return transformToOpenAIFormat(request.model, transformed.messages, transformed);
}

export function transformGoogleToOpenAI(request: any): any {
  // Transform Google AI-specific parameters to OpenAI format
  return transformToOpenAIFormat(
    request.model,
    request.messages,
    {
      ...request,
      max_tokens: request.maxOutputTokens,
      temperature: request.generationConfig?.temperature,
    }
  );
}

export function validateOpenAIRequest(request: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!request.model) {
    errors.push('Missing required field: model');
  }

  if (!request.messages || !Array.isArray(request.messages)) {
    errors.push('Missing or invalid messages array');
  } else {
    request.messages.forEach((message: any, index: number) => {
      if (!message.role || !['system', 'user', 'assistant'].includes(message.role)) {
        errors.push(`Invalid message role at index ${index}`);
      }
      if (!message.content) {
        errors.push(`Missing content for message at index ${index}`);
      }
    });
  }

  if (request.max_tokens && (typeof request.max_tokens !== 'number' || request.max_tokens < 1)) {
    errors.push('max_tokens must be a positive number');
  }

  if (request.temperature && (typeof request.temperature !== 'number' || request.temperature < 0 || request.temperature > 2)) {
    errors.push('temperature must be a number between 0 and 2');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function getVibeathonProxyUrl(): string {
  return VIBEATHON_API_BASE;
}
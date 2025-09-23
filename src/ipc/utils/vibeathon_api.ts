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
  options: any
) {
  // Standardize all provider requests to OpenAI-compatible format
  return {
    model: model,
    messages: messages,
    stream: true,
    max_tokens: options.maxTokens,
    temperature: options.temperature,
    // Add any Vibeathon-specific headers or parameters
    metadata: {
      original_provider: options.originalProvider,
      request_id: options.requestId,
      user_agent: 'Dyad/Distribution',
    }
  };
}

export function getVibeathonProxyUrl(): string {
  return VIBEATHON_API_BASE;
}
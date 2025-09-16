/**
 * Simple API key service that uses environment variables
 * No IndexedDB or encryption - just environment-based configuration
 */

export interface SimpleApiKey {
  name: string;
  description: string;
  value: string;
  isFromEnv: boolean;
}

// API keys from environment variables
const ENV_API_KEYS = [
  {
    name: 'GEMINI_API_KEY',
    description: 'Google Gemini AI API key for content generation',
    envKey: 'VITE_GEMINI_API_KEY'
  },
  {
    name: 'OPENAI_API_KEY', 
    description: 'OpenAI API key for alternative content generation',
    envKey: 'VITE_OPENAI_API_KEY'
  },
  {
    name: 'ANTHROPIC_API_KEY',
    description: 'Anthropic Claude API key for content generation', 
    envKey: 'VITE_ANTHROPIC_API_KEY'
  },
  {
    name: 'GOOGLE_SEARCH_API_KEY',
    description: 'Google Custom Search API key',
    envKey: 'VITE_GOOGLE_SEARCH_API_KEY'
  },
  {
    name: 'KEYWORDS_EVERYWHERE_API_KEY',
    description: 'Keywords Everywhere API key for SEO research',
    envKey: 'VITE_KEYWORDS_EVERYWHERE_API_KEY'
  }
];

/**
 * Get all available API keys from environment variables
 */
export const getAllApiKeys = (): SimpleApiKey[] => {
  return ENV_API_KEYS.map(apiKey => ({
    name: apiKey.name,
    description: apiKey.description,
    value: import.meta.env[apiKey.envKey] || '',
    isFromEnv: true
  }));
};

/**
 * Get a specific API key value
 */
export const getApiKey = (keyName: string): string | null => {
  const envKey = ENV_API_KEYS.find(k => k.name === keyName);
  if (!envKey) return null;
  
  return import.meta.env[envKey.envKey] || null;
};

/**
 * Get the Gemini API key (primary AI service)
 */
export const getGeminiApiKey = (): string | null => {
  return getApiKey('GEMINI_API_KEY');
};

// Note: In production, API keys should be set via environment variables
// This removes the complexity of client-side encryption while maintaining security
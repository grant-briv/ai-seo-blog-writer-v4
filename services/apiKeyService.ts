import Dexie from 'dexie';

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

class ApiKeyDatabase extends Dexie {
  apiKeys!: Dexie.Table<ApiKey, string>;

  constructor() {
    super('ApiKeyDatabase');
    this.version(1).stores({
      apiKeys: 'id, name, isActive'
    });
  }
}

const db = new ApiKeyDatabase();

// Default API keys configuration
const DEFAULT_API_KEYS: Omit<ApiKey, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'GEMINI_API_KEY',
    key: '',
    description: 'Google Gemini API key for content generation',
    isActive: true
  },
  {
    name: 'OPENAI_API_KEY',
    key: '',
    description: 'OpenAI API key for alternative content generation',
    isActive: false
  },
  {
    name: 'ANTHROPIC_API_KEY',
    key: '',
    description: 'Anthropic Claude API key for content generation',
    isActive: false
  }
];

export const initializeApiKeys = async (): Promise<void> => {
  try {
    const existingKeys = await db.apiKeys.toArray();
    
    // Initialize default keys if none exist
    if (existingKeys.length === 0) {
      const now = new Date().toISOString();
      const keysToAdd: ApiKey[] = DEFAULT_API_KEYS.map(key => ({
        ...key,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now
      }));
      
      await db.apiKeys.bulkAdd(keysToAdd);
    }
  } catch (error) {
    console.error('Failed to initialize API keys:', error);
  }
};

export const getAllApiKeys = async (): Promise<ApiKey[]> => {
  try {
    return await db.apiKeys.orderBy('name').toArray();
  } catch (error) {
    console.error('Failed to get API keys:', error);
    return [];
  }
};

export const getApiKey = async (name: string): Promise<string | null> => {
  try {
    const apiKey = await db.apiKeys.where('name').equals(name).first();
    return apiKey?.key || null;
  } catch (error) {
    console.error(`Failed to get API key ${name}:`, error);
    return null;
  }
};

export const saveApiKey = async (id: string, key: string): Promise<void> => {
  try {
    await db.apiKeys.update(id, {
      key,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to save API key:', error);
    throw error;
  }
};

export const toggleApiKey = async (id: string, isActive: boolean): Promise<void> => {
  try {
    await db.apiKeys.update(id, {
      isActive,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to toggle API key:', error);
    throw error;
  }
};

export const addCustomApiKey = async (name: string, key: string, description: string): Promise<void> => {
  try {
    const now = new Date().toISOString();
    const newKey: ApiKey = {
      id: crypto.randomUUID(),
      name: name.toUpperCase(),
      key,
      description,
      isActive: true,
      createdAt: now,
      updatedAt: now
    };
    
    await db.apiKeys.add(newKey);
  } catch (error) {
    console.error('Failed to add custom API key:', error);
    throw error;
  }
};

export const deleteApiKey = async (id: string): Promise<void> => {
  try {
    await db.apiKeys.delete(id);
  } catch (error) {
    console.error('Failed to delete API key:', error);
    throw error;
  }
};

// Get the active Gemini API key (fallback to environment variable)
export const getGeminiApiKey = async (): Promise<string | null> => {
  try {
    const storedKey = await getApiKey('GEMINI_API_KEY');
    if (storedKey && storedKey.trim()) {
      return storedKey;
    }
    
    // Fallback to environment variable
    return process.env.GEMINI_API_KEY || process.env.API_KEY || null;
  } catch (error) {
    console.error('Failed to get Gemini API key:', error);
    return process.env.GEMINI_API_KEY || process.env.API_KEY || null;
  }
};
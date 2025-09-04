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
    
    // Check if we need to add any default keys
    for (const defaultKey of DEFAULT_API_KEYS) {
      const exists = existingKeys.find(key => key.name === defaultKey.name);
      if (!exists) {
        const now = new Date().toISOString();
        const newKey: ApiKey = {
          ...defaultKey,
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now
        };
        
        await db.apiKeys.add(newKey);
        console.log(`Added missing API key: ${defaultKey.name}`);
      }
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

export const removeDuplicateApiKeys = async (): Promise<void> => {
  try {
    const allKeys = await db.apiKeys.toArray();
    const keysByName = new Map<string, ApiKey[]>();
    
    // Group keys by name
    allKeys.forEach(key => {
      if (!keysByName.has(key.name)) {
        keysByName.set(key.name, []);
      }
      keysByName.get(key.name)!.push(key);
    });
    
    // Remove duplicates, keeping the most recently updated
    for (const [name, keys] of keysByName) {
      if (keys.length > 1) {
        console.log(`Found ${keys.length} duplicates for ${name}, removing extras...`);
        
        // Sort by updatedAt, keep the most recent
        keys.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        const toKeep = keys[0];
        const toDelete = keys.slice(1);
        
        // Delete duplicates
        for (const duplicate of toDelete) {
          await db.apiKeys.delete(duplicate.id);
          console.log(`Removed duplicate ${name} with id ${duplicate.id}`);
        }
      }
    }
  } catch (error) {
    console.error('Failed to remove duplicate API keys:', error);
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
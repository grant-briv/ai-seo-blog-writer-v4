import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { TextInput } from './TextInput';
import { TextAreaInput } from './TextAreaInput';
import { SectionCard } from './SectionCard';
import { KeyIcon, EyeIcon, EyeSlashIcon, PlusIcon, TrashIcon, CheckCircleIcon, XCircleIcon, SearchIcon } from './Icons';
import type { ApiKey } from '../services/apiKeyService';
import { 
  getAllApiKeys, 
  saveApiKey, 
  toggleApiKey, 
  addCustomApiKey, 
  deleteApiKey,
  initializeApiKeys,
  removeDuplicateApiKeys 
} from '../services/apiKeyService';
import KeywordsEverywhereConfig from './KeywordsEverywhereConfig';
import type { KeywordsEverywhereConfig as KWConfig } from '../types';

interface ApiKeyManagerProps {
  currentUser: { role: string };
}

export const ApiKeyManager: React.FC<ApiKeyManagerProps> = ({ currentUser }) => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [tempKeyValue, setTempKeyValue] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newKeyDescription, setNewKeyDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keywordsEverywhereConfig, setKeywordsEverywhereConfig] = useState<KWConfig>({
    apiKey: '',
    isEnabled: false
  });

  useEffect(() => {
    loadApiKeys();
    loadKeywordsEverywhereConfig();
  }, []);

  const loadKeywordsEverywhereConfig = () => {
    try {
      const saved = localStorage.getItem('keywordsEverywhereConfig');
      if (saved) {
        setKeywordsEverywhereConfig(JSON.parse(saved));
      }
    } catch (err) {
      console.error('Failed to load Keywords Everywhere config:', err);
    }
  };

  const handleKeywordsEverywhereConfigUpdate = (config: KWConfig) => {
    try {
      setKeywordsEverywhereConfig(config);
      localStorage.setItem('keywordsEverywhereConfig', JSON.stringify(config));
    } catch (err) {
      console.error('Failed to save Keywords Everywhere config:', err);
      setError('Failed to save Keywords Everywhere configuration');
    }
  };

  const loadApiKeys = async () => {
    try {
      setLoading(true);
      await initializeApiKeys();
      await removeDuplicateApiKeys(); // Clean up any duplicates
      const keys = await getAllApiKeys();
      setApiKeys(keys);
    } catch (err) {
      setError('Failed to load API keys');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys(prev => ({
      ...prev,
      [keyId]: !prev[keyId]
    }));
  };

  const startEditing = (apiKey: ApiKey) => {
    setEditingKey(apiKey.id);
    setTempKeyValue(apiKey.key);
  };

  const cancelEditing = () => {
    setEditingKey(null);
    setTempKeyValue('');
  };

  const saveKeyValue = async (keyId: string) => {
    try {
      await saveApiKey(keyId, tempKeyValue);
      await loadApiKeys();
      setEditingKey(null);
      setTempKeyValue('');
    } catch (err) {
      setError('Failed to save API key');
      console.error(err);
    }
  };

  const toggleKeyActive = async (keyId: string, isActive: boolean) => {
    try {
      await toggleApiKey(keyId, !isActive);
      await loadApiKeys();
    } catch (err) {
      setError('Failed to toggle API key');
      console.error(err);
    }
  };

  const handleAddKey = async () => {
    if (!newKeyName.trim() || !newKeyValue.trim()) {
      setError('Key name and value are required');
      return;
    }

    try {
      await addCustomApiKey(newKeyName, newKeyValue, newKeyDescription);
      await loadApiKeys();
      setShowAddForm(false);
      setNewKeyName('');
      setNewKeyValue('');
      setNewKeyDescription('');
    } catch (err) {
      setError('Failed to add API key');
      console.error(err);
    }
  };

  const handleDeleteKey = async (keyId: string, keyName: string) => {
    if (!confirm(`Are you sure you want to delete ${keyName}?`)) {
      return;
    }

    try {
      await deleteApiKey(keyId);
      await loadApiKeys();
    } catch (err) {
      setError('Failed to delete API key');
      console.error(err);
    }
  };

  const maskKey = (key: string) => {
    if (!key) return 'Not set';
    if (key.length <= 8) return '••••••••';
    return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
  };

  if (currentUser.role !== 'admin') {
    return (
      <div className="text-center p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800">API key management is only available to administrators.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center p-6">
        <p>Loading API keys...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative" role="alert">
          <span className="block sm:inline">{error}</span>
          <button
            onClick={() => setError(null)}
            className="absolute top-0 bottom-0 right-0 px-4 py-3 text-red-500 hover:text-red-700"
          >
            <span className="text-2xl">&times;</span>
          </button>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg">
        <p className="text-sm">
          <strong>Important:</strong> API keys are stored securely in your browser's local database. 
          These keys enable the app to work without requiring server-side configuration.
        </p>
      </div>

      <SectionCard title="API Key Management" icon={<KeyIcon className="w-6 h-6 text-green-600" />}>
        <div className="space-y-4">
          {apiKeys.map((apiKey) => (
            <div key={apiKey.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <h4 className="text-lg font-medium text-gray-900">{apiKey.name}</h4>
                  {apiKey.isActive ? (
                    <CheckCircleIcon className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircleIcon className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    onClick={() => toggleKeyActive(apiKey.id, apiKey.isActive)}
                    className={`!py-1 !px-2 text-xs ${
                      apiKey.isActive 
                        ? 'bg-yellow-500 hover:bg-yellow-600' 
                        : 'bg-green-500 hover:bg-green-600'
                    } text-white`}
                  >
                    {apiKey.isActive ? 'Disable' : 'Enable'}
                  </Button>
                  {!['GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'].includes(apiKey.name) && (
                    <Button
                      onClick={() => handleDeleteKey(apiKey.id, apiKey.name)}
                      className="!py-1 !px-2 text-xs bg-red-500 hover:bg-red-600 text-white"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-3">{apiKey.description}</p>

              {editingKey === apiKey.id ? (
                <div className="space-y-3">
                  <TextAreaInput
                    label="API Key"
                    name="keyValue"
                    value={tempKeyValue}
                    onChange={(e) => setTempKeyValue(e.target.value)}
                    placeholder="Enter your API key..."
                    rows={3}
                    className="font-mono text-sm"
                  />
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => saveKeyValue(apiKey.id)}
                      className="bg-green-500 hover:bg-green-600 text-white !py-1 !px-3 text-sm"
                    >
                      Save
                    </Button>
                    <Button
                      onClick={cancelEditing}
                      variant="secondary"
                      className="!py-1 !px-3 text-sm"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <code className="flex-1 p-2 bg-white border border-gray-300 rounded text-sm font-mono">
                      {visibleKeys[apiKey.id] ? apiKey.key || 'Not set' : maskKey(apiKey.key)}
                    </code>
                    <Button
                      onClick={() => toggleKeyVisibility(apiKey.id)}
                      className="!py-1 !px-2 bg-gray-500 hover:bg-gray-600 text-white"
                      aria-label={visibleKeys[apiKey.id] ? 'Hide key' : 'Show key'}
                    >
                      {visibleKeys[apiKey.id] ? (
                        <EyeSlashIcon className="w-4 h-4" />
                      ) : (
                        <EyeIcon className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <Button
                    onClick={() => startEditing(apiKey)}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white !py-2"
                  >
                    {apiKey.key ? 'Update Key' : 'Set Key'}
                  </Button>
                </div>
              )}

              <div className="mt-2 text-xs text-gray-500">
                Last updated: {new Date(apiKey.updatedAt).toLocaleString()}
              </div>
            </div>
          ))}

          {showAddForm ? (
            <div className="p-4 border border-gray-300 rounded-lg bg-white">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Add Custom API Key</h4>
              <div className="space-y-3">
                <TextInput
                  label="Key Name"
                  name="keyName"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., CUSTOM_SERVICE_API_KEY"
                />
                <TextAreaInput
                  label="API Key Value"
                  name="keyValue"
                  value={newKeyValue}
                  onChange={(e) => setNewKeyValue(e.target.value)}
                  placeholder="Enter the API key..."
                  rows={3}
                  className="font-mono text-sm"
                />
                <TextInput
                  label="Description"
                  name="keyDescription"
                  value={newKeyDescription}
                  onChange={(e) => setNewKeyDescription(e.target.value)}
                  placeholder="Brief description of what this key is for..."
                />
                <div className="flex space-x-2">
                  <Button
                    onClick={handleAddKey}
                    className="bg-green-500 hover:bg-green-600 text-white"
                  >
                    Add Key
                  </Button>
                  <Button
                    onClick={() => {
                      setShowAddForm(false);
                      setNewKeyName('');
                      setNewKeyValue('');
                      setNewKeyDescription('');
                    }}
                    variant="secondary"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => setShowAddForm(true)}
              className="w-full bg-green-500 hover:bg-green-600 text-white border-2 border-dashed border-green-300 hover:border-green-500"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              Add Custom API Key
            </Button>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Keywords Everywhere Configuration" icon={<SearchIcon className="w-6 h-6 text-blue-600" />}>
        <KeywordsEverywhereConfig 
          config={keywordsEverywhereConfig}
          onConfigUpdate={handleKeywordsEverywhereConfigUpdate}
        />
      </SectionCard>

      <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
        <p className="text-sm">
          <strong>Security Note:</strong> API keys are stored locally in your browser. 
          Never share your API keys with others. If you suspect a key has been compromised, 
          regenerate it immediately in the respective service's dashboard.
        </p>
      </div>
    </div>
  );
};
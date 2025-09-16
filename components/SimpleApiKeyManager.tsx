import React, { useState, useEffect } from 'react';
import { SectionCard } from './SectionCard';
import { KeyIcon, EyeIcon, EyeSlashIcon, CheckCircleIcon, XCircleIcon } from './Icons';
import { Button } from './Button';
import type { SimpleApiKey } from '../services/simpleApiKeyService';
import { getAllApiKeys } from '../services/simpleApiKeyService';

interface SimpleApiKeyManagerProps {
  currentUser: { role: string };
}

export const SimpleApiKeyManager: React.FC<SimpleApiKeyManagerProps> = ({ currentUser }) => {
  const [apiKeys, setApiKeys] = useState<SimpleApiKey[]>([]);
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Load API keys from environment variables
    const keys = getAllApiKeys();
    setApiKeys(keys);
  }, []);

  const toggleKeyVisibility = (keyName: string) => {
    setVisibleKeys(prev => ({
      ...prev,
      [keyName]: !prev[keyName]
    }));
  };

  const maskKey = (key: string) => {
    if (!key) return 'Not set';
    if (key.length <= 8) return '••••••••';
    return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
  };

  return (
    <div className="space-y-6">
      <SectionCard title="API Key Configuration" icon={<KeyIcon className="w-6 h-6 text-green-600" />}>
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Environment Variables:</strong> API keys are configured via environment variables for security. 
            In production, set these in your Railway dashboard or deployment environment.
          </p>
        </div>
        
        <div className="space-y-4">
          {apiKeys.map((apiKey) => (
            <div key={apiKey.name} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <h4 className="text-lg font-medium text-gray-900">{apiKey.name}</h4>
                  {apiKey.value ? (
                    <CheckCircleIcon className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircleIcon className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-3">{apiKey.description}</p>

              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <code className="flex-1 p-2 bg-white border border-gray-300 rounded text-sm font-mono">
                    {visibleKeys[apiKey.name] ? (apiKey.value || 'Not set') : maskKey(apiKey.value)}
                  </code>
                  <Button
                    onClick={() => toggleKeyVisibility(apiKey.name)}
                    className="!py-1 !px-2 bg-gray-500 hover:bg-gray-600 text-white"
                    aria-label={visibleKeys[apiKey.name] ? 'Hide key' : 'Show key'}
                  >
                    {visibleKeys[apiKey.name] ? (
                      <EyeSlashIcon className="w-4 h-4" />
                    ) : (
                      <EyeIcon className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                
                {!apiKey.value && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                    <p className="text-sm text-yellow-800">
                      <strong>Not configured:</strong> Set the environment variable <code>VITE_{apiKey.name}</code> to configure this API key.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-2 text-xs text-gray-500">
                Source: Environment Variable
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">How to Configure API Keys</h4>
          <div className="text-sm text-gray-600 space-y-2">
            <p><strong>Development:</strong> Add keys to your <code>.env</code> file:</p>
            <pre className="bg-gray-100 p-2 rounded text-xs">
{`VITE_GEMINI_API_KEY=your_key_here
VITE_OPENAI_API_KEY=your_key_here
VITE_GOOGLE_SEARCH_API_KEY=your_key_here`}
            </pre>
            <p><strong>Production:</strong> Set environment variables in Railway dashboard under Variables.</p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
};
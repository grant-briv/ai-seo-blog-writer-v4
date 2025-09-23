import React, { useState, useEffect } from 'react';
import { keywordsEverywhereService } from '../services/keywordsEverywhereService';
import type { KeywordsEverywhereConfig } from '../types';

interface KeywordsEverywhereConfigProps {
  config?: KeywordsEverywhereConfig;
  onConfigUpdate?: (config: KeywordsEverywhereConfig) => void;
}

const KeywordsEverywhereConfig: React.FC<KeywordsEverywhereConfigProps> = ({ config, onConfigUpdate }) => {
  const [localConfig, setLocalConfig] = useState<KeywordsEverywhereConfig>({
    apiKey: '',
    isEnabled: false
  });
  const [showConfig, setShowConfig] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Initialize local config from props
  useEffect(() => {
    if (config) {
      setLocalConfig(config);
    }
  }, [config]);

  const isConfigured = keywordsEverywhereService.isConfigured(localConfig);

  const handleConfigChange = (field: keyof KeywordsEverywhereConfig, value: any) => {
    const newConfig = { ...localConfig, [field]: value };
    setLocalConfig(newConfig);
    if (onConfigUpdate) {
      onConfigUpdate(newConfig);
    }
  };

  const testConnection = async () => {
    if (!localConfig.apiKey) {
      setTestResult({ success: false, message: 'Please enter an API key first' });
      return;
    }

    setIsTestingConnection(true);
    setTestResult(null);

    try {
      // Test with a simple keyword
      await keywordsEverywhereService.getKeywordData(['test'], localConfig);
      setTestResult({ success: true, message: 'Connection successful! API key is working.' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setTestResult({ success: false, message: `Connection failed: ${errorMessage}` });
    } finally {
      setIsTestingConnection(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            🔍 Keywords Everywhere Integration
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Configure Keywords Everywhere API for advanced keyword research
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            isConfigured 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {isConfigured ? '✓ Configured' : '✗ Not Configured'}
          </div>
          <button
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            {showConfig ? 'Hide Config' : 'Configure'}
          </button>
        </div>
      </div>

      {showConfig && (
        <div className="space-y-4 border-t pt-4">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div className="flex items-start">
              <div className="text-blue-600 mt-0.5 mr-2">ℹ️</div>
              <div>
                <h4 className="text-sm font-medium text-blue-900">Setup Instructions</h4>
                <div className="text-sm text-blue-800 mt-1 space-y-1">
                  <p>1. Sign up for Keywords Everywhere at <a href="https://keywordseverywhere.com" target="_blank" rel="noopener noreferrer" className="underline">keywordseverywhere.com</a></p>
                  <p>2. Navigate to your API settings to get your API key</p>
                  <p>3. Enter your API key below and enable the integration</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={localConfig.apiKey}
                onChange={(e) => handleConfigChange('apiKey', e.target.value)}
                placeholder="Enter your Keywords Everywhere API key"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Your API key is stored locally and used only for API calls to Keywords Everywhere
              </p>
            </div>

            <div className="flex items-center">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localConfig.isEnabled}
                  onChange={(e) => handleConfigChange('isEnabled', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Enable Keywords Everywhere integration
                </span>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={testConnection}
                disabled={isTestingConnection || !localConfig.apiKey}
                className="px-4 py-2 btn btn-primary text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTestingConnection ? 'Testing...' : 'Test Connection'}
              </button>
            </div>

            {testResult && (
              <div className={`p-3 rounded-md ${
                testResult.success 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-start">
                  <div className={`mt-0.5 mr-2 ${
                    testResult.success ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {testResult.success ? '✅' : '❌'}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${
                      testResult.success ? 'text-green-900' : 'text-red-900'
                    }`}>
                      {testResult.success ? 'Success!' : 'Error'}
                    </p>
                    <p className={`text-sm ${
                      testResult.success ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {testResult.message}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <div className="flex items-start">
              <div className="text-yellow-600 mt-0.5 mr-2">⚠️</div>
              <div>
                <h4 className="text-sm font-medium text-yellow-900">Usage Notes</h4>
                <div className="text-sm text-yellow-800 mt-1 space-y-1">
                  <p>• Keywords Everywhere is a paid service with API credits</p>
                  <p>• Each keyword research request uses API credits</p>
                  <p>• Monitor your usage in your Keywords Everywhere dashboard</p>
                  <p>• This integration works best for English keywords</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KeywordsEverywhereConfig;
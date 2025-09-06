import React, { useState, useEffect } from 'react';
import { googleSearchService } from '../services/googleSearchService';
import type { GoogleSearchConfig } from '../types';

interface GoogleSearchConfigProps {
  config?: GoogleSearchConfig;
  onConfigUpdate?: (config: GoogleSearchConfig) => void;
}

const GoogleSearchConfig: React.FC<GoogleSearchConfigProps> = ({ config, onConfigUpdate }) => {
  const [apiKey, setApiKey] = useState(config?.apiKey || '');
  const [searchEngineId, setSearchEngineId] = useState(config?.searchEngineId || '');
  const [isEnabled, setIsEnabled] = useState(config?.isEnabled || false);
  const [showConfig, setShowConfig] = useState(false);
  const [testQuery, setTestQuery] = useState('');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Update local state when config prop changes
  useEffect(() => {
    if (config) {
      setApiKey(config.apiKey || '');
      setSearchEngineId(config.searchEngineId || '');
      setIsEnabled(config.isEnabled || false);
    }
  }, [config]);

  const isConfigured = !!(config && config.apiKey && config.searchEngineId);

  const handleSaveCredentials = () => {
    if (!apiKey.trim() || !searchEngineId.trim()) {
      alert('Please enter both API Key and Search Engine ID');
      return;
    }

    const newConfig: GoogleSearchConfig = {
      apiKey: apiKey.trim(),
      searchEngineId: searchEngineId.trim(),
      isEnabled: isEnabled
    };

    setShowConfig(false);
    onConfigUpdate?.(newConfig);
    alert('Google Search API configured successfully!');
  };

  const handleTestConnection = async () => {
    if (!testQuery.trim()) {
      setTestResult({ success: false, message: 'Please enter a test query' });
      return;
    }

    if (!apiKey.trim() || !searchEngineId.trim()) {
      setTestResult({ success: false, message: 'Please configure API key and Search Engine ID first' });
      return;
    }

    setIsTestingConnection(true);
    setTestResult(null);

    try {
      const testConfig: GoogleSearchConfig = {
        apiKey: apiKey.trim(),
        searchEngineId: searchEngineId.trim(),
        isEnabled: true
      };

      const results = await googleSearchService.searchWeb(testQuery, testConfig, { num: 3 });
      if (results.length > 0) {
        setTestResult({
          success: true,
          message: `Success! Found ${results.length} results. First result: "${results[0].title}"`
        });
      } else {
        setTestResult({
          success: false,
          message: 'No results found for the test query'
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setTestResult({
        success: false,
        message: `Error: ${errorMessage}`
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Google Custom Search API</h3>
          <p className="text-sm text-gray-600">
            Configure Google Custom Search API for improved external link suggestions
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
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-4">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                className="mr-2"
              />
              Enable Google Custom Search for this profile
            </label>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Google API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your Google Custom Search API key"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Get your API key from the{' '}
              <a 
                href="https://console.cloud.google.com/apis/credentials" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Google Cloud Console
              </a>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Engine ID
            </label>
            <input
              type="text"
              value={searchEngineId}
              onChange={(e) => setSearchEngineId(e.target.value)}
              placeholder="Enter your Custom Search Engine ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Create a search engine at{' '}
              <a 
                href="https://programmablesearchengine.google.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Programmable Search Engine
              </a>
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSaveCredentials}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              Save Configuration
            </button>
            <button
              type="button"
              onClick={() => setShowConfig(false)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm font-medium"
            >
              Cancel
            </button>
          </div>

          {/* Test Connection Section */}
          {isConfigured && (
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Test Connection</h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                  placeholder="Enter a test search query"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTestingConnection}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-400 text-sm font-medium"
                >
                  {isTestingConnection ? 'Testing...' : 'Test'}
                </button>
              </div>

              {testResult && (
                <div className={`mt-3 p-3 rounded-md text-sm ${
                  testResult.success 
                    ? 'bg-green-50 border border-green-200 text-green-800' 
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}>
                  {testResult.message}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Setup Instructions */}
      {!isConfigured && !showConfig && (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                Setup Required
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>To use improved external link suggestions, you need to:</p>
                <ol className="list-decimal list-inside mt-2 space-y-1">
                  <li>Create a Google Cloud project and enable Custom Search API</li>
                  <li>Get an API key from Google Cloud Console</li>
                  <li>Create a Programmable Search Engine</li>
                  <li>Configure the credentials above</li>
                </ol>
                <p className="mt-2 text-xs">
                  Note: Google provides 100 free searches per day, then $5 per 1000 searches.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleSearchConfig;
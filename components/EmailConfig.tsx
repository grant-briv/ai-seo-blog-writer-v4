import React, { useState, useEffect } from 'react';
import { emailService } from '../services/emailService';
import type { EmailConfig } from '../services/emailService';

interface EmailConfigProps {
  config?: EmailConfig;
  onConfigUpdate?: (config: EmailConfig) => void;
}

const EmailConfigComponent: React.FC<EmailConfigProps> = ({ config, onConfigUpdate }) => {
  const [serviceId, setServiceId] = useState(config?.serviceId || '');
  const [templateId, setTemplateId] = useState(config?.templateId || '');
  const [publicKey, setPublicKey] = useState(config?.publicKey || '');
  const [isEnabled, setIsEnabled] = useState(config?.isEnabled || false);
  const [showConfig, setShowConfig] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Update local state when config prop changes
  useEffect(() => {
    if (config) {
      setServiceId(config.serviceId || '');
      setTemplateId(config.templateId || '');
      setPublicKey(config.publicKey || '');
      setIsEnabled(config.isEnabled || false);
    }
  }, [config]);

  const isConfigured = !!(config && config.serviceId && config.publicKey);

  const handleSaveCredentials = () => {
    if (!serviceId.trim() || !publicKey.trim()) {
      alert('Please enter both Service ID and Public Key');
      return;
    }

    const newConfig: EmailConfig = {
      serviceId: serviceId.trim(),
      templateId: templateId.trim(),
      publicKey: publicKey.trim(),
      isEnabled: isEnabled
    };

    setShowConfig(false);
    onConfigUpdate?.(newConfig);
    
    // Configure the email service
    emailService.configure(newConfig);
    
    alert('Email service configured successfully!');
  };

  const handleTestEmail = async () => {
    if (!testEmail.trim()) {
      setTestResult({ success: false, message: 'Please enter a test email address' });
      return;
    }

    if (!serviceId.trim() || !publicKey.trim()) {
      setTestResult({ success: false, message: 'Please configure email service first' });
      return;
    }

    setIsTestingEmail(true);
    setTestResult(null);

    try {
      const testConfig: EmailConfig = {
        serviceId: serviceId.trim(),
        templateId: templateId.trim(),
        publicKey: publicKey.trim(),
        isEnabled: true
      };

      emailService.configure(testConfig);

      const result = await emailService.sendInvitationEmail({
        userEmail: testEmail,
        inviterName: 'Test Admin',
        tempPassword: 'TestPass123',
        loginUrl: window.location.origin,
        companyName: 'AI SEO Blog Writer (Test)'
      });

      setTestResult(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setTestResult({
        success: false,
        message: `Error: ${errorMessage}`
      });
    } finally {
      setIsTestingEmail(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Email Service Configuration</h3>
          <p className="text-sm text-gray-600">
            Configure email service for user invitations and password resets
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
              Enable email service for invitations and password resets
            </label>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Service ID
            </label>
            <input
              type="text"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              placeholder="Enter your email service ID (e.g., EmailJS Service ID)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Template ID (Optional)
            </label>
            <input
              type="text"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              placeholder="Enter your email template ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Public Key
            </label>
            <input
              type="password"
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              placeholder="Enter your public key"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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

          {/* Test Email Section */}
          {isConfigured && (
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Test Email Service</h4>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="Enter test email address"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button
                  type="button"
                  onClick={handleTestEmail}
                  disabled={isTestingEmail}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-400 text-sm font-medium"
                >
                  {isTestingEmail ? 'Sending...' : 'Test'}
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
                Email Setup Required
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>To enable user invitations and password resets, configure an email service:</p>
                <ol className="list-decimal list-inside mt-2 space-y-1">
                  <li>Sign up for an email service (EmailJS, SendGrid, etc.)</li>
                  <li>Get your Service ID and Public Key</li>
                  <li>Configure the credentials above</li>
                  <li>Test the connection</li>
                </ol>
                <p className="mt-2 text-xs">
                  Popular services: EmailJS (free tier), SendGrid, Mailgun, AWS SES
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailConfigComponent;
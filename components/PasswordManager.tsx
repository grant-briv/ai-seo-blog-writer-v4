import React, { useState } from 'react';
import { Button } from './Button';
import { TextInput } from './TextInput';
import { SectionCard } from './SectionCard';
import { KeyIcon, CheckCircleIcon, XCircleIcon } from './Icons';
import type { User } from '../types';
import { updateUserPassword, adminResetUserPassword, validatePasswordStrength } from '../services/authService';

interface PasswordManagerProps {
  currentUser: User;
  allUsers?: User[];
  onUsersChange?: () => void;
}

export const PasswordManager: React.FC<PasswordManagerProps> = ({ 
  currentUser, 
  allUsers = [], 
  onUsersChange 
}) => {
  // Change own password states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changeError, setChangeError] = useState('');
  const [changeSuccess, setChangeSuccess] = useState('');

  // Admin reset states
  const [resetUsername, setResetUsername] = useState('');
  const [adminResetPassword, setAdminResetPassword] = useState('');
  const [adminResetConfirm, setAdminResetConfirm] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeError('');
    setChangeSuccess('');

    if (newPassword !== confirmPassword) {
      setChangeError('New passwords do not match');
      return;
    }

    const validation = validatePasswordStrength(newPassword);
    if (!validation.isValid) {
      setChangeError(validation.errors.join('. '));
      return;
    }

    try {
      const result = await updateUserPassword(currentUser.id, currentPassword, newPassword);
      if (result.success) {
        setChangeSuccess('Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setChangeSuccess(''), 5000);
      } else {
        setChangeError(result.error || 'Failed to change password');
      }
    } catch (error) {
      setChangeError('An error occurred. Please try again.');
    }
  };

  const handleAdminReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');

    if (!resetUsername) {
      setResetError('Please enter a username');
      return;
    }

    if (adminResetPassword !== adminResetConfirm) {
      setResetError('Passwords do not match');
      return;
    }

    const validation = validatePasswordStrength(adminResetPassword);
    if (!validation.isValid) {
      setResetError(validation.errors.join('. '));
      return;
    }

    try {
      const result = await adminResetUserPassword(currentUser.id, resetUsername, adminResetPassword);
      if (result.success) {
        setResetSuccess(`Password reset successfully for user: ${resetUsername}`);
        setResetUsername('');
        setAdminResetPassword('');
        setAdminResetConfirm('');
        setTimeout(() => setResetSuccess(''), 5000);
        if (onUsersChange) onUsersChange();
      } else {
        setResetError(result.error || 'Failed to reset password');
      }
    } catch (error) {
      setResetError('An error occurred. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard title="Change Your Password" icon={<KeyIcon className="w-6 h-6 text-blue-600" />}>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <TextInput
            label="Current Password"
            name="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter your current password"
            isRequired
          />
          <TextInput
            label="New Password"
            name="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new secure password"
            isRequired
          />
          <TextInput
            label="Confirm New Password"
            name="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            isRequired
          />
          <div className="bg-blue-50 border border-blue-200 text-blue-800 px-3 py-2 rounded text-sm">
            <strong>Password Requirements:</strong>
            <ul className="mt-1 ml-4 list-disc text-xs">
              <li>At least 8 characters long</li>
              <li>Include uppercase and lowercase letters</li>
              <li>Include at least one number</li>
              <li>Include at least one special character (!@#$%^&*(),.?":{}|&lt;&gt;)</li>
            </ul>
          </div>
          {changeError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm flex items-center">
              <XCircleIcon className="w-4 h-4 mr-2" />
              {changeError}
            </div>
          )}
          {changeSuccess && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-3 py-2 rounded text-sm flex items-center">
              <CheckCircleIcon className="w-4 h-4 mr-2" />
              {changeSuccess}
            </div>
          )}
          <Button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            disabled={!currentPassword || !newPassword || !confirmPassword}
          >
            Change Password
          </Button>
        </form>
      </SectionCard>

      {currentUser.role === 'admin' && (
        <SectionCard title="Admin: Reset User Password" icon={<KeyIcon className="w-6 h-6 text-red-600" />}>
          <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 px-4 py-3 rounded-lg mb-4 text-sm">
            <p><strong>Admin Function:</strong> Reset any user's password. Use this responsibly and only when necessary.</p>
          </div>
          <form onSubmit={handleAdminReset} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select User to Reset
              </label>
              {allUsers.length > 0 ? (
                <select
                  value={resetUsername}
                  onChange={(e) => setResetUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  required
                >
                  <option value="">Select a user...</option>
                  {allUsers.map((user) => (
                    <option key={user.id} value={user.username}>
                      {user.username} ({user.role})
                    </option>
                  ))}
                </select>
              ) : (
                <TextInput
                  label=""
                  name="resetUsername"
                  value={resetUsername}
                  onChange={(e) => setResetUsername(e.target.value)}
                  placeholder="Enter username to reset"
                  isRequired
                />
              )}
            </div>
            <TextInput
              label="New Password for User"
              name="adminResetPassword"
              type="password"
              value={adminResetPassword}
              onChange={(e) => setAdminResetPassword(e.target.value)}
              placeholder="Enter new password for user"
              isRequired
            />
            <TextInput
              label="Confirm New Password"
              name="adminResetConfirm"
              type="password"
              value={adminResetConfirm}
              onChange={(e) => setAdminResetConfirm(e.target.value)}
              placeholder="Confirm new password"
              isRequired
            />
            {resetError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm flex items-center">
                <XCircleIcon className="w-4 h-4 mr-2" />
                {resetError}
              </div>
            )}
            {resetSuccess && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-3 py-2 rounded text-sm flex items-center">
                <CheckCircleIcon className="w-4 h-4 mr-2" />
                {resetSuccess}
              </div>
            )}
            <Button 
              type="submit" 
              className="w-full bg-red-600 hover:bg-red-700 text-white"
              disabled={!resetUsername || !adminResetPassword || !adminResetConfirm}
            >
              Reset User Password
            </Button>
          </form>
        </SectionCard>
      )}
    </div>
  );
};
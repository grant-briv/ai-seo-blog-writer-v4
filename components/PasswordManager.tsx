import React, { useState } from 'react';
import { Button } from './Button';
import { TextInput } from './TextInput';
import { SectionCard } from './SectionCard';
import { KeyIcon, CheckCircleIcon, XCircleIcon } from './Icons';
import type { User } from '../types';
import { validatePasswordStrength } from '../services/passwordValidation';
import { changePassword, adminResetPassword } from '../services/userServiceApi';

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
  const [adminResetPasswordValue, setAdminResetPasswordValue] = useState('');
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
      await changePassword(currentUser.id, currentPassword, newPassword);
      setChangeSuccess('Password changed successfully! You will be logged out in 3 seconds for security.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Log out the user after password change for security
      setTimeout(() => {
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('currentUser');
        window.location.reload();
      }, 3000);
    } catch (error) {
      setChangeError('An error occurred. Please try again.');
    }
  };

  const handleDirectPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');

    if (!resetUsername) {
      setResetError('Please select a user');
      return;
    }

    if (adminResetPasswordValue !== adminResetConfirm) {
      setResetError('Passwords do not match');
      return;
    }

    const validation = validatePasswordStrength(adminResetPasswordValue);
    if (!validation.isValid) {
      setResetError(validation.errors.join('. '));
      return;
    }

    try {
      await adminResetPassword(resetUsername, adminResetPasswordValue);
      setResetSuccess(`Password reset successfully for user: ${resetUsername}`);
      setResetUsername('');
      setAdminResetPasswordValue('');
      setAdminResetConfirm('');
      setTimeout(() => setResetSuccess(''), 5000);
      if (onUsersChange) onUsersChange();
    } catch (error) {
      setResetError('An error occurred. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard title="Change Your Password" icon={<KeyIcon className="w-6 h-6 text-place-teal" />}>
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
              <li>Include at least one special character (!@#$%^&*(),.?\":{}|&lt;&gt;)</li>
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
            className="w-full btn btn-primary"
            disabled={!currentPassword || !newPassword || !confirmPassword}
          >
            Change Password
          </Button>
        </form>
      </SectionCard>

      {currentUser.role === 'admin' && (
        <SectionCard title="Admin: Direct Password Reset" icon={<KeyIcon className="w-6 h-6 text-place-teal" />}>
          <div className="bg-blue-50 border border-blue-300 text-blue-800 px-4 py-3 rounded-lg mb-4 text-sm">
            <p><strong>Admin Function:</strong> Directly reset user passwords without requiring their current password.</p>
          </div>
          
          <form onSubmit={handleDirectPasswordReset} className="space-y-4">
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
              value={adminResetPasswordValue}
              onChange={(e) => setAdminResetPasswordValue(e.target.value)}
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
            <Button 
              type="submit" 
              className="w-full btn btn-primary"
              disabled={!resetUsername || !adminResetPasswordValue || !adminResetConfirm}
            >
              Reset User Password
            </Button>
          </form>
          
          {resetError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm flex items-center mt-4">
              <XCircleIcon className="w-4 h-4 mr-2" />
              {resetError}
            </div>
          )}
          {resetSuccess && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-3 py-2 rounded text-sm flex items-center mt-4">
              <CheckCircleIcon className="w-4 h-4 mr-2" />
              {resetSuccess}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
};
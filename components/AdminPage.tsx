import React, { useState, useEffect } from 'react';
import type { AiWriterProfile, User } from '../types';
import { Button } from './Button';
import { SectionCard } from './SectionCard';
import { ArrowLeftIcon, PlusCircleIcon, TrashIcon, UserGroupIcon, SaveIcon } from './Icons';
import { getUsers, createUser as createUserApi, updateUser as updateUserApi, deleteUser as deleteUserApi, adminResetPassword } from '../services/userServiceApi';
import { validatePasswordStrength } from '../services/passwordValidation';
import { TextInput } from './TextInput';
import { SimpleApiKeyManager } from './SimpleApiKeyManager';
import { PasswordManager } from './PasswordManager';
import EmailConfigComponent from './EmailConfig';
import { emailService } from '../services/emailService';
import type { EmailConfig } from '../services/emailService';

interface AdminPageProps {
  profiles: AiWriterProfile[];
  setCurrentView: (view: 'main' | 'admin') => void;
  currentUser: User;
}

// --- User Management Component (for Admins) ---
const UserManagement: React.FC<{ allProfiles: AiWriterProfile[]; emailConfig?: EmailConfig }> = ({ allProfiles, emailConfig }) => {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const loadedUsers = await getUsers();
        setUsers(loadedUsers);
      } catch (e) {
        console.error('Failed to load users:', e);
        // Fallback to empty array if database fails
        setUsers([]);
      }
    };
    loadUsers();
  }, []);
  const [editingUser, setEditingUser] = useState<User | null | 'new'>(null);

  const handleSaveUser = async (userToSave: User) => {
    try {
      const existingIndex = users.findIndex(u => u.id === userToSave.id);
      let updatedUsers;

      if (existingIndex > -1) {
        // Update existing user via API
        const updatedUser = await updateUserApi(userToSave.id, userToSave);
        updatedUsers = [...users];
        updatedUsers[existingIndex] = updatedUser;
      } else {
        // Create new user - this should never happen as we handle creation in UserForm
        updatedUsers = [...users, userToSave];
      }
      
      setUsers(updatedUsers);
      setEditingUser(null);
    } catch (error) {
      console.error('Failed to save user:', error);
      alert(`Failed to save user: ${error.message}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const userToDelete = users.find(u => u.id === userId);
    if (!userToDelete) return;
    
    if (userToDelete.role === 'admin' && users.filter(u => u.role === 'admin').length <= 1) {
      alert("You cannot delete the last administrator.");
      return;
    }
    if (window.confirm(`Are you sure you want to delete the user "${userToDelete.username}"? This action cannot be undone.`)) {
      try {
        await deleteUserApi(userId);
        const updatedUsers = users.filter(u => u.id !== userId);
        setUsers(updatedUsers);

        if (typeof editingUser !== 'string' && editingUser?.id === userId) {
          setEditingUser(null);
        }
      } catch (error) {
        console.error('Failed to delete user:', error);
        alert(`Failed to delete user: ${error.message}`);
      }
    }
  };

  const UserForm: React.FC<{ user: User | null; onSave: (user: User) => void; onCancel: () => void; }> = ({ user, onSave, onCancel }) => {
    const [username, setUsername] = useState(user?.username || '');
    const [email, setEmail] = useState(user?.email || '');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'admin' | 'general'>(user?.role || 'general');
    const [assignedProfileIds, setAssignedProfileIds] = useState<string[]>(user?.assignedProfileIds || []);
    const [shouldSendInvite, setShouldSendInvite] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setIsLoading(true);
      
      if (!username.trim()) {
        setError("Username is required.");
        setIsLoading(false);
        return;
      }
      
      if (shouldSendInvite && !email.trim()) {
        setError("Email is required when sending invitations.");
        setIsLoading(false);
        return;
      }
      
      if (!user && !password && !shouldSendInvite) {
        setError("Password is required for new users (or select 'Send Invitation').");
        setIsLoading(false);
        return;
      }
      
      if (users.some(u => u.username.toLowerCase() === username.toLowerCase() && u.id !== user?.id)) {
        setError("Username already exists.");
        setIsLoading(false);
        return;
      }

      try {
        if (user) {
          // Updating existing user
          if (password) {
            // Password change for existing user - admin can reset any user password
            const passwordValidation = validatePasswordStrength(password);
            if (!passwordValidation.isValid) {
              setError(passwordValidation.errors.join('; '));
              setIsLoading(false);
              return;
            }
            
            // Reset password via API
            await adminResetPassword(user.id, password);
          }
          
          // Update user details via API
          const updateData: Partial<User> = {
            username: username.trim(),
            email: email.trim() || undefined,
            role,
            assignedProfileIds: role === 'admin' ? [] : assignedProfileIds
          };
          
          const updatedUser = await updateUserApi(user.id, updateData);
          
          // Update local state
          const updatedUsers = users.map(u => u.id === user.id ? updatedUser : u);
          setUsers(updatedUsers);
        } else {
          // Creating new user via API
          console.log('🔧 DEBUG: Starting API user creation process');
          
          let finalPassword = password;
          
          // If sending invite, generate temporary password
          if (shouldSendInvite && emailService.isConfigured()) {
            finalPassword = emailService.generateTempPassword();
            console.log('🔧 DEBUG: Generated temp password for invitation');
          }
          
          if (!finalPassword) {
            finalPassword = 'TempPassword123!'; // Fallback secure password
            console.log('🔧 DEBUG: Using fallback password');
          }
          
          // Create user via API
          const newUser = await createUserApi({
            username: username.trim(),
            password: finalPassword,
            email: email.trim() || undefined,
            role,
            assignedProfileIds: role === 'admin' ? [] : assignedProfileIds
          });
          
          console.log('🔧 DEBUG: User created successfully via API');
          
          // Update local state
          const userForState = { ...newUser, isTemporaryPassword: shouldSendInvite };
          setUsers([...users, userForState]);
          
          // Send invitation email if requested
          if (shouldSendInvite && email.trim() && emailService.isConfigured()) {
            const inviteResult = await emailService.sendInvitationEmail({
              userEmail: email.trim(),
              inviterName: 'Admin',
              tempPassword: finalPassword,
              loginUrl: window.location.origin,
              companyName: 'AI SEO Blog Writer'
            });
            
            if (!inviteResult.success) {
              setError(`User created but invitation failed: ${inviteResult.message}`);
            }
          }
        }
        
        setEditingUser(null);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    const handleProfileSelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedOptions = Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value);
        setAssignedProfileIds(selectedOptions);
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4 bg-gray-50 p-6 rounded-lg shadow-inner border">
        <h4 className="text-lg font-semibold text-sky-800">{user ? `Edit ${user.username}` : 'Create New User'}</h4>
        {error && <p className="text-red-600 bg-red-100 p-2 rounded-md border border-red-300 text-sm" role="alert">{error}</p>}
        <TextInput label="Username" name="username" value={username} onChange={e => setUsername(e.target.value)} isRequired />
        <TextInput label="Email Address" name="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" />
        
        {/* Invitation option for new users */}
        {!user && emailService.isConfigured() && (
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <input
                type="checkbox"
                checked={shouldSendInvite}
                onChange={(e) => setShouldSendInvite(e.target.checked)}
                className="mr-2"
              />
              📧 Send invitation email (generates temporary password automatically)
            </label>
          </div>
        )}
        
        <TextInput 
          label={`Password ${user ? '(leave blank to keep current)' : shouldSendInvite ? '(auto-generated)' : ''}`} 
          name="password" 
          type="password" 
          value={shouldSendInvite ? '' : password} 
          onChange={e => setPassword(e.target.value)} 
          isRequired={!user && !shouldSendInvite}
          disabled={shouldSendInvite}
          placeholder={shouldSendInvite ? 'Temporary password will be generated and sent via email' : ''}
        />
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select value={role} onChange={e => setRole(e.target.value as 'admin' | 'general')} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
            <option value="general">General User</option>
            <option value="admin">Administrator</option>
          </select>
        </div>

        {role === 'general' && (
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign Writer Profiles</label>
                <select 
                    multiple 
                    value={assignedProfileIds} 
                    onChange={handleProfileSelection} 
                    className="w-full h-32 px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                    {allProfiles.filter(profile => profile.isPublic).map(profile => (
                        <option key={profile.id} value={profile.id}>{profile.agentName}</option>
                    ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple profiles. Only public profiles can be assigned to users.</p>
             </div>
        )}

        <div className="flex space-x-3 pt-2">
          <Button type="submit" className="bg-sky-600 hover:bg-sky-700 text-white flex-1" disabled={isLoading}>
            <SaveIcon className="w-5 h-5 mr-2" /> {isLoading ? 'Saving...' : 'Save User'}
          </Button>
          <Button type="button" onClick={onCancel} variant="secondary" className="flex-1">
            Cancel
          </Button>
        </div>
      </form>
    );
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-end mb-4">
        {editingUser === null && (
          <Button onClick={() => setEditingUser('new')} className="bg-sky-600 hover:bg-sky-700 text-white">
            <PlusCircleIcon className="w-5 h-5 mr-2" /> Add New User
          </Button>
        )}
      </div>

      {editingUser !== null && (
        <UserForm 
          user={editingUser === 'new' ? null : editingUser} 
          onSave={handleSaveUser} 
          onCancel={() => setEditingUser(null)} 
        />
      )}

      <div className="mt-6 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Username</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Role</th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{user.username}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 capitalize">{user.role}</td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <div className="flex items-center justify-end gap-2">
                          <Button onClick={() => setEditingUser(user)} variant="secondary" className="!py-1 !px-3 text-sky-600 hover:text-sky-800">Edit</Button>
                          <Button onClick={() => handleDeleteUser(user.id)} variant="danger" className="!py-1 !px-3">
                            <TrashIcon className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AdminPage: React.FC<AdminPageProps> = ({ profiles, setCurrentView, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'api' | 'password' | 'email'>('users');
  const [emailConfig, setEmailConfig] = useState<EmailConfig>();

  // Initialize email service when config changes
  useEffect(() => {
    if (emailConfig) {
      emailService.configure(emailConfig);
    }
  }, [emailConfig]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-sky-700">Admin Dashboard</h1>
        <Button 
          onClick={() => setCurrentView('main')} 
          variant="secondary"
          className="flex items-center"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Back to Main App
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {[
            { key: 'users', label: 'User Management', icon: UserGroupIcon },
            { key: 'email', label: 'Email Configuration', icon: UserGroupIcon },
            { key: 'api', label: 'API Configuration', icon: UserGroupIcon },
            { key: 'password', label: 'Password Management', icon: UserGroupIcon }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`${
                activeTab === key
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium flex items-center`}
            >
              <Icon className="w-5 h-5 mr-2" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'users' && (
          <SectionCard title="User Management" icon={<UserGroupIcon className="w-6 h-6 text-sky-600"/>}>
            <UserManagement allProfiles={profiles} emailConfig={emailConfig} />
          </SectionCard>
        )}

        {activeTab === 'email' && (
          <SectionCard title="Email Configuration" icon={<UserGroupIcon className="w-6 h-6 text-sky-600"/>}>
            <EmailConfigComponent 
              config={emailConfig} 
              onConfigUpdate={setEmailConfig} 
            />
          </SectionCard>
        )}

        {activeTab === 'api' && (
          <SectionCard title="API Configuration" icon={<UserGroupIcon className="w-6 h-6 text-sky-600"/>}>
            <SimpleApiKeyManager currentUser={currentUser} />
          </SectionCard>
        )}

        {activeTab === 'password' && (
          <SectionCard title="Password Management" icon={<UserGroupIcon className="w-6 h-6 text-sky-600"/>}>
            <PasswordManager currentUser={currentUser} />
          </SectionCard>
        )}
      </div>
    </div>
  );
};
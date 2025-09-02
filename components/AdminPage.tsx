
import React, { useState } from 'react';
import type { AiWriterProfile, User } from '../types';
import { Button } from './Button';
import { SectionCard } from './SectionCard';
import { ArrowLeftIcon, PlusCircleIcon, TrashIcon, UserGroupIcon, SaveIcon } from './Icons';
import { getUsers, saveUsers } from '../services/userService';
import { TextInput } from './TextInput';

interface AdminPageProps {
  profiles: AiWriterProfile[];
  setCurrentView: (view: 'main' | 'admin') => void;
  currentUser: User;
}

// --- User Management Component (for Admins) ---
const UserManagement: React.FC<{ allProfiles: AiWriterProfile[] }> = ({ allProfiles }) => {
  const [users, setUsers] = useState<User[]>(() => getUsers());
  const [editingUser, setEditingUser] = useState<User | null | 'new'>(null);

  const handleSaveUser = (userToSave: User) => {
    let updatedUsers;
    const existingIndex = users.findIndex(u => u.id === userToSave.id);

    if (existingIndex > -1) {
      updatedUsers = [...users];
      updatedUsers[existingIndex] = userToSave;
    } else {
      updatedUsers = [...users, userToSave];
    }
    
    setUsers(updatedUsers);
    saveUsers(updatedUsers);
    setEditingUser(null);
  };

  const handleDeleteUser = (userId: string) => {
    const userToDelete = users.find(u => u.id === userId);
    if (!userToDelete) return;
    
    if (userToDelete.role === 'admin' && users.filter(u => u.role === 'admin').length <= 1) {
      alert("You cannot delete the last administrator.");
      return;
    }
    if (window.confirm(`Are you sure you want to delete the user "${userToDelete.username}"? This action cannot be undone.`)) {
      const updatedUsers = users.filter(u => u.id !== userId);
      setUsers(updatedUsers);
      saveUsers(updatedUsers);
      if (typeof editingUser !== 'string' && editingUser?.id === userId) {
        setEditingUser(null);
      }
    }
  };

  const UserForm: React.FC<{ user: User | null; onSave: (user: User) => void; onCancel: () => void; }> = ({ user, onSave, onCancel }) => {
    const [username, setUsername] = useState(user?.username || '');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'admin' | 'general'>(user?.role || 'general');
    const [assignedProfileIds, setAssignedProfileIds] = useState<string[]>(user?.assignedProfileIds || []);
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      if (!username.trim()) {
        setError("Username is required.");
        return;
      }
      if (!user && !password) {
        setError("Password is required for new users.");
        return;
      }
      if (users.some(u => u.username.toLowerCase() === username.toLowerCase() && u.id !== user?.id)) {
        setError("Username already exists.");
        return;
      }

      const updatedUser: User = {
        id: user?.id || crypto.randomUUID(),
        username: username.trim(),
        password: password ? password : user!.password, // This is insecure, but matches the demo structure
        role,
        assignedProfileIds: role === 'admin' ? [] : assignedProfileIds, // Admins have all profiles implicitly
      };
      onSave(updatedUser);
    };
    
    const handleProfileSelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
        setAssignedProfileIds(selectedOptions);
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4 bg-gray-50 p-6 rounded-lg shadow-inner border">
        <h4 className="text-lg font-semibold text-sky-800">{user ? `Edit ${user.username}` : 'Create New User'}</h4>
        {error && <p className="text-red-600 bg-red-100 p-2 rounded-md border border-red-300 text-sm" role="alert">{error}</p>}
        <TextInput label="Username" name="username" value={username} onChange={e => setUsername(e.target.value)} isRequired />
        <TextInput label={`Password ${user ? '(leave blank to keep current)' : ''}`} name="password" type="password" value={password} onChange={e => setPassword(e.target.value)} isRequired={!user} />
        
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
                    {allProfiles.map(profile => (
                        <option key={profile.id} value={profile.id}>{profile.agentName}</option>
                    ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple profiles.</p>
             </div>
        )}

        <div className="flex space-x-3 pt-2">
          <Button type="submit" className="bg-sky-600 hover:bg-sky-700 text-white flex-1">
            <SaveIcon className="w-5 h-5 mr-2" /> Save User
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
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 space-x-2">
                        <Button onClick={() => setEditingUser(user)} variant="secondary" className="!py-1 !px-3 text-sky-600 hover:text-sky-800">Edit</Button>
                        <Button onClick={() => handleDeleteUser(user.id)} variant="danger" className="!py-1 !px-3">
                          <TrashIcon className="w-4 h-4" />
                        </Button>
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


// --- Main Admin Page Component ---
export const AdminPage: React.FC<AdminPageProps> = ({ profiles, setCurrentView, currentUser }) => {

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-4 md:p-8 font-sans">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-sky-700">Settings</h1>
        <Button
          onClick={() => setCurrentView('main')}
          variant="secondary"
          className="bg-white border-gray-300 hover:bg-gray-100"
        >
          <ArrowLeftIcon className="w-5 h-5 mr-2" /> Back to Main App
        </Button>
      </header>

      <div className="max-w-4xl mx-auto">
        {currentUser.role === 'admin' ? (
          <SectionCard title="User Management" icon={<UserGroupIcon className="w-6 h-6 text-sky-600"/>}>
             <UserManagement allProfiles={profiles} />
          </SectionCard>
        ) : (
           <p className="text-center text-gray-500 py-6">You do not have permission to view settings.</p>
        )}
      </div>
    </div>
  );
};
    
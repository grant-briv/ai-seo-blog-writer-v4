
import React from 'react';
import type { AiWriterProfile } from '../types';
import { UserCircleIcon } from './Icons';

interface WriterProfileSelectorProps {
  profiles: AiWriterProfile[];
  selectedProfileId: string | null;
  onSelectProfile: (profileId: string | null) => void;
}

export const WriterProfileSelector: React.FC<WriterProfileSelectorProps> = ({ profiles, selectedProfileId, onSelectProfile }) => {
  const handleSelectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onSelectProfile(value === "default" ? null : value);
  };

  return (
    <div className="mb-4">
      <label htmlFor="writerProfileSelector" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
        <UserCircleIcon className="w-5 h-5 mr-2 text-sky-600" />
        Active AI Writer Profile
      </label>
      <select
        id="writerProfileSelector"
        name="writerProfileSelector"
        value={selectedProfileId || "default"}
        onChange={handleSelectionChange}
        className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm 
                   focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-gray-900"
      >
        <option value="default">Default (No Specific Agent)</option>
        {profiles.map(profile => (
          <option key={profile.id} value={profile.id}>
            {profile.agentName}
          </option>
        ))}
      </select>
      {selectedProfileId && profiles.find(p => p.id === selectedProfileId) && (
        <p className="text-xs text-gray-500 mt-1">
            Using "{profiles.find(p => p.id === selectedProfileId)?.agentName}" profile.
        </p>
      )}
    </div>
  );
};
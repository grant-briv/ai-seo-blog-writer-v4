
import React, { useState, useMemo } from 'react';
import type { AiWriterProfile, User } from '../types';
import { Button } from './Button';
import { AiWriterProfileForm } from './AiWriterProfileForm';
import { PlusCircleIcon, TrashIcon } from './Icons';

interface WriterProfileManagerProps {
    profiles: AiWriterProfile[];
    setProfiles: React.Dispatch<React.SetStateAction<AiWriterProfile[]>>;
    currentUser: User;
}

export const WriterProfileManager: React.FC<WriterProfileManagerProps> = ({ profiles, setProfiles, currentUser }) => {
    const [editingProfile, setEditingProfile] = useState<AiWriterProfile | null | 'new'>(null);

    const visibleProfiles = useMemo(() => {
        if (currentUser.role === 'admin') {
          return profiles;
        }
        return profiles.filter(p => p.ownerId === currentUser.id || (currentUser.assignedProfileIds && currentUser.assignedProfileIds.includes(p.id)));
    }, [currentUser, profiles]);

    const handleSaveProfile = (profileToSave: AiWriterProfile) => {
        setProfiles(prev => {
          const existingIndex = prev.findIndex(p => p.id === profileToSave.id);
          if (existingIndex > -1) {
            const updatedProfiles = [...prev];
            updatedProfiles[existingIndex] = profileToSave;
            return updatedProfiles;
          }
          return [...prev, profileToSave];
        });
        setEditingProfile(null);
    };
    
    const handleDeleteProfile = (profileId: string) => {
        if (window.confirm("Are you sure you want to delete this AI Writer Profile? This action cannot be undone.")) {
          setProfiles(prev => prev.filter(p => p.id !== profileId));
          if (typeof editingProfile !== 'string' && editingProfile?.id === profileId) {
              setEditingProfile(null);
          }
        }
    };

    return (
        <>
            {editingProfile ? (
              <AiWriterProfileForm
                profile={editingProfile === 'new' ? null : editingProfile}
                onSave={handleSaveProfile}
                onCancel={() => setEditingProfile(null)}
                currentUserId={currentUser.id}
              />
            ) : (
              <div className="space-y-4">
                <Button
                  onClick={() => setEditingProfile('new')}
                  className="bg-green-500 hover:bg-green-600 text-white w-full sm:w-auto"
                >
                  <PlusCircleIcon className="w-5 h-5 mr-2" /> Create New Profile
                </Button>
                
                {visibleProfiles.length > 0 ? (
                  <ul className="space-y-3">
                    {visibleProfiles.map(profile => (
                      <li key={profile.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex-grow">
                            <p className="font-semibold text-gray-800">{profile.agentName}</p>
                            {currentUser.role === 'admin' && (
                                <p className="text-xs text-gray-500">
                                    Profile ID: {profile.id} | Owner ID: {profile.ownerId}
                                </p>
                            )}
                        </div>
                        <div className="flex space-x-2 mt-3 sm:mt-0 flex-shrink-0 self-end sm:self-center">
                          <Button onClick={() => setEditingProfile(profile)} variant="secondary" className="!py-1.5 !px-4">Edit</Button>
                          <Button onClick={() => handleDeleteProfile(profile.id)} variant="danger" className="!py-1.5 !px-4">
                            <TrashIcon className="w-4 h-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-center text-gray-500 py-6">No writer profiles found. Create one to get started!</p>
                )}
              </div>
            )}
        </>
    );
};
    
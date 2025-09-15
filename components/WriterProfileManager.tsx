
import React, { useState, useMemo } from 'react';
import type { AiWriterProfile, User } from '../types';
import { Button } from './Button';
import { AiWriterProfileForm } from './AiWriterProfileForm';
import { PlusCircleIcon, TrashIcon, DocumentDuplicateIcon } from './Icons';
import { DatabaseService } from '../services/databaseService';
import { deleteWriterProfile, saveWriterProfile } from '../services/writerProfileService';

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
        return profiles.filter(p => {
          // Show profiles if:
          // 1. User owns the profile
          // 2. User is assigned to the profile
          // 3. Profile is public (but mark as read-only for non-owners)
          return p.ownerId === currentUser.id || 
                 (currentUser.assignedProfileIds && currentUser.assignedProfileIds.includes(p.id)) ||
                 p.isPublic;
        });
    }, [currentUser, profiles]);

    const handleSaveProfile = async (profileToSave: AiWriterProfile) => {
        try {
          // Save to backend first
          const savedProfile = await saveWriterProfile(profileToSave);
          
          // Then update local state with the profile returned from backend (has correct ID)
          setProfiles(prev => {
            const existingIndex = prev.findIndex(p => p.id === profileToSave.id);
            if (existingIndex > -1) {
              const updatedProfiles = [...prev];
              updatedProfiles[existingIndex] = savedProfile;
              return updatedProfiles;
            }
            return [...prev, savedProfile];
          });
          setEditingProfile(null);
        } catch (error) {
          console.error('Failed to save profile:', error);
          alert('Error: Could not save writer profile. Please try again.');
        }
    };
    
    const handleDeleteProfile = async (profileId: string) => {
        if (window.confirm("Are you sure you want to delete this AI Writer Profile? This action cannot be undone.")) {
          try {
            // Delete from backend API or IndexedDB using the service
            await deleteWriterProfile(profileId);
            
            // Then remove from local state
            setProfiles(prev => prev.filter(p => p.id !== profileId));
            if (typeof editingProfile !== 'string' && editingProfile?.id === profileId) {
                setEditingProfile(null);
            }
          } catch (error) {
            console.error('Failed to delete profile:', error);
            alert('Error: Could not delete profile. Please try again.');
          }
        }
    };
    
    const handleDuplicateProfile = (profileToDuplicate: AiWriterProfile) => {
        const duplicatedProfile: AiWriterProfile = {
          ...profileToDuplicate,
          id: crypto.randomUUID(),
          ownerId: currentUser.id,
          agentName: `${profileToDuplicate.agentName} (Copy)`,
          isPublic: false // New duplicated profiles start as private
        };
        
        setProfiles(prev => [...prev, duplicatedProfile]);
        setEditingProfile(duplicatedProfile);
    };
    
    const canEditProfile = (profile: AiWriterProfile) => {
        return currentUser.role === 'admin' || 
               profile.ownerId === currentUser.id || 
               (currentUser.assignedProfileIds && currentUser.assignedProfileIds.includes(profile.id));
    };
    
    const canDeleteProfile = (profile: AiWriterProfile) => {
        return currentUser.role === 'admin' || profile.ownerId === currentUser.id;
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
                            <div className="flex items-center gap-2">
                                <p className="font-semibold text-gray-800">{profile.agentName}</p>
                                {profile.isPublic ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        🌍 Public
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                        🔒 Private
                                    </span>
                                )}
                                {profile.ownerId !== currentUser.id && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        Shared
                                    </span>
                                )}
                            </div>
                            {currentUser.role === 'admin' && (
                                <p className="text-xs text-gray-500">
                                    Profile ID: {profile.id} | Owner ID: {profile.ownerId}
                                </p>
                            )}
                        </div>
                        <div className="flex space-x-2 mt-3 sm:mt-0 flex-shrink-0 self-end sm:self-center">
                          <Button 
                            onClick={() => handleDuplicateProfile(profile)} 
                            variant="secondary" 
                            className="!py-1.5 !px-4"
                            title="Create a copy you can edit"
                          >
                            <DocumentDuplicateIcon className="w-4 h-4" />
                          </Button>
                          {canEditProfile(profile) && (
                            <Button onClick={() => setEditingProfile(profile)} variant="secondary" className="!py-1.5 !px-4">Edit</Button>
                          )}
                          {canDeleteProfile(profile) && (
                            <Button onClick={() => handleDeleteProfile(profile.id)} variant="danger" className="!py-1.5 !px-4">
                              <TrashIcon className="w-4 h-4" />
                            </Button>
                          )}
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
    
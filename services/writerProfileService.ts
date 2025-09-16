import type { AiWriterProfile } from '../types';
import { WriterProfileServiceApi } from './writerProfileServiceApi';
import { apiClient } from './apiClient';
import { UserSettingsApi } from './userSettingsApi';

/**
 * Retrieves all writer profiles from the API backend.
 */
export const getWriterProfiles = async (): Promise<AiWriterProfile[]> => {
    try {
        if (!apiClient.isAuthenticated()) {
            console.log('🔒 User not authenticated - cannot retrieve writer profiles');
            return [];
        }
        
        console.log('🗄️ Using API backend for writer profiles');
        return await WriterProfileServiceApi.getAllWriterProfiles();
    } catch (e) {
        console.error("Failed to retrieve writer profiles:", e);
        throw new Error(`Could not load writer profiles: ${e.message}`);
    }
};

/**
 * Saves the entire list of writer profiles to the API backend.
 * Returns the saved profiles with updated IDs from the backend.
 */
export const saveWriterProfiles = async (profiles: AiWriterProfile[]): Promise<AiWriterProfile[]> => {
    try {
        if (!apiClient.isAuthenticated()) {
            throw new Error('User not authenticated - cannot save writer profiles');
        }
        
        console.log('🗄️ Saving writer profiles to API backend');
        const savedProfiles = [];
        for (const profile of profiles) {
            try {
                const savedProfile = await WriterProfileServiceApi.saveWriterProfile(profile);
                savedProfiles.push(savedProfile);
                console.log(`📝 Successfully saved profile: ${savedProfile.agentName}`);
            } catch (profileError) {
                console.error(`📝 Failed to save profile ${profile.agentName}:`, profileError);
                throw profileError;
            }
        }
        return savedProfiles;
    } catch (e) {
        console.error("Failed to save writer profiles:", e);
        throw new Error(`Could not save writer profiles: ${e.message}`);
    }
};

/**
 * Saves a single writer profile to the API backend.
 */
export const saveWriterProfile = async (profile: AiWriterProfile): Promise<AiWriterProfile> => {
    try {
        if (!apiClient.isAuthenticated()) {
            throw new Error('User not authenticated - cannot save writer profile');
        }
        
        return await WriterProfileServiceApi.saveWriterProfile(profile);
    } catch (e) {
        console.error("Failed to save writer profile:", e);
        throw new Error(`Could not save writer profile: ${e.message}`);
    }
};

/**
 * Gets the currently selected writer profile ID from user settings.
 */
export const getSelectedWriterProfileId = async (): Promise<string | null> => {
    try {
        if (!apiClient.isAuthenticated()) {
            console.log('🔒 User not authenticated - cannot retrieve selected writer profile ID');
            return null;
        }
        
        return await UserSettingsApi.getSelectedWriterProfileId();
    } catch (e) {
        console.error("Failed to retrieve selected writer profile ID:", e);
        return null;
    }
};

/**
 * Sets the currently selected writer profile ID in user settings.
 */
export const setSelectedWriterProfileId = async (profileId: string | null): Promise<void> => {
    try {
        if (!apiClient.isAuthenticated()) {
            console.log('🔒 User not authenticated - cannot save selected writer profile ID');
            return;
        }
        
        await UserSettingsApi.setSelectedWriterProfileId(profileId);
    } catch (e) {
        console.error("Failed to save selected writer profile ID:", e);
    }
};

/**
 * Deletes a writer profile from the API backend.
 */
export const deleteWriterProfile = async (profileId: string): Promise<void> => {
    try {
        if (!apiClient.isAuthenticated()) {
            throw new Error('User not authenticated - cannot delete writer profile');
        }
        
        console.log('🗄️ Deleting writer profile from API backend');
        await WriterProfileServiceApi.deleteWriterProfile(profileId);
        console.log(`🗑️ Successfully deleted profile: ${profileId}`);
    } catch (e) {
        console.error("Failed to delete writer profile:", e);
        throw new Error(`Could not delete writer profile: ${e.message}`);
    }
};
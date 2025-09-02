import type { AiWriterProfile } from '../types';
import { DatabaseService } from './databaseService';

/**
 * Retrieves all writer profiles from the database.
 */
export const getWriterProfiles = async (): Promise<AiWriterProfile[]> => {
    try {
        const db = DatabaseService.getInstance();
        return await db.getAllWriterProfiles();
    } catch (e) {
        console.error("Failed to retrieve writer profiles:", e);
        return [];
    }
};

/**
 * Saves the entire list of writer profiles to the database.
 */
export const saveWriterProfiles = async (profiles: AiWriterProfile[]): Promise<void> => {
    try {
        const db = DatabaseService.getInstance();
        for (const profile of profiles) {
            const existing = await db.getWriterProfileById(profile.id);
            if (existing) {
                await db.updateWriterProfile(profile);
            } else {
                await db.createWriterProfile(profile);
            }
        }
    } catch (e) {
        console.error("Failed to save writer profiles:", e);
        alert("Error: Could not save writer profile data. Your changes may not persist.");
    }
};

/**
 * Saves a single writer profile to the database.
 */
export const saveWriterProfile = async (profile: AiWriterProfile): Promise<void> => {
    try {
        const db = DatabaseService.getInstance();
        const existing = await db.getWriterProfileById(profile.id);
        if (existing) {
            await db.updateWriterProfile(profile);
        } else {
            await db.createWriterProfile(profile);
        }
    } catch (e) {
        console.error("Failed to save writer profile:", e);
        alert("Error: Could not save writer profile data. Your changes may not persist.");
    }
};

/**
 * Gets the currently selected writer profile ID.
 */
export const getSelectedWriterProfileId = async (): Promise<string | null> => {
    try {
        const db = DatabaseService.getInstance();
        return await db.getSelectedWriterProfileId();
    } catch (e) {
        console.error("Failed to retrieve selected writer profile ID:", e);
        return null;
    }
};

/**
 * Sets the currently selected writer profile ID.
 */
export const setSelectedWriterProfileId = async (profileId: string | null): Promise<void> => {
    try {
        const db = DatabaseService.getInstance();
        await db.setSelectedWriterProfileId(profileId);
    } catch (e) {
        console.error("Failed to save selected writer profile ID:", e);
    }
};
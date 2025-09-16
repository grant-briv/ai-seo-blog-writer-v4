import type { AiWriterProfile } from '../types';
import { apiClient } from './apiClient';

/**
 * Writer Profile management service using API backend
 */
export class WriterProfileServiceApi {
  /**
   * Get all writer profiles for the authenticated user
   */
  static async getAllWriterProfiles(): Promise<AiWriterProfile[]> {
    try {
      console.log('📝 WriterProfileServiceApi: Getting all writer profiles via API');
      const response = await apiClient.getAllWriterProfiles();
      
      if (response.success && response.profiles) {
        console.log(`📝 WriterProfileServiceApi: Retrieved ${response.profiles.length} writer profiles`);
        return response.profiles;
      }
      
      console.error('📝 WriterProfileServiceApi: Failed to get writer profiles - invalid response');
      return [];
    } catch (error) {
      console.error('📝 WriterProfileServiceApi: Error getting writer profiles:', error);
      throw new Error(`Failed to retrieve writer profiles: ${error.message}`);
    }
  }

  /**
   * Get writer profile by ID
   */
  static async getWriterProfileById(profileId: string): Promise<AiWriterProfile | null> {
    try {
      console.log('📝 WriterProfileServiceApi: Getting writer profile by ID:', profileId);
      const response = await apiClient.getWriterProfileById(profileId);
      
      if (response.success && response.profile) {
        console.log('📝 WriterProfileServiceApi: Writer profile retrieved successfully');
        return response.profile;
      }
      
      console.log('📝 WriterProfileServiceApi: Writer profile not found');
      return null;
    } catch (error) {
      console.error('📝 WriterProfileServiceApi: Error getting writer profile:', error);
      if (error.message.includes('404') || error.message.includes('not found')) {
        return null;
      }
      throw new Error(`Failed to retrieve writer profile: ${error.message}`);
    }
  }

  /**
   * Create a new writer profile
   */
  static async createWriterProfile(profileData: Omit<AiWriterProfile, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>): Promise<AiWriterProfile> {
    try {
      console.log('📝 WriterProfileServiceApi: Creating writer profile:', { agentName: profileData.agentName });
      const response = await apiClient.createWriterProfile(profileData);
      
      if (response.success && response.profile) {
        console.log('📝 WriterProfileServiceApi: Writer profile created successfully');
        return response.profile;
      }
      
      throw new Error('Failed to create writer profile - invalid response');
    } catch (error) {
      console.error('📝 WriterProfileServiceApi: Error creating writer profile:', error);
      throw new Error(`Failed to create writer profile: ${error.message}`);
    }
  }

  /**
   * Update an existing writer profile
   */
  static async updateWriterProfile(profileId: string, profileData: Partial<AiWriterProfile>): Promise<AiWriterProfile> {
    try {
      console.log('📝 WriterProfileServiceApi: Updating writer profile:', profileId);
      const response = await apiClient.updateWriterProfile(profileId, profileData);
      
      if (response.success && response.profile) {
        console.log('📝 WriterProfileServiceApi: Writer profile updated successfully');
        return response.profile;
      }
      
      throw new Error('Failed to update writer profile - invalid response');
    } catch (error) {
      console.error('📝 WriterProfileServiceApi: Error updating writer profile:', error);
      throw new Error(`Failed to update writer profile: ${error.message}`);
    }
  }

  /**
   * Delete a writer profile
   */
  static async deleteWriterProfile(profileId: string): Promise<void> {
    try {
      console.log('📝 WriterProfileServiceApi: Deleting writer profile:', profileId);
      const response = await apiClient.deleteWriterProfile(profileId);
      
      if (response.success) {
        console.log('📝 WriterProfileServiceApi: Writer profile deleted successfully');
        return;
      }
      
      throw new Error('Failed to delete writer profile - invalid response');
    } catch (error) {
      console.error('📝 WriterProfileServiceApi: Error deleting writer profile:', error);
      throw new Error(`Failed to delete writer profile: ${error.message}`);
    }
  }

  /**
   * Save a writer profile (create if new, update if existing)
   */
  static async saveWriterProfile(profile: AiWriterProfile): Promise<AiWriterProfile> {
    try {
      if (profile.id && profile.id !== 'temp-id') {
        // Try to update existing profile first
        try {
          return await this.updateWriterProfile(profile.id, profile);
        } catch (updateError) {
          // If update fails with 404, the profile doesn't exist in backend
          // This can happen during migration from IndexedDB to PostgreSQL
          if (updateError.message.includes('not found') || updateError.message.includes('404')) {
            console.log('📝 WriterProfileServiceApi: Profile not found in backend, creating new profile');
            // Create new profile without the old ID
            const { id, ownerId, createdAt, updatedAt, ...profileData } = profile;
            return await this.createWriterProfile(profileData);
          }
          throw updateError;
        }
      } else {
        // Create new profile
        const { id, ownerId, createdAt, updatedAt, ...profileData } = profile;
        return await this.createWriterProfile(profileData);
      }
    } catch (error) {
      console.error('📝 WriterProfileServiceApi: Error saving writer profile:', error);
      throw error;
    }
  }
}
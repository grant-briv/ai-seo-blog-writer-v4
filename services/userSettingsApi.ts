import { apiClient } from './apiClient';

/**
 * User Settings API service for managing per-user preferences
 */
export class UserSettingsApi {
  /**
   * Get all user settings for the authenticated user
   */
  static async getAllUserSettings(): Promise<Record<string, string | null>> {
    try {
      console.log('⚙️ UserSettingsApi: Getting all user settings via API');
      const response = await apiClient.getUserSettings();
      
      if (response.success && response.settings) {
        console.log(`⚙️ UserSettingsApi: Retrieved ${Object.keys(response.settings).length} user settings`);
        return response.settings;
      }
      
      console.error('⚙️ UserSettingsApi: Failed to get user settings - invalid response');
      return {};
    } catch (error) {
      console.error('⚙️ UserSettingsApi: Error getting user settings:', error);
      throw new Error(`Failed to retrieve user settings: ${error.message}`);
    }
  }

  /**
   * Get a specific user setting by key
   */
  static async getUserSetting(key: string): Promise<string | null> {
    try {
      console.log('⚙️ UserSettingsApi: Getting user setting by key:', key);
      const response = await apiClient.getUserSetting(key);
      
      if (response.success) {
        console.log('⚙️ UserSettingsApi: User setting retrieved successfully');
        return response.value;
      }
      
      console.log('⚙️ UserSettingsApi: User setting not found');
      return null;
    } catch (error) {
      console.error('⚙️ UserSettingsApi: Error getting user setting:', error);
      if (error.message.includes('404') || error.message.includes('not found')) {
        return null;
      }
      throw new Error(`Failed to retrieve user setting: ${error.message}`);
    }
  }

  /**
   * Set a user setting value
   */
  static async setUserSetting(key: string, value: string | null): Promise<void> {
    try {
      console.log('⚙️ UserSettingsApi: Setting user setting:', key);
      
      if (value === null) {
        // Delete the setting if value is null
        await this.deleteUserSetting(key);
        return;
      }
      
      const response = await apiClient.setUserSetting(key, value);
      
      if (response.success) {
        console.log('⚙️ UserSettingsApi: User setting updated successfully');
        return;
      }
      
      throw new Error('Failed to set user setting - invalid response');
    } catch (error) {
      console.error('⚙️ UserSettingsApi: Error setting user setting:', error);
      throw new Error(`Failed to set user setting: ${error.message}`);
    }
  }

  /**
   * Delete a user setting
   */
  static async deleteUserSetting(key: string): Promise<void> {
    try {
      console.log('⚙️ UserSettingsApi: Deleting user setting:', key);
      const response = await apiClient.deleteUserSetting(key);
      
      if (response.success) {
        console.log('⚙️ UserSettingsApi: User setting deleted successfully');
        return;
      }
      
      throw new Error('Failed to delete user setting - invalid response');
    } catch (error) {
      console.error('⚙️ UserSettingsApi: Error deleting user setting:', error);
      // Don't throw error for 404 - setting already doesn't exist
      if (error.message.includes('404') || error.message.includes('not found')) {
        console.log('⚙️ UserSettingsApi: User setting already deleted or does not exist');
        return;
      }
      throw new Error(`Failed to delete user setting: ${error.message}`);
    }
  }

  /**
   * Get the selected writer profile ID for the user
   */
  static async getSelectedWriterProfileId(): Promise<string | null> {
    return await this.getUserSetting('selectedWriterProfileId');
  }

  /**
   * Set the selected writer profile ID for the user
   */
  static async setSelectedWriterProfileId(profileId: string | null): Promise<void> {
    await this.setUserSetting('selectedWriterProfileId', profileId);
  }
}

export default UserSettingsApi;
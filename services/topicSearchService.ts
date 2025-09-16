import { apiClient } from './apiClient';

/**
 * Topic Search API service for managing user's saved topic searches
 */
export class TopicSearchService {
  /**
   * Get all saved topic searches for the authenticated user
   */
  static async getSavedSearchesForUser(): Promise<string[]> {
    try {
      if (!apiClient.isAuthenticated()) {
        console.warn("User not authenticated, cannot retrieve saved topic searches");
        return [];
      }

      console.log('🔍 TopicSearchService: Getting saved topic searches via API');
      const response = await apiClient.getSavedTopicSearches();
      
      if (response.success && response.searches) {
        console.log(`🔍 TopicSearchService: Retrieved ${response.searches.length} saved topic searches`);
        return response.searches;
      }
      
      console.error('🔍 TopicSearchService: Failed to get saved topic searches - invalid response');
      return [];
    } catch (error) {
      console.error('🔍 TopicSearchService: Error getting saved topic searches:', error);
      throw new Error(`Failed to retrieve saved topic searches: ${error.message}`);
    }
  }

  /**
   * Save a new topic search query
   */
  static async insertSavedSearch(searchQuery: string): Promise<void> {
    try {
      if (!apiClient.isAuthenticated()) {
        console.error("User not authenticated, cannot save topic search");
        return;
      }

      console.log('🔍 TopicSearchService: Saving topic search:', searchQuery);
      const response = await apiClient.saveTopicSearch(searchQuery);
      
      if (response.success) {
        console.log('🔍 TopicSearchService: Topic search saved successfully');
        return;
      }
      
      throw new Error('Failed to save topic search - invalid response');
    } catch (error) {
      console.error('🔍 TopicSearchService: Error saving topic search:', error);
      throw new Error(`Failed to save topic search: ${error.message}`);
    }
  }

  /**
   * Delete a saved topic search query
   */
  static async deleteSavedSearch(searchQuery: string): Promise<void> {
    try {
      if (!apiClient.isAuthenticated()) {
        console.error("User not authenticated, cannot delete topic search");
        return;
      }

      console.log('🔍 TopicSearchService: Deleting topic search:', searchQuery);
      const response = await apiClient.deleteTopicSearch(searchQuery);
      
      if (response.success) {
        console.log('🔍 TopicSearchService: Topic search deleted successfully');
        return;
      }
      
      throw new Error('Failed to delete topic search - invalid response');
    } catch (error) {
      console.error('🔍 TopicSearchService: Error deleting topic search:', error);
      // Don't throw error for 404 - search already doesn't exist
      if (error.message.includes('404') || error.message.includes('not found')) {
        console.log('🔍 TopicSearchService: Topic search already deleted or does not exist');
        return;
      }
      throw new Error(`Failed to delete topic search: ${error.message}`);
    }
  }
}

export default TopicSearchService;
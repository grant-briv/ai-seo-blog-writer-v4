import express from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { topicSearches } from '../../db/schema.ts';

const router = express.Router();

/**
 * GET /api/topic-searches
 * Get all saved topic searches for the authenticated user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    console.log(`🔍 Getting saved topic searches for user: ${userId}`);
    const db = req.app.locals.db;
    
    const searches = await db
      .select()
      .from(topicSearches)
      .where(eq(topicSearches.userId, userId))
      .orderBy(desc(topicSearches.createdAt));

    console.log(`🔍 Found ${searches.length} saved topic searches for user`);
    
    // Return just the search queries as an array (matching the current interface)
    const searchQueries = searches.map(search => search.searchQuery);

    res.json({ 
      success: true, 
      searches: searchQueries 
    });
  } catch (error) {
    console.error('❌ Error getting saved topic searches:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve saved topic searches',
      message: error.message 
    });
  }
});

/**
 * POST /api/topic-searches
 * Save a new topic search query
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { searchQuery } = req.body;
    
    if (!searchQuery || typeof searchQuery !== 'string') {
      return res.status(400).json({ error: 'Search query is required and must be a string' });
    }

    console.log(`🔍 Saving topic search for user: ${userId}, query: "${searchQuery}"`);
    const db = req.app.locals.db;
    
    // Check if search already exists for this user
    const existingSearches = await db
      .select()
      .from(topicSearches)
      .where(and(
        eq(topicSearches.userId, userId),
        eq(topicSearches.searchQuery, searchQuery)
      ));

    if (existingSearches.length === 0) {
      // Only add if it doesn't already exist
      await db
        .insert(topicSearches)
        .values({
          userId,
          searchQuery
        });

      console.log(`🔍 Saved new topic search: "${searchQuery}"`);
      res.status(201).json({ 
        success: true, 
        message: 'Topic search saved successfully' 
      });
    } else {
      console.log(`🔍 Topic search already exists: "${searchQuery}"`);
      res.json({ 
        success: true, 
        message: 'Topic search already exists' 
      });
    }
  } catch (error) {
    console.error('❌ Error saving topic search:', error);
    res.status(500).json({ 
      error: 'Failed to save topic search',
      message: error.message 
    });
  }
});

/**
 * DELETE /api/topic-searches
 * Delete a specific topic search query
 */
router.delete('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { searchQuery } = req.body;
    
    if (!searchQuery || typeof searchQuery !== 'string') {
      return res.status(400).json({ error: 'Search query is required and must be a string' });
    }

    console.log(`🔍 Deleting topic search for user: ${userId}, query: "${searchQuery}"`);
    const db = req.app.locals.db;
    
    await db
      .delete(topicSearches)
      .where(and(
        eq(topicSearches.userId, userId),
        eq(topicSearches.searchQuery, searchQuery)
      ));

    console.log(`🔍 Deleted topic search: "${searchQuery}"`);
    res.json({ 
      success: true, 
      message: 'Topic search deleted successfully' 
    });
  } catch (error) {
    console.error('❌ Error deleting topic search:', error);
    res.status(500).json({ 
      error: 'Failed to delete topic search',
      message: error.message 
    });
  }
});

export default router;
import express from 'express';
import { eq, and } from 'drizzle-orm';
import { userSettings } from '../../db/schema.ts';

const router = express.Router();

// Get all user settings for the authenticated user
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not authenticated' 
      });
    }

    const db = req.app.locals.db;
    const settings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId));

    console.log(`📝 Retrieved ${settings.length} user settings for user: ${userId}`);
    res.json({ 
      success: true, 
      settings: settings.reduce((acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('📝 Error getting user settings:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to retrieve user settings' 
    });
  }
});

// Get a specific user setting
router.get('/:key', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { key } = req.params;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not authenticated' 
      });
    }

    const db = req.app.locals.db;
    const setting = await db
      .select()
      .from(userSettings)
      .where(and(
        eq(userSettings.userId, userId),
        eq(userSettings.key, key)
      ))
      .limit(1);

    if (setting.length === 0) {
      return res.json({ 
        success: true, 
        value: null 
      });
    }

    console.log(`📝 Retrieved user setting ${key} for user: ${userId}`);
    res.json({ 
      success: true, 
      value: setting[0].value 
    });
  } catch (error) {
    console.error('📝 Error getting user setting:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to retrieve user setting' 
    });
  }
});

// Set a user setting
router.put('/:key', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { key } = req.params;
    const { value } = req.body;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not authenticated' 
      });
    }

    const db = req.app.locals.db;
    
    // Check if setting exists
    const existing = await db
      .select()
      .from(userSettings)
      .where(and(
        eq(userSettings.userId, userId),
        eq(userSettings.key, key)
      ))
      .limit(1);

    if (existing.length > 0) {
      // Update existing setting
      await db
        .update(userSettings)
        .set({ 
          value: value,
          updatedAt: new Date()
        })
        .where(and(
          eq(userSettings.userId, userId),
          eq(userSettings.key, key)
        ));
    } else {
      // Create new setting
      await db
        .insert(userSettings)
        .values({
          userId: userId,
          key: key,
          value: value
        });
    }

    console.log(`📝 Set user setting ${key} for user: ${userId}`);
    res.json({ 
      success: true, 
      message: 'User setting updated successfully' 
    });
  } catch (error) {
    console.error('📝 Error setting user setting:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update user setting' 
    });
  }
});

// Delete a user setting
router.delete('/:key', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { key } = req.params;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not authenticated' 
      });
    }

    const db = req.app.locals.db;
    
    const deletedSetting = await db
      .delete(userSettings)
      .where(and(
        eq(userSettings.userId, userId),
        eq(userSettings.key, key)
      ))
      .returning();

    if (deletedSetting.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'User setting not found' 
      });
    }

    console.log(`📝 Deleted user setting ${key} for user: ${userId}`);
    res.json({ 
      success: true, 
      message: 'User setting deleted successfully' 
    });
  } catch (error) {
    console.error('📝 Error deleting user setting:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete user setting' 
    });
  }
});

export default router;
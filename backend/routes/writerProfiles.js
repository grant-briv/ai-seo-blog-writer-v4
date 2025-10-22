import express from 'express';
import { eq, and } from 'drizzle-orm';
import { writerProfiles, users } from '../../db/schema.ts';

const router = express.Router();

// Get all writer profiles for the authenticated user
router.get('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    console.log(`📝 Getting writer profiles for user: ${userId}`);

    let assignedProfileIds = [];

    if (!isAdmin) {
      const userRecord = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));
      
      if (userRecord.length > 0 && Array.isArray(userRecord[0].assignedProfileIds)) {
        assignedProfileIds = userRecord[0].assignedProfileIds.filter(Boolean);
      }
    }

    const allProfiles = await db
      .select()
      .from(writerProfiles);

    const profiles = isAdmin
      ? allProfiles
      : allProfiles.filter(profile => {
          const profileData = profile.profileData || {};
          const isProfilePublic = profileData.isPublic === true;
          const isOwner = profile.ownerId === userId;
          const isAssigned = assignedProfileIds.includes(profile.id);
          return isOwner || isAssigned || isProfilePublic;
        });

    console.log(`📝 Found ${profiles.length} writer profiles`);

    // Transform the data to match the frontend format
    const transformedProfiles = profiles.map(profile => ({
      id: profile.id,
      ownerId: profile.ownerId,
      agentName: profile.agentName,
      ...profile.profileData,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt
    }));

    res.json({
      success: true,
      profiles: transformedProfiles
    });
  } catch (error) {
    console.error('❌ Error getting writer profiles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get writer profiles'
    });
  }
});

// Get a specific writer profile by ID
router.get('/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    const profileId = req.params.id;

    console.log(`📝 Getting writer profile ${profileId} for user: ${userId}`);

    const profiles = await db
      .select()
      .from(writerProfiles)
      .where(eq(writerProfiles.id, profileId));

    if (profiles.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Writer profile not found'
      });
    }

    const profile = profiles[0];

    let assignedProfileIds = [];
    if (!isAdmin) {
      const userRecord = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));
      
      if (userRecord.length > 0 && Array.isArray(userRecord[0].assignedProfileIds)) {
        assignedProfileIds = userRecord[0].assignedProfileIds.filter(Boolean);
      }
    }

    const profileData = profile.profileData || {};
    const canAccess = isAdmin ||
      profile.ownerId === userId ||
      assignedProfileIds.includes(profile.id) ||
      profileData.isPublic === true;

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to writer profile'
      });
    }

    const transformedProfile = {
      id: profile.id,
      ownerId: profile.ownerId,
      agentName: profile.agentName,
      ...profile.profileData,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt
    };

    res.json({
      success: true,
      profile: transformedProfile
    });
  } catch (error) {
    console.error('❌ Error getting writer profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get writer profile'
    });
  }
});

// Create a new writer profile
router.post('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.id;
    const profileData = req.body;

    console.log(`📝 Creating writer profile for user: ${userId}`);
    console.log(`📝 Profile data:`, { agentName: profileData.agentName });

    // Extract fields that go in separate columns or should be excluded
    const { agentName, id, ownerId, createdAt, updatedAt, ...restProfileData } = profileData;

    if (!agentName) {
      return res.status(400).json({
        success: false,
        error: 'Agent name is required'
      });
    }

    const newProfile = await db
      .insert(writerProfiles)
      .values({
        ownerId: userId,
        agentName,
        profileData: restProfileData
      })
      .returning();

    console.log(`📝 Created writer profile with ID: ${newProfile[0].id}`);

    // Transform the response to match frontend format
    const transformedProfile = {
      id: newProfile[0].id,
      ownerId: newProfile[0].ownerId,
      agentName: newProfile[0].agentName,
      ...newProfile[0].profileData,
      createdAt: newProfile[0].createdAt,
      updatedAt: newProfile[0].updatedAt
    };

    res.status(201).json({
      success: true,
      profile: transformedProfile
    });
  } catch (error) {
    console.error('❌ Error creating writer profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create writer profile'
    });
  }
});

// Update a writer profile
router.put('/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.id;
    const profileId = req.params.id;
    const profileData = req.body;

    console.log(`📝 Updating writer profile ${profileId} for user: ${userId}`);
    console.log(`📝 Received profile data keys:`, Object.keys(profileData));

    // Extract fields that go in separate columns or should be excluded
    const { agentName, id, ownerId, createdAt, updatedAt, ...restProfileData } = profileData;

    console.log(`📝 Profile data for JSONB:`, Object.keys(restProfileData));

    if (!agentName) {
      return res.status(400).json({
        success: false,
        error: 'Agent name is required'
      });
    }

    // Admin users can update any profile, regular users can only update their own
    const isAdmin = req.user.role === 'admin';
    const whereCondition = isAdmin 
      ? eq(writerProfiles.id, profileId)
      : and(
          eq(writerProfiles.id, profileId),
          eq(writerProfiles.ownerId, userId)
        );

    const updatedProfile = await db
      .update(writerProfiles)
      .set({
        agentName,
        profileData: restProfileData,
        updatedAt: new Date()
      })
      .where(whereCondition)
      .returning();

    if (updatedProfile.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Writer profile not found'
      });
    }

    console.log(`📝 Updated writer profile: ${profileId}`);

    // Transform the response to match frontend format
    const transformedProfile = {
      id: updatedProfile[0].id,
      ownerId: updatedProfile[0].ownerId,
      agentName: updatedProfile[0].agentName,
      ...updatedProfile[0].profileData,
      createdAt: updatedProfile[0].createdAt,
      updatedAt: updatedProfile[0].updatedAt
    };

    res.json({
      success: true,
      profile: transformedProfile
    });
  } catch (error) {
    console.error('❌ Error updating writer profile:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error message:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to update writer profile',
      details: error.message // Add error details for debugging
    });
  }
});

// Delete a writer profile
router.delete('/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.id;
    const profileId = req.params.id;

    console.log(`📝 Deleting writer profile ${profileId} for user: ${userId}`);

    // Admin users can delete any profile, regular users can only delete their own
    const isAdmin = req.user.role === 'admin';
    const whereCondition = isAdmin 
      ? eq(writerProfiles.id, profileId)
      : and(
          eq(writerProfiles.id, profileId),
          eq(writerProfiles.ownerId, userId)
        );

    const deletedProfile = await db
      .delete(writerProfiles)
      .where(whereCondition)
      .returning();

    if (deletedProfile.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Writer profile not found'
      });
    }

    console.log(`📝 Deleted writer profile: ${profileId}`);

    res.json({
      success: true,
      message: 'Writer profile deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting writer profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete writer profile'
    });
  }
});

export default router;

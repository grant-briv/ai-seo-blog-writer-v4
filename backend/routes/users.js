import express from 'express';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { users } from '../../db/schema.ts';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// GET /api/users - Get all users (admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    console.log('👥 Getting all users');
    
    const db = req.app.locals.db;
    const allUsers = await db.select().from(users);
    
    // Remove passwords from response
    const safeUsers = allUsers.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
    
    console.log(`👥 Found ${safeUsers.length} users`);
    res.json({ success: true, users: safeUsers });
    
  } catch (error) {
    console.error('👥 Error getting users:', error);
    res.status(500).json({ error: 'Failed to retrieve users' });
  }
});

// GET /api/users/:id - Get user by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Users can view their own profile, admins can view any profile
    if (req.user.role !== 'admin' && req.user.id !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    console.log('👥 Getting user by ID:', id);
    
    const db = req.app.locals.db;
    const userResult = await db.select().from(users).where(eq(users.id, id));
    const user = userResult[0];
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Remove password from response
    const { password, ...userWithoutPassword } = user;
    
    res.json({ success: true, user: userWithoutPassword });
    
  } catch (error) {
    console.error('👥 Error getting user:', error);
    res.status(500).json({ error: 'Failed to retrieve user' });
  }
});

// PUT /api/users/:id - Update user (admin or self)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, role, assignedProfileIds, password } = req.body;
    
    // Users can update their own profile (except role), admins can update any profile
    if (req.user.role !== 'admin' && req.user.id !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Non-admin users cannot change role
    if (req.user.role !== 'admin' && role && role !== req.user.role) {
      return res.status(403).json({ error: 'Cannot change role' });
    }
    
    console.log('👥 Updating user:', id);
    
    const db = req.app.locals.db;
    
    // Get existing user
    const existingUserResult = await db.select().from(users).where(eq(users.id, id));
    const existingUser = existingUserResult[0];
    
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Build update object
    const updateData = {};
    
    if (username && username !== existingUser.username) {
      // Check if new username is already taken
      const usernameCheck = await db.select().from(users).where(eq(users.username, username.toLowerCase()));
      if (usernameCheck.length > 0) {
        return res.status(409).json({ error: 'Username already exists' });
      }
      updateData.username = username.toLowerCase();
    }
    
    if (email !== undefined) updateData.email = email;
    if (role && req.user.role === 'admin') updateData.role = role;
    if (assignedProfileIds !== undefined && req.user.role === 'admin') {
      updateData.assignedProfileIds = assignedProfileIds;
    }
    
    // Handle password update
    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long' });
      }
      updateData.password = await bcrypt.hash(password, 12);
      console.log('👥 Password updated for user:', id);
    }
    
    // Perform update
    const updatedUserResult = await db.update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    
    const updatedUser = updatedUserResult[0];
    
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = updatedUser;
    
    console.log('👥 User updated successfully:', id);
    res.json({ success: true, user: userWithoutPassword });
    
  } catch (error) {
    console.error('👥 Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /api/users/:id - Delete user (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Prevent admin from deleting themselves
    if (req.user.id === id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    console.log('👥 Deleting user:', id);
    
    const db = req.app.locals.db;
    
    // Check if user exists
    const existingUserResult = await db.select().from(users).where(eq(users.id, id));
    if (existingUserResult.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Delete user
    await db.delete(users).where(eq(users.id, id));
    
    console.log('👥 User deleted successfully:', id);
    res.json({ success: true, message: 'User deleted successfully' });
    
  } catch (error) {
    console.error('👥 Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// PUT /api/users/:id/password - Change password (admin or self)
router.put('/:id/password', async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    
    // Users can change their own password, admins can change any password
    if (req.user.role !== 'admin' && req.user.id !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long' });
    }
    
    console.log('👥 Changing password for user:', id);
    
    const db = req.app.locals.db;
    
    // Get user
    const userResult = await db.select().from(users).where(eq(users.id, id));
    const user = userResult[0];
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // If not admin, verify current password
    if (req.user.role !== 'admin') {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required' });
      }
      
      const isValidCurrentPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidCurrentPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
    }
    
    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    
    // Update password
    await db.update(users)
      .set({ password: hashedNewPassword })
      .where(eq(users.id, id));
    
    console.log('👥 Password changed successfully for user:', id);
    res.json({ success: true, message: 'Password changed successfully' });
    
  } catch (error) {
    console.error('👥 Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;
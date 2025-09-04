import { DatabaseService } from './databaseService';
import { hashPassword } from './authService';
import type { User } from '../types';

/**
 * Migrates existing users with plaintext passwords to hashed passwords
 */
export const migrateUsersToHashedPasswords = async (): Promise<void> => {
  try {
    const db = DatabaseService.getInstance();
    const users = await db.getAllUsers();
    
    console.log(`Found ${users.length} users to potentially migrate`);
    
    for (const user of users) {
      // Check if password is already hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
      if (!user.password.startsWith('$2')) {
        console.log(`Migrating user: ${user.username}`);
        
        // Hash the plaintext password
        const hashedPassword = await hashPassword(user.password);
        
        // Update user with hashed password
        const updatedUser: User = {
          ...user,
          password: hashedPassword
        };
        
        await db.updateUser(updatedUser);
        console.log(`Migrated password for user: ${user.username}`);
      } else {
        console.log(`User ${user.username} already has hashed password`);
      }
    }
    
    console.log('Password migration completed');
  } catch (error) {
    console.error('Failed to migrate user passwords:', error);
  }
};

/**
 * Ensures database has at least one admin user with secure password
 */
export const ensureAdminUser = async (): Promise<void> => {
  try {
    const db = DatabaseService.getInstance();
    const users = await db.getAllUsers();
    
    // Check if any admin users exist
    const adminUsers = users.filter(u => u.role === 'admin');
    
    if (adminUsers.length === 0) {
      console.log('No admin users found. Creating secure admin user...');
      
      // Create admin user with hashed password
      const hashedPassword = await hashPassword('SecureAdmin123!');
      
      const adminUser: User = {
        id: 'admin-001',
        username: 'admin',
        password: hashedPassword,
        role: 'admin',
        assignedProfileIds: [],
      };
      
      await db.createUser(adminUser);
      console.log('Created secure admin user with username: admin');
    } else {
      console.log(`Found ${adminUsers.length} admin user(s)`);
      
      // Reset admin password to known secure password if needed
      const adminUser = adminUsers.find(u => u.username === 'admin');
      if (adminUser) {
        console.log('Resetting admin password to SecureAdmin123!');
        const hashedPassword = await hashPassword('SecureAdmin123!');
        const updatedAdmin: User = {
          ...adminUser,
          password: hashedPassword
        };
        await db.updateUser(updatedAdmin);
        console.log('Admin password reset completed');
      }
    }
  } catch (error) {
    console.error('Failed to ensure admin user:', error);
  }
};
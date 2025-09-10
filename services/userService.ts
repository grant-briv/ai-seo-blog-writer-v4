import type { User } from '../types';
import { DatabaseService } from './databaseService';
import { initializeSecureUsers, createSecureUser, validatePasswordStrength, hashPassword } from './authService';

// Use secure initialization
const initializeUsers = initializeSecureUsers;

/**
 * Retrieves all users, ensuring the list is initialized.
 */
export const getUsers = async (): Promise<User[]> => {
    return await initializeUsers();
};

/**
 * Saves a single user to the database with security checks.
 * DEPRECATED: Use createSecureUser for new users instead.
 */
export const saveUser = async (user: User): Promise<void> => {
    try {
        const db = DatabaseService.getInstance();
        const existingUser = await db.getUserById(user.id);
        
        // Security check: ensure password is hashed
        if (user.password && !user.password.startsWith('$2b$')) {
            console.warn('Attempting to save user with unhashed password. Hashing now.');
            user.password = await hashPassword(user.password);
        }
        
        if (existingUser) {
            await db.updateUser(user);
        } else {
            await db.createUser(user);
        }
    } catch (e) {
        console.error("Failed to save user:", e);
        throw new Error("Failed to save user data");
    }
};

/**
 * DEPRECATED: Use individual user operations instead.
 * This function can lead to security issues if passwords aren't properly hashed.
 */
export const saveUsers = async (users: User[]): Promise<void> => {
    console.warn('saveUsers is deprecated. Use individual user operations instead.');
    
    try {
        for (const user of users) {
            await saveUser(user);
        }
    } catch (e) {
        console.error("Failed to save users:", e);
        throw new Error("Failed to save user data");
    }
};

// Re-export secure authentication from authService
export { authenticateUser, createSecureUser, validatePasswordStrength } from './authService';
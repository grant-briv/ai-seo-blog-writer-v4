import type { User } from '../types';
import { DatabaseService } from './databaseService';
import { initializeSecureUsers } from './authService';

// Use secure initialization
const initializeUsers = initializeSecureUsers;

/**
 * Retrieves all users, ensuring the list is initialized.
 */
export const getUsers = async (): Promise<User[]> => {
    return await initializeUsers();
};

/**
 * Saves a single user to the database.
 */
export const saveUser = async (user: User): Promise<void> => {
    try {
        const db = DatabaseService.getInstance();
        const existingUser = await db.getUserById(user.id);
        if (existingUser) {
            await db.updateUser(user);
        } else {
            await db.createUser(user);
        }
    } catch (e) {
        console.error("Failed to save user:", e);
        alert("Error: Could not save user data. Your changes may not persist.");
    }
};

/**
 * Saves the entire list of users to the database.
 */
export const saveUsers = async (users: User[]): Promise<void> => {
    try {
        const db = DatabaseService.getInstance();
        for (const user of users) {
            const existingUser = await db.getUserById(user.id);
            if (existingUser) {
                await db.updateUser(user);
            } else {
                await db.createUser(user);
            }
        }
    } catch (e) {
        console.error("Failed to save users:", e);
        alert("Error: Could not save user data. Your changes may not persist.");
    }
};

// Re-export secure authentication from authService
export { authenticateUser } from './authService';
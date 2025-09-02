import type { User } from '../types';
import { DatabaseService } from './databaseService';

// Initialize with a default admin user if none exist.
// This function ensures there's always an admin available.
const initializeUsers = async (): Promise<User[]> => {
    const db = DatabaseService.getInstance();
    const defaultAdmin: User = {
        id: 'admin-001',
        username: 'admin',
        password: 'password', // INSECURE: For demo purposes only.
        role: 'admin',
        assignedProfileIds: [],
    };
    
    try {
        const users = await db.getAllUsers();
        if (users.length > 0) {
            // Ensure at least one admin exists. If not, add the default one.
            if (users.some(u => u.role === 'admin')) {
                return users;
            } else {
                await db.createUser(defaultAdmin);
                return [...users, defaultAdmin];
            }
        }
        // No users exist, create the default admin.
        await db.createUser(defaultAdmin);
        return [defaultAdmin];
    } catch (e) {
        console.error("Failed to initialize users:", e);
        // Fallback to default admin if database is unavailable.
        try {
            await db.createUser(defaultAdmin);
            return [defaultAdmin];
        } catch (createError) {
            console.error("Failed to create default admin:", createError);
            return [defaultAdmin];
        }
    }
};

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

/**
 * Authenticates a user against the stored user list.
 * @returns The user object if successful, otherwise null.
 */
export const authenticateUser = async (username: string, password: string): Promise<User | null> => {
    try {
        const db = DatabaseService.getInstance();
        const user = await db.getUserByUsername(username.toLowerCase());
        if (user && user.password === password) {
            return user;
        }
        return null;
    } catch (e) {
        console.error("Failed to authenticate user:", e);
        return null;
    }
};
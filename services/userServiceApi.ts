import type { User } from '../types';
import { apiClient } from './apiClient';

/**
 * User management service using API backend
 */
export class UserServiceApi {
  /**
   * Get all users (admin only)
   */
  static async getAllUsers(): Promise<User[]> {
    try {
      console.log('👥 UserServiceApi: Getting all users via API');
      const response = await apiClient.getAllUsers();
      
      if (response.success && response.users) {
        console.log(`👥 UserServiceApi: Retrieved ${response.users.length} users`);
        return response.users;
      }
      
      console.error('👥 UserServiceApi: Failed to get users - invalid response');
      return [];
    } catch (error) {
      console.error('👥 UserServiceApi: Error getting users:', error);
      throw new Error(`Failed to retrieve users: ${error.message}`);
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string): Promise<User | null> {
    try {
      console.log('👥 UserServiceApi: Getting user by ID:', userId);
      const response = await apiClient.getUserById(userId);
      
      if (response.success && response.user) {
        console.log('👥 UserServiceApi: User retrieved successfully');
        return response.user;
      }
      
      console.log('👥 UserServiceApi: User not found');
      return null;
    } catch (error) {
      console.error('👥 UserServiceApi: Error getting user:', error);
      if (error.message.includes('404') || error.message.includes('not found')) {
        return null;
      }
      throw new Error(`Failed to retrieve user: ${error.message}`);
    }
  }

  /**
   * Create a new user
   */
  static async createUser(userData: {
    username: string;
    password: string;
    email?: string;
    role?: 'admin' | 'general';
    assignedProfileIds?: string[];
  }): Promise<User> {
    try {
      console.log('👥 UserServiceApi: Creating user via API:', userData.username);
      const response = await apiClient.register({
        username: userData.username,
        password: userData.password,
        email: userData.email,
        role: userData.role || 'general',
        assignedProfileIds: userData.assignedProfileIds || []
      });
      
      if (response.success && response.user) {
        console.log('👥 UserServiceApi: User created successfully');
        return response.user;
      }
      
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error('👥 UserServiceApi: Error creating user:', error);
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  /**
   * Update user details
   */
  static async updateUser(userId: string, userData: Partial<User>): Promise<User> {
    try {
      console.log('👥 UserServiceApi: Updating user via API:', userId);
      const response = await apiClient.updateUser(userId, userData);
      
      if (response.success && response.user) {
        console.log('👥 UserServiceApi: User updated successfully');
        return response.user;
      }
      
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error('👥 UserServiceApi: Error updating user:', error);
      throw new Error(`Failed to update user: ${error.message}`);
    }
  }

  /**
   * Delete user (admin only)
   */
  static async deleteUser(userId: string): Promise<void> {
    try {
      console.log('👥 UserServiceApi: Deleting user via API:', userId);
      const response = await apiClient.deleteUser(userId);
      
      if (response.success) {
        console.log('👥 UserServiceApi: User deleted successfully');
        return;
      }
      
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error('👥 UserServiceApi: Error deleting user:', error);
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }

  /**
   * Change user password (admin or self)
   */
  static async changePassword(
    userId: string, 
    currentPassword: string, 
    newPassword: string
  ): Promise<void> {
    try {
      console.log('👥 UserServiceApi: Changing password via API for user:', userId);
      const response = await apiClient.changePassword(userId, currentPassword, newPassword);
      
      if (response.success) {
        console.log('👥 UserServiceApi: Password changed successfully');
        return;
      }
      
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error('👥 UserServiceApi: Error changing password:', error);
      throw new Error(`Failed to change password: ${error.message}`);
    }
  }

  /**
   * Admin-only password reset (no current password required)
   */
  static async adminResetPassword(userId: string, newPassword: string): Promise<void> {
    try {
      console.log('👥 UserServiceApi: Admin resetting password via API for user:', userId);
      const response = await apiClient.changePasswordAsAdmin(userId, newPassword);
      
      if (response.success) {
        console.log('👥 UserServiceApi: Password reset successfully');
        return;
      }
      
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error('👥 UserServiceApi: Error resetting password:', error);
      throw new Error(`Failed to reset password: ${error.message}`);
    }
  }

  /**
   * Check if user exists by username
   */
  static async userExists(username: string): Promise<boolean> {
    try {
      const users = await this.getAllUsers();
      return users.some(user => user.username.toLowerCase() === username.toLowerCase());
    } catch (error) {
      console.error('👥 UserServiceApi: Error checking if user exists:', error);
      // In case of error, assume user might exist to prevent conflicts
      return true;
    }
  }

  /**
   * Validate current user session
   */
  static async validateSession(): Promise<User | null> {
    try {
      console.log('👥 UserServiceApi: Validating session via API');
      const response = await apiClient.verifyToken();
      
      if (response.success && response.user) {
        console.log('👥 UserServiceApi: Session valid');
        return response.user;
      }
      
      console.log('👥 UserServiceApi: Session invalid');
      return null;
    } catch (error) {
      console.error('👥 UserServiceApi: Error validating session:', error);
      return null;
    }
  }
}

// Convenience functions that match the existing userService interface
export const getUsers = (): Promise<User[]> => UserServiceApi.getAllUsers();
export const getUserById = (userId: string): Promise<User | null> => UserServiceApi.getUserById(userId);
export const createUser = (userData: Parameters<typeof UserServiceApi.createUser>[0]): Promise<User> => 
  UserServiceApi.createUser(userData);
export const updateUser = (userId: string, userData: Partial<User>): Promise<User> => 
  UserServiceApi.updateUser(userId, userData);
export const deleteUser = (userId: string): Promise<void> => UserServiceApi.deleteUser(userId);
export const changePassword = (userId: string, currentPassword: string, newPassword: string): Promise<void> => 
  UserServiceApi.changePassword(userId, currentPassword, newPassword);
export const adminResetPassword = (userId: string, newPassword: string): Promise<void> => 
  UserServiceApi.adminResetPassword(userId, newPassword);

export default UserServiceApi;
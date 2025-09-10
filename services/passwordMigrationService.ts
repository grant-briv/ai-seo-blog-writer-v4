import { DatabaseService } from './databaseService';
import { hashPassword } from './authService';
import type { User } from '../types';

/**
 * Migration service to hash existing plain text passwords
 */
export class PasswordMigrationService {
  private static instance: PasswordMigrationService;
  private db: DatabaseService;

  private constructor() {
    this.db = DatabaseService.getInstance();
  }

  public static getInstance(): PasswordMigrationService {
    if (!PasswordMigrationService.instance) {
      PasswordMigrationService.instance = new PasswordMigrationService();
    }
    return PasswordMigrationService.instance;
  }

  /**
   * Check if a password is already hashed (bcrypt hashes start with $2b$)
   */
  private isPasswordHashed(password: string): boolean {
    return password.startsWith('$2b$') || password.startsWith('$2a$') || password.startsWith('$2y$');
  }

  /**
   * Migrate all users with unhashed passwords
   */
  public async migrateUnhashedPasswords(): Promise<{ migrated: number; total: number; errors: string[] }> {
    const errors: string[] = [];
    let migrated = 0;

    try {
      const users = await this.db.getAllUsers();
      console.log(`Starting password migration for ${users.length} users...`);

      for (const user of users) {
        try {
          if (!user.password || this.isPasswordHashed(user.password)) {
            // Skip users with no password or already hashed passwords
            continue;
          }

          console.log(`Migrating password for user: ${user.username}`);
          
          // Hash the plain text password
          const hashedPassword = await hashPassword(user.password);
          
          // Update user with hashed password
          const updatedUser: User = {
            ...user,
            password: hashedPassword
          };
          
          await this.db.updateUser(updatedUser);
          migrated++;
          
          console.log(`✓ Successfully migrated password for user: ${user.username}`);
        } catch (error) {
          const errorMsg = `Failed to migrate password for user ${user.username}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      const result = { migrated, total: users.length, errors };
      console.log(`Password migration completed: ${migrated}/${users.length} users migrated`);
      
      if (errors.length > 0) {
        console.error('Migration errors:', errors);
      }

      return result;
    } catch (error) {
      const errorMsg = `Password migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * Run migration automatically on app startup
   */
  public async runMigrationIfNeeded(): Promise<void> {
    try {
      // Check if any users have unhashed passwords
      const users = await this.db.getAllUsers();
      const needsMigration = users.some(user => 
        user.password && !this.isPasswordHashed(user.password)
      );

      if (needsMigration) {
        console.log('🔐 Detected users with unhashed passwords. Starting automatic migration...');
        const result = await this.migrateUnhashedPasswords();
        
        if (result.migrated > 0) {
          console.log(`🔐 Password migration completed: ${result.migrated} users migrated`);
        }
        
        if (result.errors.length > 0) {
          console.warn('⚠️ Password migration completed with errors:', result.errors);
        }
      }
    } catch (error) {
      console.error('🔐 Password migration failed:', error);
      // Don't throw - app should still start even if migration fails
    }
  }

  /**
   * Manually trigger migration (for admin use)
   */
  public async forceMigration(): Promise<{ migrated: number; total: number; errors: string[] }> {
    console.log('🔐 Manually triggering password migration...');
    return await this.migrateUnhashedPasswords();
  }
}

// Export singleton instance
export const passwordMigrationService = PasswordMigrationService.getInstance();
import { eq, and } from 'drizzle-orm';
import { db } from '../db/config';
import * as schema from '../db/schema';
import type { User, SavedBlogPost, AiWriterProfile } from '../types';

/**
 * PostgreSQL Database Service for production use
 * Provides persistent server-side storage
 */
export class PostgresDatabaseService {
  private static instance: PostgresDatabaseService;

  private constructor() {}

  public static getInstance(): PostgresDatabaseService {
    if (!PostgresDatabaseService.instance) {
      PostgresDatabaseService.instance = new PostgresDatabaseService();
    }
    return PostgresDatabaseService.instance;
  }

  // User operations
  public async getAllUsers(): Promise<User[]> {
    if (!db) throw new Error('Database not connected');
    
    const result = await db.select().from(schema.users);
    return result.map(this.mapDbUserToUser);
  }

  public async getUserById(userId: string): Promise<User | undefined> {
    if (!db) throw new Error('Database not connected');
    
    const result = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    return result[0] ? this.mapDbUserToUser(result[0]) : undefined;
  }

  public async getUserByUsername(username: string): Promise<User | undefined> {
    if (!db) throw new Error('Database not connected');
    
    const result = await db.select().from(schema.users).where(eq(schema.users.username, username.toLowerCase()));
    return result[0] ? this.mapDbUserToUser(result[0]) : undefined;
  }

  public async createUser(user: User): Promise<void> {
    if (!db) throw new Error('Database not connected');
    
    console.log('💾 PostgreSQL: Creating user in database:', {
      id: user.id,
      username: user.username,
      hasPassword: !!user.password,
      passwordLength: user.password?.length
    });
    
    try {
      await db.insert(schema.users).values({
        id: user.id,
        username: user.username.toLowerCase(),
        email: user.email,
        password: user.password,
        role: user.role,
        assignedProfileIds: user.assignedProfileIds || [],
        isTemporaryPassword: user.isTemporaryPassword ? 'true' : 'false',
      });
      
      console.log('💾 PostgreSQL: User creation successful');
      
      // Verify the user was actually saved
      const savedUser = await this.getUserById(user.id);
      console.log('💾 PostgreSQL: Verification - user saved:', {
        found: !!savedUser,
        hasPassword: !!savedUser?.password,
        passwordLength: savedUser?.password?.length
      });
    } catch (error) {
      console.error('💾 PostgreSQL: User creation failed:', error);
      throw error;
    }
  }

  public async updateUser(user: User): Promise<void> {
    if (!db) throw new Error('Database not connected');
    
    await db.update(schema.users)
      .set({
        username: user.username.toLowerCase(),
        email: user.email,
        password: user.password,
        role: user.role,
        assignedProfileIds: user.assignedProfileIds || [],
        isTemporaryPassword: user.isTemporaryPassword ? 'true' : 'false',
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, user.id));
  }

  public async deleteUser(userId: string): Promise<void> {
    if (!db) throw new Error('Database not connected');
    
    await db.delete(schema.users).where(eq(schema.users.id, userId));
  }

  // Writer Profile operations
  public async getAllWriterProfiles(): Promise<AiWriterProfile[]> {
    if (!db) throw new Error('Database not connected');
    
    const result = await db.select().from(schema.writerProfiles);
    return result.map(row => ({
      id: row.id,
      ownerId: row.ownerId,
      agentName: row.agentName,
      ...(row.profileData as any), // Cast the JSONB data
    }));
  }

  public async getWriterProfileById(profileId: string): Promise<AiWriterProfile | undefined> {
    if (!db) throw new Error('Database not connected');
    
    const result = await db.select().from(schema.writerProfiles).where(eq(schema.writerProfiles.id, profileId));
    if (!result[0]) return undefined;
    
    const row = result[0];
    return {
      id: row.id,
      ownerId: row.ownerId,
      agentName: row.agentName,
      ...(row.profileData as any),
    };
  }

  public async getWriterProfilesByOwner(ownerId: string): Promise<AiWriterProfile[]> {
    if (!db) throw new Error('Database not connected');
    
    const result = await db.select().from(schema.writerProfiles).where(eq(schema.writerProfiles.ownerId, ownerId));
    return result.map(row => ({
      id: row.id,
      ownerId: row.ownerId,
      agentName: row.agentName,
      ...(row.profileData as any),
    }));
  }

  public async createWriterProfile(profile: AiWriterProfile): Promise<void> {
    if (!db) throw new Error('Database not connected');
    
    const { id, ownerId, agentName, ...profileData } = profile;
    
    await db.insert(schema.writerProfiles).values({
      id,
      ownerId,
      agentName,
      profileData,
    });
  }

  public async updateWriterProfile(profile: AiWriterProfile): Promise<void> {
    if (!db) throw new Error('Database not connected');
    
    const { id, ownerId, agentName, ...profileData } = profile;
    
    await db.update(schema.writerProfiles)
      .set({
        ownerId,
        agentName,
        profileData,
        updatedAt: new Date(),
      })
      .where(eq(schema.writerProfiles.id, id));
  }

  public async deleteWriterProfile(profileId: string): Promise<void> {
    if (!db) throw new Error('Database not connected');
    
    await db.delete(schema.writerProfiles).where(eq(schema.writerProfiles.id, profileId));
  }

  // Blog Post operations
  public async getSavedBlogsForUser(userId: string): Promise<SavedBlogPost[]> {
    if (!db) throw new Error('Database not connected');
    
    const result = await db.select().from(schema.savedBlogPosts)
      .where(eq(schema.savedBlogPosts.userId, userId))
      .orderBy(schema.savedBlogPosts.savedAt);
      
    return result.map(row => ({
      id: row.id,
      userId: row.userId,
      blogTitle: row.blogTitle,
      savedAt: row.savedAt,
      ...(row.blogData as any),
    }));
  }

  public async getSavedBlogById(blogId: string): Promise<SavedBlogPost | undefined> {
    if (!db) throw new Error('Database not connected');
    
    const result = await db.select().from(schema.savedBlogPosts).where(eq(schema.savedBlogPosts.id, blogId));
    if (!result[0]) return undefined;
    
    const row = result[0];
    return {
      id: row.id,
      userId: row.userId,
      blogTitle: row.blogTitle,
      savedAt: row.savedAt,
      ...(row.blogData as any),
    };
  }

  public async createSavedBlog(blogPost: SavedBlogPost): Promise<void> {
    if (!db) throw new Error('Database not connected');
    
    const { id, userId, blogTitle, savedAt, ...blogData } = blogPost;
    
    await db.insert(schema.savedBlogPosts).values({
      id,
      userId,
      blogTitle,
      blogData,
      savedAt: savedAt || new Date(),
    });
  }

  public async updateSavedBlog(blogPost: SavedBlogPost): Promise<void> {
    if (!db) throw new Error('Database not connected');
    
    const { id, userId, blogTitle, savedAt, ...blogData } = blogPost;
    
    await db.update(schema.savedBlogPosts)
      .set({
        userId,
        blogTitle,
        blogData,
        savedAt: savedAt || new Date(),
      })
      .where(eq(schema.savedBlogPosts.id, id));
  }

  public async deleteSavedBlog(blogId: string): Promise<void> {
    if (!db) throw new Error('Database not connected');
    
    await db.delete(schema.savedBlogPosts).where(eq(schema.savedBlogPosts.id, blogId));
  }

  // Settings operations
  public async getSelectedWriterProfileId(): Promise<string | null> {
    if (!db) throw new Error('Database not connected');
    
    try {
      const result = await db.select().from(schema.appSettings).where(eq(schema.appSettings.key, 'selectedWriterProfileId'));
      return result[0]?.value || null;
    } catch (e) {
      console.error('Error getting selected writer profile ID:', e);
      return null;
    }
  }

  public async setSelectedWriterProfileId(profileId: string | null): Promise<void> {
    if (!db) throw new Error('Database not connected');
    
    try {
      if (profileId) {
        await db.insert(schema.appSettings).values({
          key: 'selectedWriterProfileId',
          value: profileId,
        }).onConflictDoUpdate({
          target: schema.appSettings.key,
          set: {
            value: profileId,
            updatedAt: new Date(),
          },
        });
      } else {
        await db.delete(schema.appSettings).where(eq(schema.appSettings.key, 'selectedWriterProfileId'));
      }
    } catch (e) {
      console.error('Error setting selected writer profile ID:', e);
    }
  }

  // Helper method to map database user to application user type
  private mapDbUserToUser(dbUser: any): User {
    return {
      id: dbUser.id,
      username: dbUser.username,
      email: dbUser.email,
      password: dbUser.password,
      role: dbUser.role as 'admin' | 'general',
      assignedProfileIds: dbUser.assignedProfileIds || [],
      isTemporaryPassword: dbUser.isTemporaryPassword === 'true',
    };
  }

  // Migration helper - not needed for PostgreSQL as we use proper migrations
  public async migrateFromLocalStorage(): Promise<void> {
    console.log('PostgreSQL database does not need localStorage migration');
  }
}
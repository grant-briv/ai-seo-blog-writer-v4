import Dexie, { Table } from 'dexie';
import { User, SavedBlogPost, AiWriterProfile } from '../types';

interface AppSetting {
  key: string;
  value: string;
  updatedAt?: Date;
}

interface TopicSearch {
  id?: number;
  userId: string;
  searchQuery: string;
  createdAt?: Date;
}

class AppDatabase extends Dexie {
  users!: Table<User>;
  writerProfiles!: Table<AiWriterProfile>;
  savedBlogPosts!: Table<SavedBlogPost>;
  topicSearches!: Table<TopicSearch>;
  appSettings!: Table<AppSetting>;

  constructor() {
    super('AiSEOBlogWriterDB');
    
    this.version(1).stores({
      users: 'id, username, role',
      writerProfiles: 'id, ownerId, agentName',
      savedBlogPosts: 'id, userId, blogTitle, savedAt',
      topicSearches: '++id, userId, searchQuery, createdAt',
      appSettings: 'key'
    });
  }
}

export class DatabaseService {
  private static instance: DatabaseService;
  private db: AppDatabase;

  private constructor() {
    this.db = new AppDatabase();
    this.initializeDatabase();
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  private async initializeDatabase(): Promise<void> {
    try {
      await this.db.open();
      await this.seedDefaultData();
    } catch (error) {
      console.error('Failed to initialize database:', error);
    }
  }

  private async seedDefaultData(): Promise<void> {
    // Check if default admin user exists
    const adminExists = await this.db.users.where('role').equals('admin').count();
    
    if (adminExists === 0) {
      const defaultAdmin: User = {
        id: 'admin-001',
        username: 'admin',
        password: 'password', // INSECURE: For demo purposes only
        role: 'admin',
        assignedProfileIds: [],
      };
      await this.db.users.add(defaultAdmin);
    }
  }

  // User operations
  public async getAllUsers(): Promise<User[]> {
    return await this.db.users.orderBy('username').toArray();
  }

  public async getUserById(userId: string): Promise<User | undefined> {
    return await this.db.users.get(userId);
  }

  public async getUserByUsername(username: string): Promise<User | undefined> {
    return await this.db.users.where('username').equalsIgnoreCase(username).first();
  }

  public async createUser(user: User): Promise<void> {
    await this.db.users.add(user);
  }

  public async updateUser(user: User): Promise<void> {
    await this.db.users.put(user);
  }

  public async deleteUser(userId: string): Promise<void> {
    await this.db.users.delete(userId);
  }

  // Writer Profile operations
  public async getAllWriterProfiles(): Promise<AiWriterProfile[]> {
    return await this.db.writerProfiles.orderBy('agentName').toArray();
  }

  public async getWriterProfileById(profileId: string): Promise<AiWriterProfile | undefined> {
    return await this.db.writerProfiles.get(profileId);
  }

  public async getWriterProfilesByOwner(ownerId: string): Promise<AiWriterProfile[]> {
    return await this.db.writerProfiles.where('ownerId').equals(ownerId).toArray();
  }

  public async createWriterProfile(profile: AiWriterProfile): Promise<void> {
    await this.db.writerProfiles.add(profile);
  }

  public async updateWriterProfile(profile: AiWriterProfile): Promise<void> {
    await this.db.writerProfiles.put(profile);
  }

  public async deleteWriterProfile(profileId: string): Promise<void> {
    await this.db.writerProfiles.delete(profileId);
  }

  // Blog Post operations
  public async getSavedBlogsForUser(userId: string): Promise<SavedBlogPost[]> {
    return await this.db.savedBlogPosts
      .where('userId').equals(userId)
      .reverse()
      .sortBy('savedAt');
  }

  public async getSavedBlogById(blogId: string): Promise<SavedBlogPost | undefined> {
    return await this.db.savedBlogPosts.get(blogId);
  }

  public async createSavedBlog(blogPost: SavedBlogPost): Promise<void> {
    await this.db.savedBlogPosts.add(blogPost);
  }

  public async updateSavedBlog(blogPost: SavedBlogPost): Promise<void> {
    await this.db.savedBlogPosts.put(blogPost);
  }

  public async deleteSavedBlog(blogId: string): Promise<void> {
    await this.db.savedBlogPosts.delete(blogId);
  }

  // Topic Search operations
  public async getSavedSearchesForUser(userId: string): Promise<string[]> {
    const searches = await this.db.topicSearches
      .where('userId').equals(userId)
      .reverse()
      .sortBy('createdAt');
    return searches.map(search => search.searchQuery);
  }

  public async insertSavedSearch(userId: string, searchQuery: string): Promise<void> {
    // Check if search already exists for this user
    const existing = await this.db.topicSearches
      .where(['userId', 'searchQuery'])
      .equals([userId, searchQuery])
      .first();
    
    if (!existing) {
      await this.db.topicSearches.add({
        userId,
        searchQuery,
        createdAt: new Date()
      });
    }
  }

  public async deleteSavedSearch(userId: string, searchQuery: string): Promise<void> {
    await this.db.topicSearches
      .where(['userId', 'searchQuery'])
      .equals([userId, searchQuery])
      .delete();
  }

  // Settings operations
  public async getSelectedWriterProfileId(): Promise<string | null> {
    try {
      const setting = await this.db.appSettings.get('selectedWriterProfileId');
      return setting?.value || null;
    } catch (e) {
      console.error('Error getting selected writer profile ID:', e);
      return null;
    }
  }

  public async setSelectedWriterProfileId(profileId: string | null): Promise<void> {
    try {
      if (profileId) {
        await this.db.appSettings.put({
          key: 'selectedWriterProfileId',
          value: profileId,
          updatedAt: new Date()
        });
      } else {
        await this.db.appSettings.delete('selectedWriterProfileId');
      }
    } catch (e) {
      console.error('Error setting selected writer profile ID:', e);
    }
  }

  // Migration helper to import from localStorage
  public async migrateFromLocalStorage(): Promise<void> {
    try {
      console.log('Starting migration from localStorage to IndexedDB...');
      
      // Migrate writer profiles
      const storedProfiles = localStorage.getItem('aiWriterProfiles');
      if (storedProfiles) {
        const profiles: AiWriterProfile[] = JSON.parse(storedProfiles);
        const existingProfiles = await this.getAllWriterProfiles();
        
        for (const profile of profiles) {
          const exists = existingProfiles.find(p => p.id === profile.id);
          if (!exists) {
            await this.createWriterProfile(profile);
            console.log(`Migrated writer profile: "${profile.agentName}"`);
          }
        }
      }

      // Migrate selected profile ID
      const selectedProfileId = localStorage.getItem('selectedAiWriterProfileId');
      if (selectedProfileId) {
        await this.setSelectedWriterProfileId(selectedProfileId);
        console.log('Migrated selected profile ID');
      }

      // Migrate saved blogs
      const storedBlogs = localStorage.getItem('ai_blog_writer_saved_blogs');
      if (storedBlogs) {
        const blogs: SavedBlogPost[] = JSON.parse(storedBlogs);
        const existingBlogs = await this.db.savedBlogPosts.toArray();
        
        for (const blog of blogs) {
          const exists = existingBlogs.find(b => b.id === blog.id);
          if (!exists) {
            await this.createSavedBlog(blog);
            console.log(`Migrated blog: ${blog.blogTitle}`);
          }
        }
      }

      console.log('Migration completed successfully!');
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }
}
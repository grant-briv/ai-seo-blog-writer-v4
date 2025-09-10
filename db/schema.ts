import { pgTable, text, timestamp, jsonb, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(),
  email: text('email'),
  password: text('password').notNull(),
  role: text('role').notNull(), // 'admin' | 'general'
  assignedProfileIds: jsonb('assigned_profile_ids').$type<string[]>().default([]),
  isTemporaryPassword: text('is_temporary_password').default('false'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const writerProfiles = pgTable('writer_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: text('owner_id').notNull(),
  agentName: text('agent_name').notNull(),
  profileData: jsonb('profile_data').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const savedBlogPosts = pgTable('saved_blog_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  blogTitle: text('blog_title').notNull(),
  blogData: jsonb('blog_data').notNull(),
  savedAt: timestamp('saved_at').defaultNow().notNull(),
});

export const topicSearches = pgTable('topic_searches', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  searchQuery: text('search_query').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type WriterProfile = typeof writerProfiles.$inferSelect;
export type NewWriterProfile = typeof writerProfiles.$inferInsert;
export type SavedBlogPost = typeof savedBlogPosts.$inferSelect;
export type NewSavedBlogPost = typeof savedBlogPosts.$inferInsert;
import type { SavedBlogPost } from '../types';
import { DatabaseService } from './databaseService';

/**
 * Retrieves all saved blog posts for a specific user.
 * @param userId - The ID of the user whose blogs to retrieve.
 * @returns An array of SavedBlogPost objects.
 */
export const getSavedBlogsForUser = async (userId: string): Promise<SavedBlogPost[]> => {
    try {
        const db = DatabaseService.getInstance();
        return await db.getSavedBlogsForUser(userId);
    } catch (e) {
        console.error("Failed to retrieve saved blogs:", e);
        return [];
    }
};

/**
 * Saves or updates a single blog post.
 * @param blogPost - The blog post to save.
 */
export const saveBlogPost = async (blogPost: SavedBlogPost): Promise<void> => {
    try {
        const db = DatabaseService.getInstance();
        const existing = await db.getSavedBlogById(blogPost.id);
        if (existing) {
            await db.updateSavedBlog(blogPost);
        } else {
            await db.createSavedBlog(blogPost);
        }
    } catch (e) {
        console.error("Failed to save blog:", e);
        alert("Error: Could not save blog data. Your changes may not persist.");
    }
};

/**
 * Deletes a blog post by its ID, ensuring it belongs to the correct user.
 * @param blogId - The ID of the blog to delete.
 * @param userId - The ID of the user requesting the deletion.
 */
export const deleteBlogPost = async (blogId: string, userId: string): Promise<void> => {
    try {
        const db = DatabaseService.getInstance();
        const blogToDelete = await db.getSavedBlogById(blogId);
        
        if (blogToDelete && blogToDelete.userId === userId) {
            await db.deleteSavedBlog(blogId);
        } else {
            console.warn("Attempted to delete a blog post that does not exist or does not belong to the user.");
        }
    } catch (e) {
        console.error("Failed to delete blog:", e);
    }
};
import type { SavedBlogPost } from '../types';
import { apiClient } from './apiClient';

/**
 * Retrieves all saved blog posts for the authenticated user.
 * @returns An array of SavedBlogPost objects.
 */
export const getSavedBlogsForUser = async (): Promise<SavedBlogPost[]> => {
    try {
        if (!apiClient.isAuthenticated()) {
            console.warn("User not authenticated, cannot retrieve saved blogs");
            return [];
        }

        const response = await apiClient.getAllSavedBlogs();
        
        if (response.success && response.blogs) {
            console.log(`📝 Retrieved ${response.blogs.length} saved blogs from API`);
            return response.blogs;
        }
        
        console.error("Failed to retrieve saved blogs - invalid response");
        return [];
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
        if (!apiClient.isAuthenticated()) {
            console.error("User not authenticated, cannot save blog");
            alert("Error: You must be logged in to save blog posts.");
            return;
        }

        const blogData = {
            blogTitle: blogPost.blogTitle,
            appState: blogPost.appState
        };

        // Check if this is an update (blog has existing UUID format) or create
        const isUpdate = blogPost.id && blogPost.id.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);
        
        if (isUpdate) {
            // Try to update existing blog
            try {
                await apiClient.updateSavedBlog(blogPost.id, blogData);
                console.log(`📝 Updated saved blog with ID: ${blogPost.id}`);
            } catch (updateError) {
                // If update fails (e.g., blog doesn't exist), create new one
                if (updateError.message.includes('404')) {
                    console.log(`📝 Blog ${blogPost.id} not found, creating new blog instead`);
                    await apiClient.createSavedBlog(blogData);
                } else {
                    throw updateError;
                }
            }
        } else {
            // Create new blog
            await apiClient.createSavedBlog(blogData);
            console.log(`📝 Created new saved blog`);
        }
    } catch (e) {
        console.error("Failed to save blog:", e);
        alert("Error: Could not save blog data. Your changes may not persist.");
    }
};

/**
 * Deletes a blog post by its ID, ensuring it belongs to the authenticated user.
 * @param blogId - The ID of the blog to delete.
 */
export const deleteBlogPost = async (blogId: string): Promise<void> => {
    try {
        if (!apiClient.isAuthenticated()) {
            console.error("User not authenticated, cannot delete blog");
            return;
        }

        await apiClient.deleteSavedBlog(blogId);
        console.log(`📝 Deleted saved blog with ID: ${blogId}`);
    } catch (e) {
        console.error("Failed to delete blog:", e);
        if (e.message.includes('404')) {
            console.warn("Blog post not found or does not belong to the user.");
        } else {
            alert("Error: Could not delete blog post. Please try again.");
        }
    }
};
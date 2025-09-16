import express from 'express';
import { eq, and } from 'drizzle-orm';
import { savedBlogPosts } from '../../db/schema.ts';

const router = express.Router();

/**
 * GET /api/saved-blogs
 * Get all saved blog posts for the authenticated user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    console.log(`📝 Getting saved blogs for user: ${userId}`);
    const db = req.app.locals.db;
    
    const blogs = await db
      .select()
      .from(savedBlogPosts)
      .where(eq(savedBlogPosts.userId, userId));

    console.log(`📝 Found ${blogs.length} saved blogs for user`);
    
    // Transform database records to match frontend SavedBlogPost interface
    const transformedBlogs = blogs.map(blog => ({
      id: blog.id,
      userId: blog.userId,
      savedAt: blog.savedAt.toISOString(),
      blogTitle: blog.blogTitle,
      appState: blog.blogData // blogData contains the full SavedBlogState
    }));

    res.json({ 
      success: true, 
      blogs: transformedBlogs 
    });
  } catch (error) {
    console.error('❌ Error getting saved blogs:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve saved blogs',
      message: error.message 
    });
  }
});

/**
 * GET /api/saved-blogs/:id
 * Get a specific saved blog post by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    console.log(`📝 Getting saved blog ${id} for user: ${userId}`);
    const db = req.app.locals.db;
    
    const blogs = await db
      .select()
      .from(savedBlogPosts)
      .where(and(
        eq(savedBlogPosts.id, id),
        eq(savedBlogPosts.userId, userId)
      ));

    if (blogs.length === 0) {
      return res.status(404).json({ error: 'Blog post not found' });
    }

    const blog = blogs[0];
    
    // Transform database record to match frontend SavedBlogPost interface
    const transformedBlog = {
      id: blog.id,
      userId: blog.userId,
      savedAt: blog.savedAt.toISOString(),
      blogTitle: blog.blogTitle,
      appState: blog.blogData // blogData contains the full SavedBlogState
    };

    res.json({ 
      success: true, 
      blog: transformedBlog 
    });
  } catch (error) {
    console.error('❌ Error getting saved blog:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve saved blog',
      message: error.message 
    });
  }
});

/**
 * POST /api/saved-blogs
 * Create a new saved blog post
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { blogTitle, appState } = req.body;
    
    if (!blogTitle || !appState) {
      return res.status(400).json({ error: 'Blog title and app state are required' });
    }

    console.log(`📝 Creating new saved blog for user: ${userId}`);
    const db = req.app.locals.db;
    
    const newBlogData = {
      userId,
      blogTitle,
      blogData: appState // Store the full SavedBlogState in blogData
    };

    const createdBlogs = await db
      .insert(savedBlogPosts)
      .values(newBlogData)
      .returning();

    const createdBlog = createdBlogs[0];
    
    // Transform database record to match frontend SavedBlogPost interface
    const transformedBlog = {
      id: createdBlog.id,
      userId: createdBlog.userId,
      savedAt: createdBlog.savedAt.toISOString(),
      blogTitle: createdBlog.blogTitle,
      appState: createdBlog.blogData
    };

    console.log(`📝 Created saved blog with ID: ${createdBlog.id}`);
    res.status(201).json({ 
      success: true, 
      blog: transformedBlog 
    });
  } catch (error) {
    console.error('❌ Error creating saved blog:', error);
    res.status(500).json({ 
      error: 'Failed to create saved blog',
      message: error.message 
    });
  }
});

/**
 * PUT /api/saved-blogs/:id
 * Update an existing saved blog post
 */
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { blogTitle, appState } = req.body;
    
    if (!blogTitle || !appState) {
      return res.status(400).json({ error: 'Blog title and app state are required' });
    }

    console.log(`📝 Updating saved blog ${id} for user: ${userId}`);
    const db = req.app.locals.db;
    
    // First check if the blog exists and belongs to the user
    const existingBlogs = await db
      .select()
      .from(savedBlogPosts)
      .where(and(
        eq(savedBlogPosts.id, id),
        eq(savedBlogPosts.userId, userId)
      ));

    if (existingBlogs.length === 0) {
      return res.status(404).json({ error: 'Blog post not found' });
    }

    const updateData = {
      blogTitle,
      blogData: appState // Store the full SavedBlogState in blogData
    };

    const updatedBlogs = await db
      .update(savedBlogPosts)
      .set(updateData)
      .where(and(
        eq(savedBlogPosts.id, id),
        eq(savedBlogPosts.userId, userId)
      ))
      .returning();

    const updatedBlog = updatedBlogs[0];
    
    // Transform database record to match frontend SavedBlogPost interface
    const transformedBlog = {
      id: updatedBlog.id,
      userId: updatedBlog.userId,
      savedAt: updatedBlog.savedAt.toISOString(),
      blogTitle: updatedBlog.blogTitle,
      appState: updatedBlog.blogData
    };

    console.log(`📝 Updated saved blog with ID: ${id}`);
    res.json({ 
      success: true, 
      blog: transformedBlog 
    });
  } catch (error) {
    console.error('❌ Error updating saved blog:', error);
    res.status(500).json({ 
      error: 'Failed to update saved blog',
      message: error.message 
    });
  }
});

/**
 * DELETE /api/saved-blogs/:id
 * Delete a saved blog post
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    console.log(`📝 Deleting saved blog ${id} for user: ${userId}`);
    const db = req.app.locals.db;
    
    // First check if the blog exists and belongs to the user
    const existingBlogs = await db
      .select()
      .from(savedBlogPosts)
      .where(and(
        eq(savedBlogPosts.id, id),
        eq(savedBlogPosts.userId, userId)
      ));

    if (existingBlogs.length === 0) {
      return res.status(404).json({ error: 'Blog post not found' });
    }

    await db
      .delete(savedBlogPosts)
      .where(and(
        eq(savedBlogPosts.id, id),
        eq(savedBlogPosts.userId, userId)
      ));

    console.log(`📝 Deleted saved blog with ID: ${id}`);
    res.json({ 
      success: true, 
      message: 'Blog post deleted successfully' 
    });
  } catch (error) {
    console.error('❌ Error deleting saved blog:', error);
    res.status(500).json({ 
      error: 'Failed to delete saved blog',
      message: error.message 
    });
  }
});

export default router;
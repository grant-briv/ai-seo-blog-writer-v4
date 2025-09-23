import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();
import { fileURLToPath } from 'url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';
import * as schema from '../db/schema.ts';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import writerProfileRoutes from './routes/writerProfiles.js';
import userSettingsRoutes from './routes/userSettings.js';
import savedBlogsRoutes from './routes/savedBlogs.js';
import topicSearchesRoutes from './routes/topicSearches.js';
import emailRoutes from './routes/email.js';
import { authenticateToken } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Database setup
let db;
async function initializeDatabase() {
  const connectionString = process.env.DATABASE_URL || process.env.PGURL;
  
  if (!connectionString) {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ No DATABASE_URL found. Please set the environment variable.');
      process.exit(1);
    } else {
      console.log('⚠️  No DATABASE_URL found. Running without persistent database for development.');
      console.log('⚠️  Users will be stored in memory only. Set DATABASE_URL for persistent storage.');
      
      // Create a mock database object for development
      app.locals.db = {
        select: () => ({ from: () => ({ where: () => [] }) }),
        insert: () => ({ values: () => ({ returning: () => [{ id: 'mock-id', username: 'mock' }] }) }),
        update: () => ({ set: () => ({ where: () => ({ returning: () => [{ id: 'mock-id' }] }) }) }),
        delete: () => ({ where: () => Promise.resolve() })
      };
      
      console.log('⚠️  Mock database initialized for development');
      return;
    }
  }

  console.log('🔄 Connecting to PostgreSQL database...');
  
  const client = new Client({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    db = drizzle(client, { schema });
    
    // Run migrations
    console.log('🔄 Running database migrations...');
    await migrate(db, { migrationsFolder: './db/migrations' });
    console.log('✅ Database migrations completed');
    
    // Make db available to routes
    app.locals.db = db;
    
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.log('⚠️  Falling back to mock database for development');
      app.locals.db = {
        select: () => ({ from: () => ({ where: () => [] }) }),
        insert: () => ({ values: () => ({ returning: () => [{ id: 'mock-id', username: 'mock' }] }) }),
        update: () => ({ set: () => ({ where: () => ({ returning: () => [{ id: 'mock-id' }] }) }) }),
        delete: () => ({ where: () => Promise.resolve() })
      };
    }
  }
}

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || [
    'http://localhost:5173', 
    'https://ai-seo-blog-writer-v4-production.up.railway.app',
    'https://seoblog.placetools.ai'
  ],
  credentials: true
}));
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    database: !!db ? 'connected' : 'disconnected'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/writer-profiles', authenticateToken, writerProfileRoutes);
app.use('/api/user-settings', authenticateToken, userSettingsRoutes);
app.use('/api/saved-blogs', authenticateToken, savedBlogsRoutes);
app.use('/api/topic-searches', authenticateToken, topicSearchesRoutes);
app.use('/api/email', authenticateToken, emailRoutes);

// Serve static frontend files in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'dist');
  console.log(`📁 Serving static files from: ${distPath}`);
  app.use(express.static(distPath));
  
  // Handle client-side routing - serve index.html for non-API routes
  app.use((req, res, next) => {
    // Skip API routes and health checks
    if (req.path.startsWith('/api/') || req.path.startsWith('/health')) {
      return next();
    }
    
    // Check if file exists in static files first
    const filePath = path.join(distPath, req.path);
    if (req.path !== '/' && fs.existsSync(filePath)) {
      return next();
    }
    
    console.log(`📄 Serving index.html for: ${req.path}`);
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  // Development 404 handler for non-API routes
  app.use((req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/health')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.status(404).send('Frontend not available in development mode. Use npm run dev for frontend.');
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
  next();
});

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 Backend API server running on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
      console.log(`🔗 Frontend CORS: ${process.env.FRONTEND_URL || 'localhost:5173'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
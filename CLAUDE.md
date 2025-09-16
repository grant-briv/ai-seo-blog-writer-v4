# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI SEO Blog Writer v4 is a React-based web application with an Express.js backend that generates SEO-optimized blog content using Google's Gemini AI. The application features a hybrid architecture with both client-side (IndexedDB) and server-side (PostgreSQL) data storage, user authentication, and multi-tenant writer profile management.

## Development Commands

### Frontend Development
```bash
npm run dev                 # Start Vite dev server (frontend only)
npm run build              # Build for production (includes DB migration)
npm run preview            # Preview production build
```

### Backend Development
```bash
npm run backend            # Start Express.js API server
npm run backend:dev        # Start backend with auto-reload
npm run dev:full           # Run both frontend and backend concurrently
```

### Database Management
```bash
npm run migrate            # Run database migrations
npm run db:generate        # Generate new migration files
npm run db:migrate         # Apply migrations using drizzle-kit
npm run db:studio          # Open Drizzle Studio database GUI
```

## Architecture Overview

### Dual Storage System
The application implements a hybrid storage approach:
- **Client-side**: IndexedDB via Dexie.js for offline-first functionality
- **Server-side**: PostgreSQL via Drizzle ORM for persistent, shared storage
- **API Client**: `services/apiClient.ts` handles backend communication
- **Database Service**: `services/databaseService.ts` manages IndexedDB operations

### Authentication System
- **Frontend**: `services/authService.ts` - Handles user authentication via API
- **Backend**: `backend/routes/auth.js` - JWT-based authentication with bcrypt
- **Middleware**: `backend/middleware/auth.js` - Token validation and authorization
- **Rate Limiting**: Built-in account lockout (5 attempts, 15-minute lockout)

### Core Services Architecture
- **Gemini AI**: `services/geminiService.ts` - All AI content generation
- **Keyword Research**: `services/keywordsEverywhereService.ts` - SEO keyword analysis
- **Google Search**: `services/googleSearchService.ts` - External content research
- **Writer Profiles**: `services/writerProfileService.ts` - AI persona management
- **Blog Storage**: `services/blogStorageService.ts` - Blog post persistence

### Database Schema (PostgreSQL)
```typescript
// Primary tables defined in db/schema.ts
users              // User accounts with role-based access
writer_profiles     // AI writer persona configurations  
saved_blog_posts    // Stored blog content and metadata
```

### Component Structure
- **App.tsx**: Main application shell with routing and authentication
- **AdminPage.tsx**: User management interface (admin-only)
- **ContentEnhancementUI.tsx**: AI-powered content optimization tools
- **KeywordResearch.tsx**: SEO keyword analysis interface
- **WriterProfileManager.tsx**: AI writer persona configuration

## Environment Configuration

### Required Environment Variables
```bash
# Frontend (.env)
VITE_API_URL=http://localhost:3001        # Backend API endpoint

# Backend (set via Railway/production)
DATABASE_URL=postgresql://...             # PostgreSQL connection string
JWT_SECRET=your-jwt-secret                # JWT token signing key
NODE_ENV=production                       # Environment mode
```

### API Keys (set via admin interface)
- `GEMINI_API_KEY`: Google Gemini AI (required)
- `GOOGLE_SEARCH_API_KEY`: Google Custom Search (optional)
- `GOOGLE_SEARCH_ENGINE_ID`: Custom Search Engine ID (optional)
- `KEYWORDS_EVERYWHERE_API_KEY`: Keyword research (optional)

## Backend API Endpoints

### Authentication
- `POST /api/auth/login` - User authentication
- `POST /api/auth/register` - User registration (admin only)
- `POST /api/auth/verify-token` - Token validation

### User Management (requires authentication)
- `GET /api/users` - List all users (admin only)
- `GET /api/users/:id` - Get user by ID (admin or self)
- `PUT /api/users/:id` - Update user (admin or self)
- `DELETE /api/users/:id` - Delete user (admin only)
- `PUT /api/users/:id/password` - Change password (admin or self)

## Development Workflow

### Backend Development
1. Set `DATABASE_URL` environment variable for PostgreSQL connection
2. Without `DATABASE_URL`, backend runs with mock database for development
3. Use `npm run dev:full` to run both frontend and backend simultaneously
4. Backend runs on port 3001, frontend on port 5173

### Frontend-Backend Integration
- Frontend uses `services/apiClient.ts` for all backend communication
- Authentication state managed in `App.tsx` with JWT tokens
- API client automatically handles authorization headers

### Database Development
- Use Drizzle Studio (`npm run db:studio`) for database inspection
- Generate migrations with `npm run db:generate` after schema changes
- Schema definitions in `db/schema.ts` using Drizzle ORM

## Production Deployment

### Railway Deployment
- Frontend and backend are separate Railway services
- PostgreSQL database shared between services
- Environment variables set via Railway dashboard
- Use internal `DATABASE_URL` for production, external for local development

### Migration Strategy
- Database migrations run automatically on build (`npm run build`)
- User data migrates from IndexedDB to PostgreSQL when backend is available
- Graceful fallback to IndexedDB when backend is unavailable

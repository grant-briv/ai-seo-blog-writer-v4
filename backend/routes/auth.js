import express from 'express';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { users } from '../../db/schema.ts';
import { generateToken } from '../middleware/auth.js';

const router = express.Router();

// Rate limiting storage (in production, use Redis)
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

function isRateLimited(username) {
  const attempts = loginAttempts.get(username.toLowerCase());
  if (!attempts) return { isLimited: false };

  const now = Date.now();
  
  if (attempts.lockedUntil && now > attempts.lockedUntil) {
    loginAttempts.delete(username.toLowerCase());
    return { isLimited: false };
  }

  if (attempts.lockedUntil && now <= attempts.lockedUntil) {
    return { isLimited: true, lockedUntil: attempts.lockedUntil };
  }

  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    const lockedUntil = now + LOCKOUT_DURATION;
    attempts.lockedUntil = lockedUntil;
    return { isLimited: true, lockedUntil };
  }

  return { isLimited: false };
}

function recordFailedAttempt(username) {
  const key = username.toLowerCase();
  const now = Date.now();
  const attempts = loginAttempts.get(key) || { count: 0, lastAttempt: 0 };

  if (now - attempts.lastAttempt > LOCKOUT_DURATION) {
    attempts.count = 1;
  } else {
    attempts.count++;
  }

  attempts.lastAttempt = now;
  loginAttempts.set(key, attempts);
}

function clearFailedAttempts(username) {
  loginAttempts.delete(username.toLowerCase());
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    console.log('🔐 Login attempt for user:', username);

    // Check rate limiting
    const rateLimitCheck = isRateLimited(username);
    if (rateLimitCheck.isLimited) {
      const lockoutMinutes = rateLimitCheck.lockedUntil ? 
        Math.ceil((rateLimitCheck.lockedUntil - Date.now()) / (1000 * 60)) : 15;
      
      console.log('🔐 Rate limited user:', username);
      return res.status(429).json({ 
        error: `Too many failed attempts. Account locked for ${lockoutMinutes} minutes.`,
        lockedUntil: rateLimitCheck.lockedUntil
      });
    }

    // Get user from database
    const db = req.app.locals.db;
    const userResult = await db.select().from(users).where(eq(users.username, username.toLowerCase()));
    const user = userResult[0];

    if (!user) {
      console.log('🔐 User not found:', username);
      recordFailedAttempt(username);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    console.log('🔐 User found, verifying password');

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      console.log('🔐 Invalid password for user:', username);
      recordFailedAttempt(username);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Success - clear failed attempts and create token
    console.log('🔐 Login successful for user:', username);
    clearFailedAttempts(username);
    const token = generateToken(user);

    // Don't return password in response
    const { password: _, ...userResponse } = user;

    res.json({ 
      success: true, 
      user: userResponse, 
      token 
    });

  } catch (error) {
    console.error('🔐 Login error:', error);
    res.status(500).json({ error: 'Authentication service unavailable' });
  }
});

// POST /api/auth/register (admin only - will be protected by middleware in main app)
router.post('/register', async (req, res) => {
  try {
    const { username, password, email, role = 'general', assignedProfileIds = [] } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    console.log('🔐 Registration attempt for user:', username);

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const db = req.app.locals.db;

    // Check if username already exists
    const existingUser = await db.select().from(users).where(eq(users.username, username.toLowerCase()));
    if (existingUser.length > 0) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const newUserResult = await db.insert(users).values({
      username: username.toLowerCase(),
      email,
      password: hashedPassword,
      role,
      assignedProfileIds
    }).returning();

    const newUser = newUserResult[0];
    console.log('🔐 User created successfully:', username);

    // Don't return password in response
    const { password: _, ...userResponse } = newUser;

    res.status(201).json({ 
      success: true, 
      user: userResponse 
    });

  } catch (error) {
    console.error('🔐 Registration error:', error);
    res.status(500).json({ error: 'User creation failed' });
  }
});

// POST /api/auth/verify-token
router.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // The authenticateToken middleware would handle this, but this is a standalone endpoint
    const jwt = await import('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
    
    const decoded = jwt.default.verify(token, JWT_SECRET);
    
    // Get fresh user data
    const db = req.app.locals.db;
    const userResult = await db.select().from(users).where(eq(users.id, decoded.id));
    const user = userResult[0];
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Don't return password
    const { password: _, ...userResponse } = user;
    
    res.json({ 
      success: true, 
      user: userResponse 
    });
    
  } catch (error) {
    console.error('🔐 Token verification error:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

export default router;
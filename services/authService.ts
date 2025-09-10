import bcrypt from 'bcryptjs';
import type { User } from '../types';
import { DatabaseService } from './databaseService';

// Security configuration
const SALT_ROUNDS = 12;
const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const MIN_PASSWORD_LENGTH = 8;

// Password strength requirements
const PASSWORD_REQUIREMENTS = {
  minLength: MIN_PASSWORD_LENGTH,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
};

// Rate limiting storage (in-memory for demo, should use Redis in production)
const loginAttempts = new Map<string, { count: number; lastAttempt: number; lockedUntil?: number }>();

// Session token interface
interface SessionToken {
  userId: string;
  username: string;
  role: 'admin' | 'general';
  issuedAt: number;
  expiresAt: number;
}

/**
 * Validates password strength
 */
export const validatePasswordStrength = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters long`);
  }

  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (PASSWORD_REQUIREMENTS.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (PASSWORD_REQUIREMENTS.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return { isValid: errors.length === 0, errors };
};

/**
 * Hashes a password securely
 */
export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Verifies a password against its hash
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  console.log('🔐 VERIFY: Starting password verification');
  console.log('🔐 VERIFY: Password provided:', password ? 'YES' : 'NO');
  console.log('🔐 VERIFY: Hash provided:', hash ? 'YES' : 'NO');
  console.log('🔐 VERIFY: Hash length:', hash?.length);
  console.log('🔐 VERIFY: Hash starts with $2:', hash?.startsWith('$2'));
  
  if (!password || !hash) {
    console.error('🔐 VERIFY: verifyPassword called with empty password or hash');
    return false;
  }
  
  try {
    console.log('🔐 VERIFY: Calling bcrypt.compare...');
    const result = await bcrypt.compare(password, hash);
    console.log('🔐 VERIFY: bcrypt.compare result:', result);
    return result;
  } catch (error) {
    console.error('🔐 VERIFY: Password verification failed:', error);
    return false;
  }
};

/**
 * Checks if user is rate limited
 */
const isRateLimited = (username: string): { isLimited: boolean; lockedUntil?: number } => {
  const attempts = loginAttempts.get(username.toLowerCase());
  if (!attempts) return { isLimited: false };

  const now = Date.now();
  
  // Check if lockout period has expired
  if (attempts.lockedUntil && now > attempts.lockedUntil) {
    loginAttempts.delete(username.toLowerCase());
    return { isLimited: false };
  }

  // Check if user is currently locked out
  if (attempts.lockedUntil && now <= attempts.lockedUntil) {
    return { isLimited: true, lockedUntil: attempts.lockedUntil };
  }

  // Check if too many attempts in timeframe
  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    const lockedUntil = now + LOCKOUT_DURATION;
    attempts.lockedUntil = lockedUntil;
    return { isLimited: true, lockedUntil };
  }

  return { isLimited: false };
};

/**
 * Records a failed login attempt
 */
const recordFailedAttempt = (username: string): void => {
  const key = username.toLowerCase();
  const now = Date.now();
  const attempts = loginAttempts.get(key) || { count: 0, lastAttempt: 0 };

  // Reset count if last attempt was more than lockout duration ago
  if (now - attempts.lastAttempt > LOCKOUT_DURATION) {
    attempts.count = 1;
  } else {
    attempts.count++;
  }

  attempts.lastAttempt = now;
  loginAttempts.set(key, attempts);
};

/**
 * Clears failed attempts for successful login
 */
const clearFailedAttempts = (username: string): void => {
  loginAttempts.delete(username.toLowerCase());
};

/**
 * Creates a secure session token
 */
const createSessionToken = (user: User): string => {
  const now = Date.now();
  const token: SessionToken = {
    userId: user.id,
    username: user.username,
    role: user.role,
    issuedAt: now,
    expiresAt: now + SESSION_DURATION,
  };

  // In production, use proper JWT signing
  return btoa(JSON.stringify(token));
};

/**
 * Validates and decodes a session token
 */
export const validateSessionToken = (token: string): { isValid: boolean; user?: User; error?: string } => {
  try {
    const decoded: SessionToken = JSON.parse(atob(token));
    const now = Date.now();

    if (now > decoded.expiresAt) {
      return { isValid: false, error: 'Session expired' };
    }

    const user: User = {
      id: decoded.userId,
      username: decoded.username,
      password: '', // Never include password in session
      role: decoded.role,
      assignedProfileIds: [], // Would need to fetch from DB if needed
    };

    return { isValid: true, user };
  } catch (error) {
    return { isValid: false, error: 'Invalid session token' };
  }
};

/**
 * Production-grade user authentication
 */
export const authenticateUser = async (username: string, password: string): Promise<{ 
  success: boolean; 
  user?: User; 
  token?: string; 
  error?: string; 
  lockedUntil?: number 
}> => {
  try {
    console.log('🔐 AUTH: Starting authentication for user:', username);
    
    // Check rate limiting
    const rateLimitCheck = isRateLimited(username);
    if (rateLimitCheck.isLimited) {
      const lockoutMinutes = rateLimitCheck.lockedUntil ? 
        Math.ceil((rateLimitCheck.lockedUntil - Date.now()) / (1000 * 60)) : 15;
      console.log('🔐 AUTH: User is rate limited:', username, 'lockout minutes:', lockoutMinutes);
      return { 
        success: false, 
        error: `Too many failed attempts. Account locked for ${lockoutMinutes} minutes.`,
        lockedUntil: rateLimitCheck.lockedUntil
      };
    }

    // Get user from database
    console.log('🔐 AUTH: Looking up user in database:', username.toLowerCase());
    const db = DatabaseService.getInstance();
    const user = await db.getUserByUsername(username.toLowerCase());

    if (!user) {
      console.log('🔐 AUTH: User not found in database:', username);
      recordFailedAttempt(username);
      return { success: false, error: 'Invalid username or password' };
    }

    console.log('🔐 AUTH: User found in database:', {
      id: user.id,
      username: user.username,
      role: user.role,
      hasPassword: !!user.password,
      passwordLength: user.password?.length,
      passwordStartsWith: user.password?.substring(0, 10) + '...'
    });

    // Verify password
    if (!user.password) {
      console.error('🔐 AUTH: User has no password set:', username);
      recordFailedAttempt(username);
      return { success: false, error: 'Invalid username or password' };
    }
    
    console.log('🔐 AUTH: Verifying password for user:', username);
    const isValidPassword = await verifyPassword(password, user.password);
    console.log('🔐 AUTH: Password verification result:', isValidPassword);
    
    if (!isValidPassword) {
      console.log('🔐 AUTH: Password verification failed for user:', username);
      recordFailedAttempt(username);
      return { success: false, error: 'Invalid username or password' };
    }

    // Success - clear failed attempts and create session
    console.log('🔐 AUTH: Password verification successful, creating session for user:', username);
    clearFailedAttempts(username);
    const token = createSessionToken(user);

    // Don't return password in response
    const userResponse = { ...user };
    delete (userResponse as any).password;

    console.log('🔐 AUTH: Authentication successful for user:', username);
    return { success: true, user: userResponse, token };
  } catch (error) {
    console.error('🔐 AUTH: Authentication error:', error);
    return { success: false, error: 'Authentication service unavailable' };
  }
};

/**
 * Creates a new user with secure password handling
 */
export const createSecureUser = async (userData: {
  username: string;
  password: string;
  role: 'admin' | 'general';
  assignedProfileIds?: string[];
}): Promise<{ success: boolean; user?: User; error?: string }> => {
  try {
    console.log('🔐 createSecureUser: Starting user creation');
    console.log('🔐 createSecureUser: Input data:', {
      username: userData.username,
      password: userData.password ? '***PROVIDED***' : 'NOT PROVIDED',
      role: userData.role,
      assignedProfileIds: userData.assignedProfileIds
    });
    
    // Validate password strength
    console.log('🔐 createSecureUser: Validating password strength');
    const passwordValidation = validatePasswordStrength(userData.password);
    if (!passwordValidation.isValid) {
      console.error('🔐 createSecureUser: Password validation failed:', passwordValidation.errors);
      return { success: false, error: passwordValidation.errors.join('; ') };
    }
    console.log('🔐 createSecureUser: Password validation passed');

    // Check if username already exists
    console.log('🔐 createSecureUser: Checking if username exists');
    const db = DatabaseService.getInstance();
    const existingUser = await db.getUserByUsername(userData.username.toLowerCase());
    if (existingUser) {
      console.error('🔐 createSecureUser: Username already exists:', userData.username);
      return { success: false, error: 'Username already exists' };
    }
    console.log('🔐 createSecureUser: Username is available');

    // Hash password and create user
    console.log('🔐 createSecureUser: Hashing password');
    const hashedPassword = await hashPassword(userData.password);
    console.log('🔐 createSecureUser: Password hashed successfully, length:', hashedPassword.length);
    
    const newUser: User = {
      id: crypto.randomUUID(),
      username: userData.username.toLowerCase(),
      password: hashedPassword,
      role: userData.role,
      assignedProfileIds: userData.assignedProfileIds || [],
    };

    console.log('🔐 createSecureUser: Created user object:', {
      id: newUser.id,
      username: newUser.username,
      password: newUser.password ? 'HASHED (' + newUser.password.length + ' chars)' : 'NO PASSWORD!',
      role: newUser.role,
      assignedProfileIds: newUser.assignedProfileIds
    });

    console.log('🔐 createSecureUser: Saving user to database');
    await db.createUser(newUser);
    console.log('🔐 createSecureUser: User saved to database successfully');

    // Verify the user was actually saved with password
    console.log('🔐 createSecureUser: Verifying user was saved correctly');
    const savedUser = await db.getUserByUsername(userData.username.toLowerCase());
    console.log('🔐 createSecureUser: Verification result:', {
      userFound: !!savedUser,
      hasPassword: !!savedUser?.password,
      passwordLength: savedUser?.password?.length
    });

    // Return user without password
    const userResponse = { ...newUser };
    delete (userResponse as any).password;

    console.log('🔐 createSecureUser: Returning success response');
    return { success: true, user: userResponse };
  } catch (error) {
    console.error('🔐 createSecureUser: User creation error:', error);
    return { success: false, error: 'Failed to create user' };
  }
};

/**
 * Updates user password with security checks
 */
export const updateUserPassword = async (
  userId: string,
  oldPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Get user from database
    const db = DatabaseService.getInstance();
    const user = await db.getUserById(userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Verify old password
    const isValidOldPassword = await verifyPassword(oldPassword, user.password);
    if (!isValidOldPassword) {
      return { success: false, error: 'Current password is incorrect' };
    }

    // Validate new password strength
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      return { success: false, error: passwordValidation.errors.join('; ') };
    }

    // Hash new password and update
    const hashedPassword = await hashPassword(newPassword);
    const updatedUser = { ...user, password: hashedPassword };
    await db.updateUser(updatedUser);

    return { success: true };
  } catch (error) {
    console.error('Password update error:', error);
    return { success: false, error: 'Failed to update password' };
  }
};

/**
 * Initialize with secure admin user (only if no users exist)
 */
export const initializeSecureUsers = async (): Promise<User[]> => {
  const db = DatabaseService.getInstance();
  
  try {
    const users = await db.getAllUsers();
    if (users.length > 0) {
      return users;
    }

    // Create secure admin user - require admin to set password on first login
    console.log('No users found. Creating secure admin user...');
    console.log('IMPORTANT: Default admin password is "SecureAdmin123!" - CHANGE IMMEDIATELY');
    
    const result = await createSecureUser({
      username: 'admin',
      password: 'SecureAdmin123!', // Meets security requirements
      role: 'admin',
      assignedProfileIds: [],
    });

    if (result.success && result.user) {
      return [result.user];
    }

    throw new Error('Failed to create initial admin user');
  } catch (error) {
    console.error('Failed to initialize users:', error);
    // Fallback - should not happen in production
    return [];
  }
};

/**
 * Logout user (client-side session cleanup)
 */
export const logoutUser = (): void => {
  sessionStorage.removeItem('authToken');
  sessionStorage.removeItem('currentUser');
};

/**
 * Admin-only password reset for any user
 */
export const adminResetUserPassword = async (
  adminUserId: string,
  targetUsername: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Verify admin user exists and is admin
    const db = DatabaseService.getInstance();
    const adminUser = await db.getUserById(adminUserId);
    if (!adminUser || adminUser.role !== 'admin') {
      return { success: false, error: 'Unauthorized - admin access required' };
    }

    // Get target user
    const targetUser = await db.getUserByUsername(targetUsername.toLowerCase());
    if (!targetUser) {
      return { success: false, error: 'User not found' };
    }

    // Validate new password strength
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      return { success: false, error: passwordValidation.errors.join('; ') };
    }

    // Hash new password and update
    const hashedPassword = await hashPassword(newPassword);
    const updatedUser = { ...targetUser, password: hashedPassword };
    await db.updateUser(updatedUser);

    // Clear any lockouts for this user
    clearFailedAttempts(targetUsername);

    return { success: true };
  } catch (error) {
    console.error('Admin password reset error:', error);
    return { success: false, error: 'Failed to reset password' };
  }
};

/**
 * Generate a secure password reset token
 */
export const generatePasswordResetToken = async (
  adminUserId: string,
  targetUsername: string
): Promise<{ success: boolean; token?: string; error?: string; expiresAt?: number }> => {
  try {
    // Verify admin user exists and is admin
    const db = DatabaseService.getInstance();
    const adminUser = await db.getUserById(adminUserId);
    if (!adminUser || adminUser.role !== 'admin') {
      return { success: false, error: 'Unauthorized - admin access required' };
    }

    // Get target user
    const targetUser = await db.getUserByUsername(targetUsername.toLowerCase());
    if (!targetUser) {
      return { success: false, error: 'User not found' };
    }

    // Generate secure token with expiration
    const tokenData = {
      userId: targetUser.id,
      username: targetUser.username,
      adminId: adminUserId,
      issuedAt: Date.now(),
      expiresAt: Date.now() + (15 * 60 * 1000), // 15 minutes
      type: 'password_reset'
    };

    // In production, this would be signed with a secret key
    const token = btoa(JSON.stringify(tokenData));
    
    console.log(`Password reset token generated for ${targetUsername} by admin ${adminUser.username}`);
    
    return { 
      success: true, 
      token,
      expiresAt: tokenData.expiresAt
    };
  } catch (error) {
    console.error('Token generation error:', error);
    return { success: false, error: 'Failed to generate reset token' };
  }
};

/**
 * Reset password using a valid token
 */
export const resetPasswordWithToken = async (
  token: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Decode and validate token
    const tokenData = JSON.parse(atob(token));
    const now = Date.now();

    if (now > tokenData.expiresAt) {
      return { success: false, error: 'Reset token has expired' };
    }

    if (tokenData.type !== 'password_reset') {
      return { success: false, error: 'Invalid token type' };
    }

    // Validate new password strength
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      return { success: false, error: passwordValidation.errors.join('; ') };
    }

    // Get user and update password
    const db = DatabaseService.getInstance();
    const user = await db.getUserById(tokenData.userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Hash new password and update
    const hashedPassword = await hashPassword(newPassword);
    const updatedUser = { ...user, password: hashedPassword };
    await db.updateUser(updatedUser);

    // Clear any lockouts for this user
    clearFailedAttempts(user.username);

    console.log(`Password reset completed for user ${user.username} via token`);
    return { success: true };
  } catch (error) {
    console.error('Token reset error:', error);
    return { success: false, error: 'Invalid or corrupted reset token' };
  }
};


/**
 * Get current session from storage
 */
export const getCurrentSession = (): { isValid: boolean; user?: User; error?: string } => {
  const token = sessionStorage.getItem('authToken');
  if (!token) {
    return { isValid: false, error: 'No active session' };
  }

  return validateSessionToken(token);
};
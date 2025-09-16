#!/usr/bin/env node

import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Starting AI SEO Blog Writer Backend Server...');
console.log('📁 Working directory:', __dirname);

// Run database migrations if DATABASE_URL is available
if (process.env.DATABASE_URL) {
  console.log('🔄 Running database migrations...');
  try {
    execSync('npm run migrate', { stdio: 'inherit', cwd: __dirname });
    console.log('✅ Database migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('⚠️  Continuing without migrations...');
  }
}

// Set environment variable for backend mode
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// In production, set NODE_ENV to production if not already set
if (process.env.RAILWAY_ENVIRONMENT) {
  process.env.NODE_ENV = 'production';
}

const backendPath = join(__dirname, 'backend', 'server.js');

console.log('🔧 Backend server path:', backendPath);

// Start the backend server with tsx for TypeScript support
const backendProcess = spawn('npx', ['tsx', backendPath], {
  stdio: 'inherit',
  cwd: __dirname,
  env: {
    ...process.env,
    PORT: process.env.PORT || '3001',
    JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production'
  }
});

backendProcess.on('error', (error) => {
  console.error('❌ Failed to start backend server:', error);
  process.exit(1);
});

backendProcess.on('exit', (code, signal) => {
  console.log(`📤 Backend server exited with code ${code} and signal ${signal}`);
  process.exit(code || 0);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  backendProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  backendProcess.kill('SIGTERM');
});
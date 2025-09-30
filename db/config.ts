import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import * as schema from './schema';

// Database connection configuration
export function createDatabaseConnection() {
  // Railway provides database URL in environment variables
  const connectionString = process.env.DATABASE_URL || process.env.PGURL;
  
  if (!connectionString) {
    console.warn('No DATABASE_URL found, falling back to local development');
    // For local development, you can set up a local postgres or use a test DB
    return null;
  }

  console.log('🗄️ Connecting to PostgreSQL database...');
  
  const client = new Client({
    connectionString,
    ssl: connectionString.includes('railway.app') || connectionString.includes('rlwy.net') ? { rejectUnauthorized: false } : false,
  });

  // Connect the client
  client.connect().catch(err => {
    console.error('Failed to connect to PostgreSQL:', err);
  });

  return drizzle(client, { schema });
}

export const db = createDatabaseConnection();
export type Database = typeof db;
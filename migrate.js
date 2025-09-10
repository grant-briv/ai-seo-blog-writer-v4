import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';

async function runMigration() {
  const connectionString = process.env.DATABASE_URL || process.env.PGURL;
  
  if (!connectionString) {
    console.log('❌ No DATABASE_URL found, skipping migration');
    process.exit(0);
  }

  console.log('🔄 Running database migrations...');
  
  const client = new Client({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    const db = drizzle(client);
    
    await migrate(db, { migrationsFolder: './db/migrations' });
    
    console.log('✅ Database migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
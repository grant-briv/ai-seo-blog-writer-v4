import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Client } = pkg;
import { users } from './db/schema.ts';

async function listUsers() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔄 Connecting to database...');
    await client.connect();
    const db = drizzle(client);

    console.log('\n📋 Users in database:\n');
    const allUsers = await db.select({
      username: users.username,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt
    }).from(users);

    if (allUsers.length === 0) {
      console.log('   No users found in database');
    } else {
      allUsers.forEach((u, idx) => {
        console.log(`${idx + 1}. Username: ${u.username}`);
        console.log(`   Email: ${u.email || 'N/A'}`);
        console.log(`   Role: ${u.role}`);
        console.log(`   Created: ${u.createdAt.toISOString()}`);
        console.log('');
      });
    }

    console.log(`Total users: ${allUsers.length}`);

  } catch (error) {
    console.error('❌ Error listing users:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

listUsers();

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import pkg from 'pg';
const { Client } = pkg;
import bcrypt from 'bcryptjs';
import { users } from './db/schema.ts';

async function resetPassword() {
  const username = process.argv[2];
  const newPassword = process.argv[3];

  if (!username || !newPassword) {
    console.error('❌ Usage: node reset-password.js <username> <new-password>');
    process.exit(1);
  }

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

    // Find the user
    console.log(`🔍 Looking for user: ${username}`);
    const [user] = await db.select().from(users).where(eq(users.username, username));

    if (!user) {
      console.error(`❌ User "${username}" not found`);

      // List all users to help
      console.log('\n📋 Available users:');
      const allUsers = await db.select({ username: users.username, email: users.email, role: users.role }).from(users);
      allUsers.forEach(u => {
        console.log(`  - ${u.username} (${u.email || 'no email'}) [${u.role}]`);
      });

      process.exit(1);
    }

    // Hash the new password
    console.log('🔐 Hashing new password...');
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the password
    console.log('💾 Updating password in database...');
    await db
      .update(users)
      .set({
        password: hashedPassword,
        isTemporaryPassword: 'false',
        updatedAt: new Date()
      })
      .where(eq(users.id, user.id));

    console.log(`✅ Password successfully reset for user: ${username}`);
    console.log(`   Email: ${user.email || 'N/A'}`);
    console.log(`   Role: ${user.role}`);
    console.log(`\n🔑 New credentials:`);
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${newPassword}`);

  } catch (error) {
    console.error('❌ Error resetting password:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

resetPassword();

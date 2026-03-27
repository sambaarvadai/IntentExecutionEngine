#!/usr/bin/env node

import dotenv from 'dotenv';
import { initializeDatabase } from './db/init';

// Load environment variables
dotenv.config();

async function setupDatabase(): Promise<void> {
  console.log('🔧 Database Setup - NL2DB Prototype');
  console.log('=====================================');
  
  try {
    console.log('🗄️  Initializing database...');
    await initializeDatabase();
    console.log('✅ Database setup complete!\n');
    console.log('You can now run the main application with: npm run dev');
  } catch (error) {
    console.error('💥 Database setup failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  setupDatabase().catch((error) => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

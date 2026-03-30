// ------------------------------------------------------------------
// Migration: Remove Graph Tables from Main Database
// ------------------------------------------------------------------

// This script removes any graph-related tables from the main database
// to ensure clean separation between main app data and graph persistence

import { getDatabase } from './sqlite';
import { getGraphDatabase } from '../graph/store/db';

export async function migrateGraphTablesToSeparateDB(): Promise<void> {
  console.log('🔄 Starting graph table migration...');
  
  const mainDb = await getDatabase();
  const graphDb = await getGraphDatabase();
  
  try {
    // Check if old graph tables exist in main database
    const tables = await mainDb.all(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      AND (name LIKE 'stored_graph%' OR name LIKE '%graph%')
    `);
    
    if (tables.length === 0) {
      console.log('✅ No graph tables found in main database');
      return;
    }
    
    console.log(`📋 Found ${tables.length} graph-related tables in main database:`, 
      tables.map(t => t.name));
    
    // For each table, check if it has data and migrate if needed
    for (const table of tables) {
      const tableName = table.name;
      
      // Skip FTS auxiliary tables - they'll be recreated automatically
      if (tableName.includes('_fts_data') || tableName.includes('_fts_idx') || 
          tableName.includes('_fts_docsize') || tableName.includes('_fts_config')) {
        console.log(`⏭️  Skipping FTS auxiliary table: ${tableName}`);
        continue;
      }
      
      try {
        // Check if table still exists (might have been dropped in previous run)
        const tableExists = await mainDb.get(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name = ?
        `, tableName);
        
        if (!tableExists) {
          console.log(`⏭️  Table ${tableName} already removed`);
          continue;
        }
        
        // Check if table has data
        const count = await mainDb.get(`SELECT COUNT(*) as count FROM ${tableName}`);
        
        if (count.count > 0) {
          console.log(`⚠️  Table ${tableName} has ${count.count} rows - migrating data...`);
          
          try {
            // Get all data from old table
            const rows = await mainDb.all(`SELECT * FROM ${tableName}`);
            
            // Insert into new graph database (assuming same schema)
            for (const row of rows) {
              const columns = Object.keys(row);
              const placeholders = columns.map(() => '?').join(', ');
              const values = columns.map(col => row[col]);
              
              await graphDb.run(
                `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
                ...values
              );
            }
            
            console.log(`✅ Migrated ${count.count} rows from ${tableName}`);
          } catch (error) {
            console.error(`❌ Failed to migrate ${tableName}:`, error);
            // Continue with dropping even if migration fails
          }
        }
        
        // Drop the old table
        await mainDb.exec(`DROP TABLE IF EXISTS ${tableName}`);
        console.log(`🗑️  Dropped table ${tableName} from main database`);
        
      } catch (error) {
        console.log(`⚠️  Could not process table ${tableName}:`, (error as Error).message);
      }
    }
    
    // Drop any related indexes and triggers
    const indexes = await mainDb.all(`
      SELECT name FROM sqlite_master 
      WHERE type='index' 
      AND (name LIKE '%graph%' OR name LIKE '%stored_graph%')
    `);
    
    for (const index of indexes) {
      await mainDb.exec(`DROP INDEX IF EXISTS ${index.name}`);
      console.log(`🗑️  Dropped index ${index.name} from main database`);
    }
    
    const triggers = await mainDb.all(`
      SELECT name FROM sqlite_master 
      WHERE type='trigger' 
      AND (name LIKE '%graph%' OR name LIKE '%stored_graph%')
    `);
    
    for (const trigger of triggers) {
      await mainDb.exec(`DROP TRIGGER IF EXISTS ${trigger.name}`);
      console.log(`🗑️  Dropped trigger ${trigger.name} from main database`);
    }
    
    // Drop remaining FTS tables
    for (const table of tables) {
      const tableName = table.name;
      if (tableName.includes('_fts')) {
        await mainDb.exec(`DROP TABLE IF EXISTS ${tableName}`);
        console.log(`🗑️  Dropped FTS table ${tableName} from main database`);
      }
    }
    
    console.log('✅ Graph table migration completed successfully');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateGraphTablesToSeparateDB()
    .then(() => {
      console.log('🎉 Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

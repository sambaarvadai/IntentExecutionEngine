// ------------------------------------------------------------------
// Migration: Add prompt_embedding column to stored_graphs table
// ------------------------------------------------------------------

import { getGraphDatabase } from '../graph/store/db';

export async function migratePromptEmbeddingColumn(): Promise<void> {
  const db = await getGraphDatabase();
  
  // Add the prompt_embedding column as optional (NULLable)
  await db.run(`
    ALTER TABLE stored_graphs 
    ADD COLUMN prompt_embedding BLOB
  `);
  
  console.log('Added prompt_embedding column to stored_graphs table');
}

// Run migration if this file is executed directly
if (require.main === module) {
  migratePromptEmbeddingColumn()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

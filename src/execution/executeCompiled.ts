import { getDatabase } from '../db/sqlite';
import { ExecutionResult, QueryResult } from '../plans/types';
import { getConfig } from '../config';
import { CompiledQuery } from './compile';

export async function executeCompiledQuery(compiled: CompiledQuery): Promise<ExecutionResult> {
  try {
    const config = getConfig();
    
    if (config.app.debug && process.env.DEBUG !== 'false') {
      console.log('Debug: SQL:', compiled.sql)
      console.log('Debug: Params:', compiled.params)
    }
    
    const db = await getDatabase()
    const result = await db.all(compiled.sql, compiled.params)
    
    const queryResult: QueryResult = {
      rows: result,
      fields: result.length > 0 ? Object.keys(result[0]) : []
    };
    
    return {
      success: true,
      data: queryResult
    };
    
  } catch (error: any) {
    return {
      success: false,
      data: error.message || 'Unknown error'
    };
  }
}

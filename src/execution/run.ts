import { getDatabase } from '../db/sqlite';
import { AnyPlan, ExecutionResult, QueryResult } from '../plans/types';
import { validatePlan } from '../plans';
import { compileQuery } from './compile';

export async function executePlan(plan: AnyPlan): Promise<ExecutionResult> {
  try {
    // Validate the plan first
    const validationResult = validatePlan(plan);
    
    // If validation fails, return error with details
    if (!validationResult.valid) {
      return {
        success: false,
        error: `Validation failed: ${validationResult.issues.map(i => `[${i.field}] ${i.message}`).join('; ')}`
      };
    }
    
    // Handle conversational responses
    if (!plan.needsDb) {
      return {
        success: true,
        data: plan.responseMode === 'conversational' ? 'conversational' : 'unknown'
      };
    }
    
    // Execute database query
    const db = await getDatabase();
    const compiled = compileQuery(plan);
    
    // Debug logging
    console.log('Debug: SQL:', compiled.sql);
    console.log('Debug: Params:', compiled.params);
    
    const rows = await db.all(compiled.sql, compiled.params);
    
    const queryResult: QueryResult = {
      rows,
      fields: rows.length > 0 ? Object.keys(rows[0]) : []
    };
    
    return {
      success: true,
      data: queryResult
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

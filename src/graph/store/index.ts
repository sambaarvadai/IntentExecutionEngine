// ------------------------------------------------------------------
// Graph Store Public Surface
// ------------------------------------------------------------------

export { GraphRepository } from './repository';
export type { 
  StoredGraph, 
  GraphStatus, 
  CreateGraphInput,
  UpdateGraphStatusInput,
  StoreQuery 
} from './types';

// Singleton instance for use throughout the app
import { GraphRepository } from './repository';
export const graphRepository = new GraphRepository();

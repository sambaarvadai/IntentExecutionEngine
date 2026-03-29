import { QueryPlan } from '../plans/types';
import { Dialect } from './compiler/dialects';
export interface CompiledQuery {
    sql: string;
    params: any[];
}
export declare function compileQuery(plan: QueryPlan, dialect?: Dialect): CompiledQuery;
//# sourceMappingURL=compile.d.ts.map
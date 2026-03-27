import { QueryPlan } from '../plans/types';
export interface CompiledQuery {
    sql: string;
    params: any[];
}
export declare function compileQuery(plan: QueryPlan): CompiledQuery;
//# sourceMappingURL=compile-old.d.ts.map
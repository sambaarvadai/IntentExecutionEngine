import { QueryPlan } from '../plans/types';
export type ValidationSeverity = 'error' | 'warning';
export interface ValidationIssue {
    severity: ValidationSeverity;
    field: string;
    message: string;
    suggestion?: string;
}
export interface ValidationResult {
    valid: boolean;
    issues: ValidationIssue[];
    llmFeedback?: string;
}
export declare function validatePlan(plan: QueryPlan): ValidationResult;
//# sourceMappingURL=validator.d.ts.map
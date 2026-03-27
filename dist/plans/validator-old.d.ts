import { AnyPlan } from './types';
export declare class ValidationError extends Error {
    constructor(message: string);
}
export declare function validatePlan(plan: AnyPlan): void;
export declare function isValidPlan(plan: any): plan is AnyPlan;
//# sourceMappingURL=validator-old.d.ts.map
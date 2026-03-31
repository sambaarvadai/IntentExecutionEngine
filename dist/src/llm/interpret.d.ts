import { AnyPlan } from '../plans/types';
export declare class LLMInterpreterError extends Error {
    constructor(message: string);
}
export declare function interpretUserRequest(userMessage: string): Promise<AnyPlan>;
//# sourceMappingURL=interpret.d.ts.map
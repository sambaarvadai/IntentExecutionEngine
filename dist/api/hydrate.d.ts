import { HydrationContext, HydrationResult } from '../context/types';
export declare class PlanHydrator {
    hydrate(context: HydrationContext): Promise<HydrationResult>;
    private injectParameters;
    private injectIntoConditions;
    private injectValue;
    private extractParameterReferences;
    private validateParameterValue;
    hydrateWithDefaults(context: HydrationContext): Promise<HydrationResult>;
    validateParameters(context: HydrationContext): Promise<string[]>;
    private applyValidationRule;
    private static instance;
    static getInstance(): PlanHydrator;
}
export declare const planHydrator: PlanHydrator;
//# sourceMappingURL=hydrate.d.ts.map
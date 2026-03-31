import { GenerationRequest, GenerationResult, GenerationConstraints, AuthConfig } from '../context/types';
import { IntentEngine } from '../intent';
export interface APIGeneratorConfig {
    defaultAuth?: AuthConfig;
    defaultConstraints?: GenerationConstraints;
    maxRetries?: number;
}
export declare class APIGenerator {
    private intentEngine;
    private config;
    constructor(intentEngine: IntentEngine, config?: APIGeneratorConfig);
    generateAPI(request: GenerationRequest): Promise<GenerationResult>;
    private generateExecutionGraph;
    private getPrimaryQueryPlan;
    private generateAPIDefinition;
    private generateExamples;
    private getFirstAggregate;
    private generateRoute;
    private determineMethod;
    private generateLabel;
    private extractParameters;
    private extractFromConditions;
    private inferType;
    private generateDescription;
    private determineAuth;
    private generateExampleParams;
    private generateExampleResponse;
    private generateVariationExample;
    private calculateConfidence;
}
//# sourceMappingURL=generator.d.ts.map
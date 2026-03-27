import { GenerationRequest, GenerationResult, GenerationConstraints, AuthConfig } from '../context/types';
import { LLMAdapter } from '../plans';
export interface APIGeneratorConfig {
    defaultAuth?: AuthConfig;
    defaultConstraints?: GenerationConstraints;
    maxRetries?: number;
}
export declare class APIGenerator {
    private config;
    constructor(config?: APIGeneratorConfig);
    generateAPI(request: GenerationRequest, llm: LLMAdapter): Promise<GenerationResult>;
    private generateQueryPlan;
    private extractOriginalPlanFromPipeline;
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
    private calculatePlanConfidence;
    private static instance;
    static getInstance(config?: APIGeneratorConfig): APIGenerator;
}
export declare const apiGenerator: APIGenerator;
//# sourceMappingURL=generator.d.ts.map
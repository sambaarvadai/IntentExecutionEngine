export interface DatabaseConfig {
    filename: string;
    path: string;
}
export interface LLMConfig {
    provider: string;
    model: string;
    maxTokens: number;
}
export interface AppConfig {
    name: string;
    maxQueryLimit: number;
    debug: boolean;
}
export interface PipelineConfig {
    enabled: boolean;
    maxCorrectionAttempts: number;
    enableResponseReframing: boolean;
}
export interface SchemaConfig {
    tables: Record<string, any>;
    joins: Record<string, any>;
}
export interface Config {
    database: DatabaseConfig;
    llm: LLMConfig;
    app: AppConfig;
    pipeline: PipelineConfig;
}
export declare function getConfig(): Config;
export declare function getSchemaConfig(): SchemaConfig;
export declare function getSeedData(): any;
//# sourceMappingURL=index.d.ts.map
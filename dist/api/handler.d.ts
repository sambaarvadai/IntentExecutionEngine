import { HandlerRequest, HandlerResponse } from '../context/types';
export declare class APIHandler {
    handleRequest(request: HandlerRequest): Promise<HandlerResponse>;
    private loadAPI;
    private authenticate;
    private validateAndExtractParams;
    private validateAndConvertType;
    private applyValidationRules;
    private hydratePlan;
    private injectParameters;
    private injectIntoConditions;
    private executeQuery;
    private generateRequestId;
    private static instance;
    static getInstance(): APIHandler;
}
export declare const apiHandler: APIHandler;
//# sourceMappingURL=handler.d.ts.map
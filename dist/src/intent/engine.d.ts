import Anthropic from '@anthropic-ai/sdk';
import { IntentRequest, IntentResult } from './types';
import { APISearchService } from '../search';
export declare class IntentEngine {
    private anthropic;
    private searchService?;
    constructor(anthropic: Anthropic, searchService?: APISearchService | undefined);
    execute(request: IntentRequest): Promise<IntentResult>;
    private validateGraphConstraints;
    private generateGraph;
    private correctGraph;
}
//# sourceMappingURL=engine.d.ts.map
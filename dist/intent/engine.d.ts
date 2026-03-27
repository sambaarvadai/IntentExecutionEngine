import Anthropic from '@anthropic-ai/sdk';
import { IntentRequest, IntentResult } from './types';
export declare class IntentEngine {
    private anthropic;
    constructor(anthropic: Anthropic);
    execute(request: IntentRequest): Promise<IntentResult>;
    private generateGraph;
    private correctGraph;
}
//# sourceMappingURL=engine.d.ts.map
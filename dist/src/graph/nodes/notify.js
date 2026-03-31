"use strict";
// src/graph/nodes/notify.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLogNode = buildLogNode;
exports.buildWebhookNode = buildWebhookNode;
function buildLogNode(params) {
    return {
        id: params.id,
        type: 'notify',
        label: params.label,
        notify: (input) => {
            const data = params.dataKey ? input[params.dataKey] : input;
            const logPrefix = params.prefix ?? '[LOG]';
            console.log(`${logPrefix} ${JSON.stringify(data)}`);
            // Return the data that was logged
            return data;
        }
    };
}
function buildWebhookNode(params) {
    return {
        id: params.id,
        type: 'notify',
        label: params.label,
        notify: (input) => {
            const data = params.dataKey ? input[params.dataKey] : input;
            const method = params.method || 'POST';
            // TODO: Real implementation would use fetch or axios
            // For now, just log what would be sent
            console.log(`[WEBHOOK] Would ${method} to ${params.url} with payload: ${JSON.stringify(data)}`);
            // Return success indicator
            return { sent: true, url: params.url, payload: data };
        }
    };
}
//# sourceMappingURL=notify.js.map
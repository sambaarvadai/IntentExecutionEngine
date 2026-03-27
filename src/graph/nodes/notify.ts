// src/graph/nodes/notify.ts

import { ExecutionNode, ExecutionNodeType } from '../types'

export function buildLogNode(params: {
  id: string
  label: string
  dataKey?: string      // if provided, log input[dataKey], else log full input
  prefix?: string       // optional log prefix, defaults to '[LOG]'
}): ExecutionNode {
  return {
    id: params.id,
    type: 'notify' as ExecutionNodeType,
    label: params.label,
    notify: (input) => {
      const data = params.dataKey ? input[params.dataKey] : input;
      const logPrefix = params.prefix ?? '[LOG]';
      
      console.log(`${logPrefix} ${JSON.stringify(data)}`);
      
      // Return the data that was logged
      return data;
    }
  }
}

export function buildWebhookNode(params: {
  id: string
  label: string
  url: string
  dataKey?: string      // what data to send in the payload
  method?: 'POST' | 'PUT'   // defaults to POST
}): ExecutionNode {
  return {
    id: params.id,
    type: 'notify' as ExecutionNodeType,
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
  }
}

// src/graph/nodes/query.ts

import { ExecutionNode, ExecutionNodeType } from '../types'
import { QueryPlan } from '../../plans/types'

export function buildQueryNode(params: {
  id: string
  label: string
  plan: QueryPlan
  timeoutMs?: number
}): ExecutionNode {
  return {
    id: params.id,
    type: 'query' as ExecutionNodeType,
    label: params.label,
    timeoutMs: params.timeoutMs,
    plan: params.plan
  }
}

export function buildFilteredQueryNode(params: {
  id: string
  label: string
  entity: string
  select: string[]
  field: string
  op: string
  value: any
  timeoutMs?: number
}): ExecutionNode {
  const plan: QueryPlan = {
    needsDb: true,
    entity: params.entity,
    select: params.select,
    where: [{
      field: params.field,
      op: params.op,
      value: params.value
    }]
  }

  return buildQueryNode({
    id: params.id,
    label: params.label,
    plan,
    timeoutMs: params.timeoutMs
  })
}

export function buildPaginatedQueryNode(params: {
  id: string
  label: string
  entity: string
  select: string[]
  limit: number
  offset?: number
  orderBy?: { field: string; direction: 'asc' | 'desc' }
  timeoutMs?: number
}): ExecutionNode {
  const plan: QueryPlan = {
    needsDb: true,
    entity: params.entity,
    select: params.select,
    limit: params.limit,
    offset: params.offset,
    orderBy: params.orderBy
  }

  return buildQueryNode({
    id: params.id,
    label: params.label,
    plan,
    timeoutMs: params.timeoutMs
  })
}

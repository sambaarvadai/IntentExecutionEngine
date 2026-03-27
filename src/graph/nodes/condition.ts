// src/graph/nodes/condition.ts

import { ExecutionNode, ExecutionNodeType } from '../types'

export function ifEmpty(params: {
  id: string
  label: string
  dataKey: string
  trueBranch: string
  falseBranch: string
}): ExecutionNode {
  return {
    id: params.id,
    type: 'condition' as ExecutionNodeType,
    label: params.label,
    condition: (input) => {
      const dataset = input[params.dataKey] ?? { rows: [], fields: [] }
      return dataset.rows.length === 0
    },
    trueBranch: params.trueBranch,
    falseBranch: params.falseBranch
  }
}

export function ifRowCountAbove(params: {
  id: string
  label: string
  dataKey: string
  threshold: number
  trueBranch: string
  falseBranch: string
}): ExecutionNode {
  return {
    id: params.id,
    type: 'condition' as ExecutionNodeType,
    label: params.label,
    condition: (input) => {
      const dataset = input[params.dataKey] ?? { rows: [], fields: [] }
      return dataset.rows.length > params.threshold
    },
    trueBranch: params.trueBranch,
    falseBranch: params.falseBranch
  }
}

export function ifFieldEquals(params: {
  id: string
  label: string
  dataKey: string
  field: string
  value: any
  trueBranch: string
  falseBranch: string
}): ExecutionNode {
  return {
    id: params.id,
    type: 'condition' as ExecutionNodeType,
    label: params.label,
    condition: (input) => {
      const dataset = input[params.dataKey] ?? { rows: [], fields: [] }
      if (dataset.rows.length === 0) return false
      return dataset.rows.every((row: any) => row[params.field] === params.value)
    },
    trueBranch: params.trueBranch,
    falseBranch: params.falseBranch
  }
}

export function ifHasRole(params: {
  id: string
  label: string
  role: string
  trueBranch: string
  falseBranch: string
}): ExecutionNode {
  return {
    id: params.id,
    type: 'condition' as ExecutionNodeType,
    label: params.label,
    condition: (input) => {
      const context = input._context as any
      return context?.roles?.includes(params.role) ?? false
    },
    trueBranch: params.trueBranch,
    falseBranch: params.falseBranch
  }
}

import type { ComponentType } from 'react'

export type MotionId = 'metric-focus' | 'compare-split' | 'quote-lockup'
export type ParameterValue = string | number
export type ParameterValues = Record<string, ParameterValue>

export interface MetricFocusParams extends ParameterValues {
  eyebrow: string
  value: number
  prefix: string
  suffix: string
  description: string
  trend: string
  decimals: number
  duration: number
}

export interface CompareSplitParams extends ParameterValues {
  title: string
  leftLabel: string
  leftValue: number
  rightLabel: string
  rightValue: number
  suffix: string
  conclusion: string
  emphasis: 'left' | 'right'
  split: number
  duration: number
}

export interface QuoteLockupParams extends ParameterValues {
  eyebrow: string
  quote: string
  author: string
  role: string
  align: 'left' | 'center'
  maxWidth: number
  duration: number
}

export type MotionParams = MetricFocusParams | CompareSplitParams | QuoteLockupParams

export type Control =
  | {
      type: 'text'
      key: string
      label: string
      maxLength: number
    }
  | {
      type: 'number'
      key: string
      label: string
      min: number
      max: number
      step: number
      suffix?: string
    }
  | {
      type: 'select'
      key: string
      label: string
      options: Array<{ label: string; value: string }>
    }

export interface MotionComponentProps<T extends ParameterValues> {
  params: T
}

export interface MotionDefinition<T extends ParameterValues = ParameterValues> {
  id: MotionId
  index: string
  name: string
  category: string
  description: string
  defaults: T
  controls: Control[]
  component: ComponentType<MotionComponentProps<T>>
}

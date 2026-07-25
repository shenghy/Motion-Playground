import type { ComponentType } from 'react'

export type MotionId = 'metric-focus' | 'compare-split' | 'profile-reveal'
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

export interface ProfileRevealParams extends ParameterValues {
  category: string
  descriptor: string
  overline: string
  title: string
  fact1: string
  fact1Note: string
  fact2: string
  fact2Note: string
  fact3: string
  fact3Note: string
  status: string
  duration: number
}

export type MotionParams = MetricFocusParams | CompareSplitParams | ProfileRevealParams

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

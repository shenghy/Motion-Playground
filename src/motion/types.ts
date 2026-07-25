import type { ComponentType } from 'react'

export type MotionId =
  | 'metric-focus'
  | 'compare-split'
  | 'profile-reveal'
  | 'bar-compare'
  | 'share-ring'
  | 'step-flow'
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

export interface BarCompareParams extends ParameterValues {
  eyebrow: string
  title: string
  item1Label: string
  item1Value: number
  item2Label: string
  item2Value: number
  item3Label: string
  item3Value: number
  item4Label: string
  item4Value: number
  suffix: string
  focusIndex: '1' | '2' | '3' | '4'
  resultLabel: string
  resultNote: string
  duration: number
}

export interface ShareRingParams extends ParameterValues {
  eyebrow: string
  title: string
  item1Label: string
  item1Value: number
  item2Label: string
  item2Value: number
  item3Label: string
  item3Value: number
  item4Label: string
  item4Value: number
  focusIndex: '1' | '2' | '3' | '4'
  centerLabel: string
  resultLabel: string
  resultNote: string
  duration: number
}

export interface StepFlowParams extends ParameterValues {
  eyebrow: string
  title: string
  step1: string
  step2: string
  step3: string
  step4: string
  step5: string
  focusStep: '1' | '2' | '3' | '4' | '5'
  statusLabel: string
  statusNote: string
  stepDuration: number
}

export type MotionParams =
  | MetricFocusParams
  | CompareSplitParams
  | ProfileRevealParams
  | BarCompareParams
  | ShareRingParams
  | StepFlowParams

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

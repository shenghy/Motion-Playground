import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MOTION_IDS } from './types'
import { getMotionDefinition } from './registry'

const componentFiles = [
  'Narrative.tsx',
  'MetricFocus.tsx',
  'CompareSplit.tsx',
  'ProfileReveal.tsx',
  'BarCompare.tsx',
  'ShareRing.tsx',
  'StepFlow.tsx',
  'AudiencePoll.tsx',
]

describe('one-shot motion contract', () => {
  it('does not configure any motion component to repeat forever', () => {
    for (const file of componentFiles) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8')
      expect(source, file).not.toMatch(/repeat\s*:\s*Infinity/)
    }
  })

  it('describes duration controls as playback rather than loop duration', () => {
    for (const motionId of MOTION_IDS) {
      const durationControls = getMotionDefinition(motionId).controls.filter(
        (control) => control.key === 'duration',
      )
      for (const control of durationControls) {
        expect(control.label).not.toContain('循环')
      }
    }
  })
})

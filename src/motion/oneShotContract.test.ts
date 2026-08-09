import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MOTION_IDS } from './types'
import { getMotionDefinition } from './registry'

const previewFiles = ['MotionCanvasPreview.tsx']

describe('one-shot motion contract', () => {
  it('does not configure the shared preview renderer to repeat forever', () => {
    for (const file of previewFiles) {
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

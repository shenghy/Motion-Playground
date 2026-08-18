import { describe, expect, it } from 'vitest'
import { motionRegistry } from '../../motion/registry'
import { createRoiStressSamples } from './roiStressFixtures'

describe('ROI stress fixtures', () => {
  it('covers every motion with default, minimum, and maximum legal parameters', () => {
    const samples = createRoiStressSamples()

    for (const definition of motionRegistry) {
      const motionSamples = samples.filter(
        (sample) => sample.card.motionId === definition.id,
      )
      expect(motionSamples).toHaveLength(6)
      expect(new Set(motionSamples.map((sample) => sample.parameterProfile)))
        .toEqual(new Set(['default', 'minimum', 'maximum']))

      for (const sample of motionSamples) {
        for (const control of definition.controls) {
          const value = sample.card.params[control.key]
          if (control.type === 'text' || control.type === 'textarea') {
            expect(typeof value).toBe('string')
            expect(String(value).length).toBeLessThanOrEqual(control.maxLength)
          } else if (control.type === 'number') {
            expect(Number(value)).toBeGreaterThanOrEqual(control.min)
            expect(Number(value)).toBeLessThanOrEqual(control.max)
          } else {
            expect(control.options.map((option) => option.value)).toContain(value)
          }
        }
      }

      const maximum = motionSamples.find(
        (sample) => sample.parameterProfile === 'maximum',
      )
      expect(maximum).toBeDefined()
      for (const control of definition.controls) {
        const value = maximum?.card.params[control.key]
        if (control.type === 'text' || control.type === 'textarea') {
          expect(String(value)).toHaveLength(control.maxLength)
        }
        if (control.type === 'number') expect(value).toBe(control.max)
        if (control.type === 'select') {
          expect(value).toBe(control.options.at(-1)?.value)
        }
      }
    }
  })

  it('covers all four legal position corners', () => {
    const positions = new Set(
      createRoiStressSamples().map(
        (sample) => `${sample.card.position.x},${sample.card.position.y}`,
      ),
    )

    expect(positions).toEqual(new Set(['0,0', '100,0', '0,100', '100,100']))
  })
})

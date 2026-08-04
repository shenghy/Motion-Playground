import { describe, expect, it } from 'vitest'
import { motionRegistry } from '../../motion/registry'
import { MOTION_IDS } from '../../motion/types'

describe('canvas motion registry coverage', () => {
  it('registers one canvas renderer for every motion id', () => {
    expect(motionRegistry.map((item) => 'canvasRenderer' in item)).toEqual(
      MOTION_IDS.map(() => true),
    )
  })
})

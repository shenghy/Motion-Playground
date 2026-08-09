import { describe, expect, it } from 'vitest'
import { encodeOrderedRoiFrame } from './roiFrame'

describe('browser ROI frame encoder', () => {
  it('writes the ROI4 header and tightly packed rgba payload', () => {
    const packet = encodeOrderedRoiFrame(
      { x: 10, y: 20, width: 1, height: 1 },
      new Uint8ClampedArray([1, 2, 3, 4]),
    )
    const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength)

    expect([...packet.slice(0, 4)]).toEqual([82, 79, 73, 52])
    expect(view.getUint16(4, true)).toBe(10)
    expect(view.getUint16(6, true)).toBe(20)
    expect(view.getUint16(8, true)).toBe(1)
    expect(view.getUint16(10, true)).toBe(1)
    expect([...packet.slice(12)]).toEqual([1, 2, 3, 4])
  })

  it('uses only the fixed header for a transparent frame', () => {
    const packet = encodeOrderedRoiFrame(
      { x: 0, y: 0, width: 0, height: 0 },
      new Uint8ClampedArray(0),
    )
    expect(packet.byteLength).toBe(12)
  })
})

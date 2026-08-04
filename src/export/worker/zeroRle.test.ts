import { describe, expect, it } from 'vitest'
import { encodeZeroRleFrame } from './zeroRle'

describe('zero rgba run encoding', () => {
  it('encodes only non-zero pixel runs with exact byte payloads', () => {
    const pixels = new Uint8ClampedArray([
      0, 0, 0, 0,
      10, 20, 30, 40,
      50, 60, 70, 80,
      0, 0, 0, 0,
      90, 100, 110, 120,
    ])
    const encoded = encodeZeroRleFrame(pixels)
    const view = new DataView(encoded.buffer, encoded.byteOffset, encoded.byteLength)
    expect(view.getUint32(0, true)).toBe(2)
    expect(view.getUint32(4, true)).toBe(1)
    expect(view.getUint32(8, true)).toBe(2)
    expect([...encoded.slice(12, 20)]).toEqual([10, 20, 30, 40, 50, 60, 70, 80])
    expect(view.getUint32(20, true)).toBe(4)
    expect(view.getUint32(24, true)).toBe(1)
    expect([...encoded.slice(28)]).toEqual([90, 100, 110, 120])
  })

  it('encodes a transparent frame as a four-byte zero run count', () => {
    expect([...encodeZeroRleFrame(new Uint8ClampedArray(16))]).toEqual([0, 0, 0, 0])
  })
})

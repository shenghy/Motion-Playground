import { describe, expect, it } from 'vitest'
import {
  applyOrderedRoiFrame,
  decodeOrderedRoiFrame,
  decodeOrderedRawFrame,
  decodeOrderedZeroRleFrame,
  decodeRawFrame,
  encodeOrderedRoiFrame,
  encodeRawFrame,
  rawFrameBytes,
} from './raw-frame-protocol.mjs'

describe('ordered ROI rgba protocol', () => {
  it('encodes and reconstructs one tightly packed rectangle', () => {
    const pixels = Buffer.from([
      1, 2, 3, 4, 5, 6, 7, 8,
      9, 10, 11, 12, 13, 14, 15, 16,
    ])
    const packet = encodeOrderedRoiFrame(
      { x: 1, y: 1, width: 2, height: 2 },
      pixels,
    )
    const roi = decodeOrderedRoiFrame(packet, 4, 3)
    const output = Buffer.alloc(4 * 3 * 4)

    expect(roi).toEqual({
      rect: { x: 1, y: 1, width: 2, height: 2 },
      pixels,
    })
    expect(applyOrderedRoiFrame(output, roi, 4, 3)).toEqual(
      { x: 1, y: 1, width: 2, height: 2 },
    )
    expect(output).toEqual(Buffer.from([
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 0, 0, 0, 0,
      0, 0, 0, 0, 9, 10, 11, 12, 13, 14, 15, 16, 0, 0, 0, 0,
    ]))
  })

  it('uses a header-only packet for an empty frame and clears prior pixels', () => {
    const output = Buffer.alloc(2 * 2 * 4, 255)
    const packet = encodeOrderedRoiFrame(
      { x: 0, y: 0, width: 0, height: 0 },
      Buffer.alloc(0),
    )
    const roi = decodeOrderedRoiFrame(packet, 2, 2)

    expect(applyOrderedRoiFrame(
      output,
      roi,
      2,
      2,
      { x: 0, y: 0, width: 2, height: 2 },
    )).toEqual({ x: 0, y: 0, width: 0, height: 0 })
    expect(output).toEqual(Buffer.alloc(2 * 2 * 4))
  })

  it('rejects malformed, overflowing, and trailing ROI payloads', () => {
    const valid = encodeOrderedRoiFrame(
      { x: 1, y: 1, width: 1, height: 1 },
      Buffer.from([1, 2, 3, 4]),
    )
    const badMagic = Buffer.from(valid)
    badMagic[0] = 0

    expect(() => decodeOrderedRoiFrame(badMagic, 2, 2)).toThrow('ROI')
    expect(() => decodeOrderedRoiFrame(valid, 1, 1)).toThrow('ROI')
    expect(() => decodeOrderedRoiFrame(
      Buffer.concat([valid, Buffer.from([9])]),
      2,
      2,
    )).toThrow('ROI')
    expect(() => encodeOrderedRoiFrame(
      { x: 0, y: 0, width: 1, height: 1 },
      Buffer.alloc(3),
    )).toThrow('ROI')
  })
})

describe('raw rgba frame protocol', () => {
  it('prefixes pixels with one big-endian frame index', () => {
    const pixels = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8])
    const encoded = encodeRawFrame(7, pixels)
    expect(encoded.readUInt32BE(0)).toBe(7)
    expect(encoded.subarray(4)).toEqual(pixels)
    expect(decodeRawFrame(encoded, 1, 2)).toEqual({
      frameIndex: 7,
      pixels,
    })
  })

  it('requires one exact rgba payload', () => {
    expect(rawFrameBytes(1920, 1080)).toBe(8_294_400)
    expect(() => decodeRawFrame(Buffer.alloc(11), 1, 2)).toThrow(
      'RGBA 帧字节数',
    )
    expect(() => encodeRawFrame(-1, Buffer.alloc(8))).toThrow('帧序号')
  })

  it('validates ordered pixels without allocating a frame header', () => {
    const pixels = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8])
    expect(decodeOrderedRawFrame(pixels, 1, 2)).toBe(pixels)
    expect(() => decodeOrderedRawFrame(Buffer.alloc(9), 1, 2)).toThrow(
      'RGBA 甯у瓧鑺傛暟',
    )
  })
})

it('decodes ordered zero-rle rgba without changing any pixel byte', () => {
  const encoded = Buffer.from([
    2, 0, 0, 0,
    1, 0, 0, 0, 2, 0, 0, 0,
    10, 20, 30, 40, 50, 60, 70, 80,
    4, 0, 0, 0, 1, 0, 0, 0,
    90, 100, 110, 120,
  ])
  expect(decodeOrderedZeroRleFrame(encoded, 5, 1)).toEqual(Buffer.from([
    0, 0, 0, 0, 10, 20, 30, 40, 50, 60, 70, 80,
    0, 0, 0, 0, 90, 100, 110, 120,
  ]))
})

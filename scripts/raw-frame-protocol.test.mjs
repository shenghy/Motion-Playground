import { describe, expect, it } from 'vitest'
import {
  decodeOrderedRawFrame,
  decodeRawFrame,
  encodeRawFrame,
  rawFrameBytes,
} from './raw-frame-protocol.mjs'

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

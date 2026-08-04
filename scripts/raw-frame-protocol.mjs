export const RAW_FRAME_HEADER_BYTES = 4

export function rawFrameBytes(width, height) {
  if (
    !Number.isInteger(width) || width <= 0
    || !Number.isInteger(height) || height <= 0
  ) {
    throw new Error('RGBA 帧尺寸无效')
  }
  return width * height * 4
}

export function encodeRawFrame(frameIndex, pixels) {
  if (!Number.isInteger(frameIndex) || frameIndex < 0) {
    throw new Error('RGBA 帧序号无效')
  }
  const source = Buffer.isBuffer(pixels)
    ? pixels
    : Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength)
  const encoded = Buffer.allocUnsafe(RAW_FRAME_HEADER_BYTES + source.length)
  encoded.writeUInt32BE(frameIndex, 0)
  source.copy(encoded, RAW_FRAME_HEADER_BYTES)
  return encoded
}

export function decodeRawFrame(message, width, height) {
  const buffer = Buffer.isBuffer(message)
    ? message
    : Buffer.from(message.buffer, message.byteOffset, message.byteLength)
  const expected = RAW_FRAME_HEADER_BYTES + rawFrameBytes(width, height)
  if (buffer.length !== expected) {
    throw new Error(`RGBA 帧字节数必须为 ${expected - RAW_FRAME_HEADER_BYTES}`)
  }
  return {
    frameIndex: buffer.readUInt32BE(0),
    pixels: buffer.subarray(RAW_FRAME_HEADER_BYTES),
  }
}

export function decodeOrderedRawFrame(message, width, height) {
  const buffer = Buffer.isBuffer(message)
    ? message
    : Buffer.from(message.buffer, message.byteOffset, message.byteLength)
  const expected = rawFrameBytes(width, height)
  if (buffer.length !== expected) {
    throw new Error(`RGBA 甯у瓧鑺傛暟蹇呴』涓?${expected}`)
  }
  return buffer
}

export function decodeOrderedZeroRleFrame(message, width, height) {
  const buffer = Buffer.isBuffer(message)
    ? message
    : Buffer.from(message.buffer, message.byteOffset, message.byteLength)
  if (buffer.length < 4) throw new Error('RGBA RLE 帧缺少游程数量')
  const pixelCount = width * height
  const output = Buffer.alloc(rawFrameBytes(width, height))
  const runCount = buffer.readUInt32LE(0)
  let inputOffset = 4
  let previousEnd = 0
  for (let run = 0; run < runCount; run += 1) {
    if (inputOffset + 8 > buffer.length) throw new Error('RGBA RLE 游程头无效')
    const start = buffer.readUInt32LE(inputOffset)
    const length = buffer.readUInt32LE(inputOffset + 4)
    inputOffset += 8
    const end = start + length
    const bytes = length * 4
    if (length === 0 || start < previousEnd || end > pixelCount || inputOffset + bytes > buffer.length) {
      throw new Error('RGBA RLE 游程范围无效')
    }
    buffer.copy(output, start * 4, inputOffset, inputOffset + bytes)
    inputOffset += bytes
    previousEnd = end
  }
  if (inputOffset !== buffer.length) throw new Error('RGBA RLE 帧包含多余数据')
  return output
}

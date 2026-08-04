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

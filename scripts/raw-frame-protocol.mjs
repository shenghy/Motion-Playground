export const RAW_FRAME_HEADER_BYTES = 4
export const ROI_FRAME_HEADER_BYTES = 12

const ROI_FRAME_MAGIC = Buffer.from('ROI4', 'ascii')

function asBuffer(value) {
  return Buffer.isBuffer(value)
    ? value
    : Buffer.from(value.buffer, value.byteOffset, value.byteLength)
}

function validateRoiRect(rect, frameWidth, frameHeight) {
  const values = [rect?.x, rect?.y, rect?.width, rect?.height]
  if (values.some((value) => !Number.isInteger(value) || value < 0)) {
    throw new Error('RGBA ROI 矩形无效')
  }
  const empty = rect.width === 0 || rect.height === 0
  if (empty && (rect.x !== 0 || rect.y !== 0 || rect.width !== 0 || rect.height !== 0)) {
    throw new Error('RGBA ROI 空矩形无效')
  }
  if (
    rect.x > 0xffff || rect.y > 0xffff
    || rect.width > 0xffff || rect.height > 0xffff
    || rect.x + rect.width > frameWidth
    || rect.y + rect.height > frameHeight
  ) {
    throw new Error('RGBA ROI 矩形超出画面')
  }
}

export function encodeOrderedRoiFrame(rect, pixels) {
  validateRoiRect(rect, 0xffff, 0xffff)
  const source = asBuffer(pixels)
  const expected = rect.width * rect.height * 4
  if (source.length !== expected) {
    throw new Error(`RGBA ROI 像素字节数必须为 ${expected}`)
  }
  const packet = Buffer.allocUnsafe(ROI_FRAME_HEADER_BYTES + expected)
  ROI_FRAME_MAGIC.copy(packet, 0)
  packet.writeUInt16LE(rect.x, 4)
  packet.writeUInt16LE(rect.y, 6)
  packet.writeUInt16LE(rect.width, 8)
  packet.writeUInt16LE(rect.height, 10)
  source.copy(packet, ROI_FRAME_HEADER_BYTES)
  return packet
}

export function decodeOrderedRoiFrame(message, frameWidth, frameHeight) {
  rawFrameBytes(frameWidth, frameHeight)
  const buffer = asBuffer(message)
  if (
    buffer.length < ROI_FRAME_HEADER_BYTES
    || !buffer.subarray(0, 4).equals(ROI_FRAME_MAGIC)
  ) {
    throw new Error('RGBA ROI 帧头无效')
  }
  const rect = {
    x: buffer.readUInt16LE(4),
    y: buffer.readUInt16LE(6),
    width: buffer.readUInt16LE(8),
    height: buffer.readUInt16LE(10),
  }
  validateRoiRect(rect, frameWidth, frameHeight)
  const expected = ROI_FRAME_HEADER_BYTES + rect.width * rect.height * 4
  if (buffer.length !== expected) {
    throw new Error(`RGBA ROI 负载字节数必须为 ${expected - ROI_FRAME_HEADER_BYTES}`)
  }
  return {
    rect,
    pixels: buffer.subarray(ROI_FRAME_HEADER_BYTES),
  }
}

function clearRect(output, rect, frameWidth) {
  for (let row = 0; row < rect.height; row += 1) {
    const start = ((rect.y + row) * frameWidth + rect.x) * 4
    output.fill(0, start, start + rect.width * 4)
  }
}

export function applyOrderedRoiFrame(
  output,
  roi,
  frameWidth,
  frameHeight,
  previousRect = { x: 0, y: 0, width: 0, height: 0 },
) {
  const target = asBuffer(output)
  if (target.length !== rawFrameBytes(frameWidth, frameHeight)) {
    throw new Error('RGBA ROI 输出缓冲区尺寸无效')
  }
  validateRoiRect(previousRect, frameWidth, frameHeight)
  validateRoiRect(roi.rect, frameWidth, frameHeight)
  if (roi.pixels.length !== roi.rect.width * roi.rect.height * 4) {
    throw new Error('RGBA ROI 像素负载无效')
  }
  clearRect(target, previousRect, frameWidth)
  const source = asBuffer(roi.pixels)
  for (let row = 0; row < roi.rect.height; row += 1) {
    const sourceStart = row * roi.rect.width * 4
    const targetStart = ((roi.rect.y + row) * frameWidth + roi.rect.x) * 4
    source.copy(
      target,
      targetStart,
      sourceStart,
      sourceStart + roi.rect.width * 4,
    )
  }
  return { ...roi.rect }
}

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

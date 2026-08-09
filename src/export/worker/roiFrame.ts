import type { CanvasFrameRect } from '../canvas/types'

const ROI_HEADER_BYTES = 12
const ROI_MAGIC = [82, 79, 73, 52] as const

function validRect(rect: CanvasFrameRect) {
  const values = [rect.x, rect.y, rect.width, rect.height]
  if (values.some((value) => !Number.isInteger(value) || value < 0 || value > 0xffff)) {
    return false
  }
  const empty = rect.width === 0 || rect.height === 0
  return !empty || (
    rect.x === 0 && rect.y === 0 && rect.width === 0 && rect.height === 0
  )
}

export function encodeOrderedRoiFrame(
  rect: CanvasFrameRect,
  pixels: Uint8ClampedArray,
) {
  if (!validRect(rect) || pixels.byteLength !== rect.width * rect.height * 4) {
    throw new Error('RGBA ROI 帧无效')
  }
  const packet = new Uint8Array(ROI_HEADER_BYTES + pixels.byteLength)
  packet.set(ROI_MAGIC, 0)
  const view = new DataView(packet.buffer)
  view.setUint16(4, rect.x, true)
  view.setUint16(6, rect.y, true)
  view.setUint16(8, rect.width, true)
  view.setUint16(10, rect.height, true)
  packet.set(pixels, ROI_HEADER_BYTES)
  return packet
}

export function createZeroRleEncoder(pixelCount: number) {
  if (!Number.isInteger(pixelCount) || pixelCount < 1) {
    throw new Error('RGBA 像素数量无效')
  }
  const maximumBytes = Math.max(
    12 + pixelCount * 4,
    4 + Math.ceil(pixelCount / 2) * 12,
  )
  const scratch = new Uint8Array(maximumBytes)
  const view = new DataView(scratch.buffer)

  return {
    encode(pixels: Uint8ClampedArray) {
      if (pixels.byteLength !== pixelCount * 4) {
        throw new Error(`RGBA 帧字节数必须为 ${pixelCount * 4}`)
      }
      const words = new Uint32Array(
        pixels.buffer,
        pixels.byteOffset,
        pixelCount,
      )
      let runCount = 0
      let outputOffset = 4
      for (let index = 0; index < words.length;) {
        while (index < words.length && words[index] === 0) index += 1
        if (index >= words.length) break
        const start = index
        while (index < words.length && words[index] !== 0) index += 1
        const length = index - start
        view.setUint32(outputOffset, start, true)
        view.setUint32(outputOffset + 4, length, true)
        outputOffset += 8
        scratch.set(
          pixels.subarray(start * 4, (start + length) * 4),
          outputOffset,
        )
        outputOffset += length * 4
        runCount += 1
      }
      view.setUint32(0, runCount, true)
      return scratch.subarray(0, outputOffset)
    },
  }
}

export function encodeZeroRleFrame(pixels: Uint8ClampedArray) {
  return createZeroRleEncoder(pixels.byteLength / 4).encode(pixels).slice()
}

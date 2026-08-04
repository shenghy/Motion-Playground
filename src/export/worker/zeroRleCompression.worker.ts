import { createZeroRleEncoder } from './zeroRle'

const encoders = new Map<number, ReturnType<typeof createZeroRleEncoder>>()

globalThis.addEventListener('message', (event: MessageEvent<{
  id: number
  pixels: ArrayBuffer
}>) => {
  const { id, pixels } = event.data
  const source = new Uint8ClampedArray(pixels)
  const pixelCount = source.byteLength / 4
  let encoder = encoders.get(pixelCount)
  if (!encoder) {
    encoder = createZeroRleEncoder(pixelCount)
    encoders.set(pixelCount, encoder)
  }
  const compressed = encoder.encode(source).slice()
  globalThis.postMessage({ id, compressed: compressed.buffer }, {
    transfer: [compressed.buffer],
  })
})

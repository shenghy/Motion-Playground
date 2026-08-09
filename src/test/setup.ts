import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => cleanup())

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
})

const testCanvasPixels = new Uint8ClampedArray(1920 * 1080 * 4)
const canvasNoop = () => undefined
const testCanvasGradient = { addColorStop: canvasNoop }
const testCanvasContext = new Proxy({
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
  fillStyle: '#000000',
  strokeStyle: '#000000',
  lineWidth: 1,
  font: '10px sans-serif',
  textAlign: 'start',
  textBaseline: 'alphabetic',
  filter: 'none',
  measureText: (text: string) => ({ width: text.length * 20 }),
  createLinearGradient: () => testCanvasGradient,
  createRadialGradient: () => testCanvasGradient,
  getImageData: () => ({ data: testCanvasPixels }),
} as unknown as CanvasRenderingContext2D, {
  get(target, property, receiver) {
    if (property in target) return Reflect.get(target, property, receiver)
    return canvasNoop
  },
})

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  value: () => testCanvasContext,
})
Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
  configurable: true,
  value: (callback: BlobCallback) => {
    callback(new Blob(['png'], { type: 'image/png' }))
  },
})

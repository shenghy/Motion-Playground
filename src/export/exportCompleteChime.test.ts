import { describe, expect, it, vi } from 'vitest'
import { createExportCompleteChime } from './exportCompleteChime'

function createAudioContext() {
  const endedListeners: Array<() => void> = []
  const oscillators = Array.from({ length: 3 }, () => ({
    type: 'sine' as OscillatorType,
    frequency: { setValueAtTime: vi.fn() },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    addEventListener: vi.fn((_type: string, listener: () => void) => {
      endedListeners.push(listener)
    }),
  }))
  const gains = Array.from({ length: 3 }, () => ({
    gain: {
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  }))
  let oscillatorIndex = 0
  let gainIndex = 0
  const context = {
    currentTime: 10,
    state: 'suspended' as AudioContextState,
    destination: {},
    resume: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    createOscillator: vi.fn(() => oscillators[oscillatorIndex++]),
    createGain: vi.fn(() => gains[gainIndex++]),
  }
  return { context, endedListeners, gains, oscillators }
}

describe('export completion chime', () => {
  it('plays a rising three-note chime and closes after the final note', async () => {
    const audio = createAudioContext()
    const chime = createExportCompleteChime(
      () => audio.context as unknown as AudioContext,
    )

    expect(audio.context.resume).toHaveBeenCalledTimes(1)
    await chime.play()

    expect(audio.oscillators.map((oscillator) =>
      oscillator.frequency.setValueAtTime.mock.calls[0]?.[0],
    )).toEqual([523.25, 659.25, 783.99])
    expect(audio.oscillators.map((oscillator) =>
      oscillator.start.mock.calls[0]?.[0],
    )).toEqual([10, 10.14, 10.28])
    expect(audio.oscillators.every((oscillator) =>
      oscillator.connect.mock.calls[0]?.[0] !== undefined,
    )).toBe(true)
    expect(audio.gains.every((gain) =>
      gain.connect.mock.calls[0]?.[0] === audio.context.destination,
    )).toBe(true)

    audio.endedListeners.at(-1)?.()
    expect(audio.context.close).toHaveBeenCalledTimes(1)
  })

  it('stays silent and closes when an export is cancelled', async () => {
    const audio = createAudioContext()
    const chime = createExportCompleteChime(
      () => audio.context as unknown as AudioContext,
    )

    await chime.dispose()

    expect(audio.context.close).toHaveBeenCalledTimes(1)
    expect(audio.oscillators.every((oscillator) =>
      oscillator.start.mock.calls.length === 0,
    )).toBe(true)
  })
})

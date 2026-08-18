export interface ExportCompleteChime {
  play(): Promise<void>
  dispose(): Promise<void>
}

const silentChime: ExportCompleteChime = {
  play: async () => undefined,
  dispose: async () => undefined,
}

export function createExportCompleteChime(
  contextFactory: () => AudioContext = () => new AudioContext(),
): ExportCompleteChime {
  let context: AudioContext
  try {
    context = contextFactory()
  } catch {
    return silentChime
  }

  let closed = false
  let played = false
  const ready = context.state === 'suspended'
    ? context.resume().then(() => true).catch(() => false)
    : Promise.resolve(true)
  const close = async () => {
    if (closed) return
    closed = true
    await context.close().catch(() => undefined)
  }

  return {
    async play() {
      if (played || closed) return
      if (!await ready) {
        await close()
        return
      }

      const notes = [523.25, 659.25, 783.99]
      const startedAt = context.currentTime
      try {
        notes.forEach((frequency, index) => {
          const noteStart = startedAt + index * 0.14
          const oscillator = context.createOscillator()
          const gain = context.createGain()
          oscillator.type = 'sine'
          oscillator.frequency.setValueAtTime(frequency, noteStart)
          gain.gain.setValueAtTime(0.001, noteStart)
          gain.gain.linearRampToValueAtTime(0.16, noteStart + 0.025)
          gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.32)
          oscillator.connect(gain)
          gain.connect(context.destination)
          oscillator.start(noteStart)
          oscillator.stop(noteStart + 0.34)
          if (index === notes.length - 1) {
            oscillator.addEventListener('ended', () => { void close() }, { once: true })
          }
        })
        played = true
      } catch {
        await close()
      }
    },
    async dispose() {
      if (!played) await close()
    },
  }
}

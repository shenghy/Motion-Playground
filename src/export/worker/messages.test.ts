import { describe, expect, it } from 'vitest'
import { validateWorkerExportCommand } from './messages'

describe('worker export message validation', () => {
  it('accepts a cloneable three-frame prepare command', () => {
    expect(validateWorkerExportCommand({
      type: 'prepare',
      cards: [],
      duration: 10,
      windowSize: 3,
    }, 'http://localhost:4173')).toMatchObject({
      type: 'prepare',
      duration: 10,
      windowSize: 3,
    })
  })

  it.each([
    { type: 'prepare', cards: [], duration: 0, windowSize: 3 },
    { type: 'prepare', cards: [], duration: 10, windowSize: 2 },
    { type: 'prepare', cards: [{ invalid: () => undefined }], duration: 10, windowSize: 3 },
  ])('rejects an invalid prepare command', (command) => {
    expect(() => validateWorkerExportCommand(
      command,
      'http://localhost:4173',
    )).toThrow()
  })

  it('accepts only a same-origin websocket start command', () => {
    expect(validateWorkerExportCommand({
      type: 'start',
      jobId: 'job-1',
      socketUrl: 'ws://localhost:4173/__overlay_export__/jobs/job-1/raw',
    }, 'http://localhost:4173')).toMatchObject({ type: 'start' })

    expect(() => validateWorkerExportCommand({
      type: 'start',
      jobId: 'job-1',
      socketUrl: 'ws://elsewhere.test/jobs/job-1/raw',
    }, 'http://localhost:4173')).toThrow('同源')
    expect(() => validateWorkerExportCommand({
      type: 'start',
      jobId: '',
      socketUrl: 'ws://localhost:4173/jobs/raw',
    }, 'http://localhost:4173')).toThrow('任务编号')
  })

  it('accepts cancellation without additional data', () => {
    expect(validateWorkerExportCommand(
      { type: 'cancel' },
      'http://localhost:4173',
    )).toEqual({ type: 'cancel' })
  })
})

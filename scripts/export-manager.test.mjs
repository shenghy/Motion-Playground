import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createExportManager } from './export-manager.mjs'

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3,
])

function createFakeProcess() {
  const child = new EventEmitter()
  child.stdin = new PassThrough()
  child.stderr = new PassThrough()
  child.kill = vi.fn(() => {
    queueMicrotask(() => child.emit('close', null, 'SIGTERM'))
    return true
  })
  child.stdin.once('finish', () => {
    queueMicrotask(() => child.emit('close', 0, null))
  })
  return child
}

describe('transparent MOV export manager', () => {
  it('streams ordered PNG frames to ProRes 4444 with alpha', async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'overlay-export-'))
    const child = createFakeProcess()
    const spawnProcess = vi.fn(() => child)
    const manager = createExportManager({
      ffmpegPath: 'bundled-ffmpeg',
      spawnProcess,
      temporaryRoot,
    })

    try {
      const job = await manager.createJob({
        width: 1920,
        height: 1080,
        fps: 30,
        totalFrames: 2,
      })
      const input = []
      child.stdin.on('data', (chunk) => input.push(chunk))

      await manager.appendFrame(job.id, 0, PNG)
      await expect(manager.appendFrame(job.id, 2, PNG)).rejects.toThrow(
        '帧序号',
      )
      await manager.appendFrame(job.id, 1, PNG)
      await writeFile(job.outputPath, 'mov')
      await manager.finishJob(job.id)

      expect(Buffer.concat(input)).toEqual(Buffer.concat([PNG, PNG]))
      const [command, args] = spawnProcess.mock.calls[0]
      expect(command).toBe('bundled-ffmpeg')
      expect(args).toEqual(expect.arrayContaining([
        '-f', 'image2pipe',
        '-framerate', '30',
        '-c:v', 'prores_ks',
        '-profile:v', '4',
        '-pix_fmt', 'yuva444p10le',
        '-alpha_bits', '16',
      ]))
      expect(args.join(' ')).not.toContain('.mp4')
    } finally {
      await manager.close()
      await rm(temporaryRoot, { recursive: true, force: true })
    }
  })

  it('allows only one active job and kills it on cancellation', async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'overlay-export-'))
    const child = createFakeProcess()
    const manager = createExportManager({
      ffmpegPath: 'bundled-ffmpeg',
      spawnProcess: () => child,
      temporaryRoot,
    })

    try {
      const job = await manager.createJob({
        width: 1920,
        height: 1080,
        fps: 30,
        totalFrames: 1,
      })
      await expect(manager.createJob({
        width: 1920,
        height: 1080,
        fps: 30,
        totalFrames: 1,
      })).rejects.toThrow('已有导出任务')

      await manager.cancelJob(job.id)
      expect(child.kill).toHaveBeenCalled()
    } finally {
      await manager.close()
      await rm(temporaryRoot, { recursive: true, force: true })
    }
  })
})

import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createExportManager } from './export-manager.mjs'

function pngHeader(width = 1920, height = 1080) {
  const buffer = Buffer.alloc(33)
  Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]).copy(buffer)
  buffer.writeUInt32BE(13, 8)
  buffer.write('IHDR', 12, 'ascii')
  buffer.writeUInt32BE(width, 16)
  buffer.writeUInt32BE(height, 20)
  buffer[24] = 8
  buffer[25] = 6
  return buffer
}

const PNG = pngHeader()

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

  it('rejects PNG frames that do not match the export canvas', async () => {
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
      await expect(
        manager.appendFrame(job.id, 0, pngHeader(1280, 720)),
      ).rejects.toThrow('PNG 帧尺寸')
    } finally {
      await manager.close()
      await rm(temporaryRoot, { recursive: true, force: true })
    }
  })

  it('reclaims abandoned jobs after the inactivity timeout', async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'overlay-export-'))
    const children = []
    const manager = createExportManager({
      ffmpegPath: 'bundled-ffmpeg',
      spawnProcess: () => {
        const child = createFakeProcess()
        children.push(child)
        return child
      },
      temporaryRoot,
      jobTtlMs: 10,
    })

    try {
      await manager.createJob({
        width: 1920,
        height: 1080,
        fps: 30,
        totalFrames: 1,
      })
      await new Promise((resolve) => setTimeout(resolve, 30))
      await manager.createJob({
        width: 1920,
        height: 1080,
        fps: 30,
        totalFrames: 1,
      })
      expect(children[0].kill).toHaveBeenCalled()
    } finally {
      await manager.close()
      await rm(temporaryRoot, { recursive: true, force: true })
    }
  })
})

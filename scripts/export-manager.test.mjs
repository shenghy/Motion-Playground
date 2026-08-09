import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createExportManager } from './export-manager.mjs'
import { rawFrameBytes } from './raw-frame-protocol.mjs'

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

function createFakeProcess(onFinish = () => undefined) {
  const child = new EventEmitter()
  child.stdin = new PassThrough()
  child.stderr = new PassThrough()
  child.kill = vi.fn(() => {
    queueMicrotask(() => child.emit('close', null, 'SIGTERM'))
    return true
  })
  child.stdin.once('finish', () => {
    onFinish()
    queueMicrotask(() => child.emit('close', 0, null))
  })
  return child
}

describe('transparent MOV export manager', () => {
  it('streams ordered raw RGBA frames with FFmpeg backpressure', async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'overlay-export-'))
    const child = createFakeProcess()
    const writeToInput = child.stdin.write.bind(child.stdin)
    child.stdin.write = vi.fn((chunk) => {
      writeToInput(chunk)
      queueMicrotask(() => child.stdin.emit('drain'))
      return false
    })
    const spawnProcess = vi.fn(() => child)
    const manager = createExportManager({
      ffmpegPath: 'bundled-ffmpeg',
      spawnProcess,
      temporaryRoot,
    })
    const rgba = Buffer.alloc(rawFrameBytes(1920, 1080), 23)
    const input = []
    child.stdin.on('data', (chunk) => input.push(chunk))

    try {
      const job = await manager.createJob({
        width: 1920,
        height: 1080,
        fps: 30,
        totalFrames: 1,
        transport: 'raw-rgba-ordered',
      })
      await expect(
        manager.appendRawFrame(job.id, 0, rgba.subarray(1)),
      ).rejects.toThrow('RGBA 帧字节数')
      await manager.appendRawFrame(job.id, 0, rgba)
      expect(child.stdin.write).toHaveReturnedWith(false)
      await writeFile(job.outputPath, 'mov')
      await manager.finishJob(job.id)

      const received = Buffer.concat(input)
      expect(received.length).toBe(rgba.length)
      expect(received.subarray(0, 16)).toEqual(rgba.subarray(0, 16))
      expect(received.subarray(-16)).toEqual(rgba.subarray(-16))
      const [, args] = spawnProcess.mock.calls[0]
      expect(args).toEqual(expect.arrayContaining([
        '-f', 'rawvideo',
        '-pixel_format', 'rgba',
        '-video_size', '1920x1080',
        '-framerate', '30',
      ]))
      expect(args).not.toContain('image2pipe')
    } finally {
      await manager.close()
      await rm(temporaryRoot, { recursive: true, force: true })
    }
  })

  it('reconstructs an ROI packet into one exact full RGBA frame', async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'overlay-export-'))
    const child = createFakeProcess()
    const writeRoiToInput = child.stdin.write.bind(child.stdin)
    child.stdin.write = vi.fn((chunk, callback) => {
      writeRoiToInput(chunk, callback)
      return true
    })
    const manager = createExportManager({
      ffmpegPath: 'bundled-ffmpeg',
      spawnProcess: () => child,
      temporaryRoot,
    })
    const input = []
    child.stdin.on('data', (chunk) => input.push(chunk))

    try {
      const job = await manager.createJob({
        width: 1920,
        height: 1080,
        fps: 30,
        totalFrames: 1,
        transport: 'raw-rgba-roi-ordered',
      })
      await manager.appendRoiFrame(job.id, 0, {
        rect: { x: 1, y: 1, width: 2, height: 1 },
        pixels: Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]),
      })

      const received = Buffer.concat(input)
      expect(received.length).toBe(rawFrameBytes(1920, 1080))
      const rowOffset = (1920 + 1) * 4
      expect(received.subarray(rowOffset, rowOffset + 8)).toEqual(
        Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]),
      )
      expect(received.subarray(0, rowOffset).every((byte) => byte === 0)).toBe(true)
      expect(received.subarray(rowOffset + 8).every((byte) => byte === 0)).toBe(true)
    } finally {
      await manager.close()
      await rm(temporaryRoot, { recursive: true, force: true })
    }
  })

  it('does not reuse an ROI slot before the prior FFmpeg write completes', async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'overlay-export-'))
    const child = createFakeProcess()
    const callbacks = []
    child.stdin.write = vi.fn((_chunk, callback) => {
      callbacks.push(callback)
      return true
    })
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
        totalFrames: 4,
        transport: 'raw-rgba-roi-ordered',
      })
      const roi = {
        rect: { x: 0, y: 0, width: 1, height: 1 },
        pixels: Buffer.from([1, 2, 3, 4]),
      }
      await manager.appendRoiFrame(job.id, 0, roi)
      await manager.appendRoiFrame(job.id, 1, roi)
      await manager.appendRoiFrame(job.id, 2, roi)

      let fourthCompleted = false
      const fourth = manager.appendRoiFrame(job.id, 3, roi).then(() => {
        fourthCompleted = true
      })
      await Promise.resolve()
      expect(child.stdin.write).toHaveBeenCalledTimes(3)
      expect(fourthCompleted).toBe(false)

      callbacks[0]()
      await fourth
      expect(child.stdin.write).toHaveBeenCalledTimes(4)
    } finally {
      await manager.close()
      await rm(temporaryRoot, { recursive: true, force: true })
    }
  })

  it('streams ordered PNG frames to ProRes 4444 with alpha', async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'overlay-export-'))
    let clock = 100
    const child = createFakeProcess(() => {
      clock = 145
    })
    const spawnProcess = vi.fn(() => child)
    const manager = createExportManager({
      ffmpegPath: 'bundled-ffmpeg',
      spawnProcess,
      temporaryRoot,
      now: () => clock,
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
      const finished = await manager.finishJob(job.id)

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
        '-threads', '16',
      ]))
      expect(args.join(' ')).not.toContain('.mp4')
      expect(finished.encodingMs).toBe(45)
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

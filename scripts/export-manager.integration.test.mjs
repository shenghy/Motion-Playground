import { spawnSync } from 'node:child_process'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ffmpegPath from 'ffmpeg-static'
import { describe, expect, it } from 'vitest'
import { createExportManager } from './export-manager.mjs'

describe('bundled FFmpeg transparent MOV integration', () => {
  it('encodes a real raw RGBA frame as ProRes 4444 with alpha', async () => {
    const temporaryRoot = await mkdtemp(
      join(tmpdir(), 'overlay-export-raw-integration-'),
    )
    const manager = createExportManager({
      ffmpegPath,
      temporaryRoot: join(temporaryRoot, 'jobs'),
    })
    const frame = Buffer.alloc(1920 * 1080 * 4)
    const center = ((540 * 1920) + 960) * 4
    frame.set([241, 238, 229, 255], center)

    try {
      const job = await manager.createJob({
        width: 1920,
        height: 1080,
        fps: 30,
        totalFrames: 1,
        transport: 'raw-rgba',
      })
      await manager.appendRawFrame(job.id, 0, frame)
      const result = await manager.finishJob(job.id)
      expect(result.size).toBeGreaterThan(0)

      const probed = spawnSync(
        ffmpegPath,
        ['-hide_banner', '-i', job.outputPath],
        { encoding: 'utf8', windowsHide: true },
      )
      expect(probed.stderr).toContain('Video: prores (4444)')
      expect(probed.stderr).toContain('yuva444p')
      expect(probed.stderr).toContain('1920x1080')
      expect(probed.stderr).toContain('30 fps')
      await manager.completeDownload(job.id)
    } finally {
      await manager.close()
      await rm(temporaryRoot, { recursive: true, force: true })
    }
  })

  it('encodes a real 1920x1080 alpha PNG as ProRes 4444 at 30fps', async () => {
    const temporaryRoot = await mkdtemp(
      join(tmpdir(), 'overlay-export-integration-'),
    )
    const framePath = join(temporaryRoot, 'frame.png')
    const manager = createExportManager({
      ffmpegPath,
      temporaryRoot: join(temporaryRoot, 'jobs'),
    })

    try {
      const generated = spawnSync(
        ffmpegPath,
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-f',
          'lavfi',
          '-i',
          'color=c=black@0.0:s=1920x1080:d=0.04',
          '-frames:v',
          '1',
          '-pix_fmt',
          'rgba',
          '-threads',
          '1',
          '-y',
          framePath,
        ],
        { encoding: 'utf8', windowsHide: true },
      )
      expect(generated.status, generated.stderr).toBe(0)

      const job = await manager.createJob({
        width: 1920,
        height: 1080,
        fps: 30,
        totalFrames: 1,
      })
      await manager.appendFrame(job.id, 0, await readFile(framePath))
      const result = await manager.finishJob(job.id)
      expect(result.size).toBeGreaterThan(0)

      const probed = spawnSync(
        ffmpegPath,
        ['-hide_banner', '-i', job.outputPath],
        { encoding: 'utf8', windowsHide: true },
      )
      expect(probed.stderr).toContain('Video: prores (4444)')
      expect(probed.stderr).toContain('yuva444p')
      expect(probed.stderr).toContain('1920x1080')
      expect(probed.stderr).toContain('30 fps')
      await manager.completeDownload(job.id)
    } finally {
      await manager.close()
      await rm(temporaryRoot, { recursive: true, force: true })
    }
  })
})

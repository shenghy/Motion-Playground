import { spawnSync } from 'node:child_process'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import ffmpegPath from 'ffmpeg-static'
import { createExportManager } from './export-manager.mjs'

export async function runEncoderBenchmark({ frameCount = 300 } = {}) {
  if (!Number.isInteger(frameCount) || frameCount <= 0) {
    throw new Error('frameCount must be a positive integer')
  }

  const temporaryRoot = await mkdtemp(
    join(tmpdir(), 'overlay-export-benchmark-'),
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
    if (generated.status !== 0) {
      throw new Error(generated.stderr || 'failed to create benchmark frame')
    }

    const frame = await readFile(framePath)
    const startedAt = performance.now()
    const job = await manager.createJob({
      width: 1920,
      height: 1080,
      fps: 30,
      totalFrames: frameCount,
    })
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      await manager.appendFrame(job.id, frameIndex, frame)
    }
    const result = await manager.finishJob(job.id)
    const wallSeconds = (performance.now() - startedAt) / 1_000
    const benchmark = {
      frames: frameCount,
      videoSeconds: frameCount / 30,
      wallSeconds,
      framesPerSecond: frameCount / wallSeconds,
      outputMB: result.size / (1024 * 1024),
      encodingMs: result.encodingMs,
    }
    await manager.completeDownload(job.id)
    return benchmark
  } finally {
    await manager.close()
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const result = await runEncoderBenchmark()
  console.log(JSON.stringify(result, null, 2))
}

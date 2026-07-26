import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
])
const MAX_FRAME_BYTES = 32 * 1024 * 1024

function isPng(buffer) {
  return (
    Buffer.isBuffer(buffer) &&
    buffer.length >= PNG_SIGNATURE.length &&
    buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  )
}

function readPngDimensions(buffer) {
  if (
    !isPng(buffer) ||
    buffer.length < 26 ||
    buffer.readUInt32BE(8) !== 13 ||
    buffer.toString('ascii', 12, 16) !== 'IHDR'
  ) {
    return null
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

function validateJobOptions({ width, height, fps, totalFrames }) {
  if (
    width !== 1920 ||
    height !== 1080 ||
    fps !== 30 ||
    !Number.isInteger(totalFrames) ||
    totalFrames <= 0
  ) {
    throw new Error('透明导出参数无效')
  }
}

function ffmpegArguments(fps, outputPath) {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'image2pipe',
    '-framerate',
    String(fps),
    '-vcodec',
    'png',
    '-i',
    'pipe:0',
    '-an',
    '-c:v',
    'prores_ks',
    '-profile:v',
    '4',
    '-pix_fmt',
    'yuva444p10le',
    '-alpha_bits',
    '16',
    '-y',
    outputPath,
  ]
}

export function createExportManager({
  ffmpegPath,
  spawnProcess = spawn,
  temporaryRoot = join(tmpdir(), 'overlay-studio-exports'),
  jobTtlMs = 30 * 60 * 1000,
}) {
  let activeJob = null

  async function removeJob(job) {
    if (job.expiryTimer) clearTimeout(job.expiryTimer)
    await rm(job.directory, { recursive: true, force: true })
    if (activeJob?.id === job.id) activeJob = null
  }

  function refreshExpiry(job) {
    if (job.expiryTimer) clearTimeout(job.expiryTimer)
    job.expiryTimer = setTimeout(() => {
      void cancelJob(job.id).catch(() => undefined)
    }, jobTtlMs)
    job.expiryTimer.unref?.()
  }

  async function createJob(options) {
    validateJobOptions(options)
    if (!ffmpegPath) throw new Error('本地 FFmpeg 编码器不可用')
    if (activeJob) throw new Error('已有导出任务正在进行')

    await mkdir(temporaryRoot, { recursive: true })
    const directory = await mkdtemp(join(temporaryRoot, 'job-'))
    const outputPath = join(directory, 'overlay-transparent.mov')
    const child = spawnProcess(
      ffmpegPath,
      ffmpegArguments(options.fps, outputPath),
      { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true },
    )
    const job = {
      id: randomUUID(),
      directory,
      outputPath,
      child,
      nextFrame: 0,
      totalFrames: options.totalFrames,
      width: options.width,
      height: options.height,
      status: 'rendering',
      stderr: '',
      closeResult: null,
      expiryTimer: null,
    }
    child.stderr?.on('data', (chunk) => {
      job.stderr = `${job.stderr}${chunk}`.slice(-8000)
    })
    job.closeResult = new Promise((resolveClose, rejectClose) => {
      child.once('error', rejectClose)
      child.once('close', (code, signal) => resolveClose({ code, signal }))
    })
    activeJob = job
    refreshExpiry(job)
    return { id: job.id, outputPath }
  }

  function requireJob(id) {
    if (!activeJob || activeJob.id !== id) {
      throw new Error('找不到透明导出任务')
    }
    return activeJob
  }

  async function appendFrame(id, frameIndex, buffer) {
    const job = requireJob(id)
    if (job.status !== 'rendering') throw new Error('导出任务不再接收帧')
    if (frameIndex !== job.nextFrame) throw new Error('透明导出帧序号不连续')
    if (!isPng(buffer) || buffer.length > MAX_FRAME_BYTES) {
      throw new Error('透明导出 PNG 帧无效')
    }
    const dimensions = readPngDimensions(buffer)
    if (
      !dimensions ||
      dimensions.width !== job.width ||
      dimensions.height !== job.height
    ) {
      throw new Error('透明导出 PNG 帧尺寸必须为 1920×1080')
    }
    if (!job.child.stdin.write(buffer)) {
      await once(job.child.stdin, 'drain')
    }
    job.nextFrame += 1
    refreshExpiry(job)
  }

  async function finishJob(id) {
    const job = requireJob(id)
    if (job.nextFrame !== job.totalFrames) {
      throw new Error('透明导出帧数量不完整')
    }
    job.status = 'encoding'
    job.child.stdin.end()
    const result = await job.closeResult
    if (result.code !== 0) {
      await removeJob(job)
      throw new Error(`透明 MOV 编码失败：${job.stderr || result.signal || '未知错误'}`)
    }
    await stat(job.outputPath)
    job.status = 'completed'
    refreshExpiry(job)
    return { id: job.id, size: (await stat(job.outputPath)).size }
  }

  async function cancelJob(id) {
    const job = requireJob(id)
    if (job.status !== 'completed') {
      job.child.stdin.destroy()
      job.child.kill('SIGTERM')
      await job.closeResult.catch(() => undefined)
    }
    await removeJob(job)
  }

  function openResult(id) {
    const job = requireJob(id)
    if (job.status !== 'completed') throw new Error('透明 MOV 尚未编码完成')
    return createReadStream(job.outputPath)
  }

  async function completeDownload(id) {
    await removeJob(requireJob(id))
  }

  async function close() {
    if (activeJob) await cancelJob(activeJob.id)
  }

  return {
    createJob,
    appendFrame,
    finishJob,
    cancelJob,
    openResult,
    completeDownload,
    close,
    get activeJob() {
      return activeJob
    },
  }
}

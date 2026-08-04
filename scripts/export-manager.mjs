import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { rawFrameBytes } from './raw-frame-protocol.mjs'

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

function validateTransport(transport) {
  if (transport !== 'png' && transport !== 'raw-rgba') {
    throw new Error('透明导出传输格式无效')
  }
}

export function rawFfmpegArguments(fps, outputPath, width = 1920, height = 1080) {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'rawvideo',
    '-pixel_format',
    'rgba',
    '-video_size',
    `${width}x${height}`,
    '-framerate',
    String(fps),
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

function pngFfmpegArguments(fps, outputPath) {
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
  now = () => performance.now(),
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
    const transport = options.transport ?? 'png'
    validateTransport(transport)
    if (!ffmpegPath) throw new Error('本地 FFmpeg 编码器不可用')
    if (activeJob) throw new Error('已有导出任务正在进行')

    await mkdir(temporaryRoot, { recursive: true })
    const directory = await mkdtemp(join(temporaryRoot, 'job-'))
    const outputPath = join(directory, 'overlay-transparent.mov')
    const child = spawnProcess(
      ffmpegPath,
      transport === 'raw-rgba'
        ? rawFfmpegArguments(
            options.fps,
            outputPath,
            options.width,
            options.height,
          )
        : pngFfmpegArguments(options.fps, outputPath),
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
      transport,
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

  function getJobInfo(id) {
    const job = requireJob(id)
    return {
      id: job.id,
      width: job.width,
      height: job.height,
      totalFrames: job.totalFrames,
      nextFrame: job.nextFrame,
      transport: job.transport,
      status: job.status,
    }
  }

  async function appendFrame(id, frameIndex, buffer) {
    const job = requireJob(id)
    if (job.status !== 'rendering') throw new Error('导出任务不再接收帧')
    if (job.transport !== 'png') throw new Error('当前导出任务不接收 PNG 帧')
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

  async function appendRawFrame(id, frameIndex, buffer) {
    const job = requireJob(id)
    if (job.status !== 'rendering') throw new Error('导出任务不再接收帧')
    if (job.transport !== 'raw-rgba') {
      throw new Error('当前导出任务不接收 RGBA 帧')
    }
    if (frameIndex !== job.nextFrame) throw new Error('透明导出帧序号不连续')
    if (!Buffer.isBuffer(buffer) || buffer.length !== rawFrameBytes(
      job.width,
      job.height,
    )) {
      throw new Error(`RGBA 帧字节数必须为 ${rawFrameBytes(job.width, job.height)}`)
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
    const encodingStartedAt = now()
    job.child.stdin.end()
    const result = await job.closeResult
    if (result.code !== 0) {
      await removeJob(job)
      throw new Error(`透明 MOV 编码失败：${job.stderr || result.signal || '未知错误'}`)
    }
    await stat(job.outputPath)
    job.status = 'completed'
    refreshExpiry(job)
    const measuredEncodingMs = now() - encodingStartedAt
    const encodingMs = Number.isFinite(measuredEncodingMs)
      ? Math.max(0, measuredEncodingMs)
      : 0
    return {
      id: job.id,
      size: (await stat(job.outputPath)).size,
      encodingMs,
    }
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
    getJobInfo,
    appendFrame,
    appendRawFrame,
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

import type { OverlayCard } from '../../timeline/types'
import { calculateFrameCount } from '../frameMath'

export interface WorkerPhaseDurations {
  frameCaptureMs: number
  frameTransferMs: number
  acknowledgementMs: number
  encodingMs: number
}

export type WorkerExportCommand =
  | { type: 'prepare'; cards: OverlayCard[]; duration: number; windowSize: 3 }
  | { type: 'start'; jobId: string; socketUrl: string }
  | { type: 'cancel' }

export type WorkerExportEvent =
  | { type: 'ready' }
  | {
      type: 'progress'
      completedFrames: number
      totalFrames: number
      phases: WorkerPhaseDurations
    }
  | {
      type: 'completed'
      size: number
      encodingMs: number
      phases: WorkerPhaseDurations
    }
  | { type: 'cancelled'; completedFrames: number }
  | { type: 'error'; message: string }

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    throw new Error('Worker 导出命令必须是对象')
  }
  return value as Record<string, unknown>
}

function assertCloneable(value: unknown) {
  try {
    structuredClone(value)
  } catch {
    throw new Error('Worker 导出卡片必须可序列化')
  }
}

function websocketOriginMatches(socketUrl: URL, pageOrigin: string) {
  const page = new URL(pageOrigin)
  const requiredProtocol = page.protocol === 'https:' ? 'wss:' : 'ws:'
  return socketUrl.protocol === requiredProtocol && socketUrl.host === page.host
}

export function validateWorkerExportCommand(
  value: unknown,
  pageOrigin: string,
): WorkerExportCommand {
  const command = object(value)

  if (command.type === 'cancel') return { type: 'cancel' }

  if (command.type === 'prepare') {
    if (!Array.isArray(command.cards)) {
      throw new Error('Worker 导出缺少动画卡片')
    }
    if (
      typeof command.duration !== 'number'
      || !Number.isFinite(command.duration)
      || command.duration <= 0
      || calculateFrameCount(command.duration) <= 0
    ) {
      throw new Error('Worker 导出时长无效')
    }
    if (command.windowSize !== 3) {
      throw new Error('Worker 导出流水线窗口必须为 3')
    }
    assertCloneable(command.cards)
    return command as unknown as WorkerExportCommand
  }

  if (command.type === 'start') {
    if (typeof command.jobId !== 'string' || command.jobId.trim() === '') {
      throw new Error('Worker 导出任务编号无效')
    }
    if (typeof command.socketUrl !== 'string') {
      throw new Error('Worker 导出 WebSocket 地址无效')
    }
    let url: URL
    try {
      url = new URL(command.socketUrl)
    } catch {
      throw new Error('Worker 导出 WebSocket 地址无效')
    }
    if (!websocketOriginMatches(url, pageOrigin)) {
      throw new Error('Worker 导出 WebSocket 必须同源')
    }
    return command as unknown as WorkerExportCommand
  }

  throw new Error('无法识别 Worker 导出命令')
}

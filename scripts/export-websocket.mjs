import { WebSocket, WebSocketServer } from 'ws'
import {
  decodeOrderedRawFrame,
  decodeOrderedRoiFrame,
  decodeOrderedZeroRleFrame,
  decodeRawFrame,
} from './raw-frame-protocol.mjs'

const RAW_SOCKET_PATH = /^\/__overlay_export__\/jobs\/([^/]+)\/raw$/

function rejectUpgrade(socket, statusCode, message) {
  const statusText = statusCode === 403
    ? 'Forbidden'
    : statusCode === 404
      ? 'Not Found'
      : 'Bad Request'
  const body = Buffer.from(message, 'utf8')
  socket.end(
    `HTTP/1.1 ${statusCode} ${statusText}\r\n`
      + 'Connection: close\r\n'
      + 'Content-Type: text/plain; charset=utf-8\r\n'
      + `Content-Length: ${body.length}\r\n\r\n`
      + message,
  )
}

function closeReason(error) {
  const message = error instanceof Error ? error.message : 'RGBA 帧传输失败'
  return Buffer.from(message, 'utf8').subarray(0, 120).toString('utf8')
}

export function createExportWebSocket({ manager, origin }) {
  const server = new WebSocketServer({
    noServer: true,
    maxPayload: 16 * 1024 * 1024,
  })
  let httpServer = null
  let upgradeHandler = null

  async function handleConnection(socket, jobId, jobInfo) {
    let completed = false
    let cancelled = false
    let expectedFrame = jobInfo.nextFrame
    let processing = Promise.resolve()

    const cancelOnce = async () => {
      if (completed || cancelled) return
      cancelled = true
      await manager.cancelJob(jobId).catch(() => undefined)
    }

    const fail = async (error) => {
      await cancelOnce()
      if (socket.readyState === WebSocket.OPEN) {
        socket.close(1008, closeReason(error))
      }
    }

    socket.on('message', (data, isBinary) => {
      processing = processing.then(async () => {
        if (completed) throw new Error('透明导出任务已经完成')
        if (isBinary) {
          const roiFrame = jobInfo.transport === 'raw-rgba-roi-ordered'
            ? (data.subarray(0, 4).toString('ascii') === 'ROI4'
                ? decodeOrderedRoiFrame(data, jobInfo.width, jobInfo.height)
                : {
                    rect: {
                      x: 0,
                      y: 0,
                      width: jobInfo.width,
                      height: jobInfo.height,
                    },
                    pixels: decodeOrderedZeroRleFrame(
                      data,
                      jobInfo.width,
                      jobInfo.height,
                    ),
                  })
            : null
          const decoded = roiFrame
            ? { frameIndex: expectedFrame, pixels: null }
            : jobInfo.transport === 'raw-rgba-rle-ordered'
            ? {
                frameIndex: expectedFrame,
                pixels: decodeOrderedZeroRleFrame(
                  data,
                  jobInfo.width,
                  jobInfo.height,
                ),
              }
            : jobInfo.transport === 'raw-rgba-ordered'
            ? {
                frameIndex: expectedFrame,
                pixels: decodeOrderedRawFrame(
                  data,
                  jobInfo.width,
                  jobInfo.height,
                ),
              }
            : decodeRawFrame(data, jobInfo.width, jobInfo.height)
          const { frameIndex, pixels } = decoded
          if (frameIndex !== expectedFrame) {
            throw new Error('透明导出帧序号不连续')
          }
          if (roiFrame) await manager.appendRoiFrame(jobId, frameIndex, roiFrame)
          else await manager.appendRawFrame(jobId, frameIndex, pixels)
          expectedFrame += 1
          socket.send(JSON.stringify({
            type: 'frame-accepted',
            frameIndex,
          }))
          return
        }

        const message = JSON.parse(data.toString('utf8'))
        if (message?.type !== 'finish') {
          throw new Error('无法识别透明导出控制消息')
        }
        const result = await manager.finishJob(jobId)
        completed = true
        socket.send(JSON.stringify({
          type: 'completed',
          size: result.size,
          encodingMs: result.encodingMs,
        }), () => socket.close(1000, 'completed'))
      }).catch(fail)
    })
    socket.once('close', () => {
      void processing.finally(cancelOnce)
    })
    socket.once('error', () => {
      void cancelOnce()
    })
  }

  return {
    attach(target) {
      if (httpServer) throw new Error('RGBA WebSocket 已连接到本地服务')
      httpServer = target
      upgradeHandler = (request, socket, head) => {
        const url = new URL(request.url ?? '/', origin)
        const match = url.pathname.match(RAW_SOCKET_PATH)
        if (!match) {
          rejectUpgrade(socket, 404, '找不到透明导出 WebSocket')
          return
        }
        if (request.headers.origin !== origin) {
          rejectUpgrade(socket, 403, '禁止跨站导出请求')
          return
        }

        let jobId
        let jobInfo
        try {
          jobId = decodeURIComponent(match[1])
          jobInfo = manager.getJobInfo(jobId)
          if (
            jobInfo.transport !== 'raw-rgba'
            && jobInfo.transport !== 'raw-rgba-ordered'
            && jobInfo.transport !== 'raw-rgba-rle-ordered'
            && jobInfo.transport !== 'raw-rgba-roi-ordered'
          ) {
            throw new Error('当前任务不是 RGBA 导出任务')
          }
        } catch (error) {
          rejectUpgrade(socket, 400, closeReason(error))
          return
        }

        server.handleUpgrade(request, socket, head, (webSocket) => {
          server.emit('connection', webSocket, request)
          void handleConnection(webSocket, jobId, jobInfo)
        })
      }
      target.on('upgrade', upgradeHandler)
    },
    async close() {
      if (httpServer && upgradeHandler) {
        httpServer.off('upgrade', upgradeHandler)
      }
      for (const client of server.clients) client.terminate()
      await new Promise((resolve) => server.close(() => resolve()))
      httpServer = null
      upgradeHandler = null
    },
  }
}

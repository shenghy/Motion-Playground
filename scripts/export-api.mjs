const API_PREFIX = '/__overlay_export__'
const MAX_JSON_BYTES = 16 * 1024
const MAX_PNG_BYTES = 32 * 1024 * 1024

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(JSON.stringify(value))
}

async function readBody(request, limit) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > limit) throw new Error('请求内容过大')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

export function createExportApi({ manager, origin }) {
  async function handle(request, response) {
    const url = new URL(request.url ?? '/', origin)
    if (!url.pathname.startsWith(API_PREFIX)) return false

    try {
      if (
        request.method !== 'GET' &&
        request.headers.origin &&
        request.headers.origin !== origin
      ) {
        sendJson(response, 403, { error: '禁止跨站导出请求' })
        return true
      }

      if (
        request.method === 'GET' &&
        url.pathname === `${API_PREFIX}/capabilities`
      ) {
        sendJson(response, 200, {
          mov: true,
          width: 1920,
          height: 1080,
          fps: 30,
        })
        return true
      }

      if (
        request.method === 'POST' &&
        url.pathname === `${API_PREFIX}/jobs`
      ) {
        if (!request.headers['content-type']?.startsWith('application/json')) {
          throw new Error('创建导出任务需要 JSON')
        }
        const body = JSON.parse(
          (await readBody(request, MAX_JSON_BYTES)).toString('utf8'),
        )
        const job = await manager.createJob(body)
        sendJson(response, 201, { id: job.id })
        return true
      }

      const frameMatch = url.pathname.match(
        /^\/__overlay_export__\/jobs\/([^/]+)\/frames\/(\d+)$/,
      )
      if (request.method === 'PUT' && frameMatch) {
        if (!request.headers['content-type']?.startsWith('image/png')) {
          throw new Error('透明导出帧必须是 PNG')
        }
        const buffer = await readBody(request, MAX_PNG_BYTES)
        await manager.appendFrame(
          decodeURIComponent(frameMatch[1]),
          Number(frameMatch[2]),
          buffer,
        )
        response.writeHead(204, { 'Cache-Control': 'no-store' })
        response.end()
        return true
      }

      const actionMatch = url.pathname.match(
        /^\/__overlay_export__\/jobs\/([^/]+)\/(finish|file)$/,
      )
      if (actionMatch) {
        const id = decodeURIComponent(actionMatch[1])
        const action = actionMatch[2]
        if (request.method === 'POST' && action === 'finish') {
          const result = await manager.finishJob(id)
          sendJson(response, 200, {
            id,
            size: result.size,
            encodingMs: result.encodingMs,
          })
          return true
        }
        if (request.method === 'GET' && action === 'file') {
          const stream = manager.openResult(id)
          response.writeHead(200, {
            'Content-Type': 'video/quicktime',
            'Content-Disposition':
              'attachment; filename="Overlay-transparent.mov"',
            'Cache-Control': 'no-store',
          })
          stream.once('error', () => response.destroy())
          stream.pipe(response)
          return true
        }
      }

      const jobMatch = url.pathname.match(
        /^\/__overlay_export__\/jobs\/([^/]+)$/,
      )
      if (request.method === 'DELETE' && jobMatch) {
        await manager.cancelJob(decodeURIComponent(jobMatch[1]))
        response.writeHead(204, { 'Cache-Control': 'no-store' })
        response.end()
        return true
      }

      sendJson(response, 404, { error: '找不到透明导出接口' })
    } catch (error) {
      sendJson(response, 400, {
        error:
          error instanceof Error ? error.message : '透明导出请求失败',
      })
    }
    return true
  }

  return {
    handle,
    close: () => manager.close(),
  }
}

import { createReadStream } from 'node:fs'
import { realpath, stat } from 'node:fs/promises'
import { createServer as createHttpServer } from 'node:http'
import { createServer as createNetServer } from 'node:net'
import { extname, resolve, sep } from 'node:path'

const CONTENT_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.ttf', 'font/ttf'],
  ['.mp4', 'video/mp4'],
  ['.webm', 'video/webm'],
  ['.mp3', 'audio/mpeg'],
  ['.wav', 'audio/wav'],
  ['.srt', 'application/x-subrip; charset=utf-8'],
])

export function getContentType(filePath) {
  return CONTENT_TYPES.get(extname(filePath).toLowerCase()) ??
    'application/octet-stream'
}

function canListen(host, port) {
  return new Promise((resolvePort) => {
    const probe = createNetServer()
    probe.unref()
    probe.once('error', () => resolvePort(false))
    probe.listen(port, host, () => {
      probe.close(() => resolvePort(true))
    })
  })
}

export async function findAvailablePort(
  host = '127.0.0.1',
  startPort = 4173,
  endPort = 4192,
) {
  for (let port = startPort; port <= endPort; port += 1) {
    if (await canListen(host, port)) {
      return port
    }
  }

  throw new Error(`没有可用端口：${startPort}-${endPort}`)
}

function isInsideRoot(rootDirectory, candidatePath) {
  const rootPrefix = rootDirectory.endsWith(sep)
    ? rootDirectory
    : `${rootDirectory}${sep}`
  return candidatePath === rootDirectory || candidatePath.startsWith(rootPrefix)
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(message)
}

async function findResponseFile(rootDirectory, requestUrl) {
  let pathname
  try {
    const rawPathname = (requestUrl ?? '/').split(/[?#]/, 1)[0]
    pathname = decodeURIComponent(rawPathname)
  } catch {
    return { statusCode: 400 }
  }

  const relativePath = pathname.replace(/^[/\\]+/, '')
  const candidatePath = resolve(rootDirectory, relativePath)
  if (!isInsideRoot(rootDirectory, candidatePath)) {
    return { statusCode: 403 }
  }

  try {
    const candidateStat = await stat(candidatePath)
    if (candidateStat.isFile()) {
      const realCandidatePath = await realpath(candidatePath)
      if (!isInsideRoot(rootDirectory, realCandidatePath)) {
        return { statusCode: 403 }
      }
      return { statusCode: 200, filePath: realCandidatePath }
    }
  } catch {
    // Missing extensionless routes fall through to the SPA entry point.
  }

  if (extname(pathname) === '') {
    const indexPath = resolve(rootDirectory, 'index.html')
    try {
      const indexStat = await stat(indexPath)
      if (indexStat.isFile()) {
        const realIndexPath = await realpath(indexPath)
        if (!isInsideRoot(rootDirectory, realIndexPath)) {
          return { statusCode: 403 }
        }
        return { statusCode: 200, filePath: realIndexPath }
      }
    } catch {
      return { statusCode: 404 }
    }
  }

  return { statusCode: 404 }
}

export async function createLocalStaticServer({
  rootDirectory,
  host = '127.0.0.1',
  port,
  projectId,
}) {
  const absoluteRoot = await realpath(resolve(rootDirectory))
  const indexPath = resolve(absoluteRoot, 'index.html')
  try {
    const indexStat = await stat(indexPath)
    if (!indexStat.isFile()) {
      throw new Error()
    }
  } catch {
    throw new Error(`找不到构建产物：${indexPath}`)
  }

  const server = createHttpServer(async (request, response) => {
    const requestPath = (request.url ?? '/')
      .split('?', 1)[0]
      .replace(/^\/+/, '/')
    if (
      requestPath === '/__overlay_studio_status__'
    ) {
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      })
      response.end(
        JSON.stringify({
          app: 'overlay-studio',
          version: 1,
          projectId,
        }),
      )
      return
    }

    const result = await findResponseFile(absoluteRoot, request.url)
    if (!result.filePath) {
      sendText(
        response,
        result.statusCode,
        result.statusCode === 403 ? '禁止访问' : '找不到文件',
      )
      return
    }

    response.writeHead(200, {
      'Content-Type': getContentType(result.filePath),
      'Cache-Control': 'no-cache',
    })
    if (request.method === 'HEAD') {
      response.end()
      return
    }

    const stream = createReadStream(result.filePath)
    stream.once('error', () => {
      if (!response.headersSent) {
        sendText(response, 500, '读取文件失败')
      } else {
        response.destroy()
      }
    })
    stream.pipe(response)
  })

  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(port, host, () => {
      server.off('error', rejectListen)
      resolveListen()
    })
  })

  return {
    server,
    url: `http://${host}:${port}/`,
    close: () =>
      new Promise((resolveClose, rejectClose) => {
        server.close((error) => {
          if (error) {
            rejectClose(error)
            return
          }
          resolveClose()
        })
      }),
  }
}

import { createServer } from 'node:http'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  createLocalStaticServer,
  findAvailablePort,
  getContentType,
} from './local-server.mjs'

function listen(server, port = 0) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
}

describe('local static server', () => {
  it('falls back when the preferred port is occupied', async () => {
    const blocker = createServer()
    await listen(blocker)
    const address = blocker.address()
    const occupiedPort =
      typeof address === 'object' && address ? address.port : 4173

    try {
      expect(
        await findAvailablePort(
          '127.0.0.1',
          occupiedPort,
          occupiedPort + 2,
        ),
      ).toBe(occupiedPort + 1)
    } finally {
      await close(blocker)
    }
  })

  it('throws a clear error when every candidate port is occupied', async () => {
    const blocker = createServer()
    await listen(blocker)
    const address = blocker.address()
    const occupiedPort =
      typeof address === 'object' && address ? address.port : 4173

    try {
      await expect(
        findAvailablePort('127.0.0.1', occupiedPort, occupiedPort),
      ).rejects.toThrow(`没有可用端口：${occupiedPort}-${occupiedPort}`)
    } finally {
      await close(blocker)
    }
  })

  it('serves assets with MIME types and falls back to index.html', async () => {
    const root = await mkdtemp(join(tmpdir(), 'overlay-server-'))
    await writeFile(join(root, 'index.html'), '<main>Overlay Studio</main>')
    await writeFile(join(root, 'app.js'), 'globalThis.overlay = true')
    const port = await findAvailablePort()
    const local = await createLocalStaticServer({ rootDirectory: root, port })

    try {
      const asset = await fetch(`${local.url}/app.js`)
      expect(asset.status).toBe(200)
      expect(asset.headers.get('content-type')).toContain('javascript')
      expect(await asset.text()).toContain('globalThis.overlay')

      const route = await fetch(`${local.url}/editor`)
      expect(route.status).toBe(200)
      expect(await route.text()).toContain('Overlay Studio')

      const status = await fetch(`${local.url}/__overlay_studio_status__`)
      expect(await status.json()).toEqual({
        app: 'overlay-studio',
        version: 1,
      })
    } finally {
      await local.close()
      await rm(root, { recursive: true, force: true })
    }
  })

  it('does not expose files outside dist', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'overlay-server-'))
    const root = join(parent, 'dist')
    await mkdir(root)
    await writeFile(join(root, 'index.html'), '<main>Overlay Studio</main>')
    await writeFile(join(parent, 'secret.txt'), 'must-not-leak')
    const port = await findAvailablePort()
    const local = await createLocalStaticServer({ rootDirectory: root, port })

    try {
      const response = await fetch(`${local.url}/..%2Fsecret.txt`)
      expect([403, 404]).toContain(response.status)
      expect(await response.text()).not.toContain('must-not-leak')
    } finally {
      await local.close()
      await rm(parent, { recursive: true, force: true })
    }
  })

  it('maps the file types used by the Vite build', () => {
    expect(getContentType('app.js')).toContain('javascript')
    expect(getContentType('style.css')).toBe('text/css; charset=utf-8')
    expect(getContentType('font.woff2')).toBe('font/woff2')
    expect(getContentType('image.png')).toBe('image/png')
    expect(getContentType('video.mp4')).toBe('video/mp4')
  })
})

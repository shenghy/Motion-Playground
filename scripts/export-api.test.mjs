import { Readable } from 'node:stream'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createExportApi } from './export-api.mjs'
import {
  createLocalStaticServer,
  findAvailablePort,
} from './local-server.mjs'

const PNG = Buffer.alloc(33)
Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]).copy(PNG)
PNG.writeUInt32BE(13, 8)
PNG.write('IHDR', 12, 'ascii')
PNG.writeUInt32BE(1920, 16)
PNG.writeUInt32BE(1080, 20)
PNG[24] = 8
PNG[25] = 6

describe('localhost transparent export API', () => {
  it('handles the complete MOV job lifecycle on the same origin', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'overlay-api-'))
    const dist = join(parent, 'dist')
    await mkdir(dist)
    await writeFile(join(dist, 'index.html'), '<main>Overlay</main>')
    const manager = {
      createJob: vi.fn(async () => ({ id: 'job-1' })),
      appendFrame: vi.fn(async () => undefined),
      finishJob: vi.fn(async () => ({ id: 'job-1', size: 3 })),
      openResult: vi.fn(() => Readable.from(Buffer.from('mov'))),
      completeDownload: vi.fn(async () => undefined),
      cancelJob: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    }
    const port = await findAvailablePort()
    const origin = `http://127.0.0.1:${port}`
    const exportApi = createExportApi({ manager, origin })
    const local = await createLocalStaticServer({
      rootDirectory: dist,
      port,
      projectId: 'test',
      exportApi,
    })

    try {
      const capabilities = await fetch(
        `${origin}/__overlay_export__/capabilities`,
      )
      expect(await capabilities.json()).toEqual({
        mov: true,
        width: 1920,
        height: 1080,
        fps: 30,
      })

      const created = await fetch(`${origin}/__overlay_export__/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: origin,
        },
        body: JSON.stringify({
          width: 1920,
          height: 1080,
          fps: 30,
          totalFrames: 1,
        }),
      })
      expect(await created.json()).toEqual({ id: 'job-1' })

      const frame = await fetch(
        `${origin}/__overlay_export__/jobs/job-1/frames/0`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'image/png', Origin: origin },
          body: PNG,
        },
      )
      expect(frame.status).toBe(204)
      expect(manager.appendFrame).toHaveBeenCalledWith(
        'job-1',
        0,
        PNG,
      )

      const finished = await fetch(
        `${origin}/__overlay_export__/jobs/job-1/finish`,
        { method: 'POST', headers: { Origin: origin } },
      )
      expect(finished.status).toBe(200)

      const file = await fetch(
        `${origin}/__overlay_export__/jobs/job-1/file`,
      )
      expect(await file.text()).toBe('mov')
      expect(manager.completeDownload).not.toHaveBeenCalled()

      const discarded = await fetch(
        `${origin}/__overlay_export__/jobs/job-1`,
        { method: 'DELETE', headers: { Origin: origin } },
      )
      expect(discarded.status).toBe(204)
      expect(manager.cancelJob).toHaveBeenCalledWith('job-1')
    } finally {
      await local.close()
      await rm(parent, { recursive: true, force: true })
    }
  })
})

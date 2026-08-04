import { createServer } from 'node:http'
import { once } from 'node:events'
import { WebSocket } from 'ws'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createExportWebSocket } from './export-websocket.mjs'
import { encodeRawFrame } from './raw-frame-protocol.mjs'

const resources = []

async function startBridge(manager) {
  const server = createServer((_request, response) => response.end('ok'))
  const origin = 'http://127.0.0.1'
  const bridge = createExportWebSocket({ manager, origin })
  bridge.attach(server)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  resources.push(async () => {
    await bridge.close()
    await new Promise((resolve) => server.close(resolve))
  })
  return { url: `ws://127.0.0.1:${port}`, origin }
}

function managerFixture(overrides = {}) {
  return {
    getJobInfo: vi.fn(() => ({
      id: 'job-1',
      width: 1,
      height: 2,
      totalFrames: 1,
      nextFrame: 0,
      transport: 'raw-rgba',
      status: 'rendering',
    })),
    appendRawFrame: vi.fn(async () => undefined),
    finishJob: vi.fn(async () => ({ size: 123, encodingMs: 9 })),
    cancelJob: vi.fn(async () => undefined),
    ...overrides,
  }
}

async function nextJson(socket) {
  const [data] = await once(socket, 'message')
  return JSON.parse(data.toString())
}

afterEach(async () => {
  while (resources.length) await resources.pop()()
})

describe('raw export websocket bridge', () => {
  it('acknowledges a frame only after append and completes the job', async () => {
    let releaseAppend
    const appendBlocked = new Promise((resolve) => {
      releaseAppend = resolve
    })
    const manager = managerFixture({
      appendRawFrame: vi.fn(() => appendBlocked),
    })
    const { url, origin } = await startBridge(manager)
    const socket = new WebSocket(`${url}/__overlay_export__/jobs/job-1/raw`, {
      origin,
    })
    await once(socket, 'open')
    socket.send(encodeRawFrame(0, Buffer.alloc(8, 7)))
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(manager.appendRawFrame).toHaveBeenCalledWith(
      'job-1',
      0,
      Buffer.alloc(8, 7),
    )

    releaseAppend()
    await expect(nextJson(socket)).resolves.toEqual({
      type: 'frame-accepted',
      frameIndex: 0,
    })
    socket.send(JSON.stringify({ type: 'finish' }))
    await expect(nextJson(socket)).resolves.toEqual({
      type: 'completed',
      size: 123,
      encodingMs: 9,
    })
    await once(socket, 'close')
    expect(manager.cancelJob).not.toHaveBeenCalled()
  })

  it('assigns continuous indexes to ordered headerless frames', async () => {
    const releases = []
    const manager = managerFixture({
      getJobInfo: vi.fn(() => ({
        id: 'job-1',
        width: 1,
        height: 2,
        totalFrames: 2,
        nextFrame: 0,
        transport: 'raw-rgba-ordered',
        status: 'rendering',
      })),
      appendRawFrame: vi.fn(() => new Promise((resolve) => releases.push(resolve))),
    })
    const { url, origin } = await startBridge(manager)
    const socket = new WebSocket(`${url}/__overlay_export__/jobs/job-1/raw`, {
      origin,
    })
    await once(socket, 'open')
    const first = Buffer.alloc(8, 1)
    const second = Buffer.alloc(8, 2)
    socket.send(first)
    socket.send(second)

    await vi.waitFor(() => expect(manager.appendRawFrame).toHaveBeenCalledTimes(1))
    expect(manager.appendRawFrame).toHaveBeenLastCalledWith('job-1', 0, first)
    releases.shift()()
    await expect(nextJson(socket)).resolves.toEqual({
      type: 'frame-accepted',
      frameIndex: 0,
    })
    await vi.waitFor(() => expect(manager.appendRawFrame).toHaveBeenCalledTimes(2))
    expect(manager.appendRawFrame).toHaveBeenLastCalledWith('job-1', 1, second)
    releases.shift()()
    await expect(nextJson(socket)).resolves.toEqual({
      type: 'frame-accepted',
      frameIndex: 1,
    })
    socket.close()
  })

  it('rejects a cross-origin upgrade', async () => {
    const { url } = await startBridge(managerFixture())
    const socket = new WebSocket(`${url}/__overlay_export__/jobs/job-1/raw`, {
      origin: 'http://evil.example',
    })
    socket.on('error', () => undefined)
    const [, response] = await once(socket, 'unexpected-response')
    expect(response.statusCode).toBe(403)
  })

  it('rejects non-raw jobs before opening the socket', async () => {
    const manager = managerFixture({
      getJobInfo: vi.fn(() => ({ transport: 'png' })),
    })
    const { url, origin } = await startBridge(manager)
    const socket = new WebSocket(`${url}/__overlay_export__/jobs/job-1/raw`, {
      origin,
    })
    socket.on('error', () => undefined)
    const [, response] = await once(socket, 'unexpected-response')
    expect(response.statusCode).toBe(400)
  })

  it('cancels the job after an out-of-order frame closes the socket', async () => {
    const manager = managerFixture()
    const { url, origin } = await startBridge(manager)
    const socket = new WebSocket(`${url}/__overlay_export__/jobs/job-1/raw`, {
      origin,
    })
    await once(socket, 'open')
    socket.send(encodeRawFrame(2, Buffer.alloc(8)))
    const [code] = await once(socket, 'close')
    expect(code).toBe(1008)
    await vi.waitFor(() => expect(manager.cancelJob).toHaveBeenCalledWith('job-1'))
  })
})

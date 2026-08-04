import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { getFontEmbedCSS } from 'html-to-image'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Workbench } from './Workbench'

vi.mock('html-to-image', () => ({
  getFontEmbedCSS: vi.fn(async () => 'embedded-fonts'),
  toBlob: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}))

function loadOneSecondVideo() {
  const file = new File(['video'], 'export-test.mp4', {
    type: 'video/mp4',
  })
  fireEvent.change(screen.getByLabelText('导入本地视频'), {
    target: { files: [file] },
  })
  fireEvent.canPlay(screen.getByTestId('video-validation-probe'))
  const video = screen.getByTestId('presenter-video') as HTMLVideoElement
  Object.defineProperty(video, 'duration', {
    configurable: true,
    value: 1,
  })
  fireEvent.durationChange(video)
  fireEvent.click(
    screen.getByRole('button', { name: '在播放头添加核心指标' }),
  )
}

class WorkbenchSocket {
  static instances: WorkbenchSocket[] = []
  sent: Array<ArrayBuffer | string> = []
  listeners = new Map<string, Set<(event: Event | MessageEvent) => void>>()
  readyState = 0

  constructor() {
    WorkbenchSocket.instances.push(this)
    queueMicrotask(() => {
      this.readyState = 1
      this.emit('open', new Event('open'))
    })
  }

  addEventListener(type: string, listener: (event: Event | MessageEvent) => void) {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: (event: Event | MessageEvent) => void) {
    this.listeners.get(type)?.delete(listener)
  }

  send(data: ArrayBuffer | string) {
    this.sent.push(data)
  }

  close() {
    this.readyState = 3
    this.emit('close', new Event('close'))
  }

  emit(type: string, event: Event | MessageEvent) {
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }
}

describe('Workbench transparent export coordination', () => {
  beforeEach(() => {
    vi.mocked(getFontEmbedCSS).mockClear()
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:export-test'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            mov: true,
            width: 1920,
            height: 1080,
            fps: 30,
            rawRgba: true,
            transport: 'websocket',
          }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete (window as unknown as Record<string, unknown>).showSaveFilePicker
    delete (window as unknown as Record<string, unknown>).showDirectoryPicker
    vi.restoreAllMocks()
  })

  it('locks both export buttons before opening the native MOV picker', async () => {
    let rejectPicker!: (reason: unknown) => void
    const showSaveFilePicker = vi.fn(
      () =>
        new Promise<{
          name: string
          createWritable(): Promise<never>
        }>((_resolve, reject) => {
          rejectPicker = reject
        }),
    )
    Object.assign(window, {
      showSaveFilePicker,
      showDirectoryPicker: vi.fn(),
    })

    render(<Workbench idFactory={() => 'export-card'} />)
    loadOneSecondVideo()

    const movButton = await screen.findByRole('button', {
      name: '导出透明 MOV',
    })
    await waitFor(() => expect(movButton).toBeEnabled())
    fireEvent.click(movButton)
    fireEvent.click(movButton)

    expect(showSaveFilePicker).toHaveBeenCalledTimes(1)
    expect(movButton).toBeDisabled()
    expect(
      screen.getByRole('button', { name: '导出 PNG 序列' }),
    ).toBeDisabled()

    rejectPicker(new DOMException('cancelled', 'AbortError'))
    await screen.findByText('已取消导出')
  })

  it('keeps the cancel button interactive during frame rendering', async () => {
    WorkbenchSocket.instances = []
    vi.stubGlobal('WebSocket', WorkbenchSocket)
    const showSaveFilePicker = vi.fn(async () => ({
      name: 'overlay.mov',
      async createWritable() {
        throw new Error('saving should not start after cancellation')
      },
    }))
    Object.assign(window, {
      showSaveFilePicker,
      showDirectoryPicker: vi.fn(),
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.endsWith('/capabilities')) {
          return new Response(JSON.stringify({
            mov: true,
            rawRgba: true,
            transport: 'websocket',
          }), {
            headers: { 'Content-Type': 'application/json' },
          })
        }
        if (url.endsWith('/jobs') && init?.method === 'POST') {
          return new Response(JSON.stringify({ id: 'rendering-job' }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        if (url.includes('/frames/')) throw new Error('legacy PNG frame upload')
        return new Response(null, { status: 204 })
      }),
    )

    render(<Workbench idFactory={() => 'cancel-card'} />)
    loadOneSecondVideo()
    const movButton = await screen.findByRole('button', {
      name: '导出透明 MOV',
    })
    await waitFor(() => expect(movButton).toBeEnabled())
    fireEvent.click(movButton)

    await waitFor(() => expect(WorkbenchSocket.instances).toHaveLength(1))
    await waitFor(() => expect(WorkbenchSocket.instances[0].sent).toHaveLength(1))

    const cancelButton = await screen.findByRole('button', {
      name: '取消导出',
    })
    expect(cancelButton).toBeEnabled()
    expect(
      screen.getByRole('button', { name: '导出期间不可清空' }),
    ).toBeDisabled()
    expect(document.querySelector('.workspace')).not.toHaveAttribute('inert')
    fireEvent.click(cancelButton)
    expect(getFontEmbedCSS).not.toHaveBeenCalled()

    await screen.findByText('已取消，共生成 0 帧')
  })

  it('starts raw export for a snapshot containing all six motions', async () => {
    WorkbenchSocket.instances = []
    vi.stubGlobal('WebSocket', WorkbenchSocket)
    Object.assign(window, {
      showSaveFilePicker: vi.fn(async () => ({
        name: 'all-motions.mov',
        async createWritable() {
          throw new Error('not reached while the first frame waits for acknowledgement')
        },
      })),
      showDirectoryPicker: vi.fn(),
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.endsWith('/capabilities')) {
          return new Response(JSON.stringify({ mov: true, rawRgba: true, transport: 'websocket' }), {
            headers: { 'Content-Type': 'application/json' },
          })
        }
        if (url.endsWith('/jobs') && init?.method === 'POST') {
          return new Response(JSON.stringify({ id: 'all-motion-job' }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        return new Response(null, { status: 204 })
      }),
    )

    render(<Workbench idFactory={() => crypto.randomUUID()} />)
    loadOneSecondVideo()
    for (const name of [
      '在播放头添加对比卡片',
      '在播放头添加人物信息',
      '在播放头添加柱状对比',
      '在播放头添加环形占比',
      '在播放头添加步骤流程',
    ]) {
      fireEvent.click(screen.getByRole('button', { name }))
    }

    const movButton = await screen.findByRole('button', { name: '导出透明 MOV' })
    await waitFor(() => expect(movButton).toBeEnabled())
    fireEvent.click(movButton)
    await waitFor(() => expect(WorkbenchSocket.instances).toHaveLength(1))
  })
})

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Workbench } from './Workbench'

describe('Workbench transparent export coordination', () => {
  beforeEach(() => {
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
})

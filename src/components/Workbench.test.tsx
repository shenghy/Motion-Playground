import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { motionRegistry } from '../motion/registry'
import type { MotionId, ParameterValues } from '../motion/types'
import type {
  PersistedVideoV1,
  PersistedWorkspaceV1,
  WorkspaceStorage,
} from '../persistence/workspaceStorage'
import { Workbench } from './Workbench'

function mockTimelineRect(track: HTMLElement, left = 100, width = 400) {
  vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
    x: left,
    y: 0,
    left,
    top: 0,
    right: left + width,
    bottom: 60,
    width,
    height: 60,
    toJSON: () => ({}),
  })
}

function dropMotion(track: HTMLElement, motionId: string, clientX: number) {
  fireEvent(track, createMotionDropEvent(motionId, clientX))
}

function createMotionDropEvent(motionId: string, clientX: number) {
  const event = new Event('drop', { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    clientX: { value: clientX },
    dataTransfer: {
      value: {
        types: ['application/x-overlay-motion'],
        getData: () => motionId,
      },
    },
  })
  return event
}

function firePointer(
  target: HTMLElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  pointerId: number,
  clientX: number,
  clientY = 0,
) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    clientX: { value: clientX },
    clientY: { value: clientY },
  })
  fireEvent(target, event)
}

function jsonProjectFile(project: unknown) {
  const text = JSON.stringify(project)
  const file = new File([text], 'overlay-project.json', {
    type: 'application/json',
  })
  Object.defineProperty(file, 'text', {
    configurable: true,
    value: vi.fn().mockResolvedValue(text),
  })
  return file
}

const persistedParameters = Object.fromEntries(
  motionRegistry.map((definition) => [
    definition.id,
    { ...definition.defaults },
  ]),
) as unknown as Record<MotionId, ParameterValues>

function persistedWorkspace(
  overrides: Partial<PersistedWorkspaceV1> = {},
): PersistedWorkspaceV1 {
  return {
    version: 1,
    project: {
      version: 1,
      canvas: { width: 1920, height: 1080 },
      cards: [],
    },
    parametersByMotion: structuredClone(persistedParameters),
    activeId: 'metric-focus',
    showSafeArea: true,
    video: { present: false },
    ...overrides,
  }
}

function createStorageDouble(
  initial: {
    workspace: PersistedWorkspaceV1 | null
    video: PersistedVideoV1 | null
  } = { workspace: null, video: null },
) {
  let state = initial
  const storage: WorkspaceStorage = {
    load: vi.fn(async () => state),
    saveWorkspace: vi.fn(async (workspace) => {
      state = { ...state, workspace }
    }),
    commitVideo: vi.fn(async (video, workspace) => {
      state = { workspace, video }
    }),
    removeVideo: vi.fn(async (workspace) => {
      state = { workspace, video: null }
    }),
    clear: vi.fn(async () => {
      state = { workspace: null, video: null }
    }),
  }
  return { storage, getState: () => state }
}

describe('Workbench', () => {
  const createObjectURL = vi.fn<(object?: Blob | MediaSource) => string>(
    () => 'blob:local-video-preview',
  )
  const revokeObjectURL = vi.fn()

  beforeEach(() => {
    createObjectURL.mockClear()
    revokeObjectURL.mockClear()
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    })
  })

  function loadVideo(duration: number) {
    const file = new File(['timeline-video'], '时间轴视频.mp4', {
      type: 'video/mp4',
    })
    fireEvent.change(screen.getByLabelText('导入本地视频'), {
      target: { files: [file] },
    })
    fireEvent.canPlay(screen.getByTestId('video-validation-probe'))
    const video = screen.getByTestId('presenter-video') as HTMLVideoElement
    Object.defineProperty(video, 'duration', {
      configurable: true,
      value: duration,
    })
    fireEvent.durationChange(video)
    return video
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('places 叙述 first in the component library', () => {
    render(<Workbench />)

    const choices = screen.getAllByRole('button', { name: /^选择组件/ })
    expect(choices[0]).toHaveAccessibleName('选择组件叙述')
    expect(motionRegistry[0]).toMatchObject({
      id: 'narrative',
      index: '01',
      name: '叙述',
    })
  })

  it('hydrates the saved video, cards, parameters, active motion, and safe-area setting', async () => {
    createObjectURL.mockReturnValueOnce('blob:restored-video')
    const metricDefaults = persistedParameters['metric-focus']
    const video: PersistedVideoV1 = {
      version: 1,
      blob: new Blob(['restored-video'], { type: 'video/mp4' }),
      name: '恢复视频.mp4',
      type: 'video/mp4',
      lastModified: 456,
    }
    const workspace = persistedWorkspace({
      project: {
        version: 1,
        canvas: { width: 1920, height: 1080 },
        cards: [
          {
            id: 'restored-card',
            motionId: 'metric-focus',
            start: 0,
            end: 3,
            position: { x: 22, y: 11 },
            zIndex: 0,
            params: {
              ...metricDefaults,
              eyebrow: '刷新恢复',
              value: 777,
            },
          },
        ],
      },
      parametersByMotion: {
        ...structuredClone(persistedParameters),
        'compare-split': {
          ...persistedParameters['compare-split'],
          title: '已保存组件参数',
        },
      },
      activeId: 'compare-split',
      showSafeArea: false,
      video: {
        present: true,
        name: video.name,
        type: video.type,
        lastModified: video.lastModified,
      },
    })
    const { storage } = createStorageDouble({ workspace, video })
    const { container } = render(<Workbench storage={storage} />)

    await waitFor(() => {
      expect(container.querySelectorAll('.timeline-editor__card')).toHaveLength(1)
    })

    expect(screen.getByText('恢复视频.mp4')).toBeInTheDocument()
    expect(screen.getByTestId('presenter-video')).toHaveAttribute(
      'src',
      'blob:restored-video',
    )
    expect(screen.getByText('刷新恢复')).toBeInTheDocument()
    expect(screen.getByTestId('overlay-card-restored-card')).toHaveStyle({
      transform: 'translate(22%, 11%)',
    })
    expect(
      container.querySelector('.rail-item[aria-pressed="true"] strong'),
    ).toHaveTextContent(
      motionRegistry.find(({ id }) => id === 'compare-split')?.name ?? '',
    )
    expect(container.querySelector('[role="switch"]')).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })

  it('reports invalid or unreadable persisted workspaces without restoring cards', async () => {
    const invalidStorage = createStorageDouble({
      workspace: {
        ...persistedWorkspace(),
        version: 2,
      } as unknown as PersistedWorkspaceV1,
      video: null,
    }).storage
    const invalidView = render(<Workbench storage={invalidStorage} />)

    expect(
      await screen.findByText('本地工作区数据无效'),
    ).toBeInTheDocument()
    expect(
      invalidView.container.querySelectorAll('.timeline-editor__card'),
    ).toHaveLength(0)
    invalidView.unmount()

    const failedStorage = createStorageDouble().storage
    vi.mocked(failedStorage.load).mockRejectedValueOnce(new Error('blocked'))
    render(<Workbench storage={failedStorage} />)

    expect(
      await screen.findByText('本地工作区恢复失败'),
    ).toBeInTheDocument()
  })

  it('autosaves changed component parameters after hydration', async () => {
    const { storage, getState } = createStorageDouble()
    render(<Workbench storage={storage} />)

    await waitFor(() => expect(storage.load).toHaveBeenCalledTimes(1))
    fireEvent.change(screen.getByLabelText('核心数值'), {
      target: { value: '615' },
    })

    await waitFor(
      () => expect(storage.saveWorkspace).toHaveBeenCalled(),
      { timeout: 1500 },
    )
    expect(
      getState().workspace?.parametersByMotion['metric-focus'].value,
    ).toBe(615)
  })

  it('keeps autosave active under the production StrictMode wrapper', async () => {
    const { storage } = createStorageDouble()
    render(
      <StrictMode>
        <Workbench storage={storage} />
      </StrictMode>,
    )
    await waitFor(() => expect(storage.load).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText('指标名称'), {
      target: { value: '严格模式仍保存' },
    })

    await waitFor(
      () => expect(storage.saveWorkspace).toHaveBeenCalled(),
      { timeout: 1500 },
    )
  })

  it('stores an accepted video and its workspace metadata together', async () => {
    const { storage, getState } = createStorageDouble()
    render(<Workbench storage={storage} />)
    await waitFor(() => expect(storage.load).toHaveBeenCalledTimes(1))

    const file = new File(['remember-me'], '刷新保留.mp4', {
      type: 'video/mp4',
      lastModified: 987,
    })
    fireEvent.change(screen.getByLabelText('导入本地视频'), {
      target: { files: [file] },
    })
    fireEvent.canPlay(screen.getByTestId('video-validation-probe'))

    await waitFor(() => expect(storage.commitVideo).toHaveBeenCalledTimes(1))
    expect(getState().video).toMatchObject({
      version: 1,
      name: '刷新保留.mp4',
      type: 'video/mp4',
      lastModified: 987,
    })
    expect(getState().workspace?.video).toEqual({
      present: true,
      name: '刷新保留.mp4',
      type: 'video/mp4',
      lastModified: 987,
    })
  })

  it('clears the entire restored workspace only after confirmation', async () => {
    createObjectURL.mockReturnValueOnce('blob:clearable-video')
    const workspace = persistedWorkspace({
      project: {
        version: 1,
        canvas: { width: 1920, height: 1080 },
        cards: [
          {
            id: 'clear-me',
            motionId: 'metric-focus',
            start: 0,
            end: 3,
            position: { x: 8, y: 9 },
            zIndex: 0,
            params: persistedParameters['metric-focus'],
          },
        ],
      },
      video: {
        present: true,
        name: '待清空.mp4',
        type: 'video/mp4',
        lastModified: 10,
      },
    })
    const video: PersistedVideoV1 = {
      version: 1,
      blob: new Blob(['clear']),
      name: '待清空.mp4',
      type: 'video/mp4',
      lastModified: 10,
    }
    const { storage, getState } = createStorageDouble({ workspace, video })
    render(<Workbench storage={storage} />)
    await screen.findByText('待清空.mp4')

    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false)
    fireEvent.click(screen.getByRole('button', { name: '清空工作区' }))
    expect(storage.clear).not.toHaveBeenCalled()
    expect(screen.getByText('待清空.mp4')).toBeInTheDocument()

    confirm.mockReturnValueOnce(true)
    fireEvent.click(screen.getByRole('button', { name: '清空工作区' }))

    await waitFor(() => expect(storage.clear).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(screen.queryByText('待清空.mp4')).not.toBeInTheDocument(),
    )
    expect(document.querySelectorAll('.timeline-editor__card')).toHaveLength(0)
    expect(getState()).toEqual({ workspace: null, video: null })
    expect(screen.getByRole('switch', { name: '显示人物安全区' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('waits for an in-flight autosave before clearing persisted data', async () => {
    let releaseSave!: () => void
    const saveBlocked = new Promise<void>((resolve) => {
      releaseSave = resolve
    })
    const { storage, getState } = createStorageDouble()
    vi.mocked(storage.saveWorkspace).mockImplementationOnce(() => saveBlocked)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<Workbench storage={storage} />)
    await waitFor(() => expect(storage.load).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText('指标名称'), {
      target: { value: '即将清空' },
    })
    await waitFor(
      () => expect(storage.saveWorkspace).toHaveBeenCalled(),
      { timeout: 1500 },
    )
    fireEvent.click(screen.getByRole('button', { name: '清空工作区' }))

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(storage.clear).not.toHaveBeenCalled()
    releaseSave()
    await waitFor(() => expect(storage.clear).toHaveBeenCalledTimes(1))
    expect(getState()).toEqual({ workspace: null, video: null })
  })

  it('commits a video after earlier autosaves so metadata cannot be overwritten', async () => {
    let releaseSave!: () => void
    const saveBlocked = new Promise<void>((resolve) => {
      releaseSave = resolve
    })
    const { storage } = createStorageDouble()
    vi.mocked(storage.saveWorkspace).mockImplementationOnce(() => saveBlocked)
    render(<Workbench storage={storage} />)
    await waitFor(() => expect(storage.load).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText('指标名称'), {
      target: { value: '先保存参数' },
    })
    await waitFor(
      () => expect(storage.saveWorkspace).toHaveBeenCalled(),
      { timeout: 1500 },
    )
    const file = new File(['ordered-video'], '有序提交.mp4', {
      type: 'video/mp4',
    })
    fireEvent.change(screen.getByLabelText('导入本地视频'), {
      target: { files: [file] },
    })
    fireEvent.canPlay(screen.getByTestId('video-validation-probe'))

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(storage.commitVideo).not.toHaveBeenCalled()
    releaseSave()
    await waitFor(() => expect(storage.commitVideo).toHaveBeenCalledTimes(1))
  })

  it('clears only after an in-flight video commit has settled', async () => {
    let releaseCommit!: () => void
    const commitBlocked = new Promise<void>((resolve) => {
      releaseCommit = resolve
    })
    const { storage, getState } = createStorageDouble()
    vi.mocked(storage.commitVideo).mockImplementationOnce(
      async (video, workspace) => {
        await commitBlocked
        getState().workspace = workspace
        getState().video = video
      },
    )
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<Workbench storage={storage} />)
    await waitFor(() => expect(storage.load).toHaveBeenCalled())

    const file = new File(['slow-video'], '慢写入.mp4', {
      type: 'video/mp4',
    })
    fireEvent.change(screen.getByLabelText('导入本地视频'), {
      target: { files: [file] },
    })
    fireEvent.canPlay(screen.getByTestId('video-validation-probe'))
    await waitFor(() => expect(storage.commitVideo).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: '清空工作区' }))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(storage.clear).not.toHaveBeenCalled()

    releaseCommit()
    await waitFor(() => expect(storage.clear).toHaveBeenCalledTimes(1))
    expect(getState()).toEqual({ workspace: null, video: null })
  })

  it('preserves edits made while an earlier save and video commit are queued', async () => {
    let releaseSave!: () => void
    const saveBlocked = new Promise<void>((resolve) => {
      releaseSave = resolve
    })
    const { storage, getState } = createStorageDouble()
    vi.mocked(storage.saveWorkspace).mockImplementationOnce(() => saveBlocked)
    render(<Workbench storage={storage} />)
    await waitFor(() => expect(storage.load).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText('指标名称'), {
      target: { value: '较早快照' },
    })
    await waitFor(
      () => expect(storage.saveWorkspace).toHaveBeenCalledTimes(1),
      { timeout: 1500 },
    )

    const file = new File(['ordered'], '顺序保护.mp4', {
      type: 'video/mp4',
    })
    fireEvent.change(screen.getByLabelText('导入本地视频'), {
      target: { files: [file] },
    })
    fireEvent.canPlay(screen.getByTestId('video-validation-probe'))
    fireEvent.change(screen.getByLabelText('指标名称'), {
      target: { value: '最后修改必须保留' },
    })
    await new Promise((resolve) => setTimeout(resolve, 350))

    releaseSave()
    await waitFor(
      () =>
        expect(
          getState().workspace?.parametersByMotion['metric-focus'].eyebrow,
        ).toBe('最后修改必须保留'),
      { timeout: 1500 },
    )
    expect(getState().workspace?.video.present).toBe(true)
    expect(getState().video?.name).toBe('顺序保护.mp4')
  })

  it('ignores new persistence writes while a confirmed clear is waiting', async () => {
    let releaseCommit!: () => void
    const commitBlocked = new Promise<void>((resolve) => {
      releaseCommit = resolve
    })
    const { storage, getState } = createStorageDouble()
    vi.mocked(storage.commitVideo).mockImplementationOnce(
      async (video, workspace) => {
        await commitBlocked
        getState().workspace = workspace
        getState().video = video
      },
    )
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<Workbench storage={storage} />)
    await waitFor(() => expect(storage.load).toHaveBeenCalled())

    const file = new File(['blocked-clear'], '清空锁定.mp4', {
      type: 'video/mp4',
    })
    fireEvent.change(screen.getByLabelText('导入本地视频'), {
      target: { files: [file] },
    })
    fireEvent.canPlay(screen.getByTestId('video-validation-probe'))
    await waitFor(() => expect(storage.commitVideo).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: '清空工作区' }))
    fireEvent.change(screen.getByLabelText('指标名称'), {
      target: { value: '等待清空时的修改' },
    })
    await new Promise((resolve) => setTimeout(resolve, 350))
    releaseCommit()

    await waitFor(() => expect(storage.clear).toHaveBeenCalledTimes(1))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(storage.saveWorkspace).not.toHaveBeenCalled()
    expect(getState()).toEqual({ workspace: null, video: null })
  })

  it('keeps the saved workspace consistent when a queued clear fails', async () => {
    let releaseCommit!: () => void
    const commitBlocked = new Promise<void>((resolve) => {
      releaseCommit = resolve
    })
    const { storage, getState } = createStorageDouble()
    vi.mocked(storage.commitVideo).mockImplementationOnce(
      async (video, workspace) => {
        await commitBlocked
        getState().workspace = workspace
        getState().video = video
      },
    )
    vi.mocked(storage.clear).mockRejectedValueOnce(new Error('disk error'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<Workbench storage={storage} />)
    await waitFor(() => expect(storage.load).toHaveBeenCalled())

    const file = new File(['clear-fails'], '保留原状态.mp4', {
      type: 'video/mp4',
    })
    fireEvent.change(screen.getByLabelText('导入本地视频'), {
      target: { files: [file] },
    })
    fireEvent.canPlay(screen.getByTestId('video-validation-probe'))
    await waitFor(() => expect(storage.commitVideo).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: '清空工作区' }))
    expect(document.querySelector('.workbench')).toHaveAttribute(
      'aria-busy',
      'true',
    )
    fireEvent.change(screen.getByLabelText('指标名称'), {
      target: { value: '不应进入半保存状态' },
    })
    expect(screen.getByLabelText('指标名称')).toHaveValue('季度增长')

    releaseCommit()
    expect(await screen.findByText('清空工作区失败，请稍后重试')).toBeInTheDocument()
    expect(document.querySelector('.workbench')).toHaveAttribute(
      'aria-busy',
      'false',
    )
    expect(getState().workspace?.video.present).toBe(true)
    expect(getState().video?.name).toBe('保留原状态.mp4')
  })

  it('opens the Chinese component library and switches between all motions', () => {
    const { container } = render(<Workbench />)
    const expectPencilStyle = () => {
      expect(container.querySelector('.motion-canvas')).toHaveAttribute(
        'data-pencil-style',
        'silver-on-black',
      )
    }

    expect(screen.getByText('系统就绪')).toBeInTheDocument()
    expect(screen.getByText('参数设置')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '选择组件核心指标' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('1920 × 1080')).toBeInTheDocument()
    expect(screen.getByText('1.4秒')).toBeInTheDocument()
    expectPencilStyle()

    fireEvent.click(screen.getByRole('button', { name: '选择组件叙述' }))
    expect(screen.getByText('把复杂的工作')).toBeInTheDocument()
    expect(screen.getByText('交给自动化')).toBeInTheDocument()
    expectPencilStyle()

    fireEvent.click(screen.getByRole('button', { name: '选择组件对比卡片' }))
    expect(screen.getByText('提升 2.05 倍')).toBeInTheDocument()
    expectPencilStyle()

    fireEvent.click(screen.getByRole('button', { name: '选择组件人物信息' }))
    expect(screen.getByText('公开构建者')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /QuoteLockup/ })).not.toBeInTheDocument()
    expectPencilStyle()

    expect(
      screen.getAllByRole('button', {
        name: /^选择组件(?:叙述|核心指标|对比卡片|人物信息|柱状对比|环形占比|步骤流程)$/,
      }),
    ).toHaveLength(7)

    fireEvent.click(screen.getByRole('button', { name: '选择组件柱状对比' }))
    expect(screen.getByText('季度增长')).toBeInTheDocument()
    expectPencilStyle()

    fireEvent.click(screen.getByRole('button', { name: '选择组件环形占比' }))
    expect(screen.getByText('用户构成')).toBeInTheDocument()
    expectPencilStyle()

    fireEvent.click(screen.getByRole('button', { name: '选择组件步骤流程' }))
    expect(screen.getByText('发布流程')).toBeInTheDocument()
    expectPencilStyle()

    expect(screen.queryByText('MOTION PLAYGROUND')).not.toBeInTheDocument()
    expect(screen.queryByText('COMPONENTS')).not.toBeInTheDocument()
    expect(screen.queryByText('PARAMETERS')).not.toBeInTheDocument()
    expect(screen.queryByText('SYSTEM READY')).not.toBeInTheDocument()
  })

  it('applies live changes and restarts playback', () => {
    render(<Workbench />)
    const stage = screen.getByTestId('preview-stage')
    const initialKey = stage.dataset.playbackKey

    fireEvent.change(screen.getByLabelText('核心数值'), { target: { value: '320' } })
    expect(screen.getByLabelText('核心指标 +320%')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '重新播放' }))
    expect(stage.dataset.playbackKey).not.toBe(initialKey)

    fireEvent.click(screen.getByRole('button', { name: '恢复默认' }))
    expect(screen.getByLabelText('核心指标 +248%')).toBeInTheDocument()
  })

  it('shows the presenter background and lets the safety guide be hidden', () => {
    render(<Workbench />)

    expect(
      screen.getByRole('img', { name: '口播人物参考背景' }),
    ).toHaveAttribute('src', '/reference-standing.png')
    expect(screen.getByTestId('presenter-safe-area')).toBeInTheDocument()
    expect(screen.getByTestId('subtitle-safe-area')).toHaveTextContent(
      '字幕安全区 / 150像素',
    )

    const toggle = screen.getByRole('switch', { name: '显示人物安全区' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(toggle)

    expect(screen.queryByTestId('presenter-safe-area')).not.toBeInTheDocument()
    expect(screen.queryByTestId('subtitle-safe-area')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: '口播人物参考背景' })).toBeInTheDocument()
  })

  it('imports a local video and keeps it mounted while motion copy changes', () => {
    render(<Workbench />)
    const file = new File(['video-bytes'], '我的口播.mp4', { type: 'video/mp4' })

    fireEvent.change(screen.getByLabelText('导入本地视频'), {
      target: { files: [file] },
    })
    expect(screen.getByText('正在检查')).toBeInTheDocument()
    const validationProbe = screen.getByTestId('video-validation-probe')
    expect(validationProbe).toHaveAttribute('preload', 'auto')
    fireEvent.canPlay(validationProbe)

    const video = screen.getByTestId('presenter-video') as HTMLVideoElement
    expect(video).toHaveAttribute('src', 'blob:local-video-preview')
    expect(video).toHaveAttribute('autoplay')
    expect(video).toHaveAttribute('loop')
    expect(video).toHaveAttribute('playsinline')
    expect(video.muted).toBe(true)
    expect(screen.getByText('我的口播.mp4')).toBeInTheDocument()
    expect(
      screen.queryByRole('img', { name: '口播人物参考背景' }),
    ).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('指标名称'), {
      target: { value: '实时文字预览' },
    })
    expect(screen.getByTestId('presenter-video')).toBe(video)

    fireEvent.click(screen.getByRole('button', { name: '选择组件对比卡片' }))
    expect(screen.getByTestId('presenter-video')).toBe(video)

    fireEvent.click(screen.getByRole('button', { name: '移除视频' }))
    expect(screen.queryByTestId('presenter-video')).not.toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: '口播人物参考背景' }),
    ).toBeInTheDocument()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:local-video-preview')
  })

  it('controls video playback, sound, progress, and keeps state across motions', () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockResolvedValue(undefined)
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, 'pause')
      .mockImplementation(() => undefined)
    render(<Workbench />)
    const file = new File(['video-with-audio'], '带声音口播.mp4', {
      type: 'video/mp4',
    })

    fireEvent.change(screen.getByLabelText('导入本地视频'), {
      target: { files: [file] },
    })
    fireEvent.canPlay(screen.getByTestId('video-validation-probe'))

    const video = screen.getByTestId('presenter-video') as HTMLVideoElement
    Object.defineProperty(video, 'duration', {
      configurable: true,
      value: 125,
    })
    fireEvent.durationChange(video)
    video.currentTime = 35
    fireEvent.timeUpdate(video)
    fireEvent.play(video)

    expect(screen.getByRole('button', { name: '暂停视频' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '开启声音' })).toBeInTheDocument()
    expect(screen.getByLabelText('视频进度')).toHaveAttribute('max', '125')
    expect(screen.getByLabelText('视频进度')).toHaveValue('35')
    expect(screen.getByText('00:35 / 02:05')).toBeInTheDocument()

    Object.defineProperty(video, 'paused', {
      configurable: true,
      value: false,
    })
    fireEvent.click(screen.getByRole('button', { name: '暂停视频' }))
    expect(pause).toHaveBeenCalled()
    fireEvent.pause(video)

    Object.defineProperty(video, 'paused', {
      configurable: true,
      value: true,
    })
    fireEvent.click(screen.getByRole('button', { name: '播放视频' }))
    expect(play).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '开启声音' }))
    expect(video.muted).toBe(false)
    expect(screen.getByRole('button', { name: '静音' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('视频进度'), {
      target: { value: '50' },
    })
    expect(video.currentTime).toBe(50)
    expect(screen.getByText('00:50 / 02:05')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('指标名称'), {
      target: { value: '声音实时预览' },
    })
    fireEvent.click(screen.getByRole('button', { name: '选择组件对比卡片' }))

    expect(screen.getByTestId('presenter-video')).toBe(video)
    expect(video.muted).toBe(false)
    expect(screen.getByLabelText('视频进度')).toBeInTheDocument()

  })

  it('ignores a rejected play promise from a replaced video source', async () => {
    createObjectURL
      .mockReturnValueOnce('blob:old-playback-source')
      .mockReturnValueOnce('blob:new-playback-source')
    let rejectOldPlayback!: (reason?: unknown) => void
    const oldPlayback = new Promise<void>((_, reject) => {
      rejectOldPlayback = reject
    })
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockReturnValue(oldPlayback)
    render(<Workbench />)
    const oldFile = new File(['old'], '旧视频.mp4', { type: 'video/mp4' })
    const newFile = new File(['new'], '新视频.mp4', { type: 'video/mp4' })

    fireEvent.change(screen.getByLabelText('导入本地视频'), {
      target: { files: [oldFile] },
    })
    fireEvent.canPlay(screen.getByTestId('video-validation-probe'))
    const oldVideo = screen.getByTestId('presenter-video')
    Object.defineProperty(oldVideo, 'paused', {
      configurable: true,
      value: true,
    })
    fireEvent.click(screen.getByRole('button', { name: '播放视频' }))

    fireEvent.change(screen.getByLabelText('导入本地视频'), {
      target: { files: [newFile] },
    })
    fireEvent.canPlay(screen.getByTestId('video-validation-probe'))
    const newVideo = screen.getByTestId('presenter-video') as HTMLVideoElement
    Object.defineProperty(newVideo, 'duration', {
      configurable: true,
      value: 60,
    })
    fireEvent.durationChange(newVideo)
    newVideo.currentTime = 10
    fireEvent.timeUpdate(newVideo)
    fireEvent.play(newVideo)

    await act(async () => {
      rejectOldPlayback(new Error('旧视频播放被中断'))
      await oldPlayback.catch(() => undefined)
    })

    expect(screen.getByTestId('presenter-video')).toBe(newVideo)
    expect(screen.getByRole('button', { name: '暂停视频' })).toBeInTheDocument()
    expect(screen.getByLabelText('视频进度')).toHaveAttribute('max', '60')
    expect(screen.getByLabelText('视频进度')).toHaveValue('10')
  })

  it('normalizes non-finite media time values in the playback controls', () => {
    render(<Workbench />)
    const file = new File(['video'], '异常时长.mp4', { type: 'video/mp4' })

    fireEvent.change(screen.getByLabelText('导入本地视频'), {
      target: { files: [file] },
    })
    fireEvent.canPlay(screen.getByTestId('video-validation-probe'))
    const video = screen.getByTestId('presenter-video')
    Object.defineProperty(video, 'duration', {
      configurable: true,
      value: Number.POSITIVE_INFINITY,
    })
    Object.defineProperty(video, 'currentTime', {
      configurable: true,
      value: Number.NaN,
      writable: true,
    })

    fireEvent.durationChange(video)
    fireEvent.timeUpdate(video)

    expect(screen.getByLabelText('视频进度')).toHaveAttribute('max', '0')
    expect(screen.getByLabelText('视频进度')).toHaveValue('0')
    expect(screen.getByText('00:00 / 00:00')).toBeInTheDocument()
  })

  it('rejects a non-video file without replacing the reference background', () => {
    render(<Workbench />)
    const file = new File(['not-video'], '文档.txt', { type: 'text/plain' })

    fireEvent.change(screen.getByLabelText('导入本地视频'), {
      target: { files: [file] },
    })

    expect(screen.getByText('请选择有效的视频文件')).toBeInTheDocument()
    expect(screen.queryByTestId('presenter-video')).not.toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: '口播人物参考背景' }),
    ).toBeInTheDocument()
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it('revokes replaced and active video URLs to release browser memory', () => {
    createObjectURL
      .mockReturnValueOnce('blob:first-video')
      .mockReturnValueOnce('blob:second-video')
    const { unmount } = render(<Workbench />)
    const firstFile = new File(['first'], '第一段.mp4', { type: 'video/mp4' })
    const secondFile = new File(['second'], '第二段.mp4', { type: 'video/mp4' })

    fireEvent.change(screen.getByLabelText('导入本地视频'), {
      target: { files: [firstFile] },
    })
    fireEvent.canPlay(screen.getByTestId('video-validation-probe'))
    fireEvent.change(screen.getByLabelText('导入本地视频'), {
      target: { files: [secondFile] },
    })
    fireEvent.canPlay(screen.getByTestId('video-validation-probe'))

    expect(screen.getByTestId('presenter-video')).toHaveAttribute(
      'src',
      'blob:second-video',
    )
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:first-video')

    unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:second-video')
  })

  it('keeps the current preview when a replacement video cannot be decoded', () => {
    createObjectURL
      .mockReturnValueOnce('blob:working-video')
      .mockReturnValueOnce('blob:broken-video')
    render(<Workbench />)
    const workingFile = new File(['working'], '可播放.mp4', { type: 'video/mp4' })
    const brokenFile = new File(['broken'], '损坏视频.mp4', { type: 'video/mp4' })

    fireEvent.change(screen.getByLabelText('导入本地视频'), {
      target: { files: [workingFile] },
    })
    fireEvent.canPlay(screen.getByTestId('video-validation-probe'))
    const workingVideo = screen.getByTestId('presenter-video')

    fireEvent.change(screen.getByLabelText('导入本地视频'), {
      target: { files: [brokenFile] },
    })
    expect(screen.getByTestId('presenter-video')).toBe(workingVideo)
    fireEvent.error(screen.getByTestId('video-validation-probe'))

    expect(screen.getByText('无法读取此视频，请更换文件')).toBeInTheDocument()
    expect(screen.getByTestId('presenter-video')).toBe(workingVideo)
    expect(screen.getByTestId('presenter-video')).toHaveAttribute(
      'src',
      'blob:working-video',
    )
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:broken-video')
    expect(revokeObjectURL).not.toHaveBeenCalledWith('blob:working-video')
  })

  it('cancels a pending candidate when the latest selection is invalid', () => {
    createObjectURL.mockReturnValueOnce('blob:pending-video')
    render(<Workbench />)
    const pendingFile = new File(['pending'], '等待检查.mp4', { type: 'video/mp4' })
    const invalidFile = new File(['invalid'], '不是视频.txt', { type: 'text/plain' })

    fireEvent.change(screen.getByLabelText('导入本地视频'), {
      target: { files: [pendingFile] },
    })
    expect(screen.getByTestId('video-validation-probe')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('导入本地视频'), {
      target: { files: [invalidFile] },
    })

    expect(screen.queryByTestId('video-validation-probe')).not.toBeInTheDocument()
    expect(screen.getByText('请选择有效的视频文件')).toBeInTheDocument()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:pending-video')
  })

  it('falls back to the reference image if an active video later fails', () => {
    createObjectURL.mockReturnValueOnce('blob:runtime-failure')
    render(<Workbench />)
    const file = new File(['video'], '后续损坏.mp4', { type: 'video/mp4' })

    fireEvent.change(screen.getByLabelText('导入本地视频'), {
      target: { files: [file] },
    })
    fireEvent.canPlay(screen.getByTestId('video-validation-probe'))
    fireEvent.error(screen.getByTestId('presenter-video'))

    expect(screen.getByText('视频播放失败，请更换文件')).toBeInTheDocument()
    expect(screen.queryByTestId('presenter-video')).not.toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: '口播人物参考背景' }),
    ).toBeInTheDocument()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:runtime-failure')
  })

  it('refuses timeline drops and keyboard adds until a usable video is loaded', () => {
    render(<Workbench />)
    const track = screen.getByTestId('timeline-track')
    mockTimelineRect(track)

    expect(screen.getByText('请先导入视频')).toBeInTheDocument()
    dropMotion(track, 'metric-focus', 200)
    fireEvent.click(
      screen.getByRole('button', { name: '在播放头添加核心指标' }),
    )

    expect(
      screen.queryByRole('button', {
        name: '选择核心指标片段，可用左右方向键微调时间',
      }),
    ).not.toBeInTheDocument()
  })

  it('reports a loaded video that is too short for an overlay card', () => {
    const idFactory = vi.fn(() => 'unused-card')
    render(<Workbench idFactory={idFactory} />)
    loadVideo(0.1)
    const track = screen.getByTestId('timeline-track')
    mockTimelineRect(track)

    expect(screen.getByText('视频时长不足，无法添加动效')).toBeInTheDocument()
    dropMotion(track, 'metric-focus', 100)
    fireEvent.click(
      screen.getByRole('button', { name: '在播放头添加核心指标' }),
    )
    expect(idFactory).not.toHaveBeenCalled()
  })

  it('creates selected unique cards with defaults, z-order, and end clamping', () => {
    const ids = ['uuid-1', 'uuid-2', 'uuid-3']
    render(<Workbench idFactory={() => ids.shift() ?? 'fallback-id'} />)
    const video = loadVideo(10)
    const track = screen.getByTestId('timeline-track')
    mockTimelineRect(track)

    dropMotion(track, 'metric-focus', 180)
    dropMotion(track, 'compare-split', 180)
    dropMotion(track, 'metric-focus', 500)

    const clips = document.querySelectorAll<HTMLElement>('.timeline-editor__card')
    expect(clips).toHaveLength(3)
    expect(clips[0]).toHaveStyle({ left: '20%', width: '30%' })
    expect(Number.parseFloat(clips[2].style.left)).toBeCloseTo(98)
    expect(Number.parseFloat(clips[2].style.width)).toBeCloseTo(2)
    expect(screen.getByLabelText('核心数值')).toHaveValue('248')
    expect(
      screen.getAllByRole('button', {
        name: '选择核心指标片段，可用左右方向键微调时间',
      })[1],
    ).toHaveAttribute('aria-pressed', 'true')

    video.currentTime = 2
    fireEvent.timeUpdate(video)
    const overlays = screen.getAllByTestId(/^overlay-card-/)
    expect(overlays.map((overlay) => overlay.dataset.overlayCardId)).toEqual([
      'uuid-1',
      'uuid-2',
    ])
    expect(overlays[0]).toHaveStyle({ zIndex: '0' })
    expect(overlays[1]).toHaveStyle({ zIndex: '1' })
  })

  it('supports a keyboard-only add, timeline nudge, and overlay position workflow', async () => {
    const user = userEvent.setup()
    render(<Workbench idFactory={() => 'keyboard-card'} />)
    const video = loadVideo(10)
    video.currentTime = 2
    fireEvent.timeUpdate(video)

    const addButton = screen.getByRole('button', {
      name: '在播放头添加核心指标',
    })
    addButton.focus()
    await user.keyboard('{Enter}')

    const clip = screen.getByRole('button', {
      name: '选择核心指标片段，可用左右方向键微调时间',
    })
    expect(clip.parentElement).toHaveStyle({ left: '20%', width: '30%' })
    expect(screen.getByLabelText('核心数值')).toHaveValue('248')

    clip.focus()
    await user.keyboard('{ArrowRight}{Shift>}{ArrowLeft}{/Shift}')
    expect(clip.parentElement).toHaveStyle({ left: '16%', width: '30%' })

    fireEvent.change(screen.getByLabelText('核心数值'), {
      target: { value: '320' },
    })
    const overlay = screen.getByTestId('overlay-card-keyboard-card')
    overlay.focus()
    await user.keyboard('{ArrowRight}{Shift>}{ArrowDown}{/Shift}')
    expect(screen.getByTestId('overlay-card-keyboard-card')).toHaveStyle({
      transform: 'translate(1%, 5%)',
    })

    await user.click(
      screen.getByRole('button', { name: '选择组件对比卡片' }),
    )
    expect(document.querySelectorAll('.timeline-editor__card')).toHaveLength(1)
    await user.click(clip)
    expect(screen.getByLabelText('核心数值')).toHaveValue('320')
  })

  it('double-clicks a component to add one card at the current playhead', async () => {
    const user = userEvent.setup()
    const idFactory = vi.fn(() => 'double-click-card')
    const { container } = render(<Workbench idFactory={idFactory} />)
    const video = loadVideo(10)
    video.currentTime = 2
    fireEvent.timeUpdate(video)
    const metricButton = container.querySelector<HTMLButtonElement>(
      '.rail-item-shell .rail-item',
    )

    expect(metricButton).not.toBeNull()
    await user.dblClick(metricButton as HTMLButtonElement)

    expect(idFactory).toHaveBeenCalledTimes(1)
    const clips = container.querySelectorAll<HTMLElement>('.timeline-editor__card')
    expect(clips).toHaveLength(1)
    expect(clips[0]).toHaveStyle({ left: '20%', width: '30%' })
  })

  it('deletes the selected card with Delete unless an editable control has focus', async () => {
    const user = userEvent.setup()
    const ids = ['delete-card', 'guarded-card']
    const { container } = render(
      <Workbench idFactory={() => ids.shift() ?? 'fallback-card'} />,
    )
    loadVideo(10)
    const addButton = container.querySelector<HTMLButtonElement>('.rail-item__add')

    expect(addButton).not.toBeNull()
    await user.click(addButton as HTMLButtonElement)
    expect(container.querySelectorAll('.timeline-editor__card')).toHaveLength(1)

    await user.keyboard('{Delete}')
    expect(container.querySelectorAll('.timeline-editor__card')).toHaveLength(0)

    await user.click(addButton as HTMLButtonElement)
    const textInput = container.querySelector<HTMLInputElement>(
      '.control-field input:not([type="range"])',
    )
    const rangeInput = container.querySelector<HTMLInputElement>(
      '.control-field input[type="range"]',
    )

    expect(textInput).not.toBeNull()
    expect(rangeInput).not.toBeNull()

    textInput?.focus()
    await user.keyboard('{Delete}')
    expect(container.querySelectorAll('.timeline-editor__card')).toHaveLength(1)

    rangeInput?.focus()
    await user.keyboard('{Delete}')
    expect(container.querySelectorAll('.timeline-editor__card')).toHaveLength(1)

    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    editable.tabIndex = 0
    document.body.append(editable)
    editable.focus()
    await user.keyboard('{Delete}')
    expect(container.querySelectorAll('.timeline-editor__card')).toHaveLength(1)
    editable.remove()
  })

  it('edits and resets only the selected card parameters', () => {
    render(<Workbench idFactory={vi.fn()
      .mockReturnValueOnce('first-card')
      .mockReturnValueOnce('second-card')} />)
    const video = loadVideo(10)
    const track = screen.getByTestId('timeline-track')
    mockTimelineRect(track)
    dropMotion(track, 'metric-focus', 100)
    dropMotion(track, 'metric-focus', 100)
    const stableVideo = screen.getByTestId('presenter-video')
    const cardButtons = screen.getAllByRole('button', {
      name: '选择核心指标片段，可用左右方向键微调时间',
    })

    fireEvent.change(screen.getByLabelText('核心数值'), {
      target: { value: '320' },
    })
    fireEvent.click(cardButtons[0])
    expect(screen.getByLabelText('核心数值')).toHaveValue('248')
    fireEvent.change(screen.getByLabelText('核心数值'), {
      target: { value: '111' },
    })
    fireEvent.click(cardButtons[1])
    expect(screen.getByLabelText('核心数值')).toHaveValue('320')
    fireEvent.click(screen.getByRole('button', { name: '恢复默认' }))
    expect(screen.getByLabelText('核心数值')).toHaveValue('248')
    fireEvent.click(cardButtons[0])
    expect(screen.getByLabelText('核心数值')).toHaveValue('111')
    expect(screen.getByTestId('presenter-video')).toBe(stableVideo)
    expect(video).toBe(stableVideo)
  })

  it('moves, resizes, and deletes the selected timeline card', () => {
    render(<Workbench idFactory={() => 'editable-card'} />)
    loadVideo(10)
    const track = screen.getByTestId('timeline-track')
    mockTimelineRect(track)
    dropMotion(track, 'metric-focus', 180)
    const body = screen.getByRole('button', {
      name: '选择核心指标片段，可用左右方向键微调时间',
    })
    const startHandle = screen.getByRole('button', {
      name: '调整核心指标片段开始时间',
    })
    const endHandle = screen.getByRole('button', {
      name: '调整核心指标片段结束时间',
    })

    firePointer(body, 'pointerdown', 1, 100)
    firePointer(track, 'pointermove', 1, 180)
    firePointer(track, 'pointerup', 1, 180)
    expect(body.parentElement).toHaveStyle({ left: '40%', width: '30%' })

    firePointer(startHandle, 'pointerdown', 2, 100)
    firePointer(track, 'pointermove', 2, 140)
    firePointer(track, 'pointerup', 2, 140)
    expect(body.parentElement).toHaveStyle({ left: '50%', width: '20%' })

    firePointer(endHandle, 'pointerdown', 3, 100)
    firePointer(track, 'pointermove', 3, 140)
    firePointer(track, 'pointerup', 3, 140)
    expect(body.parentElement).toHaveStyle({ left: '50%', width: '30%' })

    fireEvent.click(screen.getByRole('button', { name: '删除选中片段' }))
    expect(
      screen.queryByRole('button', {
        name: '选择核心指标片段，可用左右方向键微调时间',
      }),
    ).not.toBeInTheDocument()
  })

  it('updates preview position and synchronizes media time, duration, and seeking', () => {
    render(<Workbench idFactory={() => 'position-card'} />)
    const video = loadVideo(10)
    const track = screen.getByTestId('timeline-track')
    mockTimelineRect(track)
    dropMotion(track, 'metric-focus', 100)
    const stage = screen.getByTestId('preview-stage')
    const overlay = screen.getByTestId('overlay-card-position-card')
    vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 960,
      bottom: 540,
      width: 960,
      height: 540,
      toJSON: () => ({}),
    })

    firePointer(overlay, 'pointerdown', 1, 0, 0)
    firePointer(stage, 'pointermove', 1, 192, 108)
    firePointer(stage, 'pointerup', 1, 192, 108)
    expect(screen.getByTestId('overlay-card-position-card')).toHaveStyle({
      transform: 'translate(20%, 20%)',
    })

    video.currentTime = 3
    fireEvent.timeUpdate(video)
    expect(screen.getByTestId('timeline-playhead')).toHaveStyle({ left: '30%' })
    fireEvent.click(track, { clientX: 300 })
    expect(video.currentTime).toBe(5)
  })

  it('keeps active timeline cards visible after switching the parameter panel to rail mode', () => {
    render(<Workbench idFactory={() => 'timeline-card'} />)
    const video = loadVideo(10)
    const track = screen.getByTestId('timeline-track')
    mockTimelineRect(track)
    dropMotion(track, 'metric-focus', 100)
    const card = screen.getByRole('button', {
      name: '选择核心指标片段，可用左右方向键微调时间',
    })
    const overlay = screen.getByTestId('overlay-card-timeline-card')

    fireEvent.click(screen.getByRole('button', { name: '选择组件对比卡片' }))
    expect(card).toHaveAttribute('aria-pressed', 'false')
    expect(document.querySelectorAll('.timeline-editor__card')).toHaveLength(1)
    expect(screen.getByTestId('overlay-card-timeline-card')).toBe(overlay)
    expect(screen.queryByText('提升 2.05 倍')).not.toBeInTheDocument()

    video.currentTime = 4
    fireEvent.timeUpdate(video)
    expect(screen.queryByTestId('overlay-card-timeline-card')).not.toBeInTheDocument()
    video.currentTime = 1
    fireEvent.timeUpdate(video)
    expect(screen.getByTestId('overlay-card-timeline-card')).toBeInTheDocument()

    fireEvent.click(card)
    expect(screen.getByLabelText('核心数值')).toHaveValue('248')
    expect(card).toHaveAttribute('aria-pressed', 'true')
  })

  it('replays and parameter-remounts only the selected timeline card', () => {
    const ids = ['stable-card', 'selected-card']
    render(<Workbench idFactory={() => ids.shift() ?? 'unused'} />)
    loadVideo(10)
    const track = screen.getByTestId('timeline-track')
    mockTimelineRect(track)
    dropMotion(track, 'metric-focus', 100)
    dropMotion(track, 'metric-focus', 100)

    const stableOverlay = screen.getByTestId('overlay-card-stable-card')
    let selectedOverlay = screen.getByTestId('overlay-card-selected-card')

    fireEvent.click(screen.getByRole('button', { name: '重新播放' }))
    expect(screen.getByTestId('overlay-card-stable-card')).toBe(stableOverlay)
    expect(screen.getByTestId('overlay-card-selected-card')).not.toBe(selectedOverlay)

    selectedOverlay = screen.getByTestId('overlay-card-selected-card')
    fireEvent.change(screen.getByLabelText('核心数值'), {
      target: { value: '320' },
    })
    expect(screen.getByTestId('overlay-card-stable-card')).toBe(stableOverlay)
    expect(screen.getByTestId('overlay-card-selected-card')).not.toBe(selectedOverlay)

    selectedOverlay = screen.getByTestId('overlay-card-selected-card')
    fireEvent.click(screen.getByRole('button', { name: '恢复默认' }))
    expect(screen.getByTestId('overlay-card-stable-card')).toBe(stableOverlay)
    expect(screen.getByTestId('overlay-card-selected-card')).not.toBe(selectedOverlay)
  })

  it('atomically creates unique cards with increasing z-index from same-batch drops', () => {
    const ids = ['duplicate', 'duplicate', '', '   ']
    render(<Workbench idFactory={() => ids.shift() ?? ''} />)
    loadVideo(10)
    const track = screen.getByTestId('timeline-track')
    mockTimelineRect(track)

    act(() => {
      track.dispatchEvent(createMotionDropEvent('metric-focus', 100))
      track.dispatchEvent(createMotionDropEvent('metric-focus', 100))
      track.dispatchEvent(createMotionDropEvent('metric-focus', 100))
      track.dispatchEvent(createMotionDropEvent('metric-focus', 100))
    })

    const overlays = screen.getAllByTestId(/^overlay-card-/)
    const cardIds = overlays.map((overlay) => overlay.dataset.overlayCardId ?? '')
    expect(new Set(cardIds).size).toBe(4)
    expect(cardIds.every((id) => id.trim().length > 0)).toBe(true)
    expect(overlays.map((overlay) => overlay.style.zIndex)).toEqual([
      '0',
      '1',
      '2',
      '3',
    ])
  })

  it('atomically imports a valid project without replacing or resetting the video', async () => {
    render(<Workbench idFactory={() => 'old-card'} />)
    const video = loadVideo(10)
    const originalSource = video.getAttribute('src')
    const track = screen.getByTestId('timeline-track')
    mockTimelineRect(track)
    dropMotion(track, 'metric-focus', 100)
    fireEvent.click(screen.getByRole('button', { name: '重新播放' }))
    video.currentTime = 1
    fireEvent.timeUpdate(video)

    fireEvent.change(screen.getByLabelText('选择 JSON 项目文件'), {
      target: {
        files: [
          jsonProjectFile({
            version: 1,
            canvas: { width: 1920, height: 1080 },
            cards: [
              {
                id: 'imported-card',
                motionId: 'compare-split',
                start: 0,
                end: 3,
                position: { x: 10, y: 20 },
                zIndex: 4,
                params: { title: '导入项目' },
              },
            ],
          }),
        ],
      },
    })

    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: '选择对比卡片片段，可用左右方向键微调时间',
        }),
      ).toBeInTheDocument(),
    )
    expect(
      screen.queryByRole('button', {
        name: '选择核心指标片段，可用左右方向键微调时间',
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: '选择对比卡片片段，可用左右方向键微调时间',
      }),
    ).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('presenter-video')).toBe(video)
    expect(video.getAttribute('src')).toBe(originalSource)
    expect(video.currentTime).toBe(1)
    expect(screen.getByTestId('timeline-playhead')).toHaveStyle({ left: '10%' })

    const importedOverlay = screen.getByTestId('overlay-card-imported-card')
    fireEvent.click(
      screen.getByRole('button', {
        name: '选择对比卡片片段，可用左右方向键微调时间',
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: '重新播放' }))
    expect(screen.getByTestId('overlay-card-imported-card')).not.toBe(
      importedOverlay,
    )
  })

  it('keeps current cards and shows the unified alert for an invalid project', async () => {
    render(<Workbench idFactory={() => 'existing-card'} />)
    loadVideo(10)
    const track = screen.getByTestId('timeline-track')
    mockTimelineRect(track)
    dropMotion(track, 'metric-focus', 100)

    fireEvent.change(screen.getByLabelText('选择 JSON 项目文件'), {
      target: {
        files: [
          jsonProjectFile({
            version: 1,
            canvas: { width: 1920, height: 1080 },
            cards: [
              {
                id: 'unknown-card',
                motionId: 'unknown-motion',
                start: 0,
                end: 3,
                position: { x: 0, y: 0 },
                zIndex: 0,
                params: {},
              },
            ],
          }),
        ],
      },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'JSON 项目格式无效',
    )
    expect(
      screen.getByRole('button', {
        name: '选择核心指标片段，可用左右方向键微调时间',
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '选择unknown-motion片段' }),
    ).not.toBeInTheDocument()
  })

  it('exports only the version, canvas, and overlay cards', async () => {
    const createElement = vi.spyOn(document, 'createElement')
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined,
    )
    render(<Workbench idFactory={() => 'export-card'} />)
    loadVideo(10)
    const track = screen.getByTestId('timeline-track')
    mockTimelineRect(track)
    dropMotion(track, 'metric-focus', 100)

    fireEvent.click(screen.getByRole('button', { name: '导出 JSON' }))

    const blob = createObjectURL.mock.calls.at(-1)?.[0] as Blob
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsText(blob)
    })
    const exported = JSON.parse(text) as Record<string, unknown>
    expect(Object.keys(exported)).toEqual(['version', 'canvas', 'cards'])
    expect(exported).toMatchObject({
      version: 1,
      canvas: { width: 1920, height: 1080 },
    })
    expect(JSON.stringify(exported)).not.toContain('blob:local-video-preview')
    expect(
      Object.keys((exported.cards as Array<Record<string, unknown>>)[0]),
    ).toEqual([
      'id',
      'motionId',
      'start',
      'end',
      'position',
      'zIndex',
      'params',
    ])
    const clickedAnchor = createElement.mock.results
      .filter((_result, index) => createElement.mock.calls[index][0] === 'a')
      .map((result) => result.value as HTMLAnchorElement)
      .at(-1)
    expect(clickedAnchor?.download).toBe('overlay-studio-project.json')
  })
})

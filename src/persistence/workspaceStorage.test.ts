import 'fake-indexeddb/auto'
import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, describe, expect, it } from 'vitest'
import type { MotionId, ParameterValues } from '../motion/types'
import type { OverlayProject } from '../timeline/types'
import {
  createWorkspaceStorage,
  parsePersistedVideo,
  parsePersistedWorkspace,
  type PersistedVideoV1,
  type PersistedWorkspaceV1,
} from './workspaceStorage'

const databaseNames: string[] = []

const defaultsByMotion: Record<MotionId, ParameterValues> = {
  'narrative': { label: '默认叙述', value: 0 },
  'metric-focus': { label: '默认指标', value: 10 },
  'compare-split': { label: '默认对比', value: 20 },
  'profile-reveal': { label: '默认人物', value: 30 },
  'bar-compare': { label: '默认柱状', value: 40 },
  'share-ring': { label: '默认占比', value: 50 },
  'step-flow': { label: '默认步骤', value: 60 },
}

const project: OverlayProject = {
  version: 1,
  canvas: { width: 1920, height: 1080 },
  cards: [
    {
      id: 'card-1',
      motionId: 'metric-focus',
      start: 0,
      end: 3,
      position: { x: 12, y: 8 },
      zIndex: 0,
      params: { label: '已保存指标', value: 88 },
    },
  ],
}

function createWorkspace(
  overrides: Partial<PersistedWorkspaceV1> = {},
): PersistedWorkspaceV1 {
  return {
    version: 1,
    project,
    parametersByMotion: structuredClone(defaultsByMotion),
    activeId: 'metric-focus',
    showSafeArea: true,
    video: { present: false },
    ...overrides,
  }
}

function createVideo(name = 'sample.mp4'): PersistedVideoV1 {
  return {
    version: 1,
    blob: new NodeBlob(['video-bytes'], {
      type: 'video/mp4',
    }) as unknown as Blob,
    name,
    type: 'video/mp4',
    lastModified: 123,
  }
}

function createStorage() {
  const databaseName = `overlay-studio-test-${crypto.randomUUID()}`
  databaseNames.push(databaseName)
  return createWorkspaceStorage(databaseName)
}

async function deleteDatabase(databaseName: string) {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('database deletion blocked'))
  })
}

afterEach(async () => {
  await Promise.all(databaseNames.splice(0).map(deleteDatabase))
})

describe('workspace storage', () => {
  it('loads an empty database and saves a workspace snapshot', async () => {
    const storage = createStorage()
    const workspace = createWorkspace()

    expect(await storage.load()).toEqual({ workspace: null, video: null })

    await storage.saveWorkspace(workspace)

    expect(await storage.load()).toEqual({ workspace, video: null })
  })

  it('commits, removes, and clears video and workspace records', async () => {
    const storage = createStorage()
    const video = createVideo()
    const workspaceWithVideo = createWorkspace({
      video: {
        present: true,
        name: video.name,
        type: video.type,
        lastModified: video.lastModified,
      },
    })

    await storage.commitVideo(video, workspaceWithVideo)

    const committed = await storage.load()
    expect(committed.workspace).toEqual(workspaceWithVideo)
    expect(committed.video).toMatchObject({
      version: 1,
      name: 'sample.mp4',
      type: 'video/mp4',
      lastModified: 123,
    })
    expect(committed.video?.blob.size).toBe(video.blob.size)

    const workspaceWithoutVideo = createWorkspace()
    await storage.removeVideo(workspaceWithoutVideo)

    expect(await storage.load()).toEqual({
      workspace: workspaceWithoutVideo,
      video: null,
    })

    await storage.clear()

    expect(await storage.load()).toEqual({ workspace: null, video: null })
  })

  it('rolls back a video commit when one store write cannot be cloned', async () => {
    const storage = createStorage()
    const original = createWorkspace()
    await storage.saveWorkspace(original)
    const invalidVideo = {
      ...createVideo(),
      blob: (() => undefined) as unknown as Blob,
    }

    await expect(
      storage.commitVideo(
        invalidVideo,
        createWorkspace({
          activeId: 'compare-split',
          video: { present: true, name: 'broken.mp4' },
        }),
      ),
    ).rejects.toBeDefined()

    expect(await storage.load()).toEqual({ workspace: original, video: null })
  })

  it('rolls back video removal when the replacement workspace cannot be cloned', async () => {
    const storage = createStorage()
    const video = createVideo()
    const original = createWorkspace({
      video: { present: true, name: video.name, type: video.type },
    })
    await storage.commitVideo(video, original)
    const invalidWorkspace = {
      ...createWorkspace(),
      parametersByMotion: (() => undefined),
    } as unknown as PersistedWorkspaceV1

    await expect(storage.removeVideo(invalidWorkspace)).rejects.toBeDefined()

    const restored = await storage.load()
    expect(restored.workspace).toEqual(original)
    expect(restored.video?.name).toBe(video.name)
  })
})

describe('parsePersistedWorkspace', () => {
  it('validates a snapshot and merges missing parameter defaults', () => {
    const candidate = createWorkspace({
      parametersByMotion: {
        ...structuredClone(defaultsByMotion),
        'metric-focus': { value: 99 },
      },
    })

    const parsed = parsePersistedWorkspace(candidate, defaultsByMotion)

    expect(parsed.parametersByMotion['metric-focus']).toEqual({
      label: '默认指标',
      value: 99,
    })
    expect(parsed.project.cards[0]).toMatchObject({
      motionId: 'metric-focus',
      params: { label: '已保存指标', value: 88 },
    })
  })

  it.each([
    ['bad version', { ...createWorkspace(), version: 2 }],
    ['unknown active motion', { ...createWorkspace(), activeId: 'unknown' }],
    [
      'wrong parameter type',
      {
        ...createWorkspace(),
        parametersByMotion: {
          ...structuredClone(defaultsByMotion),
          'metric-focus': { label: '指标', value: '99' },
        },
      },
    ],
    [
      'unknown parameter key',
      {
        ...createWorkspace(),
        parametersByMotion: {
          ...structuredClone(defaultsByMotion),
          'metric-focus': { label: '指标', value: 99, extra: 'no' },
        },
      },
    ],
    [
      'invalid video metadata',
      {
        ...createWorkspace(),
        video: { present: 'yes' },
      },
    ],
  ])('rejects %s with one Chinese format error', (_label, candidate) => {
    expect(() =>
      parsePersistedWorkspace(candidate, defaultsByMotion),
    ).toThrow('本地工作区数据无效')
  })
})

describe('parsePersistedVideo', () => {
  it('accepts a complete version-one video record', () => {
    const video = {
      version: 1,
      blob: new Blob(['video'], { type: 'video/mp4' }),
      name: '已保存视频.mp4',
      type: 'video/mp4',
      lastModified: 123,
    }

    expect(parsePersistedVideo(video)).toEqual(video)
  })

  it.each([
    null,
    { version: 2, blob: new Blob(), name: 'a.mp4', type: 'video/mp4', lastModified: 1 },
    { version: 1, blob: 'broken', name: 'a.mp4', type: 'video/mp4', lastModified: 1 },
    { version: 1, blob: new Blob(), name: '', type: 'video/mp4', lastModified: 1 },
    { version: 1, blob: new Blob(), name: 'a.mp4', type: '', lastModified: -1 },
  ])('rejects invalid video records', (video) => {
    expect(() => parsePersistedVideo(video)).toThrow('本地工作区数据无效')
  })
})

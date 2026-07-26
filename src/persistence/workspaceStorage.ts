import { isMotionId, type MotionId, type ParameterValues } from '../motion/types'
import { parseOverlayProject } from '../timeline/project'
import type { OverlayProject } from '../timeline/types'

const DATABASE_VERSION = 1
const WORKSPACE_STORE = 'workspace'
const ASSETS_STORE = 'assets'
const WORKSPACE_KEY = 'current'
const VIDEO_KEY = 'video'
const INVALID_WORKSPACE_MESSAGE = '本地工作区数据无效'

export interface PersistedWorkspaceV1 {
  version: 1
  project: OverlayProject
  parametersByMotion: Record<MotionId, ParameterValues>
  activeId: MotionId
  showSafeArea: boolean
  video: {
    present: boolean
    name?: string
    type?: string
    lastModified?: number
  }
}

export interface PersistedVideoV1 {
  version: 1
  blob: Blob
  name: string
  type: string
  lastModified: number
}

export interface WorkspaceStorage {
  load(): Promise<{
    workspace: PersistedWorkspaceV1 | null
    video: PersistedVideoV1 | null
  }>
  saveWorkspace(workspace: PersistedWorkspaceV1): Promise<void>
  commitVideo(
    video: PersistedVideoV1,
    workspace: PersistedWorkspaceV1,
  ): Promise<void>
  removeVideo(workspace: PersistedWorkspaceV1): Promise<void>
  clear(): Promise<void>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  )
}

function invalidWorkspace(): never {
  throw new Error(INVALID_WORKSPACE_MESSAGE)
}

function parseParametersByMotion(
  value: unknown,
  defaults: Record<MotionId, ParameterValues>,
) {
  if (!isRecord(value)) {
    invalidWorkspace()
  }

  for (const motionId of Object.keys(value)) {
    if (!isMotionId(motionId)) {
      invalidWorkspace()
    }
  }

  return Object.fromEntries(
    Object.entries(defaults).map(([motionId, motionDefaults]) => {
      const candidate = value[motionId]
      if (candidate !== undefined && !isRecord(candidate)) {
        invalidWorkspace()
      }

      const overrides = candidate ?? {}
      for (const [key, parameterValue] of Object.entries(overrides)) {
        if (
          !Object.prototype.hasOwnProperty.call(motionDefaults, key) ||
          (typeof parameterValue !== 'string' &&
            typeof parameterValue !== 'number') ||
          typeof parameterValue !== typeof motionDefaults[key]
        ) {
          invalidWorkspace()
        }
      }

      return [motionId, { ...motionDefaults, ...overrides }]
    }),
  ) as Record<MotionId, ParameterValues>
}

function parseVideoMetadata(value: unknown): PersistedWorkspaceV1['video'] {
  if (!isRecord(value) || typeof value.present !== 'boolean') {
    invalidWorkspace()
  }

  if (
    (value.name !== undefined && typeof value.name !== 'string') ||
    (value.type !== undefined && typeof value.type !== 'string') ||
    (value.lastModified !== undefined &&
      (typeof value.lastModified !== 'number' ||
        !Number.isFinite(value.lastModified) ||
        value.lastModified < 0))
  ) {
    invalidWorkspace()
  }

  return {
    present: value.present,
    ...(value.name === undefined ? {} : { name: value.name }),
    ...(value.type === undefined ? {} : { type: value.type }),
    ...(value.lastModified === undefined
      ? {}
      : { lastModified: value.lastModified }),
  }
}

export function parsePersistedWorkspace(
  value: unknown,
  defaults: Record<MotionId, ParameterValues>,
): PersistedWorkspaceV1 {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.activeId !== 'string' ||
    !isMotionId(value.activeId) ||
    typeof value.showSafeArea !== 'boolean'
  ) {
    invalidWorkspace()
  }

  let project: OverlayProject
  try {
    project = parseOverlayProject(JSON.stringify(value.project), defaults)
  } catch {
    invalidWorkspace()
  }

  return {
    version: 1,
    project,
    parametersByMotion: parseParametersByMotion(
      value.parametersByMotion,
      defaults,
    ),
    activeId: value.activeId,
    showSafeArea: value.showSafeArea,
    video: parseVideoMetadata(value.video),
  }
}

export function parsePersistedVideo(value: unknown): PersistedVideoV1 {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !(value.blob instanceof Blob) ||
    typeof value.name !== 'string' ||
    value.name.trim() === '' ||
    typeof value.type !== 'string' ||
    value.type.trim() === '' ||
    typeof value.lastModified !== 'number' ||
    !Number.isFinite(value.lastModified) ||
    value.lastModified < 0
  ) {
    invalidWorkspace()
  }

  return {
    version: 1,
    blob: value.blob,
    name: value.name,
    type: value.type,
    lastModified: value.lastModified,
  }
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  })
}

function openDatabase(databaseName: string) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }

    const request = indexedDB.open(databaseName, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(WORKSPACE_STORE)) {
        database.createObjectStore(WORKSPACE_STORE)
      }
      if (!database.objectStoreNames.contains(ASSETS_STORE)) {
        database.createObjectStore(ASSETS_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
    request.onblocked = () => reject(new Error('IndexedDB open blocked'))
  })
}

async function withDatabase<T>(
  databaseName: string,
  operation: (database: IDBDatabase) => Promise<T>,
) {
  const database = await openDatabase(databaseName)
  try {
    return await operation(database)
  } finally {
    database.close()
  }
}

function abortAfterSynchronousFailure(
  transaction: IDBTransaction,
  completion: Promise<void>,
  error: unknown,
): Promise<never> {
  try {
    transaction.abort()
  } catch {
    // The transaction may already be inactive. Preserve the original error.
  }
  return completion.catch(() => undefined).then(() => Promise.reject(error))
}

export function createWorkspaceStorage(
  databaseName = 'overlay-studio',
): WorkspaceStorage {
  return {
    load: () =>
      withDatabase(databaseName, async (database) => {
        const transaction = database.transaction(
          [WORKSPACE_STORE, ASSETS_STORE],
          'readonly',
        )
        const completion = transactionDone(transaction)
        const workspaceRequest = transaction
          .objectStore(WORKSPACE_STORE)
          .get(WORKSPACE_KEY)
        const videoRequest = transaction.objectStore(ASSETS_STORE).get(VIDEO_KEY)
        const [workspace, video] = await Promise.all([
          requestResult(workspaceRequest),
          requestResult(videoRequest),
          completion,
        ])

        return {
          workspace: (workspace as PersistedWorkspaceV1 | undefined) ?? null,
          video: (video as PersistedVideoV1 | undefined) ?? null,
        }
      }),

    saveWorkspace: (workspace) =>
      withDatabase(databaseName, async (database) => {
        const transaction = database.transaction(WORKSPACE_STORE, 'readwrite')
        const completion = transactionDone(transaction)
        try {
          transaction.objectStore(WORKSPACE_STORE).put(workspace, WORKSPACE_KEY)
        } catch (error) {
          return abortAfterSynchronousFailure(transaction, completion, error)
        }
        await completion
      }),

    commitVideo: (video, workspace) =>
      withDatabase(databaseName, async (database) => {
        const transaction = database.transaction(
          [WORKSPACE_STORE, ASSETS_STORE],
          'readwrite',
        )
        const completion = transactionDone(transaction)
        try {
          transaction.objectStore(WORKSPACE_STORE).put(workspace, WORKSPACE_KEY)
          transaction.objectStore(ASSETS_STORE).put(video, VIDEO_KEY)
        } catch (error) {
          return abortAfterSynchronousFailure(transaction, completion, error)
        }
        await completion
      }),

    removeVideo: (workspace) =>
      withDatabase(databaseName, async (database) => {
        const transaction = database.transaction(
          [WORKSPACE_STORE, ASSETS_STORE],
          'readwrite',
        )
        const completion = transactionDone(transaction)
        try {
          transaction.objectStore(ASSETS_STORE).delete(VIDEO_KEY)
          transaction.objectStore(WORKSPACE_STORE).put(workspace, WORKSPACE_KEY)
        } catch (error) {
          return abortAfterSynchronousFailure(transaction, completion, error)
        }
        await completion
      }),

    clear: () =>
      withDatabase(databaseName, async (database) => {
        const transaction = database.transaction(
          [WORKSPACE_STORE, ASSETS_STORE],
          'readwrite',
        )
        const completion = transactionDone(transaction)
        transaction.objectStore(WORKSPACE_STORE).clear()
        transaction.objectStore(ASSETS_STORE).clear()
        await completion
      }),
  }
}

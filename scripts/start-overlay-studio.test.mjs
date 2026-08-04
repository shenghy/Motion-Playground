import { describe, expect, it, vi } from 'vitest'
import { spawn } from 'node:child_process'
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  acquireStartupLock,
  buildBrowserCommand,
  chooseLauncherTarget,
  createProjectId,
  ensureProjectReady,
  findRunningOverlayStudio,
  startOverlayStudio,
} from './start-overlay-studio.mjs'
import {
  createLocalStaticServer,
  findAvailablePort,
} from './local-server.mjs'

describe('Overlay Studio launcher', () => {
  it('uses the native browser opener for each platform', () => {
    const url = 'http://127.0.0.1:4173/'

    expect(buildBrowserCommand('win32', url)).toEqual({
      command: 'cmd',
      args: ['/c', 'start', '', url],
    })
    expect(buildBrowserCommand('darwin', url)).toEqual({
      command: 'open',
      args: [url],
    })
    expect(buildBrowserCommand('linux', url)).toEqual({
      command: 'xdg-open',
      args: [url],
    })
  })

  it('installs dependencies only when node_modules is missing and always builds', () => {
    const run = vi.fn()

    ensureProjectReady({
      projectRoot: 'project',
      exists: () => false,
      run,
    })

    expect(run.mock.calls.map(([command]) => command)).toEqual([
      'npm install',
      'npm run build',
    ])
  })

  it('skips installation when dependencies already exist', () => {
    const run = vi.fn()

    ensureProjectReady({
      projectRoot: 'project',
      exists: () => true,
      run,
    })

    expect(run).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenCalledWith('npm run build', 'project')
  })

  it('surfaces the failed preparation command in Chinese', () => {
    const run = vi.fn((command) => {
      if (command === 'npm run build') {
        throw new Error('exit 1')
      }
    })

    expect(() =>
      ensureProjectReady({
        projectRoot: 'project',
        exists: () => true,
        run,
      }),
    ).toThrow('项目构建失败')
  })

  it('reuses the saved localhost origin when Overlay Studio is already running', async () => {
    const probe = vi.fn(async (_host, port) => port === 4180)
    const findPort = vi.fn()

    await expect(
      chooseLauncherTarget({
        host: '127.0.0.1',
        startPort: 4173,
        endPort: 4192,
        savedPort: 4180,
        probe,
        findPort,
      }),
    ).resolves.toEqual({
      port: 4180,
      url: 'http://127.0.0.1:4180/',
      reused: true,
    })
    expect(findPort).not.toHaveBeenCalled()
  })

  it('prefers the saved port for a new server and falls back if it is occupied', async () => {
    const probe = vi.fn(async () => false)
    const findPort = vi
      .fn()
      .mockRejectedValueOnce(new Error('occupied'))
      .mockResolvedValueOnce(4181)

    await expect(
      chooseLauncherTarget({
        host: '127.0.0.1',
        startPort: 4173,
        endPort: 4192,
        savedPort: 4180,
        probe,
        findPort,
      }),
    ).resolves.toEqual({
      port: 4181,
      url: 'http://127.0.0.1:4181/',
      reused: false,
    })
    expect(findPort.mock.calls).toEqual([
      ['127.0.0.1', 4180, 4180],
      ['127.0.0.1', 4173, 4192],
    ])
  })

  it('binds the status marker to the current project path', () => {
    expect(createProjectId('E:\\Code\\Motion-playground')).toBe(
      createProjectId('E:\\Code\\Motion-playground'),
    )
    expect(createProjectId('E:\\Code\\Motion-playground')).not.toBe(
      createProjectId('E:\\Code\\another-copy'),
    )
  })

  it('finds only a running Overlay Studio with the same project identity', async () => {
    const probe = vi.fn(
      async (_host, port, projectId) =>
        port === 4175 && projectId === 'project-a',
    )

    await expect(
      findRunningOverlayStudio({
        host: '127.0.0.1',
        startPort: 4173,
        endPort: 4176,
        savedPort: 4175,
        projectId: 'project-a',
        probe,
      }),
    ).resolves.toEqual({
      port: 4175,
      url: 'http://127.0.0.1:4175/',
      reused: true,
    })
    expect(probe).toHaveBeenCalledWith('127.0.0.1', 4175, 'project-a')
  })

  it('allows only one launcher to hold the project startup lock', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'overlay-lock-'))
    const lockPath = join(directory, 'startup.local')

    try {
      const firstRelease = await acquireStartupLock(lockPath)
      expect(firstRelease).toEqual(expect.any(Function))
      await expect(acquireStartupLock(lockPath)).resolves.toBeNull()

      await firstRelease()
      const secondRelease = await acquireStartupLock(lockPath)
      expect(secondRelease).toEqual(expect.any(Function))
      await secondRelease()
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('reports invalid startup mutex ports instead of waiting forever', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'overlay-lock-'))

    try {
      await expect(
        acquireStartupLock(
          join(directory, 'missing-directory', 'startup.local'),
          { port: 70_000 },
        ),
      ).rejects.toThrow()
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('builds the latest page before reusing an existing local service', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'overlay-build-'))
    const distDirectory = join(projectRoot, 'dist')
    const buildMarker = join(projectRoot, 'built.txt')
    let local

    try {
      await mkdir(join(projectRoot, 'node_modules'))
      await mkdir(distDirectory)
      await writeFile(join(distDirectory, 'index.html'), '<main>ready</main>')
      await writeFile(
        join(projectRoot, 'package.json'),
        JSON.stringify({
          scripts: {
            build:
              'node -e "require(\'node:fs\').writeFileSync(\'built.txt\', \'yes\')"',
          },
        }),
      )

      const port = await findAvailablePort('127.0.0.1', 4300, 4399)
      local = await createLocalStaticServer({
        rootDirectory: distDirectory,
        host: '127.0.0.1',
        port,
        projectId: createProjectId(projectRoot),
      })

      const result = await startOverlayStudio({
        projectRoot,
        startPort: port,
        endPort: port,
        noOpen: true,
      })

      expect(result.reused).toBe(true)
      await expect(readFile(buildMarker, 'utf8')).resolves.toBe('yes')
    } finally {
      await local?.close()
      await rm(projectRoot, { recursive: true, force: true })
    }
  })

  it('exposes transparent MOV capability from a newly started local editor', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'overlay-export-server-'))
    const distDirectory = join(projectRoot, 'dist')
    let local

    try {
      await mkdir(distDirectory)
      await writeFile(join(distDirectory, 'index.html'), '<main>ready</main>')
      const port = await findAvailablePort('127.0.0.1', 4400, 4499)

      local = await startOverlayStudio({
        projectRoot,
        startPort: port,
        endPort: port,
        noOpen: true,
        skipBuild: true,
      })

      const response = await fetch(
        `${local.url}__overlay_export__/capabilities`,
      )
      await expect(response.json()).resolves.toMatchObject({
        mov: true,
        width: 1920,
        height: 1080,
        fps: 30,
        rawRgba: true,
        transport: 'websocket',
      })
    } finally {
      await local?.close()
      await rm(projectRoot, { recursive: true, force: true })
    }
  })

  it('ignores obsolete on-disk lock files because the OS owns the mutex', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'overlay-lock-'))
    const lockPath = join(directory, 'startup.local')

    try {
      await writeFile(lockPath, 'obsolete lock from an older launcher')

      const release = await acquireStartupLock(lockPath)
      expect(release).toEqual(expect.any(Function))
      await release()
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('allows only one process to acquire the same OS startup mutex', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'overlay-lock-race-'))
    const lockPath = join(directory, 'startup.local')
    const resultPath = join(directory, 'owners.txt')
    const workerPath = join(directory, 'worker.mjs')
    const launcherUrl = pathToFileURL(
      resolve(process.cwd(), 'scripts/start-overlay-studio.mjs'),
    ).href

    try {
      await writeFile(
        lockPath,
        JSON.stringify({
          pid: 2147483647,
          token: 'stale-owner',
          createdAt: Date.now() - 60_000,
          processIdentity: 'dead-process',
        }),
      )
      await writeFile(
        workerPath,
        `
          import { appendFileSync } from 'node:fs'
          import { acquireStartupLock } from ${JSON.stringify(launcherUrl)}

          const [, , lockPath, resultPath, startAt] = process.argv
          while (Date.now() < Number(startAt)) {}
          const release = await acquireStartupLock(lockPath)
          if (release) {
            appendFileSync(resultPath, process.pid + '\\n')
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500)
            await release()
          }
        `,
      )

      const startAt = Date.now() + 600
      const workers = Array.from({ length: 8 }, () => {
        const child = spawn(process.execPath, [
          workerPath,
          lockPath,
          resultPath,
          String(startAt),
        ])
        return new Promise((resolveWorker, rejectWorker) => {
          let stderr = ''
          child.stderr.on('data', (chunk) => {
            stderr += chunk
          })
          child.once('error', rejectWorker)
          child.once('close', (code) => {
            if (code === 0) {
              resolveWorker()
            } else {
              rejectWorker(new Error(stderr || `worker exited with ${code}`))
            }
          })
        })
      })

      await Promise.all(workers)
      const owners = (await readFile(resultPath, 'utf8'))
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
      expect(owners).toHaveLength(1)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  }, 15_000)

  it('provides a Windows double-click wrapper with a Node check', async () => {
    const wrapper = await readFile(
      resolve(process.cwd(), '启动 Overlay Studio.bat'),
      'utf8',
    )

    expect(wrapper).toContain('where node')
    expect(wrapper).toContain('scripts\\start-overlay-studio.mjs')
    expect(wrapper).toContain('pause')
  })

  it('provides a macOS double-click wrapper with a Node check', async () => {
    const wrapper = await readFile(
      resolve(process.cwd(), '启动 Overlay Studio.command'),
      'utf8',
    )

    expect(wrapper).toContain('command -v node')
    expect(wrapper).toContain('scripts/start-overlay-studio.mjs')
    expect(wrapper).toContain('按回车键退出')
  })
})

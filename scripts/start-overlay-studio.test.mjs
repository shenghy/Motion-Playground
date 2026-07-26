import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  buildBrowserCommand,
  chooseLauncherTarget,
  ensureProjectReady,
} from './start-overlay-studio.mjs'

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

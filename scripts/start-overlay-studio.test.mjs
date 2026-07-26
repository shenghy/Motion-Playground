import { describe, expect, it, vi } from 'vitest'
import {
  buildBrowserCommand,
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
})

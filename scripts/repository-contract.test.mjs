import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

describe('repository contract', () => {
  it('documents setup, transparent export, verification, and troubleshooting', async () => {
    const readme = await readFile(join(root, 'README.md'), 'utf8')
    for (const heading of [
      '# Motion Playground',
      '## 安装与启动',
      '## 透明视频导出',
      '## 验证',
      '## 故障排查',
    ]) {
      expect(readme).toMatch(new RegExp(heading))
    }
  })

  it('pins direct dependencies to exact versions', async () => {
    const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
    const dependencies = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    }
    for (const version of Object.values(dependencies)) {
      expect(version).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/)
    }
  })

  it('runs install, test, visual, lint, and build gates on Windows CI', async () => {
    const workflow = await readFile(
      join(root, '.github', 'workflows', 'ci.yml'),
      'utf8',
    )
    for (const required of [
      'windows-latest',
      'npm ci',
      'npm test -- --run',
      'npm run test:visual',
      'npm run lint',
      'npm run build',
    ]) {
      expect(workflow).toContain(required)
    }
  })
})

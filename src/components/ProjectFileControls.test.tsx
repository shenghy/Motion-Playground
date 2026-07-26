import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import type { OverlayProject } from '../timeline/types'
import { ProjectFileControls } from './ProjectFileControls'

const project: OverlayProject = {
  version: 1,
  canvas: { width: 1920, height: 1080 },
  cards: [
    {
      id: 'export-card',
      motionId: 'metric-focus',
      start: 0,
      end: 3,
      position: { x: 12, y: 24 },
      zIndex: 0,
      params: { value: 248 },
    },
  ],
}

function jsonFile(text: string, name = 'project.json') {
  const file = new File([text], name, { type: 'application/json' })
  Object.defineProperty(file, 'text', {
    configurable: true,
    value: vi.fn().mockResolvedValue(text),
  })
  return file
}

function readBlob(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}

describe('ProjectFileControls', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('downloads the complete UTF-8 JSON project and always revokes its URL', async () => {
    let exportedBlob: Blob | undefined
    const createElement = vi.spyOn(document, 'createElement')
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      exportedBlob = blob as Blob
      return 'blob:overlay-project'
    })
    const revokeObjectURL = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined)
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined,
    )

    render(
      <ProjectFileControls
        project={project}
        onImport={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '导出 JSON' }))

    expect(exportedBlob).toBeDefined()
    expect(exportedBlob?.type).toBe('application/json;charset=utf-8')
    expect(await readBlob(exportedBlob as Blob)).toBe(
      JSON.stringify(project, null, 2),
    )
    const clickedAnchor = createElement.mock.results
      .filter((_result, index) => createElement.mock.calls[index][0] === 'a')
      .map((result) => result.value as HTMLAnchorElement)
      .at(-1)
    expect(clickedAnchor?.download).toBe('overlay-studio-project.json')
    expect(clickedAnchor?.href).toBe('blob:overlay-project')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:overlay-project')
  })

  it('passes valid file text to import and allows selecting the same file again', async () => {
    const onImport = vi.fn()
    const file = jsonFile('{"version":1}')
    render(<ProjectFileControls project={project} onImport={onImport} />)
    const input = screen.getByLabelText('选择 JSON 项目文件')

    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1))
    expect(onImport).toHaveBeenLastCalledWith('{"version":1}')
    expect(input).toHaveValue('')

    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(2))
  })

  it('shows a Chinese alert when reading the JSON file fails', async () => {
    const onImport = vi.fn()
    const file = new File(['broken'], 'broken.json', {
      type: 'application/json',
    })
    Object.defineProperty(file, 'text', {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error('disk failure')),
    })
    render(<ProjectFileControls project={project} onImport={onImport} />)

    fireEvent.change(screen.getByLabelText('选择 JSON 项目文件'), {
      target: { files: [file] },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '读取 JSON 文件失败',
    )
    expect(onImport).not.toHaveBeenCalled()
  })

  it('handles rejected async imports without an unhandled promise', async () => {
    const onImport = vi.fn().mockRejectedValue(new Error('import failure'))
    render(<ProjectFileControls project={project} onImport={onImport} />)

    fireEvent.change(screen.getByLabelText('选择 JSON 项目文件'), {
      target: { files: [jsonFile('{}')] },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '导入 JSON 项目失败',
    )
  })

  it('renders an external validation error as a live alert', () => {
    render(
      <ProjectFileControls
        project={project}
        error="JSON 项目格式无效"
        onImport={vi.fn()}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('JSON 项目格式无效')
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive')
  })
})

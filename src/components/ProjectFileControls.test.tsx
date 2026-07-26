import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
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

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function fileWithTextPromise(textPromise: Promise<string>) {
  const file = new File(['pending'], 'project.json', {
    type: 'application/json',
  })
  Object.defineProperty(file, 'text', {
    configurable: true,
    value: vi.fn(() => textPromise),
  })
  return file
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

  it('lets the latest file win when an earlier file read finishes later', async () => {
    const slowRead = deferred<string>()
    const onImport = vi.fn()
    render(<ProjectFileControls project={project} onImport={onImport} />)
    const input = screen.getByLabelText('选择 JSON 项目文件')

    fireEvent.change(input, {
      target: { files: [fileWithTextPromise(slowRead.promise)] },
    })
    fireEvent.change(input, {
      target: { files: [jsonFile('{"project":"B"}')] },
    })
    await waitFor(() =>
      expect(onImport).toHaveBeenCalledWith('{"project":"B"}'),
    )

    await act(async () => {
      slowRead.resolve('{"project":"A"}')
      await slowRead.promise
    })

    expect(onImport).toHaveBeenCalledTimes(1)
  })

  it('does not let an older rejected import overwrite the latest result', async () => {
    const slowImport = deferred<void>()
    const onImport = vi.fn((text: string) =>
      text === '{"project":"A"}' ? slowImport.promise : Promise.resolve(),
    )
    render(<ProjectFileControls project={project} onImport={onImport} />)
    const input = screen.getByLabelText('选择 JSON 项目文件')

    fireEvent.change(input, {
      target: { files: [jsonFile('{"project":"A"}')] },
    })
    await waitFor(() =>
      expect(onImport).toHaveBeenCalledWith('{"project":"A"}'),
    )
    fireEvent.change(input, {
      target: { files: [jsonFile('{"project":"B"}')] },
    })
    await waitFor(() =>
      expect(onImport).toHaveBeenCalledWith('{"project":"B"}'),
    )

    await act(async () => {
      slowImport.reject(new Error('stale failure'))
      await slowImport.promise.catch(() => undefined)
    })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each(['resolve', 'reject'] as const)(
    'ignores a pending file read that %s after unmount',
    async (settlement) => {
      const pendingRead = deferred<string>()
      const onImport = vi.fn()
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined)
      const { unmount } = render(
        <ProjectFileControls project={project} onImport={onImport} />,
      )

      fireEvent.change(screen.getByLabelText('选择 JSON 项目文件'), {
        target: { files: [fileWithTextPromise(pendingRead.promise)] },
      })
      unmount()
      await act(async () => {
        if (settlement === 'resolve') {
          pendingRead.resolve('{"project":"late"}')
        } else {
          pendingRead.reject(new Error('late read failure'))
        }
        await pendingRead.promise.catch(() => undefined)
      })

      expect(onImport).not.toHaveBeenCalled()
      expect(consoleError).not.toHaveBeenCalled()
    },
  )

  it('clears the input immediately so the same file can be selected while reading', () => {
    const pendingRead = deferred<string>()
    const file = fileWithTextPromise(pendingRead.promise)
    render(<ProjectFileControls project={project} onImport={vi.fn()} />)
    const input = screen.getByLabelText('选择 JSON 项目文件')
    Object.defineProperty(input, 'value', {
      configurable: true,
      writable: true,
      value: 'C:\\fakepath\\project.json',
    })

    fireEvent.change(input, { target: { files: [file] } })
    expect(input).toHaveValue('')

    Object.defineProperty(input, 'value', {
      configurable: true,
      writable: true,
      value: 'C:\\fakepath\\project.json',
    })
    fireEvent.change(input, { target: { files: [file] } })
    expect(file.text).toHaveBeenCalledTimes(2)
    expect(input).toHaveValue('')
  })

  it('clears a failed export alert after a successful retry and revokes both URLs', async () => {
    vi.spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('blob:throwing-export')
      .mockReturnValueOnce('blob:successful-export')
    const revokeObjectURL = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined)
    vi.spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementationOnce(() => {
        throw new Error('download failed')
      })
      .mockImplementationOnce(() => undefined)
    render(<ProjectFileControls project={project} onImport={vi.fn()} />)
    const exportButton = screen.getByRole('button', { name: '导出 JSON' })

    fireEvent.click(exportButton)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '导出 JSON 项目失败',
    )

    fireEvent.click(exportButton)
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    )
    expect(revokeObjectURL.mock.calls).toEqual([
      ['blob:throwing-export'],
      ['blob:successful-export'],
    ])
  })
})

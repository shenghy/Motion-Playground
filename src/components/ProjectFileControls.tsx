import { useEffect, useRef, useState } from 'react'
import type { OverlayProject } from '../timeline/types'

interface ProjectFileControlsProps {
  project: OverlayProject
  error?: string
  onImport: (text: string) => void | Promise<void>
}

export function ProjectFileControls({
  project,
  error,
  onImport,
}: ProjectFileControlsProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const requestTokenRef = useRef(0)
  const mountedRef = useRef(true)
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestTokenRef.current += 1
    }
  }, [])

  const isActiveRequest = (requestToken: number) =>
    mountedRef.current && requestTokenRef.current === requestToken

  const importFile = async (file: File, requestToken: number) => {
    let text: string
    try {
      text = await file.text()
    } catch {
      if (isActiveRequest(requestToken)) {
        setLocalError('读取 JSON 文件失败')
      }
      return
    }

    if (!isActiveRequest(requestToken)) {
      return
    }

    try {
      await onImport(text)
    } catch {
      if (isActiveRequest(requestToken)) {
        setLocalError('导入 JSON 项目失败')
      }
      return
    }

    if (!isActiveRequest(requestToken)) {
      return
    }
  }

  const exportProject = () => {
    setLocalError('')
    const blob = new Blob([JSON.stringify(project, null, 2)], {
      type: 'application/json;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)

    try {
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'overlay-studio-project.json'
      anchor.click()
    } catch {
      if (mountedRef.current) {
        setLocalError('导出 JSON 项目失败')
      }
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  const visibleError = localError || error

  return (
    <section className="project-file-controls" aria-label="项目文件">
      <div className="project-file-controls__heading">
        <span>项目文件</span>
        <small>JSON</small>
      </div>
      <div className="project-file-controls__actions">
        <input
          ref={inputRef}
          className="project-file-controls__input"
          type="file"
          accept="application/json,.json"
          aria-label="选择 JSON 项目文件"
          onChange={(event) => {
            const input = event.currentTarget
            const file = input.files?.[0]
            const requestToken = requestTokenRef.current + 1
            requestTokenRef.current = requestToken
            input.value = ''

            if (!file) {
              return
            }

            setLocalError('')
            void importFile(file, requestToken)
          }}
        />
        <button type="button" onClick={() => inputRef.current?.click()}>
          导入 JSON
        </button>
        <button type="button" onClick={exportProject}>
          导出 JSON
        </button>
      </div>
      {visibleError ? (
        <p
          className="project-file-controls__error"
          role="alert"
          aria-live="assertive"
        >
          {visibleError}
        </p>
      ) : null}
    </section>
  )
}

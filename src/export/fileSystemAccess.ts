export interface OverlayFileSystemWritable {
  write(data: Blob | BufferSource | string): Promise<void>
  close(): Promise<void>
  abort?(): Promise<void>
}

export interface OverlayFileSystemFileHandle {
  name: string
  createWritable(): Promise<OverlayFileSystemWritable>
}

export interface OverlayFileSystemDirectoryHandle {
  name: string
  getDirectoryHandle(
    name: string,
    options: { create: true },
  ): Promise<OverlayFileSystemDirectoryHandle>
  getFileHandle(
    name: string,
    options: { create: true },
  ): Promise<OverlayFileSystemFileHandle>
}

interface OverlayFileWindow {
  showSaveFilePicker?: (options?: unknown) => Promise<OverlayFileSystemFileHandle>
  showDirectoryPicker?: () => Promise<OverlayFileSystemDirectoryHandle>
}

export function supportsOverlayFileExport(
  windowObject: OverlayFileWindow = window as OverlayFileWindow,
) {
  return (
    typeof windowObject.showSaveFilePicker === 'function' &&
    typeof windowObject.showDirectoryPicker === 'function'
  )
}
